# Good examples

Complete files that show the framework conventions at full size. Paths mirror where the file would live in the project; every file compiles against the current framework (new models/helpers only need the registration described in [references/templates.md](../references/templates.md)). Like the project code, the examples carry no comments — this table says what each one shows.

| File | Shows |
|---|---|
| `tests/api/articles.api.spec.ts` | API spec: flow arrange, endpoint helper act, `toMatchObject`, guest client, tracking a new slug, negative case with `response({ statusCode })` |
| `tests/ui/articles.ui.spec.ts` | Hybrid UI spec: `Session.login` in `beforeEach`, page chains, `waitUntilPageLoaded`, `page.button` / `page.text` for locators outside the named maps, native dialog, UI + API verification, `track` for UI-created data |
| `tests/ui/auth.ui.spec.ts` | Mocked response with `Interceptor`, chained verifications, header menu through `page.button`, `LocalStorage` |
| `src/pageObject/pages/SettingsPage.ts` | Page object: `root`, named `fields`/`errors`/`buttons`, public read-only locator, locator-returning method |
| `src/pageObject/components/Selector.ts` | Element helper component with JSDoc (`@param` / `@return`) |
| `src/api/request/users/UpdateUser.ts` | Request model |
| `src/api/client/helpers/users/UsersPutAPI.ts` | Endpoint helper for a new domain + verb (register it in `RestApiPutHelper`; use it only for a user created by the test, tagged `AUTH_QUOTA`) |
| `src/api/client/api/comments/CommentsAPI.ts` | Multi-call flow that uses the client's helpers and other flows |

## Bad → good

| Bad | Good |
|---|---|
| `const client = get(ConduitRestClient); await client.post.articles.with(a)` | `await get(ConduitRestClient).post.articles.with(a)` |
| `get(ConduitAPI).articles.create()` | `get(ConduitRestClient).api.articles.create()` |
| `get(Button).click(homePage.header.userMenu)` | `homePage.button.click(homePage.header.userMenu)` |
| `get(Text).getTexts(articlePage.tags)` | `articlePage.text.getTexts(articlePage.tags)` |
| `await articlePage.expectLoaded()` | `await articlePage.waitUntilPageLoaded()` |
| `get(EditorPage, Route.newArticle).fillData('title', t)` (no `await`) | `await get(EditorPage, Route.newArticle).fillData('title', t)` |
| `const page = await get(ArticlePage).fillData(...)` then `page.title` | await the chain, then `get(ArticlePage).title` |
| Page method `publishArticle(data)` that fills and submits | Chain `fillData` / `clickActionButton` steps in the spec |
| `page.waitForTimeout(2000)` | `await expect(locator).toBeVisible()` / `waitUntilPageLoaded()` |
| Article published in the UI and left on the server | `get(ConduitRestClient).api.articles.track(articlePage.slug)` |
| `request.fetch('/api/articles/' + slug)` | `response({ path: ConduitBasePath.ARTICLE, pathData: [slug] })` |
| Test 2 of a file uses the article created by test 1 | Each test arranges its own data (every test runs in its own new browser) |
| `this.page.locator('div > div:nth-child(3) button')` | `this.page.getByRole('button', { name: 'Post Comment' })` |
| `// Tags are entered comma-separated: pressing Enter submits the form` above a locator | No comment: the behaviour is in `references/app-behaviour.md`, the element name says what it is |
