---
description: Run new or changed Playwright tests once and triage their failures
argument-hint: <tasks/KEY/KEY.md | description of what was automated>
---

# Verify Playwright tests

**Input**: $ARGUMENTS

**Tests to run**: $implement.output.specs

---

## Your task

The server allows about 100 requests per 15 minutes and 5 auth requests per hour: run the smallest scope, once.

1. Run only the tests listed above: `HEADLESS=true npx playwright test <spec:line> <spec:line>`.
2. Summarize with `npm run results -- --failures-only` and triage every failure with the `playwright-ts-test-results` skill.
3. Handle each failure by its category:
   - **locator broken by the UI** → heal the page object with the `playwright-ts-test-self-healing` skill, re-run that test once;
   - **test code defect** → fix the test or page object, re-run that test once;
   - **product defect or different expected text** → do not change expectations, report it;
   - **rate limit (429) or network** → stop and report `ENV_BLOCKED` with the retry-after time.
4. Never raise retries or timeouts, add sleeps, or weaken assertions to make a test pass.

## Output

Return JSON with:
- `status` — `PASSED`, `FAILED` or `ENV_BLOCKED`
- `summary` — at most 5 lines
- `failures` — one entry per remaining failure: test, category, evidence, action taken or needed
