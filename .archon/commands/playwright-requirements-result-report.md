---
description: Write the requirements testing result and the test cases of a requirements testing run
argument-hint: --r <requirements file>
---

# Requirements testing result and test cases

**Inputs**: $inputs.output

**Review**: $review.output

**Evidence**: $evidence.output

**Gate**: $gate.output

---

## Your task

Follow the `playwright-ts-test-requirements` skill (test design and test cases, steps 6–7) and its templates; suggest layers by the test pyramid of the `playwright-ts-conduit-realworld` skill. The output folder is `outputDir` from `$ARTIFACTS_DIR/inputs.json` (`tasks/<KEY>/requirements/`). Both files are always written, whatever the evidence showed — open questions and differences are reported, they never stop the deliverables.

1. Write `<outputDir>/requirements-testing-result.md`:
   - **Result** — `Ready for test design` when no finding is open, otherwise `Ready with open questions (<n>)`.
   - **Requirements** — the normalized table from `$ARTIFACTS_DIR/requirements-review.md`.
   - **Findings and questions for the author** — findings of the review, blockers and majors first, each with its question.
   - **What the application shows** — from `$ARTIFACTS_DIR/evidence.md`: totals, then every `DIFFERS` row with expected, observed, classification (possible product defect / requirement may be outdated / not specified), its question and the evidence, and a short list of the confirmed and not observed requirements.
   - **Coverage of the evidence** — when `Evidence` is `PARTIAL`, `ENV_BLOCKED` or missing: what was not observed and why (environment, sign-in quota, data), so the reader knows which expectations are unconfirmed.
   - **Next steps** — the decisions the author has to make, most important first.
2. Write `<outputDir>/test-cases.md` with the skill's `assets/test-cases-template.md`: test design, cases with concrete data and verbatim expected messages, layer (API / UI / hybrid), automation candidate and a traceability matrix covering every requirement.
   - Expected results come from the requirements, never from the observed behaviour.
   - A case whose requirement has an open finding or a `DIFFERS` row is **Draft — confirm RV-n / EV-n**, with the observed behaviour in its notes.
   - A case for a requirement that was only confirmed in the browser stays **Ready**; a requirement that nothing can cover goes to **Not covered** with the reason.
3. Delete `<outputDir>/requirements-testing-blocked.md` when an earlier run left it.
4. Copy both files to `$ARTIFACTS_DIR/`.

Do not edit other project files.

## Output

The two file paths, the number of requirements, cases by priority, how many are drafts, and the number of open questions and differences.
