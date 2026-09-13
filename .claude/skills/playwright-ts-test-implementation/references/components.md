# Components

Part of the [playwright-ts-test-implementation](../SKILL.md) skill. Paths like `assets/…` and `scripts/…` are relative to the skill folder.

Read when using or adding element components (`page.input`, `page.button`, `page.checkbox`, `page.radioButton`, `page.text`) or browser-level components (`Session`, `Confirmation`, `LocalStorage`, `Interceptor`).

## Components

- `src/pageObject/components/` mirrors the Java `pageElements`. **Element components** — `Input` (`enter`, `sendKeys`, `clear`, `getValue`, `getAttribute`, `verifyValue`), `Button` (`click`, `click(locator, { newTab })`, `clickViaJs`, `verifyEnabled`), `Checkbox` (`check`/`uncheck` idempotent, `getStatus`, `verifyStatus`), `RadioButton` (`click`, `status`, `verifyStatus`), `Text` (`getText`, `getTexts`, `waitTextExist`, `verifyTextExists`) — are fields of every page (`page.input`, `page.button`, `page.checkbox`, `page.radioButton`, `page.text`); tests always call them from the page. **Browser-level components** (no page element to act on) are obtained with `get(ComponentClass)`: `Confirmation` (native dialogs: `answerNext('accept' | 'dismiss')`), `LocalStorage` (`getItem`, `setItem`, `removeItem`), `Interceptor` (`mock(url, { status, json })`, `unmock`), `Session` (`login(user?)` — logged-in browser without the login form).
- Components extend `BaseComponent`, take the locator as an argument of each call and log at `debug` level. Page fragments shared by pages (`Header`) are components used through composition (`page.header`). A new element component is added as a `readonly` field of `BasePage` (created in its constructor, with a doc comment) so tests call it from the page; example: `assets/src/pageObject/components/Selector.ts`.
- Native dialogs must be answered before the action that opens them: `const dialog = get(Confirmation).answerNext('accept'); await articlePage.clickActionButton('deleteArticle'); expect(await dialog).toBe('Want to delete the article?');`
- Never log passwords or tokens (`fillData` and `Input.enter` mask password values).
