# Components

Part of the [playwright-ts-test-implementation](../SKILL.md) skill. Paths like `assets/…` and `scripts/…` are relative to the skill folder.

Read when using or adding element components (`page.input`, `page.button`, `page.checkbox`, `page.radioButton`, `page.text`), native dialogs (`page.confirmation`) or browser-level components (`Session`, `LocalStorage`), or the `Interceptor` utility (mocks, API and console error capture).

## Components

- `src/pageObject/components/` mirrors the Java `pageElements`. **Element components** — `Input` (`enter`, `sendKeys`, `clear`, `getValue`, `getAttribute`, `verifyValue`), `Button` (`click`, `click(locator, { newTab })`, `clickViaJs`, `verifyEnabled`), `Checkbox` (`check`/`uncheck` idempotent, `getStatus`, `verifyStatus`), `RadioButton` (`click`, `status`, `verifyStatus`), `Text` (`getText`, `getTexts`, `waitTextExist`, `verifyTextExists`) — are fields of every page (`page.input`, `page.button`, `page.checkbox`, `page.radioButton`, `page.text`), and so is `Confirmation` (`page.confirmation` — native dialogs: `answerNext('accept' | 'dismiss')`); tests always call them from the page, never through `get`. **Browser-level components** (no page element to act on) are obtained with `get(ComponentClass)`: `LocalStorage` (`getItem`, `setItem`, `removeItem`), `Session` (`login(user?)` — logged-in browser without the login form).
- Components extend `BaseComponent`, take the locator as an argument of each call and log at `debug` level. Page fragments shared by pages (`Header`) are components used through composition (`page.header`). A new element component is added as a `readonly` field of `BasePage` (created in its constructor) so tests call it from the page; example: `assets/src/pageObject/components/Selector.ts`.
- Native dialogs must be answered before the action that opens them: `const dialog = articlePage.confirmation.answerNext('accept'); await articlePage.clickActionButton('deleteArticle'); expect(await dialog).toBe('Want to delete the article?');`
- `Interceptor` (`src/utilities/interceptor/`) is a utility, not a component, and is obtained with `get(Interceptor)`. `mock(url, { status, json })` / `unmock(url)` replace server responses. BaseTest starts its capture when every test starts, so it sees everything from the first step:
  - `network()` / `failedNetwork()` — browser calls under `/api/` (method, url, status, duration, bodies with passwords and tokens masked);
  - `console()` / `consoleErrors()` — console messages and uncaught page errors;
  - `verifyNoApiErrors()` / `verifyNoConsoleErrors()` — assertions listing the offending entries;
  - `reset()` — drops what arranging steps produced (e.g. an expected 404).

  Modes: `INTERCEPTOR_NETWORK=off|failed|all` (default `failed`), `INTERCEPTOR_CONSOLE=off|errors|all` (default `errors`: errors and warnings), `INTERCEPTOR_BODY_MAX`. A failed test gets the capture as the `interceptor` attachment and in the `network` / `console` keys of `reports/artifacts.json`.
- Never log passwords or tokens (`fillData` and `Input.enter` mask password values).
