#!/usr/bin/env node
/**
 * Exports the triage of a Playwright run as JSON and XLSX: one row per failed or flaky test with a status
 * (automation bug | defect | flaky | need to review), where it failed, likelihood percentages per category and
 * steps to reproduce in plain language. No dependencies: the XLSX file is written with node:zlib.
 *
 * Usage (from the project root):
 *   node triage-report.mjs [input] [--out-dir reports/triage] [--name triage-report] [--overrides <file.json>]
 *
 * Input: a Playwright JSON report (default reports/results.json), a folder that contains one (a copied reports/
 * folder, a CI artifact) or a .zip archive of such a folder, unpacked to reports/unpacked/<archive name>/.
 *
 * Status: the category with the highest likelihood when it reaches 60%, otherwise "need to review".
 *
 * Steps to reproduce: numbered actions in plain language, then "Actual result:" and "Expected result:".
 * --overrides: a JSON object keyed by spec file:line (or the full test name) with reviewed `status`, percentages,
 * `stepsToReproduce`, `reason` or `testMethod`; applied to both files after the automatic triage.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { rebaseArtifactPath, resolveResultsInput } from './resolve-input.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const optionValues = new Set(['--out-dir', '--name', '--overrides'].map((name) => option(name)).filter(Boolean));
const input = args.find((a) => !a.startsWith('--') && !optionValues.has(a)) ?? 'reports/results.json';
const outDir = option('--out-dir', 'reports/triage');
const baseName = option('--name', 'triage-report');
const overridesFile = option('--overrides');

const STATUS_THRESHOLD = 60;
const STATUSES = { defect: 'defect', automation: 'automation bug', flaky: 'flaky', review: 'need to review' };

// eslint-disable-next-line no-control-regex
const stripAnsi = (s = '') => s.replace(/\u001b\[[0-9;]*m/g, '');
const rel = (p) => (p ? path.relative(process.cwd(), p) : p);

// ---------- evidence patterns ----------

const RATE_LIMIT = /\b429\b|rate limited|too many requests/i;
const RATE_LIMIT_LOG = /-> 429\b/;
const NETWORK = /ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|net::ERR_|socket hang up/i;
const TEST_CODE = /\b(TypeError|ReferenceError|SyntaxError|RangeError)\b|is not a function|Cannot read propert/;
const MISSING_NAME = /has no (field|button|checkbox|radio button|error|element) named "([^"]+)"/;
const STRICT = /strict mode violation/i;
const NOT_FOUND = /element\(s\) not found|waiting for (locator|getBy)/i;
const API_STATUS = /status code => (\d{3}), expected ([\d or]+)/;
/** Known behaviour of the demo backend (see the skill): asserting it is a test problem, not a new defect. */
const KNOWN_PRODUCT_BEHAVIOUR = /data and salt arguments required|Email not found sign in first/;
const PAGE_STEP = /^([A-Z]\w*)\.(\w+)\((.*)\)$/;
const API_STEP = /^API :: (\w+) :: (.+)$/;

// ---------- Playwright JSON report ----------

function* walkSuites(suites, titles = []) {
  for (const suite of suites ?? []) {
    const suiteTitles = suite.title && !suite.file?.endsWith(suite.title) ? [...titles, suite.title] : titles;
    for (const spec of suite.specs ?? [])
      for (const test of spec.tests ?? []) yield { spec, test, titles: suiteTitles };
    yield* walkSuites(suite.suites, suiteTitles);
  }
}

const messageOf = (result) =>
  stripAnsi(
    [...new Set([result.error, ...(result.errors ?? [])].filter(Boolean).map((e) => e.message ?? ''))].join('\n'),
  );

const logsOf = (result) =>
  (result.attachments ?? [])
    .filter((a) => a.name === 'logs' && a.body)
    .map((a) => Buffer.from(a.body, 'base64').toString())
    .join('\n');

/** Chain of failed steps from the outermost to the deepest. */
function failedStepChain(steps, chain = []) {
  const failed = (steps ?? []).find((step) => step.error);
  return failed ? failedStepChain(failed.steps, [...chain, failed]) : chain;
}

