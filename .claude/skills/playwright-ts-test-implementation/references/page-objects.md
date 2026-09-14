# Page objects and locators

Part of the [playwright-ts-test-implementation](../SKILL.md) skill. Paths like `assets/…` and `scripts/…` are relative to the skill folder.

Read when adding or changing a page object, choosing a locator, or turning a page saved with Ctrl/Cmd+S into a page description.

## Page objects

- Extend `BasePage<FieldName, ButtonName, CheckboxName, RadioButtonName>`; define `protected readonly root` — a locator that exists only when the page is rendered (used by `navigate` / `waitUntilPageLoaded`).
- Declare interactive elements by name: string-literal unions plus `protected readonly fields/buttons/checkboxes/radioButtons: Record<Name, Locator>`, and `errors: Partial<Record<FieldName, Locator>>` for fields that show validation errors. `BasePage` implements `FunctionalPage` on top of them — `fillData`, `clickActionButton`, `checkCheckbox`/`uncheckCheckbox`, `clickRadioButton`, `verifyFieldData`, `verifyCheckboxStatus`, `verifyRadioButtonStatus`, `verifyErrorField`, `verifyErrorFieldText`, `verifyElementExist` — with type-checked names and logging. Do not re-implement these per page.
- Pages contain **locators only**: element maps, public `readonly` locators for read-only content and locator-returning methods for parametrised elements (`articlePreview(title)`, `articleLink(title)`). No methods that bundle steps (`login`, `publish`, `expectArticle`). The only accepted exception is a search helper with real logic (`HomePage.findArticleInFeed`); document why and start it with `await this.settled()` so it never races queued actions.
- A new generic page action belongs in `BasePage`/`FunctionalPage` and must stay chainable: `return this.enqueue('name(args)', async () => { ... })`.
- Page objects never make API calls or create test data.
- Add new routes to `pageObject/pagePath/routes.ts` instead of hard-coding URLs.
- Example: `assets/src/pageObject/pages/SettingsPage.ts`.

## Locators (in priority order)

1. `getByRole` with an accessible name — `getByRole('button', { name: 'Publish Article' })`
2. `getByLabel` / `getByPlaceholder` / `getByText` — most inputs have no labels, so placeholders are the stable choice for forms
3. Scoped CSS on semantic classes the app renders (`.article-preview`, `.error-messages`) and `filter({ hasText })` to narrow lists
4. Never XPath, generated class names, or `nth()` / `.first()` without a stable reason (such as the duplicated author actions in [app-behaviour](app-behaviour.md)); the reason goes into the task or pull request, not a code comment

A locator broke after a UI change? Use the [playwright-ts-test-self-healing](../../playwright-ts-test-self-healing/SKILL.md) skill.

## Pages saved from the browser

When a page comes as a file saved with Ctrl/Cmd+S (**Webpage, Complete**: `<name>.html` + `<name>_files/`), turn it into a page description before writing or extending a page object:

```bash
npm run page:md -- "tasks/<KEY>/pages/<name>.html"   # or a folder: every *.html in it
```

`scripts/parse-page-to-md.mjs` runs offline (page scripts disabled, network blocked — no rate-limit budget) and writes `<name>.md` next to the HTML: source route, root candidates, elements grouped as `fields` / `buttons` / `checkboxes` / `radioButtons` / errors / content with suggested names and locators (match counts checked on the saved DOM), forms with the matching chain, repeated items, the existing page object the locators already live in, open decisions and a page-object draft. Options: `--out <file|folder>`, `--name <PageClass>`, `--stdout`, `--all` (hidden elements), `--no-snapshot`.

- Treat the description as input, not final code: resolve every **Open decision** (non-unique locators, visible text that is test data, error-to-field mapping) and keep the locator priority above.
- Extend the existing page object it points to instead of creating a duplicate; links declared in `Header` stay in `page.header`.
- A saved DOM shows one state with its data; run the new test once to confirm the locators on the live page.
