#!/usr/bin/env node
/**
 * Exports the triage of a Playwright run as JSON and XLSX: one row per failed or flaky test with a status
 * (automation bug | defect | flaky | need to review), where it failed, likelihood percentages per category and
 * steps to reproduce in plain language. No dependencies: the XLSX file is written with node:zlib.
 *
 * Usage (from the project root):
 *   node triage-report.mjs [input] [--out-dir reports/triage] [--name triage-report]
 *
 * Input: a Playwright JSON report (default reports/results.json), a folder that contains one (a copied reports/
 * folder, a CI artifact) or a .zip archive of such a folder, unpacked to reports/unpacked/<archive name>/.
 *
 * Status: the category with the highest likelihood when it reaches 60%, otherwise "need to review".
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
const optionValues = new Set(['--out-dir', '--name'].map((name) => option(name)).filter(Boolean));
const input = args.find((a) => !a.startsWith('--') && !optionValues.has(a)) ?? 'reports/results.json';
const outDir = option('--out-dir', 'reports/triage');
const baseName = option('--name', 'triage-report');

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
    for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) yield { spec, test, titles: suiteTitles };
    yield* walkSuites(suite.suites, suiteTitles);
  }
}

const messageOf = (result) =>
  stripAnsi([...new Set([result.error, ...(result.errors ?? [])].filter(Boolean).map((e) => e.message ?? ''))].join('\n'));

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
  if (RATE_LIMIT.test(message) || RATE_LIMIT_LOG.test(logs)) add('flaky', 85, 'the shared demo server answered HTTP 429 (rate limit)');
  if (NETWORK.test(message)) add('flaky', 75, 'network error while talking to the server');
  if (snapshotIsBlank(result)) add('flaky', 40, 'the page did not render (blank page snapshot)');
  if (results.filter((r) => r.status !== 'passed').map(messageOf).filter((m, i, all) => all.indexOf(m) === i).length > 1) {
    add('flaky', 30, 'retries failed with different errors');
  }

  if (MISSING_NAME.test(message)) add('automation', 95, 'the page object does not declare the element used by the test');
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
  if (KNOWN_PRODUCT_BEHAVIOUR.test(message)) add('automation', 50, 'known demo-app behaviour that tests should not treat as a new defect');

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

const words = (camel) =>
  String(camel)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .trim();
const pageName = (className) => `${words(className.replace(/Page$/, '')).replace(/^./, (c) => c.toUpperCase())} page`;
const quoted = (list) => list.map((item) => `"${words(item)}"`).join(', ');

function describeLocator(locator = '') {
  const role = locator.match(/getByRole\('(\w+)'(?:,\s*\{\s*name:\s*'([^']*)'.*?\})?\)/);
  if (role) return role[2] ? `the "${role[2]}" ${role[1]}` : `a ${role[1]}`;
  const placeholder = locator.match(/getByPlaceholder\('([^']*)'/);
  if (placeholder) return `the "${placeholder[1]}" field`;
  const label = locator.match(/getByLabel\('([^']*)'/);
  if (label) return `the "${label[1]}" field`;
  const text = locator.match(/getByText\('([^']*)'/);
  if (text) return `the text "${text[1]}"`;
  const css = locator.match(/locator\('\.([\w-]+)/);
  if (css) return `the ${words(css[1])} block`;
  return locator ? 'the expected element' : 'the page element';
}

function describeStep(title) {
  const api = title.match(API_STEP);
  if (api) {
    const [name] = api[2].split(' :: ');
    return name.startsWith('/') ? `Via the API, send a ${api[1]} request to ${name}` : `Via the API: ${name}`;
  }
  const step = title.match(PAGE_STEP);
  if (!step) return undefined;
  const [, className, method, rawArgs] = step;
  const page = pageName(className);
  const parts = rawArgs.split(',').map((part) => part.trim()).filter(Boolean);
  const flag = parts.at(-1) === 'true' ? true : parts.at(-1) === 'false' ? false : undefined;
  const names = parts.filter((part) => part !== 'true' && part !== 'false');
  switch (method) {
    case 'navigate':
      return `Open the ${page} (${rawArgs || '/'})`;
    case 'waitUntilPageLoaded':
    case 'expectLoaded':
      return `Wait until the ${page} is shown`;
    case 'fillData':
      return `On the ${page}, enter a value into the ${quoted(names)} field`;
    case 'clickActionButton':
      return `On the ${page}, click ${quoted(names)}`;
    case 'checkCheckbox':
      return `On the ${page}, select the ${quoted(names)} checkbox`;
    case 'uncheckCheckbox':
      return `On the ${page}, clear the ${quoted(names)} checkbox`;
    case 'clickRadioButton':
      return `On the ${page}, choose the ${quoted(names)} option`;
    case 'verifyFieldData':
      return `On the ${page}, check that the ${quoted(names)} field shows the entered value`;
    case 'verifyCheckboxStatus':
      return `On the ${page}, check that ${quoted(names)} is ${flag ? 'selected' : 'not selected'}`;
    case 'verifyRadioButtonStatus':
      return `On the ${page}, check that the ${quoted(names)} option is ${flag ? 'chosen' : 'not chosen'}`;
    case 'verifyErrorField':
      return `On the ${page}, check that the error for ${quoted(names)} is ${flag ? 'shown' : 'not shown'}`;
    case 'verifyErrorFieldText':
      return `On the ${page}, check the error text of the ${quoted(names)} field`;
    case 'verifyElementExist':
      return `On the ${page}, check that ${quoted(names)} is ${flag ? 'shown' : 'not shown'}`;
    default:
      return `On the ${page}, ${words(method)}${names.length ? ` ${quoted(names)}` : ''}`;
  }
}

/** Steps from the logs that the report does not record as steps (browser login, mocked responses). */
function preconditionsFromLogs(logs) {
  const steps = [];
  if (/Browser session prepared for/.test(logs)) steps.push('Log in to the application as the test user');
  for (const [, url, status] of logs.matchAll(/\bMock (\S+) -> (\d{3})/g)) {
    steps.push(`Make the server answer requests to ${url} with status ${status} (simulated response)`);
  }
  return steps;
}

