# Test design

Part of the [playwright-ts-conduit-realworld](../SKILL.md) skill. Read before writing or reviewing a spec: it says how a spec is shaped. Where each kind of code goes is in [templates](templates.md).

## Page chains

Page actions (`navigate`, `waitUntilPageLoaded`, `fillData`, `clickActionButton`, `checkCheckbox`, `uncheckCheckbox`, `clickRadioButton` and the `verify*` methods) return the page. A test chains the steps of one page and awaits the chain once. Each step is still its own report step at the spec line that called it.

```ts
await get(EditorPage, Route.newArticle)
  .fillData('title', data.title)
  .fillData('body', data.body)
  .clickActionButton('submit')
  .next(ArticlePage)
  .waitUntilPageLoaded();

await expect(get(ArticlePage).title).toHaveText(data.title);
```

1. Consecutive steps on the same page form one chain, awaited once.
2. `get(Page, route)` only opens a chain: it queues the navigation, which is skipped when the page is already open.
3. Use `.next(Page)` exactly where a click lands on another page, followed by `.waitUntilPageLoaded()`.
4. Reads and assertions come after the awaited chain, as separate statements: `expect(get(Page).locator)`, `get(ArticlePage).slug`, `get(Page).text.getTexts(...)`, `get(HomePage).findArticleInFeed(...)`.
5. An `if`, a loop, an API call, an element-component call (`get(Page).button.click(locator)`) or `confirmation.answerNext(...)` ends the chain. Start a new one after it.
6. Never keep a page in a variable, and never return a page from an async function: awaiting a page runs its queue and gives `undefined`.
7. When you convert old code, keep the order of steps, arguments and waits exactly. Chaining changes only the layout.

`npm run lint:chains` lists consecutive same-page statements that should be one chain. It must print `0 statement(s)`.

## Tags

Tags come from `@/utilities/tests/Tag` and go in the test details: `test('title', { tag: Tag.SMOKE }, async ({ get }) => …)`, or `{ tag: [Tag.AUTH_QUOTA, Tag.KNOWN_DEFECT] }` for several.

| Tag                | Put it on                                                                                                        | Run                                                 |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `Tag.SMOKE`        | The few tests that prove the main flows work (create, read, comment, signed-in header); never a quota test       | `npm run test:smoke`                                |
| `Tag.AUTH_QUOTA`   | Every test that sends `POST /api/users` or `/api/users/login`, directly or by submitting the Login/Register form | excluded by `npm run test:no-quota`                 |
| `Tag.KNOWN_DEFECT` | Every `test.fail(...)`; the title keeps the `(REQ-xx.Dn)` defect id                                              | `npx playwright test --grep-invert @known-defect`   |

Retry a flaky area with `test.describe.configure({ retries: 1 })` in that describe, never globally.

## Data rows

A case that runs the same steps over several inputs gets one test per row, so each row passes or fails on its own and shows up on its own in the report:

```ts
const unknownSlugRows = [
  { name: 'read', method: 'GET', slug: () => generateShortTestsName('unknown'), body: undefined },
  { name: 'delete', method: 'DELETE', slug: () => generateShortTestsName('unknown'), body: undefined },
] as const;

for (const row of unknownSlugRows) {
  test(`responds 404 for an unknown slug on ${row.name}`, async ({ get }) => {
    …
  });
}
```

- Rows are module or describe constants with a `name` that makes each title unique. Generated data comes from builder functions (`slug: () => generateShortTestsName('unknown')`) that run inside the test, never at collection time.
- Keep one test with `expect.soft(value, row.name)` only when the rows share an arranged entity (splitting would repeat the arrange for every row) or when they spend the auth quota.
- Never split a `test.fail` loop: a known defect is expected to fail as a whole.

## Pre-state and cleanup

- State the test does not own (follows, favorites, settings of a shared account) is corrected before the test, never asserted: add an `ensure<State>(…)` flow that changes it only when it differs and returns the resulting model, e.g. `const { followersCount = 0 } = await get(APIClient).api.profiles.ensureFollowing(other.username, false);`.
- Cleanup never lives in a test body — no trailing deletes, no `try/finally`. Data created through flows is deleted by `dataCleaner`; data created another way is registered with `get(APIClient).api.articles.track(slug)`.

## ARIA snapshots

To prove a page, form or dialog opened with the right content, compare its accessibility tree instead of piling up `verifyElementExist` calls:

```ts
await get(SettingsPage).waitUntilPageLoaded().verifyAriaSnapshot('settings-form', get(SettingsPage).form);
```

- Files live in `tests/snapshots/<name>.aria.yml`, one per screen part, named after it (`settings-form`).
- Record or refresh with `npm run snapshots:update -- <spec> -g "<test title>"`, then review the git diff. Remove the values that depend on the user or on generated data (`- textbox "Your Name"` matches any value) and check those values with `verifyFieldData`.
- Snapshot only stable parts (forms, headers, dialogs), never feeds or lists of other users' data on the shared demo site.

## Writing rules

- **One spec per page or feature; bundle what shares a state.** When several checks need the same arrange and the same page state, assert them in one test instead of re-opening the page for each: every UI test starts a new browser and spends requests. Split when a check changes the state the next one needs.
- **No locators in specs.** A spec uses page locators and named elements only (`get(ArticlePage).title`, `fillData('comment', …)`); a new element goes to the page object first.
- **No `try` / `catch` / `finally` in specs.** A failing step must fail the test; cleanup belongs to flows and `dataCleaner`.
- **Assert in the spec.** Pages expose locators and data getters; the spec runs `expect`. Do not add page methods like `verifyArticleCount(n)` that hide the expected value — the `verify*` methods of `BasePage` are the only verify steps.
- **Helpers only for two or more call sites**, placed at the end of the spec file with a JSDoc block; never a shared test-utils module — repeat the steps instead.
- **Fetch shared data once per test.** Read `await getTestUser()` or an API model once into a `const` and reuse it; do not repeat the same GET in one test.
- **Framework core is read-only while writing tests.** `src/base/`, `src/api/client/RestClient.ts`, `src/api/client/APIClient.ts` and `src/utilities/reporter/` change only in a framework task. If a test seems to need a change there, stop and report the gap.
- **Copy the gold examples:** `tests/ui/articles.ui.spec.ts` (hybrid UI), `tests/api/articles.api.spec.ts` (API with data rows), `src/pageObject/pages/SettingsPage.ts` (page object), `src/api/client/api/profiles/ProfilesAPI.ts` (flow with `ensure*`).
