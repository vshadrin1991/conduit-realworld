---
description: Review Playwright test code against the Conduit framework conventions (read-only)
argument-hint: <files or folders to review; empty = changed files>
---

# Review: framework conventions

**Input**: $ARGUMENTS

**Scope**: $scope.output

---

## Your task

Review the files in scope — read each one completely. This is read-only: do not edit files. The rules come from the `playwright-ts-conduit-realworld` skill:

| Area         | Rule                                                                                                                                                                                                             |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Specs        | `test` / `expect` imported from `@/base/BaseTest`; test functions take only `{ get }` — no `page` / `request` fixtures                                                                                           |
| API calls    | Every call starts with `get(APIClient)` (`.get` / `.post` / `.put` / `.delete` / `.api` / `.response`); no `ConduitAPI` import, no client variables, no hard-coded URLs                                          |
| Components   | `input`, `button`, `checkbox`, `radioButton`, `text`, `confirmation` are called from the page; `get()` only for `LocalStorage`, `Interceptor`; signed-in UI tests use `await get(Session).login()`; `LoginPage` steps only in the specs that test the form |
| Page chains  | Consecutive steps on one page are one awaited chain (`npm run lint:chains` prints 0); `.next(Page)` where a click lands on another page; reads and `expect` after the awaited chain through `get(Page)` again; no page in a variable |
| Hooks        | Login and arrange in `beforeEach` or in the test — never `beforeAll` with `get`                                                                                                                                  |
| Page objects | Locators only: `root` + named maps, no multi-step methods, no API calls; priority role → placeholder/label/text → semantic CSS; no XPath; `.first()` / `nth()` only with a stable reason (no code comment)       |
| Test data    | `TestDataGenerator`; data created outside flows is tracked; no module-level state; the shared user is not mutated                                                                                                |
| Data rows    | Same steps over several inputs are one test per row (`for (const row of rows) test(...)`); `expect.soft` only for rows sharing an arranged entity or the auth quota; no split `test.fail` loops                    |
| Tags         | Tests hitting `POST /api/users` or `/api/users/login` carry `Tag.AUTH_QUOTA`; every `test.fail` carries `Tag.KNOWN_DEFECT`                                                                                         |
| Test design  | No `try`/`catch`/`finally`, no raw locators, no trailing cleanup in specs; pre-state through `ensure*` flows; "page opened" checks through `verifyAriaSnapshot`; helpers only for 2+ call sites                    |
| Waiting      | No `waitForTimeout` or sleeps; web-first assertions                                                                                                                                                              |
| Config       | No `process.env` outside `src/config`                                                                                                                                                                            |
| Docs         | No `//` or one-line `/** */` comments (tool directives allowed); multi-line JSDoc with `@param` / `@return` on new base, helper, flow and component methods; skills and README updated when a convention changed |

Report every violation with `file:line`, the rule, why it matters and a concrete fix. Skip formatting that Prettier and ESLint already enforce.

## Output

Return JSON with:

- `verdict` — `APPROVE` or `CHANGES_REQUESTED`
- `findings` — list of `{ severity: blocker | major | minor, file, line, rule, problem, fix }`
