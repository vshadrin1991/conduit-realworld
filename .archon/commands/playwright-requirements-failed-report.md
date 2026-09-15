---
description: Write why a requirements testing run failed
argument-hint: --r <requirements file>
---

# Requirements testing failed

**Inputs**: $inputs.output

**Environment**: $preflight.output

**Review**: $review.output

**Check in Chrome**: $live_testing.output

**Gate**: $gate.output

---

## Your task

Write `<outputDir>/requirements-testing-failed.md` (`outputDir` from `$ARTIFACTS_DIR/inputs.json`) and copy it to `$ARTIFACTS_DIR/`. Empty output above or a missing artifact file means that step did not run or did not finish — say so.

1. **Result: Failed** — one line per reason from **Gate** `reasons`.
2. **Failed requirements** — every `FAIL` row of `$ARTIFACTS_DIR/live-check.md`: REQ, expected (quoted), actual, evidence, likely cause (product defect / requirement outdated / environment).
3. **Blocking findings** — blocker findings of `$ARTIFACTS_DIR/requirements-review.md` with the question for the author.
4. **Environment** — the **Environment** result, HTTP 429s, Chrome or MCP errors, steps that did not run and why.
5. **Next steps** — what to fix or answer before running again: `archon workflow run playwright-requirements-testing --no-worktree -- --r <file>`.

Do not write test cases. Leave `test-cases.md` from an earlier run untouched and mention in the report that it is outdated when it exists. Do not edit other project files.

## Output

The failure reasons, one per line, and the report path.
