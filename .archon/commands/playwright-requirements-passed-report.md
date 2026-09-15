---
description: Write the requirements testing result and the ready test cases after a passed requirements testing run
argument-hint: --r <requirements file>
---

# Requirements testing passed

**Inputs**: $inputs.output

**Review**: $review.output

**Check in Chrome**: $live_testing.output

**Gate**: $gate.output

---

## Your task

Follow the `playwright-ts-test-requirements` skill (test design and test cases, steps 6–7) and its templates. The output folder is `outputDir` from `$ARTIFACTS_DIR/inputs.json` (`tasks/<KEY>/requirements/`). Suggest test layers by the test pyramid of the `playwright-ts-conduit-realworld` skill.

1. Write `<outputDir>/requirements-testing-result.md` from `$ARTIFACTS_DIR/requirements-review.md` and the review template, with **Result: Passed** at the top and an added section **Verification in Chrome**: totals and the table from `$ARTIFACTS_DIR/live-check.md` (screenshots referenced from the run artifacts).
2. Write `<outputDir>/test-cases.md` with the skill's `assets/test-cases-template.md`: test design, test cases with concrete test data and verbatim expected messages, layer (API / UI / hybrid), automation candidate and the traceability matrix covering every requirement. Cases whose expected result was confirmed in Chrome or does not depend on an open finding are **Ready**; cases that depend on an open finding are **Draft — confirm RV-n**; note `NOT_VERIFIED` requirements in the case notes.
3. Delete `<outputDir>/requirements-testing-failed.md` if an earlier run left it.
4. Copy both files to `$ARTIFACTS_DIR/`.

Do not edit other project files.

## Output

The two file paths, the number of requirements, test cases by priority and the number of drafts.
