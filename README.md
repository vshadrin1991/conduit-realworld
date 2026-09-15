# Conduit Playwright tests

UI and API tests for [Conduit RealWorld](https://conduit-realworld-example-app.fly.dev/) with Playwright + TypeScript.

## Quick start

```bash
npm install
npx playwright install chromium
cp .env.example .env   # optional
npm run test:quick     # everything except tests that spend the auth quota
```

Requires Node.js ≥ 20.12.

The repeatable Archon workflows (test implementation, review, execution, requirements testing) live in [.archon/](.archon/README.md); their prerequisites and setup are in [.archon/SETUP.md](.archon/SETUP.md).

## Structure

```
src/
  base/                   BaseTest (get + automatic logs/dataCleaner), FunctionalPage, BasePage, BaseComponent
  pageObject/pages/       page objects — locators only (extend BasePage)
  pageObject/components/  page components (extend BaseComponent): Input, Button, Checkbox, RadioButton, Text, Confirmation, Header, LocalStorage
  pageObject/pagePath/    Routes.ts — hash routes
  api/client/             RestClient (core request/response), APIClient (get/post/put/delete helpers)
  api/client/helpers/     RestApi{Verb}Helper + <domain>/<Domain><Verb>API endpoint classes
  api/client/api/         ConduitAPI (the `api` group of APIClient) + <domain>/<Domain>API multi-call flows
  api/client/path/        BasePath (endpoint paths)
  api/client/session/     headers factory, auth/User.ts (cached token → login → register)
  api/request/            request models by domain
  api/responses/          response models by domain
  utilities/logger/       logger
  utilities/interceptor/  Interceptor — network mocks + API and console error capture for every test
  utilities/reporter/     ArtifactsReporter — reports/artifacts.json for failed tests
  utilities/tests/        TestDataGenerator (faker-based test data), TestDataStorage (per-test storage)
  config/                 env, auth, framework (browser, headless, timeouts, ...) and report configs
tests/
  api/                    "api" project
  ui/                     "ui" project — Chromium, guest by default
.claude/skills/           project skills for writing tests and triaging results
```

## Writing tests

All specs extend one base test and get collaborators through `get` (like `BaseTest.get(Class)` in Java):

```ts
import { expect, test } from '@/base/BaseTest';

test('author deletes an article', async ({ get }) => {
  const [article] = await get(APIClient).api.articles.create();               // arrange via API
  const testUser = await getTestUser();                                    // shared user
  await get(LoginPage, Route.login)                                        // sign in through the UI
    .fillData('email', testUser.email)
    .fillData('password', testUser.password)
    .clickActionButton('login');
  await get(HomePage).waitUntilPageLoaded();

  const dialog = get(ArticlePage).confirmation.answerNext('accept');
  await get(ArticlePage, Route.article(article.slug))                      // navigate + wait,
    .clickActionButton('deleteArticle');                                   // chained page steps

  expect(await dialog).toBe('Want to delete the article?');
  await get(APIClient, { guest: true }).response({                 // verify via API
    path: BasePath.ARTICLE, pathData: [article.slug], statusCode: 404,
  });
});
```

- Every spec imports `test` from `@/base/BaseTest`; test functions receive only `{ get }` (test user: `await getTestUser()`, localStorage: `get(LocalStorage)`, network mocks: `get(Interceptor)`).
- `get(APIClient)` is authenticated as the test user (`{ guest: true }` for no token): `client.post.articles.with(article)`, `client.get.comments.list(slug)`. Negative cases: `client.response({ path, method, body, statusCode: 401 })`. Multi-call flows: `get(APIClient).api.articles.create({ count: 2 })`. Every API call in a test starts with `get(APIClient)`.
- `get(PageClass)` returns the page object; `get(PageClass, route)` also queues navigation. Page calls chain and run when awaited: `await get(LoginPage, Route.login).fillData('email', email).clickActionButton('login')` (the await resolves to `void`; use `get(PageClass)` again to read locators). Pages hold locators only.
- Element helpers are used from the page: `homePage.button.click(homePage.header.userMenu)` (`page.input`, `page.button`, `page.checkbox`, `page.radioButton`, `page.text`), and so are native dialogs: `articlePage.confirmation.answerNext('accept')`. `get(Interceptor)` (utility) and `get(LocalStorage)` (page component) come from `get`.
- Test data comes from `TestDataGenerator` (`generateArticle()`, `generateUser()`, `generateTestsName('Article')`); every name contains `AUTOMATION_KEY`. Articles created by API flows are deleted after each test; register others with `get(APIClient).api.articles.track(slug)`.
- Nothing is set up globally: tests decide whether they need a user. Authenticated clients resolve the shared user lazily; UI tests start as guests and sign in through the login form (`LoginPage` steps, tagged `@auth-quota`) when they need a signed-in browser.

Full conventions: [.claude/skills/playwright-ts-conduit-realworld/SKILL.md](.claude/skills/playwright-ts-conduit-realworld/SKILL.md).

## Running

| Command | What |
|---|---|
| `npm test` | all projects |
| `npm run test:quick` | skip `@auth-quota` tests |
| `npm run test:api` / `npm run test:ui` | a single project |
| `npm run test:headed` / `npm run test:debug` / `npm run test:ui-mode` | debugging |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint (also flags page chains without `await`) |

## Environment limits

The demo server rate-limits by IP:
- about **100 requests per 15 minutes** for the whole site (pages, assets, API);
- about **5 requests per hour** for `/api/users` and `/api/users/login`.

The framework is built around this:
- the test user and its token are cached in `.auth/`;
- static assets are cached per worker;
- data is arranged through the API;
- tests that spend auth calls are tagged `@auth-quota`.

A 429 is logged as a warning in the test's `logs` attachment. Avoid running the full suite twice within 15 minutes.

## Configuration

Settings are typed configs in `src/config/`, overridable with environment variables or `.env` / `.env.<TEST_ENV>` files (precedence: real env vars → `.env.<TEST_ENV>` → `.env` → defaults). Every variable is listed in `.env.example`.

| Config | Variables | Defaults |
|---|---|---|
| `env.config.ts` | `TEST_ENV`, `BASE_URL`, `CI`, `AUTOMATION_KEY` | `demo`, demo site URL, —, `pwauto` |
| `auth.config.ts` | `TEST_USER_EMAIL` / `TEST_USER_PASSWORD`, `AUTH_DIR`, `AUTH_LOCK_STALE_MS` | registered user, `.auth`, `60000` |
| `framework.config.ts` | `BROWSER`, `HEADLESS`, `SLOW_MO`, `VIEWPORT_WIDTH` / `VIEWPORT_HEIGHT`, `LOCALE`, `TIMEZONE` | `chromium`, `true`, `0`, `1280×720`, `en-US`, `UTC` |
| | `WORKERS`, `RETRIES`, `FULLY_PARALLEL` (api), `UI_FULLY_PARALLEL` (ui: `false` = tests of a file one by one, files in parallel), `UI_NEW_BROWSER_PER_TEST` (ui: `true` = new browser for every test) | Playwright default / `2` on CI, `0` / `1` on CI, `true`, `false`, `true` |
| | `TEST_TIMEOUT`, `EXPECT_TIMEOUT`, `ACTION_TIMEOUT`, `NAVIGATION_TIMEOUT` | `30000`, `10000`, `10000`, `30000` |
| | `TRACE`, `VIDEO`, `SCREENSHOT`, `LOG_LEVEL` | `retain-on-failure`, `retain-on-failure`, `only-on-failure`, `info` |
| `report.config.ts` | `REPORTS_DIR`, `HTML_REPORT_OPEN`, `ALLURE`, `JUNIT` | `reports`, `never`, `true`, `true` on CI |

Example: `HEADLESS=false SLOW_MO=300 npx playwright test tests/ui/auth.ui.spec.ts`.

## Reports

| Command | Report |
|---|---|
| `npm run report` | Playwright HTML (`reports/html`) |
| `npm run allure:generate` then `npm run allure:open` | Allure (`reports/allure-report`) |
| `npm run results` | text summary with failure categories (`reports/results.json`) |

Every `npm test` / `npm run test:*` script clears `reports/allure-results` first (`npm run clean:results`), so the Allure report shows only the last run — for example no API tests after `npm run test:ui`. Runs started with `npx playwright test` or from an IDE do not clear it; run `npm run clean:results` before them.

Each test has a `logs` attachment with API calls, navigation and page actions; API calls are also report steps. Failed tests keep a trace, screenshot and video in `test-results/`.
