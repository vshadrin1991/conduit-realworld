# Components

Part of the [playwright-ts-conduit-realworld](../SKILL.md) skill. Paths like `assets/…` and `scripts/…` are relative to the skill folder.

Read when using or adding page components — element components (`get(Page).input`, `.button`, `.checkbox`, `.radioButton`, `.text`), native dialogs (`.confirmation`), navigation (`.navigation`), page fragments (`.header`), `LocalStorage`, `Session` — or the `Interceptor` utility.

## BaseComponent is for page components only

- `BaseComponent` (`src/pageObject/components/BaseComponent.ts`) is the base of **page components**: classes that act on the rendered page through `this.page` — element components that take a locator per call, page fragments (`Header`), native dialogs (`Confirmation`), `Navigation` and the page's `LocalStorage`. They live in `src/pageObject/components/`.
- A class whose job is not the page does not extend `BaseComponent` and does not live in `components/`, even when it needs the `Page` — e.g. `Interceptor` (`src/utilities/interceptor/`), a utility that mocks and captures the browser's network and console. Such a class takes `page` in its constructor, creates its own logger (`createLogger('Name')`) and is registered in `BaseTest`: an overload in the `Get` interface and a fixture or branch of the `get` fixture that creates it.
- `Session` is the page component for sign-in: `await get(Session).login()` writes the app's `loggedUser` item to localStorage and reloads, so a signed-in browser costs **no auth call** — use it instead of typing credentials into the login form ([test-data-and-auth](test-data-and-auth.md#authentication)). The login form itself is exercised only by the session spec; `login(otherUser)` signs in as the secondary account.

## Page components

- `src/pageObject/components/` mirrors the Java `pageElements`. **Element components** — `Input` (`enter`, `verifyValue`, `getInput`), `Button` (`click`), `Checkbox` (`check` / `uncheck` idempotent, `verifyStatus`), `RadioButton` (`click` idempotent, `verifyStatus`), `Text` (`getTexts`) — are fields of every page, and so is `Confirmation` (native dialogs: `answerNext('accept' | 'dismiss')`). **Specs always call them as `get(PageClass).<component>.<action>()`** — never through `get(Component)` and never from a page kept in a local variable.
- `Navigation` (`to(route)` — opens `/#<route>`, skipped when the page is already there) has no element to act on but belongs to the page: it is `page.navigation`, and `BasePage.navigate` is the step that calls it and then waits for the page's `root`.
- `LocalStorage` (`getItem`, `setItem`) has no element to act on and is obtained with `get(LocalStorage)`; so is `Session` (`login`) — both are `BaseComponent`s without locators.
- Components extend `BaseComponent`, take the locator as an argument of each call and log at `debug` level. Page fragments shared by pages (`Header`) are components used through composition (`page.header`). A new element component is added as a `readonly` field of `BasePage` (created in its constructor) so tests call it from the page; example: `assets/src/pageObject/components/Selector.ts`.
- Add a component method together with the page method or test that uses it — unused helpers are removed.
- Native dialogs must be answered before the action that opens them: `const dialog = get(ArticlePage).confirmation.answerNext('accept'); await get(ArticlePage).clickActionButton('deleteArticle'); expect(await dialog).toBe('Want to delete the article?');`

## Interceptor

- `get(Interceptor).mock(url, { status, json })` replaces server responses. BaseTest starts the capture when every test starts — `network()` (browser calls under `/api/`: method, url, status, duration, bodies with passwords and tokens masked) and `console()` (console messages and uncaught page errors) — and attaches it to a failed test as the `interceptor` attachment and the `network` / `console` keys of `reports/artifacts.json`.

  Modes: `INTERCEPTOR_NETWORK=off|failed|all` (default `failed`), `INTERCEPTOR_CONSOLE=off|errors|all` (default `errors`: errors and warnings), `INTERCEPTOR_BODY_MAX`.

- Never log passwords or tokens (`fillData` and `Input.enter` mask password values).
