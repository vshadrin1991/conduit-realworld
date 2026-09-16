---
description: Review the design, reliability and cost of Playwright tests in the Conduit project (read-only)
argument-hint: <files or folders to review; empty = changed files>
---

# Review: test design and reliability

**Input**: $ARGUMENTS

**Scope**: $scope.output

---

## Your task

Review the tests in scope — read each spec and the page objects and helpers it uses. This is read-only: do not edit files. If a task file (`tasks/<KEY>/<KEY>.md`) is named in the input, also compare the tests with its cases. When `$ARTIFACTS_DIR/inputs.json` exists (implementation workflow), also compare them with the requirements and test cases it lists.

Check:

1. **Value** — right layer by the test pyramid (API for rules and validation, UI only for what needs the browser); one behaviour per test; the title states the behaviour; Arrange / Act / Assert.
2. **Assertions** — verify the user-visible outcome and persistence through the API; negative API cases assert the `ErrorResponse` body; no assertions on implementation details.
3. **Isolation** — no dependency on test order, other tests' data or existing server data; tests of one UI file run one by one in separate browsers; feeds are searched with `findArticleInFeed`.
4. **Flakiness** — reads that do not retry right after an action (`getTexts`, `allInnerTexts`, `isVisible`, `count` without `expect` / `expect.poll`); exact counts on a shared server; races with native dialogs (answer before the click).
5. **Rate-limit cost** — data arranged through the UI instead of the API, extra navigations, retries or conditions that repeat requests, avoidable sign-ins.
6. **Mocks** — only the boundary under test.
7. **Coverage** — cases of the task, test cases or requirements that are missing or only partially asserted.

Report every problem with `file:line`, the risk (how it fails or what it misses) and a concrete fix.

## Output

Return JSON with:
- `verdict` — `APPROVE` or `CHANGES_REQUESTED`
- `findings` — list of `{ severity: blocker | major | minor, file, line, rule, problem, fix }`
