---
name: playwright-ts-test-results
description: Parse, summarize and triage Playwright test results in this Conduit Playwright + TypeScript project (reports/results.json, Allure results, traces, per-test logs). Use this skill whenever the user asks what failed, why tests are red, to analyze or summarize a test run, check flaky tests, read a report or trace, compare runs, decide whether a failure is a product bug, a test bug or an environment problem (rate limit 429, network) — even if they just say "check the results", "tests failed", "what happened in the run" or paste Playwright output.
---

# Playwright test results triage

Turn a finished test run into a short, trustworthy verdict: what failed, which category each failure belongs to, the evidence, and the next action. The goal is to separate **environment noise** from **test defects** from **real product defects**, because each needs a different owner and fix.

## Where results live

| Artifact | Path | Produced by |
|---|---|---|
| Playwright JSON report (primary source) | `reports/results.json` | `json` reporter in `playwright.config.ts` |
| Allure raw results | `reports/allure-results/` | `allure-playwright` reporter |
| Allure HTML report | `reports/allure-report/` | `npm run allure:generate` |
| Playwright HTML report | `reports/html/` | `html` reporter, open with `npm run report` |
| Failed-test artifact index (error, screenshot/video/DOM paths, captured API and console errors) | `reports/artifacts.json` | `ArtifactsReporter` in `src/utilities/reporter/`, every run |
| Per-test artifacts (trace, screenshot, video, `dom.html`, `error-context.md`) | `test-results/<test-dir>/` | only for failed tests |
| Per-test log lines | `logs` attachment of every test | `logs` auto fixture in `src/base/BaseTest.ts` |
| Downloaded or CI results | any folder or `.zip` archive containing a `results.json` | unpacked to `reports/unpacked/<archive name>/` by the scripts |

`test-results/` is wiped at the start of every run, so analyze artifacts before re-running.

## Workflow

1. **Summarize with the bundled script** (no dependencies):

   ```bash
   node .claude/skills/playwright-ts-test-results/scripts/summarize-results.mjs
   ```

   Options: a path argument — `reports/results.json` (default), a folder that contains a report (a copied `reports/` folder, a CI artifact), a `.zip` archive of such a folder (unpacked to `reports/unpacked/<archive name>/`, where its traces and screenshots stay available; artifact paths recorded on CI are mapped to the unpacked copy) or an Allure results directory such as `reports/allure-results` — `--json` for structured output, `--failures-only`, `--fail-on-failures` (exit code 1, useful in CI). `npm run results` is a shortcut.

   If there is no `reports/results.json`, the tests have not run with the current config — say so instead of guessing.

   Then write the export files: `npm run results:triage` (see **Triage export** below).

2. **Check blockers first.**
   - Global errors (config/compile errors) → nothing ran; fix those first.
   - Many tests failing inside `getTestUser()` → the shared user could not be resolved (usually a 429 on login/registration); everything that needs authentication fails for the same reason.

3. **Triage each failure by category** (the script pre-classifies; confirm with evidence):

   | Category | Meaning | Typical evidence | Next action |
   |---|---|---|---|
   | `environment:rate-limit` | Demo server returned 429 (≈100 requests / 15 min per IP; auth ≈5 / hour) | `429`, `retry-after` in the error message, or `-> 429` in the `logs` attachment | Not a product bug. Wait for `retry-after`, re-run only the failed tests, reduce requests (see [execution-and-config](../playwright-ts-conduit-realworld/references/execution-and-config.md) of the conventions skill). |
   | `environment:network` | DNS/connection problems | `ECONNRESET`, `net::ERR_*` | Re-run; check the site is up. |
   | `product:server-error` | API answered 5xx | `-> 500` in logs, `got 500` | Likely product defect — capture request + response body from logs. |
   | `test-code` | Bug in the test/framework code | `TypeError`, `is not a function` | Fix the code at the reported location. |
   | `locator-or-timing` | Element not found, strict mode violation, timeout | `waiting for getByRole(...)`, `element(s) not found` | Open `error-context.md` (page snapshot) or the trace. Decide: UI changed (heal the page object with the [playwright-ts-test-self-healing](../playwright-ts-test-self-healing/SKILL.md) skill) vs page did not load (often a hidden 429 on page assets) vs real regression. |
   | `assertion` | Expectation mismatch while the app responded normally | `expect(received).toBe(expected)` with values | Compare expected vs received: product regression or outdated expectation? Verify through the API or manually before calling it a product bug. |
   | `unknown` | None of the above | — | Read the full message, logs and trace. |

   Rate-limit problems often show up as other categories: a UI page that got 429 on its HTML renders blank, so the error looks like "locator not found". Always check the `logs` attachment for `-> 429` before blaming a locator.

