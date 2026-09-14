---
description: Plan Playwright UI/API tests for the Conduit framework from a task file or a description
argument-hint: <tasks/KEY/KEY.md | description of what to automate>
---

# Plan Playwright tests

**Input**: $ARGUMENTS

**Inputs**: $inputs.output

---

## Your task

Produce an implementation plan that follows the `playwright-ts-test-implementation` skill. Do not change project files except the plan file below.

1. Read every source listed under **Workflow inputs** (read the extracted text when a source lists it; read PDFs and images directly):
   - **Test cases** (`--test-cases`) — the cases to automate. Keep their IDs, titles, steps and expected results; do not add cases beyond them, and list noticed gaps as non-blocking questions.
   - **Requirements** (`--requirements`) — without test cases, derive the cases with the `playwright-ts-test-requirements` skill (positive, negative, boundary); with test cases, use them to check coverage and expected results. Map every case to a requirement ID.
   - **Page descriptions** (`--artifacts`) — element names, locators and open decisions of the saved pages.
   - **Task** — a task file (`tasks/<KEY>/<KEY>.md`): read it together with its `pages/*.md` page descriptions and `requirements/`; any other text is the description of what to automate or extra instructions for the sources above.
2. Read the code the change will touch: matching page objects and components in `src/pageObject/`, helpers and flows in `src/api/client/`, existing specs in `tests/`.
3. For every case decide:
   - layer (API, UI, hybrid, mocked UI) by the test pyramid;
   - spec file and test title;
   - page objects to add or extend, with element names from the page descriptions;
   - routes, paths, models, endpoint helpers, flows, test data generators;
   - tags (`AUTH_QUOTA` for registration/login calls).
4. Collect open questions: open questions of the task, open decisions of page descriptions that affect the cases, missing steps, expected results or exact messages. Never invent expected texts.
5. Write the plan to `$ARTIFACTS_DIR/plan.md`: cases → layer → files table, traceability (requirement / test case ID → spec and test title), file-by-file changes, open questions.

Status is **READY** when every case in scope has steps and expected results and no open question blocks it; otherwise **BLOCKED**.

## Output

Return JSON with:
- `status` — `READY` or `BLOCKED`
- `summary` — at most 5 lines
- `specs` — spec files to create or change
- `open_questions` — blocking and non-blocking questions, blocking ones first and marked `[blocking]`
