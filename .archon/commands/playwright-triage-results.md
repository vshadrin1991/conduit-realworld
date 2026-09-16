---
description: Triage the results of a Playwright test run in the Conduit project
argument-hint: <Playwright arguments that were run>
---

# Triage test results

**Input**: $ARGUMENTS

**Run output**: $run.output

---

## Your task

Use the `playwright-ts-test-results` skill. Do not edit project files.

1. Summarize: `npm run results -- --failures-only` (reads `reports/results.json`). If there is no report, use the run output to explain why the run did not produce one.
   Export: `npm run results:triage`, then copy `reports/triage/triage-report.json` and `triage-report.xlsx` into `$ARTIFACTS_DIR/`.
2. Put every failure into one category with evidence: environment (429 rate limit, network), test code, locator broken by a UI change, assertion (product change or defect), timing/flaky.
3. For locator failures, list the broken locators: `node .claude/skills/playwright-ts-test-self-healing/scripts/find-broken-locators.mjs`.
4. Name the next action per failure: wait and re-run, fix the test, heal the locator, report a product defect.

## Output

Return JSON with:

- `verdict` — `PASSED`, `FAILED`, `ENV_BLOCKED` (all failures are environmental) or `NO_RESULTS`
- `locator_failures` — `YES` when at least one failure is a locator broken by a UI change, otherwise `NO`
- `summary` — totals and failures by category, at most 10 lines