function snapshotIsBlank(result) {
  const context = (result.attachments ?? []).find((a) => a.path && /error-context/.test(a.name));
  const file = context && rebaseArtifactPath(context.path, artifactsRoot);
  if (!file || !fs.existsSync(file)) return false;
  const snapshot = fs.readFileSync(file, 'utf-8').match(/# Page snapshot\s*```(?:yaml)?\n([\s\S]*?)```/);
  return !snapshot || snapshot[1].split('\n').filter((line) => line.trim()).length < 5;
}

// ---------- classification ----------

function classify({ outcome, result, results, message, logs }) {
  const score = { defect: 0, automation: 0, flaky: 0 };
  const reasons = [];
  const add = (bucket, points, why) => {
    score[bucket] += points;
    if (!reasons.includes(why)) reasons.push(why);
  };

  if (outcome === 'flaky') add('flaky', 90, 'failed first and passed on retry');
  // A 429 or network error explains the missing element or timeout that follows it, so those are not extra evidence.
  const environment = RATE_LIMIT.test(message) || RATE_LIMIT_LOG.test(logs) || NETWORK.test(message);
  if (RATE_LIMIT.test(message) || RATE_LIMIT_LOG.test(logs))
    add('flaky', 85, 'the shared demo server answered HTTP 429 (rate limit)');
  if (NETWORK.test(message)) add('flaky', 75, 'network error while talking to the server');
  if (snapshotIsBlank(result)) add('flaky', 40, 'the page did not render (blank page snapshot)');
  if (
    results
      .filter((r) => r.status !== 'passed')
      .map(messageOf)
      .filter((m, i, all) => all.indexOf(m) === i).length > 1
  ) {
    add('flaky', 30, 'retries failed with different errors');
  }

  if (MISSING_NAME.test(message))
    add('automation', 95, 'the page object does not declare the element used by the test');
  else if (TEST_CODE.test(message)) add('automation', 85, 'script error in the test or framework code');

  const apiStatus = message.match(API_STATUS);
  if (STRICT.test(message)) add('automation', 80, 'the locator matches several elements');
  else if (NOT_FOUND.test(message) && !apiStatus && !environment) {
    add('automation', 50, 'element not found: the locator may be outdated after a UI change');
    add('defect', 25, 'the element may be missing from the page');
    add('flaky', 25, 'the page may not have finished loading');
  }
  if (result.status === 'timedOut' && !environment) {
    add('flaky', 40, 'the test ran out of time');
    add('automation', 20, 'the test may wait for the wrong condition');
  }

  if (apiStatus && Number(apiStatus[1]) !== 429) {
    const code = Number(apiStatus[1]);
    if (code >= 500) add('defect', 80, `the API answered ${code} (server error)`);
    else {
      add('defect', 45, `the API answered ${code} instead of ${apiStatus[2]}`);
      add('automation', 40, 'the request or the expected status in the test may be wrong');
    }
  }

  const valueMismatch = /^\s*Expected:/m.test(message) && /^\s*Received:/m.test(message) && !NOT_FOUND.test(message);
  if (valueMismatch) {
    add('defect', 55, 'the application showed or returned a different value than expected');
    add('automation', 35, 'the expected value in the test may be outdated');
    add('flaky', 10, 'data created by parallel tests may interfere');
  }
  if (KNOWN_PRODUCT_BEHAVIOUR.test(message))
    add('automation', 50, 'known demo-app behaviour that tests should not treat as a new defect');

  const total = score.defect + score.automation + score.flaky;
  const percent = { defect: 0, automation: 0, flaky: 0 };
  if (total) {
    for (const key of Object.keys(score)) percent[key] = Math.round((score[key] / total) * 100);
    // Rounding can leave 99 or 101: give the difference to the largest bucket so the three always add up to 100.
    const top = Object.keys(percent).sort((a, b) => percent[b] - percent[a])[0];
    percent[top] += 100 - (percent.defect + percent.automation + percent.flaky);
  }
  const [bestKey, bestValue] = Object.entries(percent).sort((a, b) => b[1] - a[1])[0];
  const status = total && bestValue >= STATUS_THRESHOLD ? STATUSES[bestKey] : STATUSES.review;
  if (!total) reasons.push('no known failure pattern — read the error, logs and trace');
  return { status, percent, reasons };
}

// ---------- plain-language steps ----------

/** The failed matcher itself — not code lines of the test quoted in the error's code frame. */
const EXPECT_VISIBLE = /^\s*Expected: visible$|^Error: expect\(locator\)\.toBeVisible\(\)/m;
const EXPECT_HIDDEN = /^\s*Expected: hidden$|^Error: expect\(locator\)\.toBeHidden\(\)/m;
const FRAMEWORK_CLOSED = /has been disposed|context disposed|Target page, context or browser has been closed/i;

const words = (camel) =>
  String(camel)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .trim();
const capitalize = (text) => text.replace(/^./, (c) => c.toUpperCase());
const label = (name) => capitalize(words(name));
/** Page objects named the way a user names the pages. */
const CLASS_PAGES = {
  HomePage: 'Home page',
  LoginPage: 'Login page',
  RegisterPage: 'Sign-up page',
  SettingsPage: 'Settings page',
  EditorPage: 'article editor',
  ArticlePage: 'Article page',
  ProfilePage: 'Profile page',
};
const pageName = (className) => CLASS_PAGES[className] ?? `${label(className.replace(/Page$/, ''))} page`;
const joinList = (items) =>
  items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}` : (items[0] ?? '');
const quotedLabels = (names) => joinList(names.map((name) => `"${label(name)}"`));

/** Hash routes of the app: the page a user opens and the page object that shows it. */
const ROUTE_PAGES = [
  [/^\/?$/, 'Home page', 'HomePage'],
  [/^\/login$/, 'Login page', 'LoginPage'],
  [/^\/register$/, 'Sign-up page', 'RegisterPage'],
  [/^\/settings$/, 'Settings page', 'SettingsPage'],
  [/^\/editor$/, 'new article editor', 'EditorPage'],
  [/^\/editor\/.+/, 'article editor', 'EditorPage'],
  [/^\/article\/.+/, 'Article page', 'ArticlePage'],
  [/^\/profile\/.+/, 'Profile page', 'ProfilePage'],
];

/** Parts of the application behind an API path, for simulated server responses. */
const API_FEATURES = [
  [/\/users\/login/, 'sign-in'],
  [/\/users\b/, 'registration'],
  [/\/user\b/, 'account settings'],
  [/\/comments/, 'comments'],
  [/\/favorite/, 'favorites'],
  [/\/articles/, 'articles'],
  [/\/profiles/, 'profiles'],
  [/\/tags/, 'tags'],
];

/** Names of the API steps of the endpoint helpers, as actions. */
const API_ACTIONS = [
  [/^login$/, 'Sign in as the test user'],
  [/^register user$/, 'Register a new user'],
  [/^current user$/, 'Load the signed-in user'],
  [/^create article$/, 'Create an article'],
  [/^update article$/, 'Update the article'],
  [/^delete article$/, 'Delete the article'],
  [/^get article$/, 'Load the article'],
  [/^list articles$/, 'Load the list of articles'],
  [/^favorite article$/, 'Mark the article as a favorite'],
  [/^add comment$/, 'Add a comment to the article'],
  [/^list comments$/, 'Load the comments of the article'],
  [/^delete comment$/, 'Delete the comment'],
];

const ROLE_NOUNS = {
  link: 'link',
  button: 'button',
  textbox: 'field',
  heading: 'heading',
  img: 'image',
  checkbox: 'checkbox',
  radio: 'option',
  tab: 'tab',
  combobox: 'drop-down list',
  listitem: 'list item',
  dialog: 'dialog',
};
const ROLE_AREAS = {
  navigation: 'in the header',
  banner: 'in the header',
  main: 'in the main area',
  form: 'in the form',
};
const TAG_NOUNS = {
  h1: 'heading',
  h2: 'heading',
  li: 'item',
  a: 'link',
  button: 'button',
  input: 'field',
  textarea: 'field',
  img: 'image',
};
const LOCATOR_CALL =
  /(getByRole|getByPlaceholder|getByLabel|getByText|getByTestId|locator)\(((?:[^()'"`]|'[^']*'|"[^"]*"|`[^`]*`|\([^()]*\))*)\)/g;

