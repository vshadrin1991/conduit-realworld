---
description: Implement planned Playwright tests following the Conduit framework conventions
argument-hint: <tasks/KEY/KEY.md | description of what to automate>
---

# Implement Playwright tests

**Input**: $ARGUMENTS

**Plan**: $plan.output

**Inputs**: $inputs.output

Full plan: `$ARTIFACTS_DIR/plan.md`

---

## Your task

Implement exactly the plan, following the `playwright-ts-conduit-realworld` skill. Before writing each kind of file, open the matching example in `.claude/skills/playwright-ts-conduit-realworld/assets/`.

1. Order: routes → paths and models → endpoint helpers and flows → page objects and components → specs.
2. Specs:
   - import `test` / `expect` from `@/base/BaseTest`; test functions take only `{ get }`;
   - every API call starts with `get(APIClient)`;
   - element components are called from the page (`page.button`, `page.input`, `page.text`, ...);
   - log in and arrange in `test.beforeEach` or in the test, never in `beforeAll`;
   - Arrange / Act / Assert, one behaviour per test, data from `TestDataGenerator`, UI-created data tracked, `AUTH_QUOTA` tags.
3. Page objects: locators only, `root` + named maps, locator priority role → placeholder/label/text → semantic CSS. Take locators from the page descriptions (the task's `pages/*.md` and the `--artifacts` descriptions listed under Inputs) and resolve their open decisions — no `// TODO` from drafts may remain.
4. New public methods of helpers, flows and components get JSDoc with `@param` and `@return`. No `//` or one-line `/** */` comments anywhere.
5. Do not run tests here: the server is rate limited, and static checks plus one verification run follow this step.
6. Write every created or changed file path, one per line, to `$ARTIFACTS_DIR/changed-files.txt`.

## Output

Return JSON with:
- `summary` — what was implemented, at most 8 lines
- `files` — created or changed files
- `specs` — spec locations of the new or changed tests, e.g. `tests/ui/settings.ui.spec.ts:12`
