#!/usr/bin/env node
/**
 * Lists UI test failures caused by locators and maps each one to its page-object declaration.
 *
 * Usage:
 *   node find-broken-locators.mjs [path to Playwright JSON report] [--json] [--all]
 *
 * Default report: reports/results.json. `--all` also lists failures that are not locator problems.
 * No dependencies; run from the project root.
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const input = args.find((a) => !a.startsWith('--')) ?? 'reports/results.json';
const PAGE_OBJECT_DIR = 'src/pageObject';

const stripAnsi = (s = '') => s.replace(/\[[0-9;]*m/g, '');
const rel = (p) => (p ? path.relative(process.cwd(), p) : p);

const LOCATOR_ERROR = /element\(s\) not found|strict mode violation|resolved to \d+ elements|waiting for (locator|getBy)|^Locator: /im;
const MISSING_NAME = /has no (field|button|checkbox|radio button|error|element) named/;
const RATE_LIMIT_LOG = /-> 429\b/;
/** Report step title written by BasePage.enqueue: `ArticlePage.clickActionButton(postComment)`. */
const PAGE_STEP = /^([A-Z]\w*)\.(\w+)\((.*)\)$/;
/** Page-object section searched for the element used by each BasePage step method. */
const SECTION_BY_METHOD = {
  fillData: 'fields',
  verifyFieldData: 'fields',
  clickActionButton: 'buttons',
  checkCheckbox: 'checkboxes',
  uncheckCheckbox: 'checkboxes',
  verifyCheckboxStatus: 'checkboxes',
  clickRadioButton: 'radioButtons',
  verifyRadioButtonStatus: 'radioButtons',
  verifyErrorField: 'errors',
  verifyErrorFieldText: 'errors',
};
const ROOT_METHODS = new Set(['navigate', 'waitUntilPageLoaded', 'expectLoaded']);

function* walkSuites(suites) {
  for (const suite of suites ?? []) {
    for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) yield { spec, test };
    yield* walkSuites(suite.suites);
  }
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : full.endsWith('.ts') ? [full] : [];
  });
}

function extractLocator(message) {
  const patterns = [/^Locator: (.+)$/m, /strict mode violation: (.+?) resolved to/, /waiting for ((?:locator|getBy)\S.*)$/m];
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) return match[1].trim();
  }
  return undefined;
}

/** The deepest failed step whose title is a page action. */
function failedPageStep(steps, found) {
  for (const step of steps ?? []) {
    if (!step.error) continue;
    const match = step.title.match(PAGE_STEP);
    return failedPageStep(step.steps, match ? { title: step.title, className: match[1], method: match[2], arg: match[3] } : found);
  }
  return found;
}

function elementNames(method, arg) {
  if (ROOT_METHODS.has(method)) return ['root'];
  return arg
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part && part !== 'true' && part !== 'false');
}

/** Declarations of `name` in the class file, with the section (fields, buttons, ...) each one belongs to. */
function findDeclarations(file, name) {
  const lines = fs.readFileSync(file, 'utf-8').split('\n');
  const declaration = new RegExp(`^\\s*(?:(?:protected|private|public|readonly)\\s+)*${name}\\s*[:=(]`);
  let section = 'class';
  const found = [];
  lines.forEach((line, index) => {
    const sectionStart = line.match(/^\s*(?:(?:protected|private|public|readonly)\s+)+(\w+)\b/);
    if (sectionStart && /[=:]/.test(line)) section = sectionStart[1];
    if (declaration.test(line)) found.push({ file: rel(file), line: index + 1, section, code: line.trim() });
  });
  return found;
}

/** Lines of page objects that contain the string literals of the locator (for locators used directly in specs). */
function findByLiterals(files, locator) {
  const literals = [...(locator ?? '').matchAll(/'([^']{2,})'|"([^"]{2,})"/g)].map((m) => m[1] ?? m[2]);
  if (!literals.length) return [];
  const found = [];
  for (const file of files) {
    fs.readFileSync(file, 'utf-8')
      .split('\n')
      .forEach((line, index) => {
        if (literals.every((literal) => line.includes(literal))) found.push({ file: rel(file), line: index + 1, code: line.trim() });
      });
  }
  return found;
}

