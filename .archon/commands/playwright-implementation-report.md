---
description: Summarize a Playwright test implementation run into one report
argument-hint: <tasks/KEY/KEY.md | description of what was automated>
---

# Implementation report

**Input**: $ARGUMENTS

**Inputs**: $inputs.output

**Plan**: $plan.output

**Implementation**: $implement.output

**Verification**: $verify.output

**Allure report**: $allure.output

**Conventions review**: $review_conventions.output

**Test design review**: $review_design.output

---

## Your task

Write `$ARTIFACTS_DIR/implementation-report.md`. Steps that did not run have empty output — say that they were skipped and why (for example, the plan was `BLOCKED`).

1. **Result** — one line: implemented and verified / implemented with failures / blocked by open questions / blocked by the environment.
2. **Open questions** — from the plan; blocking ones first.
3. **Changes** — files from `$ARTIFACTS_DIR/changed-files.txt`, grouped: specs, page objects, API, data, docs.
4. **Tests** — each new or changed test with its verification status; remaining failures with category and next action; the Allure report URL from **Allure report** (results copied to `$ARTIFACTS_DIR/allure-results`) or why it was not served.
5. **Coverage** — when requirements or test cases were given: each requirement / test case ID → test, or the reason it is not automated.
6. **Review findings** — blocker and major findings still open.
7. **Next steps** — at most 5 bullets.

If a task file is the input and everything passed, also tick the finished subtasks and Definition of done items in that task file.

## Output

The result line and the report path.
