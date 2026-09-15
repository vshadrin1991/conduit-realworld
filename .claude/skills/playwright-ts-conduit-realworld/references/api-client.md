# API client

Part of the [playwright-ts-conduit-realworld](../SKILL.md) skill. Paths like `assets/…` and `scripts/…` are relative to the skill folder.

Read when writing API tests or adding endpoints, paths, models, helpers or flows.

## API client (mirrors the Java `rest/nora` layer)

- **Core** — `RestClient.response(request)` sends `{ path: BasePath, pathData, params, body, method, statusCode, headers, name }`: resolves `{dataN}` placeholders, adds headers from `RestClientFactory` (`headers` overrides them for one call), logs, reports 429s, wraps the call in a report step and verifies `statusCode` (default 200, `0` = no check, array = any of).
- **Endpoint helpers** — `APIClient` exposes `get`, `post`, `put`, `delete`, each grouping domain classes (`get(APIClient).get.articles`, `.post.comments`). A `<Domain><Verb>API` extends `RestClient` with one method per endpoint (`with` for create/update, `by` for single item, `list`, ...) that passes the success status and returns the model.
- **Flows** — `APIClient.api` is a `ConduitAPI` holding `<Domain>API` classes that combine calls and register created data for cleanup (`api.articles.create({ count })`, `api.articles.track(slug)`). Flow classes receive the client in the constructor and call its helpers.
- **Session** — `src/api/client/session/` is the auth side of the client: `RestClientFactory` (headers) and `auth/User.ts` (`getTestUser()` — the shared user; UI tests type its credentials into the login form).
- **Assertions** — helpers verify the success status themselves and return typed models; assert the model with `toMatchObject`. Negative cases call `get(APIClient).response({ ..., statusCode: 401 })` and assert the `ErrorResponse` body.
- **Paths and models** — endpoints live in `BasePath`; payloads in `src/api/request/<domain>/`, responses in `src/api/responses/<domain>/` (one model + wrapper per file). Never hard-code URLs.
- **Safety** — delete helpers refuse data without the automation key; keep that rule for any new delete helper.
- To add an endpoint: path → models → method in `helpers/<domain>/<Domain><Verb>API.ts` → register a new domain class in `RestApi<Verb>Helper`. No fixture changes are needed. Examples: `assets/src/api/client/helpers/users/UsersPutAPI.ts`, `assets/src/api/client/api/comments/CommentsAPI.ts`.