function actualResult(message, result) {
  const locator = message.match(/^Locator: (.+)$/m)?.[1] ?? message.match(/strict mode violation: (.+?) resolved to/)?.[1];
  const apiStatus = message.match(API_STATUS);
  const expected = message.match(/^\s*Expected:\s*(.+)$/m)?.[1];
  const received = message.match(/^\s*Received:\s*(.+)$/m)?.[1];
  const missing = message.match(MISSING_NAME);
  if (RATE_LIMIT.test(message)) return 'Actual result: the server refused the requests because of its rate limit (HTTP 429).';
  if (missing) return `Actual result: the test refers to "${words(missing[2])}", which the page description does not contain.`;
  if (STRICT.test(message)) return `Actual result: ${describeLocator(locator)} matches several elements on the page.`;
  if (NOT_FOUND.test(message) && !apiStatus) return `Expected result: ${describeLocator(locator)} is shown. Actual result: it is not on the page.`;
  if (apiStatus) return `Expected result: the server answers ${apiStatus[2]}. Actual result: it answered ${apiStatus[1]}.`;
  if (expected && received) return `Expected result: ${expected.trim()}. Actual result: ${received.trim()}.`;
  if (result.status === 'timedOut') return 'Actual result: the scenario did not finish within the time limit.';
  if (TEST_CODE.test(message)) return `Actual result: the test stopped with a script error (${message.match(TEST_CODE)[0]}).`;
  const first = message.split('\n').map((line) => line.trim()).find(Boolean);
  return `Actual result: ${first ? first.replace(/^Error:\s*/, '') : 'the test failed'}.`;
}

function stepsToReproduce(result, logs, message) {
  const lines = [...preconditionsFromLogs(logs)];
  const failedChain = failedStepChain(result.steps);
  const failedStep = failedChain[0];
  for (const step of result.steps ?? []) {
    if (/check cached token/.test(step.title)) continue;
    const described = describeStep(step.title);
    if (described && lines.at(-1) !== described) lines.push(described);
    if (step === failedStep) break;
  }
  lines.push(actualResult(message, result));
  return lines.map((line, index) => `${index + 1}. ${line}`).join('\n');
}