function snapshotInfo(errorContextPath) {
  if (!errorContextPath || !fs.existsSync(errorContextPath)) return 'no error-context.md';
  const text = fs.readFileSync(errorContextPath, 'utf-8');
  const snapshot = text.match(/# Page snapshot\s*```(?:yaml)?\n([\s\S]*?)```/);
  if (!snapshot) return 'no page snapshot (page may not have rendered — check the screenshot)';
  const lines = snapshot[1].split('\n').filter((line) => line.trim()).length;
  return lines < 5 ? `near-empty page snapshot (${lines} lines) — likely blank page / rate limit` : `page snapshot: ${lines} lines`;
}

function analyze(report) {
  const pageObjectFiles = listFiles(PAGE_OBJECT_DIR);
  const results = [];
  for (const { spec, test } of walkSuites(report.suites)) {
    const last = (test.results ?? []).at(-1);
    if (!last || !['failed', 'timedOut', 'interrupted'].includes(last.status)) continue;

    const errors = [last.error, ...(last.errors ?? [])].filter(Boolean);
    const message = stripAnsi([...new Set(errors.map((e) => e.message ?? ''))].join('\n'));
    const logs = (last.attachments ?? [])
      .filter((a) => a.name === 'logs' && a.body)
      .map((a) => Buffer.from(a.body, 'base64').toString())
      .join('\n');
    const attachment = (pattern) => (last.attachments ?? []).find((a) => a.path && pattern.test(a.name))?.path;
    const errorContext = attachment(/error-context/);

    let verdict;
    if (RATE_LIMIT_LOG.test(logs) || /\b429\b|rate limited/i.test(message)) verdict = 'environment: rate limited — do not heal';
    else if (MISSING_NAME.test(message)) verdict = 'test code: element name is not declared — do not heal';
    else if (LOCATOR_ERROR.test(message)) verdict = 'locator: candidate for healing';
    else verdict = 'not a locator failure';
    if (!verdict.startsWith('locator') && !flags.has('--all')) continue;

    const locator = extractLocator(message);
    const step = failedPageStep(last.steps);
    let declarations = [];
    if (step) {
      const classFile = pageObjectFiles.find((file) => path.basename(file, '.ts') === step.className);
      if (classFile) {
        const wanted = SECTION_BY_METHOD[step.method];
        for (const name of elementNames(step.method, step.arg)) {
          const all = findDeclarations(classFile, name);
          const preferred = wanted ? all.filter((d) => d.section === wanted) : all;
          declarations.push(...(preferred.length ? preferred : all).map((d) => ({ element: name, ...d })));
        }
      }
    }
    if (!declarations.length) declarations = findByLiterals(pageObjectFiles, locator).map((d) => ({ element: '?', ...d }));

    results.push({
      test: `${spec.file}:${spec.line} › ${spec.title}`,
      project: test.projectName,
      status: last.status,
      verdict,
      locator,
      step: step?.title,
      declarations,
      errorLocation: errors.find((e) => e.location)?.location,
      firstErrorLine: message.split('\n').find((line) => line.trim()),
      artifacts: {
        errorContext: rel(errorContext),
        screenshot: rel(attachment(/screenshot/)),
        trace: rel(attachment(/trace/)),
      },
      snapshot: snapshotInfo(errorContext),
    });
  }
  return results;
}

function printMarkdown(results) {
  const out = [`# Broken locators: ${results.filter((r) => r.verdict.startsWith('locator')).length} candidate(s)`, ''];
  if (!results.length) out.push('No locator failures in the report.');
  for (const r of results) {
    out.push(`## ${r.test}`, '');
    out.push(`- Verdict: **${r.verdict}** (${r.project}, ${r.status})`);
    out.push(`- Error: ${r.firstErrorLine ?? 'n/a'}`);
    if (r.locator) out.push(`- Broken locator: \`${r.locator}\``);
    if (r.step) out.push(`- Failed page step: \`${r.step}\``);
    if (r.errorLocation) out.push(`- Spec line: ${rel(r.errorLocation.file)}:${r.errorLocation.line}`);
    if (r.declarations.length) {
      out.push('- Declaration(s):');
      for (const d of r.declarations) out.push(`  - ${d.file}:${d.line} [${d.element}${d.section ? ` in ${d.section}` : ''}] \`${d.code}\``);
    } else {
      out.push('- Declaration: not found in src/pageObject (locator may be built in a method or used in the spec)');
    }
    out.push(`- Evidence: ${r.snapshot}`);
    const artifacts = Object.entries(r.artifacts).filter(([, value]) => value);
    if (artifacts.length) out.push(`- Artifacts: ${artifacts.map(([key, value]) => `${key}=${value}`).join(', ')}`);
    out.push('');
  }
  console.log(out.join('\n'));
}

if (!fs.existsSync(input)) {
  console.error(`No report at ${input}. Run the tests first or pass the path to a Playwright JSON report.`);
  process.exit(2);
}
const results = analyze(JSON.parse(fs.readFileSync(input, 'utf-8')));
if (flags.has('--json')) console.log(JSON.stringify(results, null, 2));
else printMarkdown(results);
