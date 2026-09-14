# Execution, rate limits and configuration

Part of the [playwright-ts-test-implementation](../SKILL.md) skill. Paths like `assets/…` and `scripts/…` are relative to the skill folder.

Read when running tests, reasoning about parallel workers and browsers, saving rate-limit budget, adding config variables or reading reports and logs.

## Parallelism and browsers

- `api` project: `fullyParallel` (`FULLY_PARALLEL`, default `true`) — any test may run in any worker.
- `ui` project: spec files run in parallel, each in its own worker, and the tests of one file run one by one (`UI_FULLY_PARALLEL=false`, default). Every test launches its own new browser and closes it afterwards (`UI_NEW_BROWSER_PER_TEST=true`, default; `false` = a new context in the worker's shared browser, faster).
- The per-test browser is created by the `context` fixture override in `BaseTest`; it never uses the built-in `browser` fixture (that would start an extra idle browser window). Context options from the config, traces, screenshots and videos still apply — keep it that way when changing fixtures.
- Never rely on test order or on state left by a previous test in the same file: each test has a new browser, `--repeat-each`/`--grep` change the order, and `UI_FULLY_PARALLEL=true` spreads tests across workers.
- Log in and arrange in `test.beforeEach` or in the test — never in `beforeAll`: `get` needs a page, and pages exist only inside a test.
- Group UI tests by feature into files; a very long file becomes one slow sequential lane.

## Rate-limit budget (critical on this environment)

The server allows about **100 requests per 15 minutes per IP for everything** (HTML, JS, API; the limit seems to be per server instance, so the remaining budget is unpredictable) and about **5 auth requests per hour**. A 429 makes pages render blank, so tests fail in misleading ways.

- Prefer API arrange and verification over extra UI navigation; keep `condition.retries` at 0 unless waiting is essential.
- Static assets are served from a per-worker cache by the extended `page` fixture — do not remove it (one worker per UI file also means one warm cache per file).
- Tag tests that call `/api/users` or `/api/users/login` with `{ tag: AUTH_QUOTA }`; `npm run test:quick` excludes them.
- Retries are 0 locally / 1 on CI; do not raise them to hide failures.
- A 429 is logged as a warning (`-> 429` in the test's `logs` attachment) — triage with the [playwright-ts-test-results](../../playwright-ts-test-results/SKILL.md) skill.
- While iterating, run a single spec or test (`npx playwright test tests/ui/articles.ui.spec.ts:12`).

## Configuration

- All settings live in `src/config/*.config.ts` and are read once through `loader.ts`. Precedence: real environment variables → `.env.<TEST_ENV>` → `.env` → code defaults. Invalid values (non-boolean `HEADLESS`, unknown `BROWSER`, ...) fail at startup with a clear message.
- `envConfig` (TEST_ENV, BASE_URL, CI, AUTOMATION_KEY), `authConfig` (TEST_USER_EMAIL/PASSWORD, AUTH_DIR, lock, session key, token scheme), `frameworkConfig` (BROWSER, HEADLESS, SLOW_MO, VIEWPORT_*, LOCALE, TIMEZONE, WORKERS, RETRIES, FULLY_PARALLEL, UI_FULLY_PARALLEL, UI_NEW_BROWSER_PER_TEST, *_TIMEOUT, TRACE, VIDEO, SCREENSHOT, LOG_LEVEL, INTERCEPTOR_NETWORK, INTERCEPTOR_CONSOLE, INTERCEPTOR_BODY_MAX), `reportConfig` (REPORTS_DIR, HTML_REPORT_OPEN, ALLURE, JUNIT, ARTIFACTS). `.env.example` lists every variable.
- Never read `process.env` directly in framework code or tests — add a typed field to the matching config (with a default) and to `.env.example`.
- One-off overrides: `HEADLESS=false SLOW_MO=300 npx playwright test tests/ui/auth.ui.spec.ts`.

## Reports and logs

- Every test gets a `logs` attachment (API calls with status/timing, navigation, page actions); API calls are also report steps. Console verbosity: `LOG_LEVEL=debug|info|warn|error`.
- Reports: `npm run report` (Playwright HTML), `npm run allure:generate && npm run allure:open` (Allure), `npm run results` (text summary for triage).
- Artifacts: a failed test gets a `dom` attachment (`dom.html`, the page DOM at failure time) from the `page` fixture in `BaseTest`; `ArtifactsReporter` (`src/utilities/reporter`) writes `reports/artifacts.json` after every run — one entry per failed or flaky test with `fileName`, `testName`, `project`, `line`, `status`, `error` and the `image`, `video` and `html` paths (`null` when not produced), plus the `network` and `console` entries captured by `Interceptor` (also the `interceptor` attachment of the failed test). Disable with `ARTIFACTS=false`.
