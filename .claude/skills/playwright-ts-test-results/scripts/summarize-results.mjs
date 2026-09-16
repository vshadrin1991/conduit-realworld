#!/usr/bin/env node
/**
 * Summarizes Playwright test results for humans and agents.
 *
 * Usage:
 *   node summarize-results.mjs [path] [--json] [--failures-only] [--fail-on-failures]
 *
 * `path` is a Playwright JSON report (default: reports/results.json), a folder that contains one (a copied
 * reports/ folder, a CI artifact), a .zip archive of such a folder (unpacked to reports/unpacked/<name>/),
 * or an Allure results directory (e.g. reports/allure-results) as a fallback source.
 */
import fs from 'node:fs';
import path from 'node:path';
import { rebaseArtifactPath, resolveResultsInput } from './resolve-input.mjs';

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const input = args.find((a) => !a.startsWith('--')) ?? 'reports/results.json';

const stripAnsi = (s = '') => s.replace(/\[[0-9;]*m/g, '');
const rel = (p) => (p ? path.relative(process.cwd(), p) : p);

/** A request that got HTTP 429, as written to the per-test `logs` attachment by the framework logger. */
const RATE_LIMIT_LOG = /-> 429\b/;

/** Ordered rules: the first match wins. */
const CATEGORY_RULES = [
  {
    id: 'environment:rate-limit',
    test: ({ msg, logs = '' }) => /\b429\b|rate limited|too many requests/i.test(msg) || RATE_LIMIT_LOG.test(logs),
  },
  {
    id: 'environment:network',
    test: ({ msg }) => /ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|net::ERR_|socket hang up/i.test(msg),
  },
  {
    id: 'product:server-error',
    test: ({ msg }) => /-> 5\d\d\b|got 5\d\d\b|Received: 5\d\d\b|status code => 5\d\d\b/.test(msg),
  },
  {
    id: 'test-code',
    test: ({ msg }) => /TypeError|ReferenceError|SyntaxError|is not a function|Cannot read properties of/.test(msg),
  },
  {
    id: 'locator-or-timing',
    test: ({ msg, status }) =>
      status === 'timedOut' || /strict mode violation|element\(s\) not found|waiting for (locator|getBy)/i.test(msg),
  },
  { id: 'assertion', test: ({ msg }) => /expect\(/.test(msg) },
];

const classify = (ctx) => CATEGORY_RULES.find((rule) => rule.test(ctx))?.id ?? 'unknown';

function firstLines(text, count = 4) {
  return stripAnsi(text)
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.trim())
    .slice(0, count);
}

// ---------- Playwright JSON report ----------

function* walkSuites(suites, titles = []) {
  for (const suite of suites ?? []) {
    const suiteTitles = suite.title && !suite.file?.endsWith(suite.title) ? [...titles, suite.title] : titles;
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) yield { spec, test, titles: suiteTitles };
    }
    yield* walkSuites(suite.suites, suiteTitles);
  }
}

function fromPlaywrightJson(report, root = '.') {
  const tests = [];
  for (const { spec, test, titles } of walkSuites(report.suites)) {
    const results = test.results ?? [];
    const last = results.at(-1) ?? {};
    const errors = [last.error, ...(last.errors ?? [])].filter(Boolean);
    const msg = stripAnsi([...new Set(errors.map((e) => e.message ?? ''))].join('\n'));
    const annotations = [...(test.annotations ?? []), ...results.flatMap((r) => r.annotations ?? [])];
    const attachments = (last.attachments ?? [])
      .filter((a) => a.path)
      .map((a) => ({ name: a.name, path: rel(rebaseArtifactPath(a.path, root)) }));
    const logs = (last.attachments ?? [])
      .filter((a) => a.name === 'logs' && a.body)
      .map((a) => Buffer.from(a.body, 'base64').toString())
      .join('\n');
    tests.push({
      project: test.projectName,
      file: spec.file,
      line: spec.line,
      title: [...titles, spec.title].join(' › '),
      tags: spec.tags ?? [],
      outcome: test.status, // expected | unexpected | flaky | skipped
      status: last.status,
      retries: Math.max(0, results.length - 1),
      duration: results.reduce((sum, r) => sum + (r.duration ?? 0), 0),
      message: msg,
      location: errors.find((e) => e.location)?.location,
      annotations,
      attachments,
      logs,
    });
  }
  return {
    source: 'playwright-json',
    startTime: report.stats?.startTime,
    duration: report.stats?.duration,
    globalErrors: (report.errors ?? []).map((e) => stripAnsi(e.message ?? String(e))),
    tests,
  };
}

// ---------- Allure results fallback ----------

function fromAllureResults(dir) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('-result.json'));
  const latest = new Map(); // historyId -> result (last attempt wins)
  for (const f of files) {
    const r = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
    const prev = latest.get(r.historyId);
    if (!prev || (r.stop ?? 0) > (prev.stop ?? 0))
      latest.set(r.historyId, { ...r, attempts: (prev?.attempts ?? 0) + 1 });
  }
  const label = (r, name) => r.labels?.find((l) => l.name === name)?.value;
  const tests = [...latest.values()].map((r) => {
    const status = r.status === 'passed' ? 'passed' : r.status === 'skipped' ? 'skipped' : 'failed';
    return {
      project: label(r, 'parentSuite') ?? '',
      file: label(r, 'package') ?? r.fullName ?? '',
      title: r.name,
      tags: (r.labels ?? []).filter((l) => l.name === 'tag').map((l) => l.value),
      outcome:
        status === 'passed' ? (r.attempts > 1 ? 'flaky' : 'expected') : status === 'skipped' ? 'skipped' : 'unexpected',
      status,
      retries: r.attempts - 1,
      duration: (r.stop ?? 0) - (r.start ?? 0),
      message: stripAnsi(r.statusDetails?.message ?? ''),
      annotations: [],
      attachments: [],
    };
  });
  return { source: 'allure-results', tests, globalErrors: [] };
}

