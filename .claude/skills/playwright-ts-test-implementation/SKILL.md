---
name: playwright-ts-test-implementation
description: Conventions and testing strategies for writing, extending and refactoring UI and API tests in this Conduit Playwright + TypeScript framework (BaseTest fixtures with get(), BasePage page objects with element helpers, components, REST client with verb helpers and api flows, paths and request/response models, TestDataGenerator/TestDataStorage, auth caching, Allure, logger, rate limits). Use this skill whenever the user asks to add, write, automate, cover, fix or refactor a test, spec, scenario, page object, component, API endpoint or flow, fixture or test data in this repo — including requests like "cover article favoriting", "automate the settings page", "add a negative case", "write an API test for comments" or "why is my new test flaky", even if they do not mention Playwright.
---

# Playwright + TS test implementation (Conduit)

Target app: https://conduit-realworld-example-app.fly.dev (React SPA with hash routes + REST API under `/api`).
The framework mirrors the team's Java framework (`BaseTest.get`, `BasePage`/`FunctionalPage`, `pageElements`, `rest/nora`, `utilities/tests`) and exists to keep tests **fast, isolated, readable and cheap on a heavily rate-limited environment**. When a situation is not covered below, choose what best preserves those goals.

**Good examples:** [assets](assets/README.md) holds complete, type-checked example files (API spec, hybrid UI spec, mocked UI spec, page object, component, endpoint helper, API flow) — open the matching one before writing new code and copy its shape. [references/templates.md](references/templates.md) lists the registration steps for each kind of addition.

**Task file:** when the work comes with a prepared task (`tasks/<KEY>/<KEY>.md`, created by the [playwright-ts-test-aqa-task](../playwright-ts-test-aqa-task/SKILL.md) skill), read it first — its cases, page descriptions (`pages/<name>.md`), requirements and open questions are the source of truth; resolve open questions with the user before implementing them.

## Project map

```
src/
  base/                   BaseTest (get + automatic logs/dataCleaner), BasePage (implements FunctionalPage), FunctionalPage, BaseComponent
  pageObject/pages/       page objects — locators only
  pageObject/components/  element components on every page (Input, Button, Checkbox, RadioButton, Text), Confirmation, LocalStorage, Interceptor, Session, Header
  pageObject/routes.ts    hash routes: Route.article(slug) etc.
  api/client/             RestClient (core `response(request)`), ConduitRestClient (get/post/put/delete helpers + api flows)
  api/client/helpers/     RestApi{Get,Post,Put,Delete}Helper + <domain>/<Domain><Verb>API endpoint classes
  api/client/api/         ConduitAPI (the `api` group) + <domain>/<Domain>API multi-call flows (ArticlesAPI.create/track/deleteCreated)
  api/client/path/        ConduitBasePath enum with {dataN} placeholders
  api/client/session/     RestClientFactory (headers) + auth/testUser.ts (getTestUser: lazy, cached token → login → register)
  api/request/, api/responses/  request and response models by domain
  utilities/logger/       logger (console + per-test `logs` attachment)
  utilities/tests/        TestDataGenerator (faker-based data, automation key), TestDataStorage (per-test storage)
  config/                 loader (.env + .env.<TEST_ENV>), env.config, auth.config, framework.config (browser, headless, timeouts, ...), report.config
tests/
  api/*.api.spec.ts       "api" project — fully parallel
  ui/*.ui.spec.ts         "ui" project — files in parallel, tests of a file one by one, new browser per test, guest by default — log in with get(Session).login()
```

## Choosing the test layer

Follow the test pyramid: verify logic at the lowest layer that can observe it.

- **API test** — business rules, validation, status codes, payload shape, permissions. Most coverage belongs here.
- **UI test** — user-visible behaviour that needs the browser: navigation, rendering, forms, dialogs, client-side state. Keep them few and focused.
- **Hybrid (preferred UI style)** — arrange via API, act via UI step by step, assert in UI and verify persistence via API. Creating data through the UI in every test wastes time and rate-limit budget.
- **Mocked UI** — `get(Interceptor).mock(url, response)` for error/edge states the backend cannot produce on demand or that would burn the auth quota (invalid login). Mock only the boundary under test and say why in a comment.

## Writing a spec

Every spec imports from the single base test — never from `@playwright/test` directly:

```ts
import { test, expect, AUTH_QUOTA } from '@/base/BaseTest';
```

Get collaborators through `get` (mirrors the Java `BaseTest.get(Class)`):

```ts
get(ConduitRestClient).post.articles.with(a)          // REST client authenticated as the shared test user
get(ConduitRestClient, { guest: true })               // REST client without a token
get(ConduitRestClient).api.articles.create({ count: 2 }) // multi-call API flows (created data is deleted after the test)
get(ArticlePage)                                      // page object bound to the current page (cached per test)
get(ArticlePage, Route.article(slug))                 // same page with navigation queued — chain steps, await once
get(Session) / get(Confirmation) / get(Interceptor)   // browser-level components (no page element to act on)
```

**Every API call in a test starts with `get(ConduitRestClient)`** — endpoint helpers (`.get/.post/.put/.delete`), flows (`.api`) and raw calls (`.response`). Do not store the client in a local variable and do not import `ConduitAPI` in specs.

**Element components are called from the page, never through `get`.** Every page exposes `input`, `button`, `checkbox`, `radioButton`, `text` (and `header`, `log`). Use them for locators that are not in the page's named maps — `get(Input | Button | Checkbox | RadioButton | Text)` does not appear in specs:

