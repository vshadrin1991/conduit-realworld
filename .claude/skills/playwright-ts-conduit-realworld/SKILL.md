---
name: playwright-ts-conduit-realworld
description: Project conventions and testing strategies of this Conduit Playwright + TypeScript framework — writing, extending and refactoring UI and API tests (BaseTest `get()` fixtures, BasePage page objects, components, REST client and api flows, test data, rate limits). Use this skill whenever the user asks to add, write, automate, cover, fix or refactor a test, spec, scenario, page object, component, API endpoint or flow, fixture or test data in this repo — including requests like "cover article favoriting", "automate the settings page", "add a negative case", "write an API test for comments" or "why is my new test flaky", even if they do not mention Playwright.
---

# Playwright + TS project conventions (Conduit)

Target app: https://conduit-realworld-example-app.fly.dev (React SPA with hash routes + REST API under `/api`).
The framework mirrors the team's Java framework (`BaseTest.get`, `BasePage`, `pageElements`, REST client layer, `utilities/tests`) and exists to keep tests **fast, isolated, readable and cheap on a heavily rate-limited environment**. When a situation is not covered below, choose what best preserves those goals.

**Good examples:** [assets](assets/README.md) holds complete, type-checked example files (API spec, hybrid UI spec, mocked UI spec, page object, component, endpoint helper, API flow) — open the matching one before writing new code and copy its shape. [references/templates.md](references/templates.md) lists the registration steps for each kind of addition.

**Task file:** when the work comes with a prepared task (`tasks/<KEY>/<KEY>.md`, created by the [playwright-ts-test-aqa-task](../playwright-ts-test-aqa-task/SKILL.md) skill), read it first — its cases, page descriptions (`pages/<name>.md`), requirements and open questions are the source of truth; resolve open questions with the user before implementing them.

**Skills built on these conventions:** [playwright-ts-api-checklist](../playwright-ts-api-checklist/SKILL.md) turns an endpoint into a case list before code is written, [playwright-ts-test-self-healing](../playwright-ts-test-self-healing/SKILL.md) repairs locators broken by UI changes, [playwright-ts-test-results](../playwright-ts-test-results/SKILL.md) triages runs, [playwright-ts-test-aqa-task](../playwright-ts-test-aqa-task/SKILL.md) and [playwright-ts-test-requirements](../playwright-ts-test-requirements/SKILL.md) prepare the work. They apply the rules of this skill; whenever they change code, these rules and the Definition of done below apply to that change.

## Project map

```
src/
  base/                   BaseTest (get + automatic logs/dataCleaner), BasePage
  pageObject/pages/       page objects — locators only
  pageObject/components/  page components (BaseComponent): element components on every page (Input, Button, Checkbox, RadioButton, Text, Confirmation), Navigation, Header, LocalStorage
  pageObject/pagePath/    Routes.ts — hash routes: Route.article(slug) etc.
  api/client/             RestClient (core `response(request)`), APIClient (get/post/put/delete helpers + api flows)
  api/client/helpers/     RestApi{Get,Post,Put,Delete}Helper + <domain>/<Domain><Verb>API endpoint classes
  api/client/api/         ConduitAPI (the `api` group) + <domain>/<Domain>API multi-call flows (ArticlesAPI.create/track/deleteCreated)
  api/client/path/        BasePath enum with {dataN} placeholders
  api/client/session/     RestClientFactory (headers), auth/User.ts (getTestUser: lazy, cached token → login → register)
  api/request/, api/responses/  request and response models by domain
  api/schemas/            JSON schemas of the responses by domain + Schema storage (expect(...).toMatchSchema)
  utilities/logger/       logger (console + per-test `logs` attachment)
  utilities/interceptor/  Interceptor — get(Interceptor): mock + API and console capture started for every test
  utilities/reporter/     ArtifactsReporter (reports/artifacts.json for failed and flaky tests), Step (inStep — report step reported at the spec line)
  utilities/tests/        TestDataGenerator (faker-based data, automation key), TestDataStorage (per-test storage)
  config/                 loader (.env + .env.<TEST_ENV>), env.config, auth.config, framework.config (browser, headless, timeouts, ...), report.config
tests/
  api/*.api.spec.ts       "api" project — fully parallel
  ui/*.ui.spec.ts         "ui" project — files in parallel, tests of a file one by one, new browser per test, guest by default — sign in through LoginPage steps
```

## Choosing the test layer

Follow the test pyramid: verify logic at the lowest layer that can observe it.

