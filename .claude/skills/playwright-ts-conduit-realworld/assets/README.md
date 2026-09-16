# Good examples

Complete files that show the framework conventions at full size. Paths mirror where the file would live in the project; every file compiles against the current framework (new models/helpers only need the registration described in [references/templates.md](../references/templates.md)). Like the project code, the examples carry no comments — this table says what each one shows.

| File                                          | Shows                                                                                                                                                                                                                              |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/api/articles.api.spec.ts`              | API spec: flow arrange, endpoint helper act, `toMatchObject`, guest client, tracking a new slug, negative case with `response({ statusCode })`                                                                                     |
| `tests/ui/articles.ui.spec.ts`                | Hybrid UI spec: sign-in through `LoginPage` in `beforeEach`, page steps, `waitUntilPageLoaded`, `page.button` / `page.text` for locators outside the named maps, native dialog, UI + API verification, `track` for UI-created data |
| `tests/ui/auth.ui.spec.ts`                    | Mocked response with `Interceptor`, `verify*` steps, header menu through `page.button`, `LocalStorage`                                                                                                                             |
| `src/pageObject/pages/SettingsPage.ts`        | Page object: `root`, named `fields`/`errors`/`buttons`, public read-only locator, locator-returning method                                                                                                                         |
| `src/pageObject/components/Selector.ts`       | Element helper component with JSDoc (`@param` / `@return`)                                                                                                                                                                         |
| `src/api/request/users/UpdateUser.ts`         | Request model                                                                                                                                                                                                                      |
| `src/api/client/helpers/users/UsersPutAPI.ts` | Endpoint helper for a new domain + verb (register it in `RestApiPutHelper`; use it only for a user created by the test)                                                                                                            |
| `src/api/client/api/comments/CommentsAPI.ts`  | Multi-call flow that uses the client's helpers and other flows                                                                                                                                                                     |

## Bad → good

| Bad                                                                                    | Good                                                                                            |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `const client = get(APIClient); await client.post.articles.with(a)`                    | `await get(APIClient).post.articles.with(a)`                                                    |
| `get(ConduitAPI).articles.create()`                                                    | `get(APIClient).api.articles.create()`                                                          |
| `get(Button).click(locator)`                                                           | `get(HomePage).button.click(locator)`                                                           |
| `get(Text).getTexts(locator)`                                                          | `get(ArticlePage).text.getTexts(locator)`                                                       |
| `const homePage = get(HomePage); await homePage.button.click(x)`                       | `await get(HomePage).button.click(x)`                                                           |
| `await get(ArticlePage).expectLoaded()`                                                | `await get(ArticlePage).waitUntilPageLoaded()`                                                  |
| `get(EditorPage, Route.newArticle)` (no `await`)                                       | `await get(EditorPage, Route.newArticle);`                                                      |
| `await get(ArticlePage, route).fillData(...)` (chaining)                               | `await get(ArticlePage, route);` then `await get(ArticlePage).fillData(...)`                    |
| Page method `publishArticle(data)` that fills and submits                              | Separate `fillData` / `clickActionButton` steps in the spec                                     |
| `page.waitForTimeout(2000)`                                                            | `await expect(locator).toBeVisible()` / `waitUntilPageLoaded()`                                 |
| Article published in the UI and left on the server                                     | `get(APIClient).api.articles.track(articlePage.slug)`                                           |
| `request.fetch('/api/articles/' + slug)`                                               | `response({ path: BasePath.ARTICLE, pathData: [slug] })`                                        |
| Test 2 of a file uses the article created by test 1                                    | Each test arranges its own data (every test runs in its own new browser)                        |
| `this.page.locator('div > div:nth-child(3) button')`                                   | `this.page.getByRole('button', { name: 'Post Comment' })`                                       |
| `// Tags are entered comma-separated: pressing Enter submits the form` above a locator | No comment: the behaviour is in `references/app-behaviour.md`, the element name says what it is |