// ---------- rows ----------

function buildRows(report) {
  const rows = [];
  for (const { spec, test, titles } of walkSuites(report.suites)) {
    if (test.status !== 'unexpected' && test.status !== 'flaky') continue;
    const results = test.results ?? [];
    // A flaky test's last attempt passed: describe the attempt that failed.
    const result = [...results].reverse().find((r) => r.status !== 'passed' && r.status !== 'skipped') ?? results.at(-1) ?? {};
    const message = messageOf(result);
    const logs = logsOf(result);
    const { status, percent, reasons } = classify({ outcome: test.status, result, results, message, logs });

    const chain = failedStepChain(result.steps);
    const deepestNamed = [...chain].reverse().find((step) => PAGE_STEP.test(step.title) || API_STEP.test(step.title)) ?? chain.at(-1);
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
  const order = [STATUSES.defect, STATUSES.automation, STATUSES.review, STATUSES.flaky];
  return rows.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
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
const STYLE = { header: 1, text: 2, percent: 3, [STATUSES.automation]: 4, [STATUSES.defect]: 5, [STATUSES.flaky]: 6, [STATUSES.review]: 7 };

function sheet(columns, rows, { filter = true } = {}) {
  const cell = (ref, value, style) =>
    typeof value === 'number'
      ? `<c r="${ref}" s="${style}"><v>${value}</v></c>`
      : `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
  const header = `<row r="1">${columns.map((c, i) => cell(`${column(i)}1`, c.header, STYLE.header)).join('')}</row>`;
  const body = rows
    .map((row, r) => `<row r="${r + 2}">${columns.map((c, i) => cell(`${column(i)}${r + 2}`, row[c.key], c.style(row))).join('')}</row>`)
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
  const fill = (rgb) => `<fill><patternFill patternType="solid"><fgColor rgb="${rgb}"/><bgColor indexed="64"/></patternFill></fill>`;
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
  console.error(`${error.message}. Pass reports/results.json, a folder that contains it, or a .zip archive of that folder.`);
  process.exit(2);
}
if (resolved.unpackedFrom) console.log(`Unpacked ${rel(path.resolve(resolved.unpackedFrom))} → ${rel(path.resolve(resolved.root))}`);
const artifactsRoot = resolved.root;
const report = JSON.parse(fs.readFileSync(resolved.path, 'utf-8'));
const rows = buildRows(report);
const count = (status) => rows.filter((row) => row.status === status).length;
const stats = report.stats ?? {};
const run = {
  source: rel(path.resolve(resolved.unpackedFrom ?? input)),
  report: rel(path.resolve(resolved.path)),
  generatedAt: new Date().toISOString(),
  startTime: stats.startTime,
  durationMs: stats.duration,
  totals: { passed: stats.expected ?? 0, failed: stats.unexpected ?? 0, flaky: stats.flaky ?? 0, skipped: stats.skipped ?? 0 },
  byStatus: Object.fromEntries(Object.values(STATUSES).map((status) => [status, count(status)])),
  statusRule: `highest likelihood when it reaches ${STATUS_THRESHOLD}%, otherwise "${STATUSES.review}"`,
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
  { item: 'Passed / failed / flaky / skipped', value: `${run.totals.passed} / ${run.totals.failed} / ${run.totals.flaky} / ${run.totals.skipped}` },
  ...Object.entries(run.byStatus).map(([status, n]) => ({ item: `Status: ${status}`, value: String(n) })),
  { item: 'Status rule', value: run.statusRule },
];
fs.writeFileSync(xlsxFile, workbook(rows, summary));

console.log(`Triage: ${rows.length} test(s) — ${Object.entries(run.byStatus).map(([s, n]) => `${n} ${s}`).join(', ')}`);
console.log(`JSON: ${rel(path.resolve(jsonFile))}`);
console.log(`XLSX: ${rel(path.resolve(xlsxFile))}`);
