# API client

Part of the [playwright-ts-conduit-realworld](../SKILL.md) skill. Paths like `assets/…` and `scripts/…` are relative to the skill folder.

Read when writing API tests or adding endpoints, paths, models, helpers or flows.

## API client (mirrors the Java REST client layer)

- **Core** — `RestClient.response(request)` sends `{ path: BasePath, pathData, params, body, method, statusCode, headers, name }`: resolves `{dataN}` placeholders, adds headers from `RestClientFactory` (`headers` overrides them for one call), logs, reports 429s, wraps the call in a report step and verifies `statusCode` (default 200, `0` = no check, array = any of).
- **Endpoint helpers** — `APIClient` exposes `get`, `post`, `put`, `delete`, each grouping domain classes (`get(APIClient).get.articles`, `.post.comments`). A `<Domain><Verb>API` extends `RestClient` with one method per endpoint (`with` for create/update, `by` for single item, `list`, ...) that passes the success status and returns the model.
- **Flows** — `APIClient.api` is a `ConduitAPI` holding `<Domain>API` classes that combine calls and register created data for cleanup (`api.articles.create({ count })`, `api.articles.track(slug)`). Flow classes receive the client in the constructor and call its helpers.
- **Session** — `src/api/client/session/` is the auth side of the client: `RestClientFactory` (headers) and `auth/User.ts` (`getTestUser()` — the shared user, `getOtherUser()` — the cached secondary account for cross-user cases, both resolved once and kept in `.auth/`). UI tests sign in with `get(Session).login()`, which injects `loggedUser` into localStorage without an auth call; only the session spec types credentials into the login form.
- **Response schemas** — `src/api/schemas/<domain>/<name>.schema.json` holds a JSON schema per response model; `Schema` (`src/api/schemas/Schema.ts`) imports them and `expect(value).toMatchSchema(Schema.ARTICLE)` validates with ajv. Each schema is strict (`additionalProperties: false`, every field required unless the API really omits it), so a new or renamed field in the response fails the test with the field name. Shared models are referenced by `$id` (`article.schema.json` refers to `profile.schema.json`).
- **Assertions** — helpers verify the success status themselves and return typed models; check the shape once with `toMatchSchema` and the values with `toMatchObject`. Negative cases call `get(APIClient).response({ ..., statusCode: 401 })` and assert the error in one step: `await expect(response).toBeApiError('You need to login first!', 401)` validates the status, the `Schema.ERROR` shape and the `errors.body` message.
- **Paths and models** — endpoints live in `BasePath`; payloads in `src/api/request/<domain>/`, responses in `src/api/responses/<domain>/` (one model + wrapper per file). Never hard-code URLs.
- **Safety** — delete helpers refuse data without the automation key; keep that rule for any new delete helper.
- To add an endpoint: path → models → method in `helpers/<domain>/<Domain><Verb>API.ts` → register a new domain class in `RestApi<Verb>Helper`. No fixture changes are needed. Examples: `assets/src/api/client/helpers/users/UsersPutAPI.ts`, `assets/src/api/client/api/comments/CommentsAPI.ts`.