// ---------- Summary ----------

function load(p) {
  let resolved;
  try {
    resolved = resolveResultsInput(p, { allowAllure: true });
  } catch (error) {
    console.error(
      `${error.message}. Run the tests first (npm test) or pass a report file, a folder or a .zip archive.`,
    );
    process.exit(2);
  }
  if (resolved.unpackedFrom) console.error(`Unpacked ${resolved.unpackedFrom} → ${resolved.root}`);
  if (resolved.kind === 'allure-results') return fromAllureResults(resolved.path);
  return fromPlaywrightJson(JSON.parse(fs.readFileSync(resolved.path, 'utf-8')), resolved.root);
}

function summarize(data) {
  const byProject = {};
  for (const t of data.tests) {
    const row = (byProject[t.project || '-'] ??= { expected: 0, unexpected: 0, flaky: 0, skipped: 0 });
    row[t.outcome] = (row[t.outcome] ?? 0) + 1;
  }
  const failures = data.tests
    .filter((t) => t.outcome === 'unexpected')
    .map((t) => ({ ...t, category: classify({ msg: t.message, logs: t.logs, status: t.status }) }));
  const skippedWithoutRun = data.tests.filter((t) => t.outcome === 'skipped' && !t.status);
  const totals = Object.values(byProject).reduce(
    (acc, r) => ({
      expected: acc.expected + r.expected,
      unexpected: acc.unexpected + r.unexpected,
      flaky: acc.flaky + r.flaky,
      skipped: acc.skipped + r.skipped,
    }),
    { expected: 0, unexpected: 0, flaky: 0, skipped: 0 },
  );
  return {
    source: data.source,
    startTime: data.startTime,
    durationMs: data.duration,
    totals,
    byProject,
    verdict: totals.unexpected ? 'FAILED' : totals.flaky ? 'PASSED WITH FLAKY TESTS' : 'PASSED',
    globalErrors: data.globalErrors,
    failures,
    flaky: data.tests.filter((t) => t.outcome === 'flaky'),
    rateLimitedTests: data.tests.filter((t) => RATE_LIMIT_LOG.test(t.logs ?? '')).length,
    skippedWithoutRun: skippedWithoutRun.length,
    slowest: [...data.tests].sort((a, b) => b.duration - a.duration).slice(0, 5),
  };
}

const fmtMs = (ms) => (ms == null ? 'n/a' : `${(ms / 1000).toFixed(1)}s`);
const ref = (t) => `[${t.project}] ${t.file}${t.line ? `:${t.line}` : ''} › ${t.title}`;

function printMarkdown(s) {
  const out = [];
  out.push(`# Test results: ${s.verdict}`, '');
  out.push(`Source: ${s.source} · started ${s.startTime ?? 'n/a'} · duration ${fmtMs(s.durationMs)}`, '');
  out.push(
    `Totals: ${s.totals.expected} passed · ${s.totals.unexpected} failed · ${s.totals.flaky} flaky · ${s.totals.skipped} skipped`,
    '',
  );
  out.push('| Project | Passed | Failed | Flaky | Skipped |', '|---|---|---|---|---|');
  for (const [project, r] of Object.entries(s.byProject)) {
    out.push(`| ${project} | ${r.expected} | ${r.unexpected} | ${r.flaky} | ${r.skipped} |`);
  }
  out.push('');
  if (s.rateLimitedTests)
    out.push(`> ${s.rateLimitedTests} test(s) received HTTP 429 (rate limit) during the run.`, '');
  if (s.globalErrors.length)
    out.push('## Global errors', ...s.globalErrors.map((e) => `- ${firstLines(e, 2).join(' ')}`), '');

  if (s.failures.length) {
    out.push('## Failures by category', '');
    const groups = {};
    for (const f of s.failures) (groups[f.category] ??= []).push(f);
    for (const [category, items] of Object.entries(groups)) {
      out.push(`### ${category} (${items.length})`, '');
      for (const f of items) {
        out.push(`- ${ref(f)} (${f.status}, retries: ${f.retries}, ${fmtMs(f.duration)})`);
        for (const line of firstLines(f.message)) out.push(`    ${line}`);
        if (f.location) out.push(`    at ${rel(f.location.file)}:${f.location.line}`);
        const artifacts = f.attachments.filter((a) => /trace|screenshot|error-context/.test(a.name));
        if (artifacts.length) out.push(`    artifacts: ${artifacts.map((a) => `${a.name}=${a.path}`).join(', ')}`);
      }
      out.push('');
    }
  }
  if (!flags.has('--failures-only')) {
    if (s.flaky.length) out.push('## Flaky (passed on retry)', ...s.flaky.map((t) => `- ${ref(t)}`), '');
    out.push('## Slowest tests', ...s.slowest.map((t) => `- ${fmtMs(t.duration)} ${ref(t)}`), '');
  }
  console.log(out.join('\n'));
}

const summary = summarize(load(input));
if (flags.has('--json')) console.log(JSON.stringify(summary, null, 2));
else printMarkdown(summary);
if (flags.has('--fail-on-failures') && summary.totals.unexpected) process.exit(1);
