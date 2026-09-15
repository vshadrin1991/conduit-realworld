# Test data and authentication

Part of the [playwright-ts-conduit-realworld](../SKILL.md) skill. Paths like `assets/…` and `scripts/…` are relative to the skill folder.

Read when generating or cleaning up test data, using the shared test user, logging in the browser or touching the auth quota.

## Test data (`utilities/tests`)

- Generate data with `TestDataGenerator`: `generateArticle()`, `generateUser()`, `generateComment()`, and primitives `generateTestsName(data)` (`data_<automationKey>_<yyyyMMddHHmmss><random>`), `generateShortTestsName`, `generateStringOfLength`, `generateEmail`, `generatePhrase`; add a new generator together with the test that uses it. Never depend on existing data on the shared server or on test order.
- Every generated name contains `AUTOMATION_KEY` (default `pwauto`); delete helpers refuse data without it (`isAutomationData`), because tests share the server with other people.
- Create prerequisites with API flows (`get(APIClient).api.articles.create()`); they register what they create in `TestDataStorage`, and the `dataCleaner` auto fixture deletes it after the test. Anything created another way (UI, direct endpoint call, new slug after an update) must be registered with `get(APIClient).api.articles.track(slug)`.
- `TestDataStorage` (`setData`, `getData`, `hasData`, `clearDataStorage`) holds per-test values; it is cleared after every test. Do not keep test state in module-level variables.
- Keep tags fixed (`AUTOMATION_TAGS`): tags outlive deleted articles on the server.
- Only the shared test user is reused; tests must not change its credentials or profile. A scenario that mutates a user creates one — and is tagged `AUTH_QUOTA`.

## Authentication

- Nothing is set up globally — each test decides whether it needs a user. `getTestUser()` resolves the shared user on first use in a worker (valid cached token in `.auth/user.json` → login with env/cached credentials → registration, under a file lock so workers register at most once). Authenticated REST clients from `get()` resolve it lazily on their first request; guest-only tests never touch auth.
- UI tests start as guests. A test that needs a signed-in browser signs in through the login form with the shared user's credentials (`getTestUser()` → `LoginPage` `fillData('email')` / `fillData('password')` / `clickActionButton('login')` → `get(HomePage).waitUntilPageLoaded()`), in `test.beforeEach` when the whole describe needs it. There is no session injection: the UI steps create the session the way a user does.
- Every sign-in or registration through the UI spends the auth quota (~5 requests / hour per IP): tag those tests or their describe `AUTH_QUOTA` (skipped by `npm run test:quick`), keep signed-in UI tests few, and cover logged-in behaviour through the API where the UI is not what is tested.