4. **Dig into evidence only where needed** (cheapest first):
   - The `logs` attachment (every API call with status and timing, navigations, page actions) — in `reports/results.json` under the result's attachments, or in the HTML/Allure report.
   - `test-results/<dir>/error-context.md` — an accessibility snapshot of the page at failure time; best for locator failures.
   - `test-results/<dir>/dom.html` — the full page DOM at failure time (UI tests); check the real markup, classes and attributes when healing a locator. `reports/artifacts.json` lists it with the error, screenshot and video of every failed test.
   - The `interceptor` attachment (the same data is in `network` / `console` of `reports/artifacts.json`) — browser API calls that answered 4xx/5xx or failed, and console errors / uncaught page errors captured during the test. A `429` there confirms a rate-limited page; a console error next to a blank page points to a front-end crash rather than a locator problem.
   - Trace: `npx playwright show-trace test-results/<dir>/trace.zip` (interactive; tell the user the command rather than trying to read the zip).
   - Allure report: `npm run allure:generate && npm run allure:open` — categories, history, retries.

5. **Re-run surgically**, and only when the rate-limit budget allows it:
   - `npx playwright test --last-failed`
   - `npx playwright test tests/ui/articles.ui.spec.ts:12 --project=ui`
   - Avoid re-running the whole suite right after a 429: it will fail again and extend nothing but the noise.

6. **Finish the export** — review every row of `reports/triage/triage-report.json` and apply the result with an overrides file ([references/triage-export.md](references/triage-export.md)). The export is shared with managers and manual QA, so it is done only when statuses match the evidence and every text reads as plain business language.

## Triage export (JSON + XLSX)

When the result has to be shared with managers or manual QA, every triage ends with two files:

```bash
npm run results:triage   # reports/results.json → reports/triage/triage-report.json + triage-report.xlsx
```

The script's output is a draft: statuses are scored by rules that cannot see the evidence you just gathered, and the steps are written in test language. Read [references/triage-export.md](references/triage-export.md) for the column map, the status rules and the review pass before sending it anywhere.

## Report format

Reply to the user with this structure (keep it short, lead with the verdict):

```markdown
## Test run: <PASSED | FAILED | PASSED WITH FLAKY TESTS>
<passed> passed · <failed> failed · <flaky> flaky · <skipped> skipped · <duration>
Export: reports/triage/triage-report.xlsx · reports/triage/triage-report.json

### Failures
| Test | Status | Defect / Automation / Flaky % | Root cause (1 line) | Action |
|---|---|---|---|---|
| [ui] articles.ui.spec.ts:12 › user publishes an article | flaky | 0 / 0 / 100 | 429 on /api/articles, retry-after 540s | Re-run after 9 min |

### Details
<only for failures that need explanation: key error lines, evidence file paths>

### Recommendations
<fixes for test code, product bugs to report, flaky tests to stabilise>
```

State the confidence of a classification when the evidence is indirect (e.g. "likely rate limit: blank page and 429 in logs"). Never label a failure a product defect without evidence that the application misbehaved.

## Known product behaviour (not regressions)

A behaviour the framework already documents and designs around is not a regression. The register lives in [app-behaviour](../playwright-ts-conduit-realworld/references/app-behaviour.md) — check it before reporting a product defect, and add newly-learned quirks there rather than here, so there is one list to trust.
