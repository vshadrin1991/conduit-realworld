---
description: Write the report of a Playwright test execution run
argument-hint: <Playwright arguments that were run>
---

# Execution report

**Input**: $ARGUMENTS

**Preflight**: $preflight.output

**Run output**: $run.output

**Triage**: $triage.output

**Locator healing**: $heal.output

---

## Your task

Write `$ARTIFACTS_DIR/execution-report.md`. Steps that did not run have empty output — say they were skipped and why.

1. **Verdict** — PASSED, FAILED, ENV_BLOCKED or NO_RESULTS, with totals (passed, failed, flaky, skipped) and duration.
2. **Scope** — the exact command that ran.
3. **Failures by category** — test, evidence, next action.
4. **Healed locators** — old → new, verified or not; tell the reader to re-run the affected specs.
5. **Rate limit** — tests that got HTTP 429, and when to retry.
6. **Reports** — triage export `$ARTIFACTS_DIR/triage-report.xlsx` / `.json` (status, defect / automation bug / flaky %, steps to reproduce per test), `npm run report` (HTML), `npm run allure:generate && npm run allure:open` (Allure).

Do not edit project files.

## Output

The verdict line and the report path.