```ts
const homePage = get(HomePage);
await homePage.button.click(homePage.header.userMenu);
await homePage.button.click(homePage.articleLink(article.title));

const articlePage = get(ArticlePage);
expect((await articlePage.text.getTexts(articlePage.tags)).toSorted()).toEqual(data.tagList!.toSorted());
```

Tests describe the flow step by step — pages have no multi-step business methods, so every user action is visible in the spec:

```ts
const [article] = await get(ConduitRestClient).api.articles.create();

await get(ArticlePage, Route.article(article.slug))
  .fillData('comment', text)
  .clickActionButton('postComment');

await expect(get(ArticlePage).comment(text)).toBeVisible();
```

Page calls are fluent (like the Java `FunctionalPage<P>`): `navigate`, `waitUntilPageLoaded` and every `FunctionalPage` method queue their action and return the page; `await` on the chain runs the actions in order, each shown as a report step (`ArticlePage.fillData(comment)`) located at the spec line.

- Always `await` the chain — an un-awaited chain does nothing visible.
- Awaiting resolves to `void`, not to the page. To read locators, take the cached instance again: `const articlePage = get(ArticlePage); await articlePage.waitUntilPageLoaded(); await expect(articlePage.title)...`.
- Element components (`page.button`, `page.text`, ...), browser-level components (`get(Confirmation)`, ...) and API clients are not chainable; await their calls individually.

Test functions receive only `{ get }` — no other fixtures (`page`, `request`, ... are not used in specs). The shared user comes from `await getTestUser()` (`@/api/client/session/auth/testUser`), a logged-in browser from `await get(Session).login()`, browser storage from `get(LocalStorage)`, network mocks from `get(Interceptor)`. Logging and data cleanup run automatically as auto fixtures inside `BaseTest` (`dataCleaner` is declared after `logs`, so its teardown is logged). `get` depends on `page`, so API specs also get a never-navigated browser page (startup time, no server requests).

Structure each test as Arrange / Act / Assert separated by blank lines, one behaviour per test, with a title that states the behaviour (`'author deletes an article'`).

## Waiting and assertions

- Use web-first assertions (`await expect(locator).toBeVisible()`, `toHaveURL`, `toHaveText`); never `page.waitForTimeout` or sleeps.
- Wait for the next page with `await get(NextPage).waitUntilPageLoaded()` after an action that navigates.
- Assert the outcome the user cares about, not implementation details.

## Rules for every change

- **Rate limits** — ~100 requests / 15 min per IP and ~5 auth requests / hour: arrange and verify through the API, run the smallest scope, tag auth calls `AUTH_QUOTA`. Details: [execution-and-config](references/execution-and-config.md).
- **Test data** — generate it with `TestDataGenerator`, create prerequisites with API flows, track anything created another way. Details: [test-data-and-auth](references/test-data-and-auth.md).
- **Browser** — every UI test runs in its own new browser; log in with `get(Session).login()` in `beforeEach` or the test, never in `beforeAll`. Details: [execution-and-config](references/execution-and-config.md), [test-data-and-auth](references/test-data-and-auth.md).
- **Page objects** — locators only; priority role → placeholder/label/text → semantic CSS; no XPath. Details: [page-objects](references/page-objects.md).
- **Components** — element components are called from the page; `get()` only for `Session`, `Confirmation`, `LocalStorage`, `Interceptor`. Details: [components](references/components.md).
- **API** — every call starts with `get(ConduitRestClient)`; paths in `ConduitBasePath`, models by domain. Details: [api-client](references/api-client.md).
- **Configuration** — never read `process.env` outside `src/config`. Details: [execution-and-config](references/execution-and-config.md).
- **Docs** — JSDoc with `@param` / `@return` on new public methods. Details: [code-conventions](references/code-conventions.md).

## References

Open the reference that matches the work before writing code:

| Reference | Read when |
|---|---|
| [page-objects.md](references/page-objects.md) | Adding or changing a page object, choosing locators, turning a saved page (Ctrl/Cmd+S) into a page description |
| [components.md](references/components.md) | Using or adding element components or browser-level components |
| [api-client.md](references/api-client.md) | API tests, new endpoints, paths, models, helpers or flows |
| [test-data-and-auth.md](references/test-data-and-auth.md) | Generating and cleaning up data, the shared test user, logged-in browser, auth quota |
| [execution-and-config.md](references/execution-and-config.md) | Parallel workers and browsers, rate-limit budget, config variables, reports and logs |
| [app-behaviour.md](references/app-behaviour.md) | Tests touching feeds, the editor, article deletion, slugs or users |
| [code-conventions.md](references/code-conventions.md) | Adding public methods to base classes, helpers, flows or components |
| [templates.md](references/templates.md) | Where each kind of code goes and what to register |
| [assets/README.md](assets/README.md) | Full example files to copy |

## Definition of done for a new or changed test

1. `npm run typecheck` and `npm run lint` pass (lint's `no-floating-promises` catches page chains without `await`).
2. The test passes when run alone, and again with `--repeat-each=2` if budget allows — this catches data coupling.
3. It fails for the right reason: temporarily break the expectation and check the message is clear.
4. Created data is registered for cleanup (API flows or `api.articles.track`).
5. Quota-consuming tests are tagged `AUTH_QUOTA`.
6. Every API call starts with `get(ConduitRestClient)`; element components (`input`, `button`, `checkbox`, `radioButton`, `text`) are called from the page.
7. Triage any failure with the [playwright-ts-test-results](../playwright-ts-test-results/SKILL.md) skill before changing expectations.
