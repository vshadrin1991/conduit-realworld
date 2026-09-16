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

| Area | Rule |
|---|---|
| Specs | `test` / `expect` imported from `@/base/BaseTest`; test functions take only `{ get }` — no `page` / `request` fixtures |
| API calls | Every call starts with `get(APIClient)` (`.get` / `.post` / `.put` / `.delete` / `.api` / `.response`); no `ConduitAPI` import, no client variables, no hard-coded URLs |
| Components | `input`, `button`, `checkbox`, `radioButton`, `text`, `confirmation` are called from the page; `get()` only for `LocalStorage`, `Interceptor`; signed-in UI tests sign in through `LoginPage` steps |
| Page chains | Chains are awaited; locators are read from `get(Page)` taken again; `waitUntilPageLoaded()` after an action that navigates |
| Hooks | Login and arrange in `beforeEach` or in the test — never `beforeAll` with `get` |
| Page objects | Locators only: `root` + named maps, no multi-step methods, no API calls; priority role → placeholder/label/text → semantic CSS; no XPath; `.first()` / `nth()` only with a stable reason (no code comment) |
| Test data | `TestDataGenerator`; data created outside flows is tracked; no module-level state; the shared user is not mutated |
| Waiting | No `waitForTimeout` or sleeps; web-first assertions |
| Config | No `process.env` outside `src/config` |
| Docs | No `//` or one-line `/** */` comments (tool directives allowed); multi-line JSDoc with `@param` / `@return` on new base, helper, flow and component methods; skills and README updated when a convention changed |

Report every violation with `file:line`, the rule, why it matters and a concrete fix. Skip formatting that Prettier and ESLint already enforce.

## Output

Return JSON with:
- `verdict` — `APPROVE` or `CHANGES_REQUESTED`
- `findings` — list of `{ severity: blocker | major | minor, file, line, rule, problem, fix }`