- **API test** — business rules, validation, status codes, payload shape, permissions. Most coverage belongs here.
- **UI test** — user-visible behaviour that needs the browser: navigation, rendering, forms, dialogs, client-side state. Keep them few and focused.
- **Hybrid (preferred UI style)** — arrange via API, act via UI step by step, assert in UI and verify persistence via API. Creating data through the UI in every test wastes time and rate-limit budget.
- **Mocked UI** — `get(Interceptor).mock(url, response)` for error/edge states the backend cannot produce on demand or that would burn the auth quota (invalid login). Mock only the boundary under test; the reason belongs in the task or pull request, not in a code comment.

## Writing a spec

Every spec imports from the single base test — never from `@playwright/test` directly:

```ts
import { test, expect } from '@/base/BaseTest';
```

Get collaborators through `get` (mirrors the Java `BaseTest.get(Class)`):

```ts
get(APIClient).post.articles.with(a); // REST client authenticated as the shared test user
get(APIClient, { guest: true }); // REST client without a token
get(APIClient).api.articles.create({ count: 2 }); // multi-call API flows (created data is deleted after the test)
get(ArticlePage); // page object bound to the current page (cached per test)
await get(ArticlePage, Route.article(slug)); // opens the page at the route; later calls use get(ArticlePage)
get(Interceptor); // network mocks (utility, not a component)
get(LocalStorage); // page component without an element to act on
```

**Every API call in a test starts with `get(APIClient)`** — endpoint helpers (`.get/.post/.put/.delete`), flows (`.api`) and raw calls (`.response`). Do not store the client in a local variable and do not import `ConduitAPI` in specs.

**Everything a page offers is reached through `get(PageClass)` — `get(PageClass).<component>.<action>()`.** Specs do not keep page objects in local variables: `get(PageClass)` returns the same cached instance for the whole test, so every line names the page it acts on and stays readable on its own.

Every page exposes the components `input`, `button`, `checkbox`, `radioButton`, `text`, `confirmation`, `navigation` (and `header`, `log`). Use them for locators that are not in the page's named maps and for native dialogs — `get(Input | Button | Checkbox | RadioButton | Text | Confirmation)` never appears in a spec:

```ts
await get(HomePage).button.click(get(HomePage).header.userMenu);
await get(HomePage).button.click(get(HomePage).articleLink(article.title));

const tagTexts = await get(ArticlePage).text.getTexts(get(ArticlePage).tags);
expect(tagTexts.toSorted()).toEqual(data.tagList!.toSorted());

const dialog = get(ArticlePage).confirmation.answerNext('accept');
await get(ArticlePage).clickActionButton('deleteArticle');
```

