---
description: Merge static checks and review findings into one Playwright review report
argument-hint: <files or folders that were reviewed>
---

# Review report

**Input**: $ARGUMENTS

**Scope**: $scope.output

**Static checks**: $static_checks.output

**Conventions review**: $review_conventions.output

**Test design review**: $review_design.output

**Allure report**: $allure.output

---

## Your task

Write `$ARTIFACTS_DIR/review.md`:

1. **Verdict** — `CHANGES_REQUESTED` when typecheck or lint failed or any blocker/major finding exists; otherwise `APPROVE`.
2. **Static checks** — typecheck and lint result with the first errors.
3. **Findings** — one table sorted by severity: Severity | File:line | Rule | Problem | Fix. Merge duplicates reported by both reviews.
4. **Last test run** — the Allure report URL from **Allure report** (results of the last run copied to `$ARTIFACTS_DIR/allure-results`), or that there were no results.
5. **What is good** — at most 3 bullets.

Do not edit project files.

## Output

The verdict line, finding counts by severity and the report path.
