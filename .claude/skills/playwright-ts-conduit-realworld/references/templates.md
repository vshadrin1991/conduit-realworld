# Adding things — steps and registration

Full example files live in [../assets](../assets/README.md) (they compile against the current framework). This file lists where each kind of code goes and what must be registered. Imports use the `@/` alias for `src/`.

## Contents
- API spec
- UI spec
- Page object
- Page component
- API endpoint
- API flow
- Test data generator

## API spec — `tests/api/<resource>.api.spec.ts`

Example: `assets/tests/api/articles.api.spec.ts`.

- Arrange with `get(APIClient).api.<domain>.create()`, act with an endpoint helper, assert the returned model with `toMatchObject`.
- Negative case: `get(APIClient, { guest: true }).response({ name, path, pathData, method, body, statusCode })`, then assert `(await response.json()) as ErrorResponse`.
- A new slug/id created outside a flow: `get(APIClient).api.articles.track(slug)`.
- Calls to `/api/users*` → `{ tag: AUTH_QUOTA }`.

## UI spec — `tests/ui/<feature>.ui.spec.ts`

Examples: `assets/tests/ui/articles.ui.spec.ts` (hybrid), `assets/tests/ui/auth.ui.spec.ts` (mocked response, header menu, localStorage).

- Signed-in browser: sign in through the form — `const testUser = await getTestUser()`, then `await get(LoginPage, Route.login).fillData('email', testUser.email).fillData('password', testUser.password).clickActionButton('login')` and `await get(HomePage).waitUntilPageLoaded()` (in `test.beforeEach` for the whole describe) — and tag the test or describe `AUTH_QUOTA`. Guest scenarios skip it.
- Steps: `await get(Page, Route.x).fillData(...).clickActionButton(...)`; after navigation `await get(NextPage).waitUntilPageLoaded()`.
- Locators outside the named maps: call element components from the page — `page.button.click(locator)`, `page.input.enter(locator, text)`, `page.text.getTexts(locator)`.
- Mock only what the backend cannot produce on demand: `await get(Interceptor).mock(url, { status, json })` before the action; state the reason in the task or pull request (no code comment).
- Tests of a file run one by one, each in its own new browser: log in and arrange in `beforeEach` (never `beforeAll`), with no dependency between tests.

## Page object — `src/pageObject/pages/<Name>Page.ts`

Example: `assets/src/pageObject/pages/SettingsPage.ts`.

1. Type unions for the groups the page has (`never` for the rest: `BasePage<never, ButtonName>`; checkboxes and radio buttons are the 3rd and 4th type parameters).
2. `root` — a locator present only when the page is rendered.
3. Named maps (`fields`, `errors`, `buttons`, `checkboxes`, `radioButtons`), public read-only locators, locator-returning methods for parametrised elements.
4. Route in `../../../../src/pageObject/pagePath/Routes.ts`.
5. JSDoc with `@param` / `@return` on every getter and method; no class-level comment — see [code-conventions](code-conventions.md#page-objects).

## Page component — `src/pageObject/components/<Name>.ts`

Example: `assets/src/pageObject/components/Selector.ts`.

`BaseComponent` is only for page components. A class about the API, test data or capture (like `Interceptor` in `src/utilities/`) does not extend it: it takes `page` in its constructor, creates its own logger and gets an overload plus a branch in the `get` fixture of `BaseTest` ([components](components.md#basecomponent-is-for-page-components-only)).

- Element component (acts on a locator passed to each call): extend `BaseComponent`, log at `debug`. Always add `readonly selector: Selector;` to `BasePage` and create it in the constructor — tests then call `somePage.selector.select(locator, 'x')`.
- Page component without an element (like `LocalStorage`): extend `BaseComponent`, use it with `get(Name)`.
- Page fragment shared by pages (like `Header`): readonly locators + locator-returning methods, exposed from `BasePage` through composition.

## API endpoint

Example: `assets/src/api/client/helpers/users/UsersPutAPI.ts`.

1. Path in `src/api/client/path/BasePath.ts` (`PROFILE_FOLLOW = '/profiles/{data1}/follow'`).
2. Models in `src/api/request/<domain>/` and `src/api/responses/<domain>/` (one model + wrapper per file).
3. Method in `src/api/client/helpers/<domain>/<Domain><Verb>API.ts` — returns the model and passes the success status.
4. New domain class? Register it in `src/api/client/helpers/RestApi<Verb>Helper.ts`:

```ts
readonly users: UsersPutAPI;
// constructor:
this.users = new UsersPutAPI(request, token);
```

Now `get(APIClient).put.users.with(changes)` works.

## API response schema — `src/api/schemas/<domain>/<name>.schema.json`

1. Write the schema as a JSON file next to the other schemas of the domain: `$schema` draft 2020-12, `$id` the file name, `title` the model name, `additionalProperties: false`, every field the API always returns in `required`, `format: date-time` for timestamps. Reuse a shared model with `{ "$ref": "profile.schema.json" }`.
2. Register it in `src/api/schemas/Schema.ts`:

```ts
import tags from './tags/tags.schema.json';

export const Schema = {
  // ...
  TAGS: tags,
} as const;
```

3. Use it in the spec next to the value assertions: `expect(tags).toMatchSchema(Schema.TAGS);`. The schema describes what the endpoint helper returns — the whole response for `Schema.ARTICLES`, the array for `Schema.COMMENTS`.

## API flow — `src/api/client/api/<domain>/<Domain>API.ts`

Example: `assets/src/api/client/api/comments/CommentsAPI.ts`.

Register it in `src/api/client/api/ConduitAPI.ts`:

```ts
readonly comments: CommentsAPI;
// constructor, after articles:
this.comments = new CommentsAPI(client);
```

Use: `get(APIClient).api.comments.create(slug, 3)`.

A flow that creates a new kind of data follows `ArticlesAPI`: store created ids in `TestDataStorage` (`track`), delete them in a `deleteCreated()` that accepts 404 and logs instead of failing, and call it from the `dataCleaner` auto fixture in `src/base/BaseTest.ts`.

## Test data generator — `src/utilities/tests/TestDataGenerator.ts`

```ts
/**
 * Generates a profile bio containing the automation key.
 * @param overrides - fields to use instead of generated values
 * @return profile bio payload
 */
export function generateProfileBio(overrides: Partial<{ bio: string }> = {}) {
  return { bio: `${generatePhrase()} ${generateTestsName('bio')}`, ...overrides };
}
```

Keep the automation key in every generated name (`generateTestsName` / `generateShortTestsName` add it) so cleanup safety checks recognise the data.
