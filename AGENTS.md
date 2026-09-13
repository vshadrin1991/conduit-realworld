# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project

Playwright + TypeScript UI and API tests for [Conduit RealWorld](https://conduit-realworld-example-app.fly.dev/), a public demo app (React SPA with hash routes, REST API under `/api`) shared with other users. The framework deliberately mirrors the team's Java automation framework (`BaseTest.get`, `BasePage`/`FunctionalPage`, `pageElements`, `rest/nora`, `utilities/tests`); keep new code in that style.

## Detailed instructions

- Writing or changing tests, pages, components, API endpoints/flows, test data: `.claude/skills/playwright-ts-test-implementation/SKILL.md` (+ `references/templates.md`).
- Analyzing a run, failures, flaky tests, reports: `.claude/skills/playwright-ts-test-results/SKILL.md`.
- Fixing broken locators after a UI change: `.claude/skills/playwright-ts-test-self-healing/SKILL.md`.
- Preparing an automation task (test cases, pages saved with Ctrl/Cmd+S, requirements → Jira-style task in `tasks/<KEY>/`): `.claude/skills/playwright-ts-test-aqa-task/SKILL.md`.
- Running implementation, review or execution as Archon workflows: `.archon/README.md` (`.archon/workflows/playwright-tests-*.yaml`).

Read the relevant file before starting; this document is only the summary.

## Commands

```bash
npm install && npx playwright install chromium   # setup (Node >= 20.12)
npm run typecheck && npm run lint                 # always run after changes
npx playwright test tests/ui/articles.ui.spec.ts:15   # run one test while iterating
npm run test:quick                                # full suite without @auth-quota tests
npm run results                                   # summarize reports/results.json with failure categories
npm run page:md -- tasks/<KEY>/pages              # pages saved with Ctrl/Cmd+S → markdown page descriptions
npm run allure:generate && npm run allure:open    # Allure report
```

## Structure

```
src/base/              BaseTest (get + automatic logs/dataCleaner), BasePage + FunctionalPage, BaseComponent
src/pageObject/        pages (locators only), components (Input, Button, Checkbox, RadioButton, Text, Confirmation, LocalStorage, Interceptor, Session, Header), routes
src/api/client/        RestClient, ConduitRestClient (get/post/put/delete helpers), api/ flows, path/, session/
src/api/request|responses/   models by domain
src/utilities/         logger/logger, tests/TestDataGenerator, tests/TestDataStorage
src/config/            loader + env, auth, framework (browser/headless/timeouts/...), report configs
tests/                 api/*.api.spec.ts, ui/*.ui.spec.ts
```

## Rules

1. **Base test only.** Specs import `test`/`expect` from `@/base/BaseTest` and obtain everything through `get(...)`: pages, components and `ConduitRestClient` — every API call starts with `get(ConduitRestClient)` (flows: `get(ConduitRestClient).api.articles.create()`). Test functions take only `{ get }`. Nothing is set up globally — each test decides: `await getTestUser()` for the shared user, `await get(Session).login()` for a logged-in browser.
2. **Pages hold locators only.** Declare named `fields`/`buttons`/`checkboxes`/`radioButtons`/`errors`; no multi-step methods (`login()`, `publish()`). Tests chain page steps and await the chain once — `await get(Page, route).fillData(...).clickActionButton(...)` — and use the page element helpers for other locators (`page.button.click(locator)`).
3. **Arrange and verify through the API**, act through the UI. Use `get(ConduitRestClient).api.articles.create()` for prerequisites; negative API cases use `client.response({ ..., statusCode })`.
4. **Generated data only.** Use `TestDataGenerator`; every name contains `AUTOMATION_KEY`. Register data created outside API flows with `get(ConduitRestClient).api.articles.track(slug)` so `dataCleaner` deletes it. Never delete or modify data that is not automation data.
5. **Respect the rate limits.** ~100 requests / 15 min per IP for the whole site and ~5 auth calls / hour. Do not loop test runs; run the smallest scope that proves the change; tag tests hitting `/api/users*` with `AUTH_QUOTA`. A `429` is an environment problem, not a product bug — wait for `retry-after`.
6. **No sleeps or `waitForTimeout`.** Use web-first assertions. Locator priority: role → placeholder/label/text → semantic CSS; no XPath.
7. **Configuration through `src/config` only.** Never read `process.env` in framework code or tests; add a typed field (default + doc comment) to the matching `*.config.ts` and document the variable in `.env.example`.
8. **Never commit secrets.** `.auth/` (cached token), `.env` and `reports/` are git-ignored; never print or log tokens and passwords.

## Definition of done

- `npm run typecheck` passes.
- The changed or new tests pass when run in isolation (budget permitting), and failures are triaged with the results skill before expectations are changed.
- Created test data is cleaned up; quota-consuming tests are tagged.
- Skill docs, templates and `README.md` are updated when a convention changes.
