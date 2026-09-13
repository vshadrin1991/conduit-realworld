---
description: Plan Playwright UI/API tests for the Conduit framework from a task file or a description
argument-hint: <tasks/KEY/KEY.md | description of what to automate>
---

# Plan Playwright tests

**Input**: $ARGUMENTS

---

## Your task

Produce an implementation plan that follows the `playwright-ts-test-implementation` skill. Do not change project files except the plan file below.

1. If the input is a task file, read it together with its `pages/*.md` page descriptions and `requirements/`. Otherwise the input is the description of what to automate.
2. Read the code the change will touch: matching page objects and components in `src/pageObject/`, helpers and flows in `src/api/client/`, existing specs in `tests/`.
3. For every case decide:
   - layer (API, UI, hybrid, mocked UI) by the test pyramid;
   - spec file and test title;
   - page objects to add or extend, with element names from the page descriptions;
   - routes, paths, models, endpoint helpers, flows, test data generators;
   - tags (`AUTH_QUOTA` for registration/login calls).
4. Collect open questions: open questions of the task, open decisions of page descriptions that affect the cases, missing steps, expected results or exact messages. Never invent expected texts.
5. Write the plan to `$ARTIFACTS_DIR/plan.md`: cases → layer → files table, file-by-file changes, open questions.

Status is **READY** when every case in scope has steps and expected results and no open question blocks it; otherwise **BLOCKED**.

## Output

Return JSON with:
- `status` — `READY` or `BLOCKED`
- `summary` — at most 5 lines
- `specs` — spec files to create or change
- `open_questions` — blocking and non-blocking questions, blocking ones first and marked `[blocking]`