/** Splits an argument list at top-level commas; commas inside quotes, brackets and braces stay in their argument. */
function splitArgs(raw = '') {
  const parts = [];
  let current = '';
  let depth = 0;
  let quote = null;
  for (const char of raw) {
    if (quote) {
      if (char === quote) quote = null;
    } else if (char === "'" || char === '"' || char === '`') {
      quote = char;
    } else if ('([{'.includes(char)) {
      depth++;
    } else if (')]}'.includes(char)) {
      depth--;
    } else if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/** One locator call as a part of the element a user sees: `{ name: 'Home', noun: 'link' }` or `{ area: 'in the header' }`. */
function describeLocatorCall(kind, args) {
  const [first = '', options = ''] = splitArgs(args);
  const value = first.replace(/^['"`]|['"`]$/g, '');
  const name =
    options.match(/name:\s*(['"`])(.*?)\1/)?.[2] ??
    options
      .match(/name:\s*\/(.*?)\/\w*/)?.[1]
      ?.replace(/[\\^$()]/g, '')
      .split('|')[0];
  switch (kind) {
    case 'getByRole':
      if (ROLE_AREAS[value] && !name) return { area: ROLE_AREAS[value] };
      return { name, noun: ROLE_NOUNS[value] ?? words(value) };
    case 'getByPlaceholder':
    case 'getByLabel':
      return { name: value, noun: 'field' };
    case 'getByText':
      return { name: value, noun: 'text' };
    case 'getByTestId':
      return { name: label(value), noun: 'element' };
    case 'locator': {
      const last = value.trim().split(/\s+/).at(-1) ?? '';
      const className = last.match(/\.([\w-]+)/)?.[1];
      const tag = TAG_NOUNS[last.match(/^([a-z][a-z0-9]*)/)?.[1]];
      const noun = [className && words(className), tag].filter(Boolean).join(' ');
      return noun ? { noun, css: true } : {};
    }
    default:
      return {};
  }
}

/** Locators as the elements a user sees: `the "Home" and "Login" links in the header`. */
function describeElements(locators) {
  const targets = locators.map((locator) => {
    const calls = [...String(locator).matchAll(LOCATOR_CALL)].map(([, kind, args]) => describeLocatorCall(kind, args));
    const index = calls.findLastIndex(
      (call) => call.noun && !(call.css && calls.slice(calls.indexOf(call) + 1).some((c) => c.noun)),
    );
    const target = calls[index] ?? {};
    const area = calls
      .slice(0, Math.max(index, 0))
      .map((call) => call.area)
      .filter(Boolean)
      .at(-1);
    return { ...target, area };
  });
  if (!targets.length || targets.every((target) => !target.noun)) return 'the expected element';
  const [first] = targets;
  const sameKind = targets.every((target) => target.name && target.noun === first.noun && target.area === first.area);
  if (targets.length > 1 && sameKind) {
    return `the ${joinList(targets.map((target) => `"${target.name}"`))} ${first.noun}s${first.area ? ` ${first.area}` : ''}`;
  }
  return joinList(
    targets.map(
      (target) =>
        `the ${target.name ? `"${target.name}" ` : ''}${target.noun ?? 'element'}${target.area ? ` ${target.area}` : ''}`,
    ),
  );
}

/** A report step as what the user does (`action`) and what should happen (`expected`). */
function describeStep(title) {
  const api = title.match(API_STEP);
  if (api) {
    const [name] = api[2].split(' :: ');
    const action =
      API_ACTIONS.find(([pattern]) => pattern.test(name))?.[1] ??
      (name.startsWith('/') ? `Send a ${api[1]} request to ${name}` : capitalize(name));
    return { action: `${action} through the API`, expected: 'the server accepts the request' };
  }
  const step = title.match(PAGE_STEP);
  if (!step) return undefined;
  const [, className, method, rawArgs] = step;
  const page = pageName(className);
  const args = splitArgs(rawArgs);
  const flag = args.at(-1) === 'true' ? true : args.at(-1) === 'false' ? false : undefined;
  const names = args.filter((arg) => arg !== 'true' && arg !== 'false');
  const [name = ''] = names;
  const field = `the "${label(name)}" field`;
  const check = (statement) => ({ action: `On the ${page}, check that ${statement}`, expected: statement });
  switch (method) {
    case 'navigate': {
      const route = ROUTE_PAGES.find(([pattern]) => pattern.test(rawArgs));
      const target = route?.[1] ?? page;
      const redirected = route && route[2] !== className;
      return {
        action: `Open the ${target}`,
        expected: redirected ? `the ${page} is shown instead` : `the ${target} opens`,
      };
    }
    case 'waitUntilPageLoaded':
    case 'expectLoaded':
      return { action: `Wait for the ${page} to open`, expected: `the ${page} opens` };
    case 'fillData': {
      const value = /password/i.test(name) ? 'a password' : /email/i.test(name) ? 'an email address' : 'a value';
      return {
        action: `On the ${page}, enter ${value} into ${field}`,
        expected: `${field} is available and accepts the value`,
      };
    }
    case 'clickActionButton':
      return {
        action: `On the ${page}, click "${label(name)}"`,
        expected: `"${label(name)}" is available and can be clicked`,
      };
    case 'checkCheckbox':
      return {
        action: `On the ${page}, select the "${label(name)}" checkbox`,
        expected: `the "${label(name)}" checkbox is selected`,
      };
    case 'uncheckCheckbox':
      return {
        action: `On the ${page}, clear the "${label(name)}" checkbox`,
        expected: `the "${label(name)}" checkbox is cleared`,
      };
    case 'clickRadioButton':
      return {
        action: `On the ${page}, choose the "${label(name)}" option`,
        expected: `the "${label(name)}" option is chosen`,
      };
    case 'verifyFieldData':
      return check(`${field} shows the entered value`);
    case 'verifyFieldAttribute':
      return check(`${field} has the expected ${words(names[1] ?? 'type')}`);
    case 'verifyCheckboxStatus':
      return check(`the "${label(name)}" checkbox is ${flag ? 'selected' : 'not selected'}`);
    case 'verifyRadioButtonStatus':
      return check(`the "${label(name)}" option is ${flag ? 'chosen' : 'not chosen'}`);
    case 'verifyErrorField':
      return check(`an error message for ${field} is ${flag ? 'shown' : 'not shown'}`);
    case 'verifyErrorFieldText':
      return check(`the error message for ${field} shows the expected text`);
    case 'verifyElementExist':
      return check(`${quotedLabels(names)} ${names.length > 1 ? 'are' : 'is'} ${flag ? 'shown' : 'not shown'}`);
    case 'verifyElementIsVisible':
      return check(`${describeElements(args)} ${args.length > 1 ? 'are' : 'is'} shown`);
    default:
      return { action: `On the ${page}, ${words(method)}`, expected: `"${words(method)}" completes` };
  }
}

/** Steps from the logs that the report does not record as steps: simulated server responses. */
function preconditionsFromLogs(logs) {
  const steps = [];
  for (const [, url, status] of logs.matchAll(/\bMock (\S+) -> (\d{3})/g)) {
    const feature = API_FEATURES.find(([pattern]) => pattern.test(url))?.[1] ?? 'the requested data';
    steps.push(
      Number(status) >= 400
        ? `Simulate a server error for ${feature} (status ${status}) instead of calling the real server`
        : `Simulate the server response for ${feature} (status ${status}) instead of calling the real server`,
    );
  }
  return steps;
}

/** The element an assertion or locator error is about, as the user sees it. */
function failingElement(message) {
  const locator =
    message.match(/^Locator: (.+)$/m)?.[1] ??
    message.match(/strict mode violation: (.+?) resolved to/)?.[1] ??
    message.match(/waiting for ((?:locator|getBy)\(.*)$/m)?.[1];
  return locator ? describeElements([locator.trim()]) : undefined;
}

function actualResult(message, result, logs) {
  const element = failingElement(message);
  const apiStatus = message.match(API_STATUS);
  const received = message.match(/^\s*Received(?: string| value)?:\s*(.+)$/m)?.[1]?.trim();
  const missing = message.match(MISSING_NAME);
  const rateLimitedMeanwhile = !RATE_LIMIT.test(message) && RATE_LIMIT_LOG.test(logs);
  const note = rateLimitedMeanwhile ? '; at that time the server was refusing requests because of its rate limit' : '';
  if (RATE_LIMIT.test(message))
    return 'the server refused the request because too many requests were sent in a short time (rate limit, status 429)';
  if (NETWORK.test(message)) return 'the application could not be reached (network error)';
  if (missing) return `the test refers to "${label(missing[2])}", which is not described for this page`;
  if (FRAMEWORK_CLOSED.test(message))
    return 'the test stopped with a technical error in the test framework: the browser page was closed while a file was still loading';
  if (STRICT.test(message))
    return `${element} matches several elements on the page, so the test cannot tell which one to use`;
  if (apiStatus) return `the server answered with status ${apiStatus[1]}`;
  if (EXPECT_HIDDEN.test(message) && element) return `${element} is still shown${note}`;
  if (element && (NOT_FOUND.test(message) || EXPECT_VISIBLE.test(message)))
    return `${element} did not appear on the page${note}`;
  if (received) return `${element ? `${element} shows` : 'the application returned'} ${received}${note}`;
  if (result.status === 'timedOut') return `the scenario did not finish within the time limit${note}`;
  if (TEST_CODE.test(message)) return 'the test stopped because of an error in the test code';
  const first = message
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  return `${first ? first.replace(/^Error:\s*/, '') : 'the test failed'}${note}`;
}

function expectedResult(message, stepExpected) {
  const element = failingElement(message);
  const apiStatus = message.match(API_STATUS);
  const expected = message.match(/^\s*Expected(?: string| value| pattern)?:\s*(.+)$/m)?.[1]?.trim();
  if (FRAMEWORK_CLOSED.test(message))
    return `${stepExpected ?? 'the scenario finishes'}, and the test finishes without a technical error`;
  if (apiStatus) return `the server accepts the request (status ${apiStatus[2].trim()})`;
  if (element && EXPECT_HIDDEN.test(message)) return `${element} is not shown`;
  if (element && (NOT_FOUND.test(message) || EXPECT_VISIBLE.test(message))) return `${element} is shown`;
  if (expected && !/^(visible|hidden)$/.test(expected))
    return `${element ? `${element} shows` : 'the application returns'} ${expected}`;
  return stepExpected ?? 'the scenario completes without errors';
}

/** Report steps up to the failed one; consecutive checks of named elements on one page become one step. */
function reportSteps(result) {
  const failedStep = failedStepChain(result.steps)[0];
  const merged = [];
  for (const step of result.steps ?? []) {
    if (/check cached token/.test(step.title)) continue;
    const current = step.title.match(PAGE_STEP);
    const previous = merged.at(-1);
    const before = previous?.title.match(PAGE_STEP);
    const sameCheck =
      current?.[2] === 'verifyElementExist' &&
      before?.[2] === 'verifyElementExist' &&
      current[1] === before[1] &&
      splitArgs(current[3]).at(-1) === splitArgs(before[3]).at(-1) &&
      !previous.failed;
    if (sameCheck) {
      const names = [...splitArgs(before[3]).slice(0, -1), ...splitArgs(current[3])];
      previous.title = `${current[1]}.verifyElementExist(${names.join(', ')})`;
      previous.failed = step === failedStep;
    } else {
      merged.push({ title: step.title, failed: step === failedStep });
    }
    if (step === failedStep) break;
  }
  return merged;
}

function stepsToReproduce(result, logs, message) {
  const lines = [...preconditionsFromLogs(logs)];
  let stepExpected;
  for (const step of reportSteps(result)) {
    const described = describeStep(step.title);
    if (!described || lines.at(-1) === described.action) continue;
    const createdArticle = lines.some((line) => /^Create an article through the API$/.test(line));
    lines.push(
      createdArticle
        ? described.action.replace(
            /^Open the (Article page|article editor)$/,
            'Open the $1 of the article created through the API',
          )
        : described.action,
    );
    stepExpected = described.expected;
  }
  return [
    ...lines.map((line, index) => `${index + 1}. ${line}`),
    `Actual result: ${capitalize(actualResult(message, result, logs))}.`,
    `Expected result: ${capitalize(expectedResult(message, stepExpected))}.`,
  ].join('\n');
}

// ---------- rows ----------

function buildRows(report) {
  const rows = [];
  for (const { spec, test, titles } of walkSuites(report.suites)) {
    if (test.status !== 'unexpected' && test.status !== 'flaky') continue;
    const results = test.results ?? [];
    // A flaky test's last attempt passed: describe the attempt that failed.
    const result =
      [...results].reverse().find((r) => r.status !== 'passed' && r.status !== 'skipped') ?? results.at(-1) ?? {};
    const message = messageOf(result);
    const logs = logsOf(result);
    const { status, percent, reasons } = classify({ outcome: test.status, result, results, message, logs });

    const chain = failedStepChain(result.steps);
    const deepestNamed =
      [...chain].reverse().find((step) => PAGE_STEP.test(step.title) || API_STEP.test(step.title)) ?? chain.at(-1);
    const location = [result.error, ...(result.errors ?? [])].find((e) => e?.location)?.location;
    const specFile = report.config?.rootDir ? rel(path.join(report.config.rootDir, spec.file)) : spec.file;
    const where = location ? `${rel(location.file)}:${location.line}` : `${specFile}:${spec.line}`;

    rows.push({
      status,
      testName: `[${test.projectName}] ${[...titles, spec.title].join(' › ')} (${specFile}:${spec.line})`,
      testMethod: deepestNamed ? `${deepestNamed.title} — ${where}` : where,
      defectPercent: percent.defect,
      automationBugPercent: percent.automation,
      flakyPercent: percent.flaky,
      stepsToReproduce: stepsToReproduce(result, logs, message),
      reason: reasons.join('; '),
    });
  }
  return sortRows(rows);
}

const PERCENT_FIELDS = { defect: 'defectPercent', automation: 'automationBugPercent', flaky: 'flakyPercent' };

function sortRows(rows) {
  const order = [STATUSES.defect, STATUSES.automation, STATUSES.review, STATUSES.flaky];
  return rows.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
}

/**
 * Applies reviewed values to the rows: `{ "tests/ui/auth.ui.spec.ts:12": { "status": "automation bug", "stepsToReproduce": "..." } }`.
 * Keys are the spec file:line (or its end, e.g. `auth.ui.spec.ts:12`) or the full test name. Percentages: all three
 * (`defectPercent`, `automationBugPercent`, `flakyPercent`, adding up to 100) or none — then a changed status gets 100%.
 */
function applyOverrides(rows, file) {
  const overrides = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const unmatched = [];
  for (const [key, change] of Object.entries(overrides)) {
    const row = rows.find((candidate) => candidate.testName === key || candidate.testName.endsWith(`${key})`));
    if (!row) {
      unmatched.push(key);
      continue;
    }
    if (change.status && !Object.values(STATUSES).includes(change.status)) {
      throw new Error(
        `Override "${key}": unknown status "${change.status}" (use ${Object.values(STATUSES).join(', ')})`,
      );
    }
    const given = Object.values(PERCENT_FIELDS).filter((field) => change[field] !== undefined);
    if (given.length) {
      const valid = given.length === 3 && given.every((field) => Number.isInteger(change[field]) && change[field] >= 0);
      if (!valid || given.reduce((sum, field) => sum + change[field], 0) !== 100) {
        throw new Error(
          `Override "${key}": give defectPercent, automationBugPercent and flakyPercent as whole numbers that add up to 100`,
        );
      }
      const bucket = Object.keys(STATUSES).find((name) => STATUSES[name] === (change.status ?? row.status));
      if (PERCENT_FIELDS[bucket] && given.some((field) => change[field] > change[PERCENT_FIELDS[bucket]])) {
        throw new Error(`Override "${key}": status "${change.status ?? row.status}" must have the highest percentage`);
      }
      for (const field of given) row[field] = change[field];
    } else if (change.status && change.status !== row.status && change.status !== STATUSES.review) {
      const bucket = Object.keys(STATUSES).find((name) => STATUSES[name] === change.status);
      for (const [name, field] of Object.entries(PERCENT_FIELDS)) row[field] = name === bucket ? 100 : 0;
    }
    for (const field of ['status', 'testMethod', 'stepsToReproduce', 'reason']) {
      if (typeof change[field] === 'string') row[field] = change[field];
    }
    row.reviewed = true;
  }
  sortRows(rows);
  return unmatched;
}

// ---------- XLSX (Office Open XML in a ZIP, no dependencies) ----------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(entries) {
  const now = new Date();
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, content] of entries) {
    const data = Buffer.from(content, 'utf8');
    const nameBuffer = Buffer.from(name, 'utf8');
    const compressed = zlib.deflateRawSync(data);
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    locals.push(local, nameBuffer, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuffer);

    offset += local.length + nameBuffer.length + compressed.length;
  }
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

const xml = (value) =>
  String(value ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .slice(0, 32_000)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const column = (index) => {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
};

/** Cell style ids from styles.xml. */
const STYLE = {
  header: 1,
  text: 2,
  percent: 3,
  [STATUSES.automation]: 4,
  [STATUSES.defect]: 5,
  [STATUSES.flaky]: 6,
  [STATUSES.review]: 7,
};

function sheet(columns, rows, { filter = true } = {}) {
  const cell = (ref, value, style) =>
    typeof value === 'number'
      ? `<c r="${ref}" s="${style}"><v>${value}</v></c>`
      : `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
  const header = `<row r="1">${columns.map((c, i) => cell(`${column(i)}1`, c.header, STYLE.header)).join('')}</row>`;
  const body = rows
    .map(
      (row, r) =>
        `<row r="${r + 2}">${columns.map((c, i) => cell(`${column(i)}${r + 2}`, row[c.key], c.style(row))).join('')}</row>`,
    )
    .join('');
  const range = `A1:${column(columns.length - 1)}${rows.length + 1}`;
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    `<cols>${columns.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width}" customWidth="1"/>`).join('')}</cols>` +
    `<sheetData>${header}${body}</sheetData>` +
    (filter ? `<autoFilter ref="${range}"/>` : '') +
    '</worksheet>'
  );
}

function workbook(rows, summary) {
  const triageColumns = [
    { header: 'Status', key: 'status', width: 16, style: (row) => STYLE[row.status] },
    { header: 'Test name', key: 'testName', width: 48, style: () => STYLE.text },
    { header: 'Test method', key: 'testMethod', width: 42, style: () => STYLE.text },
    { header: 'Defect %', key: 'defectPercent', width: 11, style: () => STYLE.percent },
    { header: 'Automation bug %', key: 'automationBugPercent', width: 17, style: () => STYLE.percent },
    { header: 'Flaky %', key: 'flakyPercent', width: 10, style: () => STYLE.percent },
    { header: 'Steps to reproduce', key: 'stepsToReproduce', width: 70, style: () => STYLE.text },
    { header: 'Reason', key: 'reason', width: 50, style: () => STYLE.text },
  ];
  const summaryColumns = [
    { header: 'Item', key: 'item', width: 28, style: () => STYLE.text },
    { header: 'Value', key: 'value', width: 60, style: () => STYLE.text },
  ];
  const fill = (rgb) =>
    `<fill><patternFill patternType="solid"><fgColor rgb="${rgb}"/><bgColor indexed="64"/></patternFill></fill>`;
  const wrapTop = '<alignment vertical="top" wrapText="1"/>';
  const lastRow = rows.length + 1;

  return zip([
    [
      '[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    ],
    [
      '_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    ],
    [
      'xl/workbook.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<sheets><sheet name="Triage" sheetId="1" r:id="rId1"/><sheet name="Summary" sheetId="2" r:id="rId2"/></sheets>' +
        `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">Triage!$A$1:$H$${lastRow}</definedName></definedNames></workbook>`,
    ],
    [
      'xl/_rels/workbook.xml.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>' +
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    ],
    [
      'xl/styles.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<numFmts count="1"><numFmt numFmtId="164" formatCode="0&quot;%&quot;"/></numFmts>' +
        '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
        `<fills count="7"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${fill('FFD9E1F2')}${fill('FFFCE4D6')}${fill('FFF8CBAD')}${fill('FFFFF2CC')}${fill('FFE7E6E6')}</fills>` +
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="8">' +
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
        `<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>` +
        `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1">${wrapTop}</xf>` +
        '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>' +
        `<xf numFmtId="0" fontId="1" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1">${wrapTop}</xf>` +
        `<xf numFmtId="0" fontId="1" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1">${wrapTop}</xf>` +
        `<xf numFmtId="0" fontId="1" fillId="5" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1">${wrapTop}</xf>` +
        `<xf numFmtId="0" fontId="1" fillId="6" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1">${wrapTop}</xf>` +
        '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>',
    ],
    ['xl/worksheets/sheet1.xml', sheet(triageColumns, rows)],
    ['xl/worksheets/sheet2.xml', sheet(summaryColumns, summary, { filter: false })],
  ]);
}

// ---------- main ----------

let resolved;
try {
  resolved = resolveResultsInput(input);
} catch (error) {
  console.error(
    `${error.message}. Pass reports/results.json, a folder that contains it, or a .zip archive of that folder.`,
  );
  process.exit(2);
}
if (resolved.unpackedFrom)
  console.log(`Unpacked ${rel(path.resolve(resolved.unpackedFrom))} → ${rel(path.resolve(resolved.root))}`);
const artifactsRoot = resolved.root;
const report = JSON.parse(fs.readFileSync(resolved.path, 'utf-8'));
const rows = buildRows(report);
let unmatchedOverrides = [];
if (overridesFile) {
  try {
    unmatchedOverrides = applyOverrides(rows, overridesFile);
  } catch (error) {
    console.error(`Cannot apply ${overridesFile}: ${error.message}`);
    process.exit(2);
  }
}
const count = (status) => rows.filter((row) => row.status === status).length;
const stats = report.stats ?? {};
const run = {
  source: rel(path.resolve(resolved.unpackedFrom ?? input)),
  report: rel(path.resolve(resolved.path)),
  generatedAt: new Date().toISOString(),
  startTime: stats.startTime,
  durationMs: stats.duration,
  totals: {
    passed: stats.expected ?? 0,
    failed: stats.unexpected ?? 0,
    flaky: stats.flaky ?? 0,
    skipped: stats.skipped ?? 0,
  },
  byStatus: Object.fromEntries(Object.values(STATUSES).map((status) => [status, count(status)])),
  statusRule: `highest likelihood when it reaches ${STATUS_THRESHOLD}%, otherwise "${STATUSES.review}"`,
  overrides: overridesFile ? rel(path.resolve(overridesFile)) : null,
  reviewed: rows.filter((row) => row.reviewed).length,
};

fs.mkdirSync(outDir, { recursive: true });
const jsonFile = path.join(outDir, `${baseName}.json`);
const xlsxFile = path.join(outDir, `${baseName}.xlsx`);
fs.writeFileSync(jsonFile, `${JSON.stringify({ run, tests: rows }, null, 2)}\n`);

const summary = [
  { item: 'Source report', value: run.source },
  { item: 'Generated at', value: run.generatedAt },
  { item: 'Run started', value: run.startTime ?? 'n/a' },
  { item: 'Duration', value: run.durationMs == null ? 'n/a' : `${(run.durationMs / 1000).toFixed(1)}s` },
  {
    item: 'Passed / failed / flaky / skipped',
    value: `${run.totals.passed} / ${run.totals.failed} / ${run.totals.flaky} / ${run.totals.skipped}`,
  },
  ...Object.entries(run.byStatus).map(([status, n]) => ({ item: `Status: ${status}`, value: String(n) })),
  { item: 'Status rule', value: run.statusRule },
  { item: 'Reviewed rows', value: run.overrides ? `${run.reviewed} (from ${run.overrides})` : 'none' },
];
fs.writeFileSync(xlsxFile, workbook(rows, summary));

console.log(
  `Triage: ${rows.length} test(s) — ${Object.entries(run.byStatus)
    .map(([s, n]) => `${n} ${s}`)
    .join(', ')}`,
);
console.log(`JSON: ${rel(path.resolve(jsonFile))}`);
console.log(`XLSX: ${rel(path.resolve(xlsxFile))}`);
if (run.overrides) console.log(`Reviewed rows: ${run.reviewed} from ${run.overrides}`);
if (unmatchedOverrides.length)
  console.log(`Overrides without a matching failed test: ${unmatchedOverrides.join(', ')}`);