More Bad → Good pairs: [assets/README.md](assets/README.md#bad--good).

Tests describe the flow step by step — pages have no multi-step business methods, so every user action is visible in the spec:

```ts
const [article] = await get(APIClient).api.articles.create();

await get(ArticlePage, Route.article(article.slug));
await get(ArticlePage).fillData('comment', text);
await get(ArticlePage).clickActionButton('postComment');

await expect(get(ArticlePage).comment(text)).toBeVisible();
```

Every page call is a separate `await` and is one named step: `navigate`, `waitUntilPageLoaded`, `fillData`, `clickActionButton` and the `verify*` methods run on their own and are shown as a report step (`ArticlePage.fillData(comment)`) reported at the spec line that called them.

- Always `await` every page call — lint's `no-floating-promises` catches a missing one.
- `get(PageClass, route)` returns a promise, so it is awaited on its own line: `await get(ArticlePage, Route.article(slug));`. Everything after it goes through `get(ArticlePage)` — the same cached instance, no local variable.
- `navigate` already waits for the page, so `waitUntilPageLoaded` after `get(PageClass, route)` is redundant; use it after an action that navigates: `await get(HomePage).button.click(...)` then `await get(ArticlePage).waitUntilPageLoaded()`.

Test functions receive only `{ get }` — no other fixtures (`page`, `request`, ... are not used in specs). The shared user comes from `await getTestUser()` (`@/api/client/session/auth/User`), a signed-in browser from the login form steps (see **Browser** below), browser storage from `get(LocalStorage)`, network mocks from `get(Interceptor).mock(url, response)` (its API/console capture is attached to failed tests automatically). Logging and data cleanup run automatically as auto fixtures inside `BaseTest` (`dataCleaner` is declared after `logs`, so its teardown is logged). `get` depends on `page`, so API specs also get a never-navigated browser page (startup time, no server requests).

Structure each test as Arrange / Act / Assert separated by blank lines, one behaviour per test, with a title that states the behaviour (`'author deletes an article'`).

## Waiting and assertions

- Use web-first assertions (`await expect(locator).toBeVisible()`, `toHaveURL`, `toHaveText`); never `page.waitForTimeout` or sleeps.
- Wait for the next page with `await get(NextPage).waitUntilPageLoaded()` after an action that navigates.
- Assert the outcome the user cares about, not implementation details.

## Rules for every change

- **Rate limits** — ~100 requests / 15 min per IP and ~5 auth requests / hour: arrange and verify through the API, run the smallest scope, keep sign-in and registration tests few. Details: [execution-and-config](references/execution-and-config.md).
- **Test data** — generate it with `TestDataGenerator`, create prerequisites with API flows, track anything created another way. Details: [test-data-and-auth](references/test-data-and-auth.md).
- **Browser** — every UI test runs in its own new browser and starts as a guest. A test that needs a user signs in through the login form — `getTestUser()` credentials, then one awaited `LoginPage` step per line, ending with `await get(HomePage).waitUntilPageLoaded()` (worked example: `assets/tests/ui/articles.ui.spec.ts`) — in `beforeEach` or the test, never in `beforeAll`. Each sign-in spends the ~5 requests / hour auth quota, so keep such tests few. Details: [execution-and-config](references/execution-and-config.md), [test-data-and-auth](references/test-data-and-auth.md).
- **Page objects** — locators only; priority role → placeholder/label/text → semantic CSS; no XPath. Details: [page-objects](references/page-objects.md).
- **Components** — `BaseComponent` (`src/pageObject/components/`) is for page components only (element components, `Header`, `Confirmation`, `Navigation`, `LocalStorage`); `Interceptor` is a utility and does not extend it. Element components and `confirmation` are called from the page; `get()` only for `Interceptor` and `LocalStorage`. Details: [components](references/components.md).
- **API** — every call starts with `get(APIClient)`; paths in `BasePath`, models by domain; validate the response shape with `expect(model).toMatchSchema(Schema.X)`. Details: [api-client](references/api-client.md).
- **Configuration** — never read `process.env` outside `src/config`. Details: [execution-and-config](references/execution-and-config.md).
- **Comments** — no `//` or one-line `/** */` comments in code; a multi-line JSDoc block (one sentence, `@param` for every parameter, `@return` unless `void`) on every function and method in base classes, utilities, page objects, helpers, flows and components; no class-level comments on page objects and utility classes. Details: [code-conventions](references/code-conventions.md).

## References

Open the reference that matches the work before writing code:

| Reference                                                              | Read when                                                                                                      |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [page-objects.md](references/page-objects.md)                          | Adding or changing a page object, choosing locators, turning a saved page (Ctrl/Cmd+S) into a page description |
| [components.md](references/components.md)                              | Using or adding page components (`BaseComponent`) or `Interceptor`                                             |
| [api-client.md](references/api-client.md)                              | API tests, new endpoints, paths, models, helpers or flows                                                      |
| [playwright-ts-api-checklist](../playwright-ts-api-checklist/SKILL.md) | Deciding **what** to cover for an endpoint before writing the cases                                            |
| [test-data-and-auth.md](references/test-data-and-auth.md)              | Generating and cleaning up data, the shared test user, signing in through the UI, auth quota                   |
| [execution-and-config.md](references/execution-and-config.md)          | Parallel workers and browsers, rate-limit budget, config variables, reports and logs                           |
| [app-behaviour.md](references/app-behaviour.md)                        | Tests touching feeds, the editor, article deletion, slugs or users                                             |
| [code-conventions.md](references/code-conventions.md)                  | Adding public methods, or before writing any comment (comments are not allowed in code)                        |
| [templates.md](references/templates.md)                                | Where each kind of code goes and what to register                                                              |
| [assets/README.md](assets/README.md)                                   | Full example files to copy                                                                                     |

## Definition of done for a new or changed test

1. `npm run typecheck` and `npm run lint` pass (lint's `no-floating-promises` catches page calls without `await`).
2. The test passes when run alone, and again with `--repeat-each=2` if budget allows — this catches data coupling.
3. It fails for the right reason: temporarily break the expectation and check the message is clear.
4. Created data is registered for cleanup (API flows or `api.articles.track`).
5. Every API call starts with `get(APIClient)`; element components (`input`, `button`, `checkbox`, `radioButton`, `text`) are called from the page.
6. Triage any failure with the [playwright-ts-test-results](../playwright-ts-test-results/SKILL.md) skill before changing expectations; heal locators broken by a UI change with the [playwright-ts-test-self-healing](../playwright-ts-test-self-healing/SKILL.md) skill.
7. If the change alters a convention, the skills, templates and README say so too — otherwise the next agent follows the old rule.
