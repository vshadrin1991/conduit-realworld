# Conduit requirements (derived from the current implementation)

Five feature requirements reconstructed on 2026-09-14 from the running application
https://conduit-realworld-example-app.fly.dev and its source code. They describe **how the product behaves today**,
so they can be reviewed, confirmed and used as the baseline for test design and automation.

| ID | Requirement | Area | Priority |
|---|---|---|---|
| [REQ-01](REQ-01-registration-and-sign-in.md) | User registration, sign-in and session | Authentication | High |
| [REQ-02](REQ-02-home-feed-tags-and-pagination.md) | Home page feeds, tag filter and pagination | Discovery | High |
| [REQ-03](REQ-03-article-create-edit-delete.md) | Creating, editing and deleting articles | Content | High |
| [REQ-04](REQ-04-article-page-and-comments.md) | Article page and comments | Content | Medium |
| [REQ-05](REQ-05-profiles-follow-favorites-settings.md) | Profiles, following, favorites and user settings | Social / account | Medium |

## How the requirements were derived

| Evidence tag | Meaning |
|---|---|
| `observed` | Seen on the live application as a guest on 2026-09-14 (pages, texts, redirects, public API responses) |
| `code` | Read in the application source, [TonyMckes/conduit-realworld-example-app](https://github.com/TonyMckes/conduit-realworld-example-app) (`backend/controllers`, `backend/helper`, `backend/middleware`, default branch) |
| `tests` | Verified by the passing automated tests of this repository (`tests/api`, `tests/ui`) or recorded in `.claude/skills/playwright-ts-conduit-realworld/references/app-behaviour.md` |

- No account was created and no sign-in was performed in the browser during the walkthrough (auth requests are rate limited to about 5 per hour per IP). Behaviour that needs a signed-in user is taken from `code` and `tests` evidence.
- The deployed build may differ from the default branch of the source repository. Where the two disagree, the statement is listed under **Open questions** instead of being presented as a requirement.
- Messages are quoted verbatim, including trailing spaces produced by the backend (shown as `⎵`).
- Statements marked **implicit — confirm** are not guaranteed by any evidence and need a product decision.

## Common API conventions

- Base URL: `https://conduit-realworld-example-app.fly.dev/api`; the SPA uses hash routes (`/#/article/<slug>`).
- Every error response has the shape `{ "errors": { "body": ["<message>"] } }`.
- Status codes by error kind: not signed in → **401** `You need to login first!`; not the author → **403** `You are not the author of this <article|comment>`; missing resource → **404** `<Resource> not found <detail>`; validation → **422**; anything unexpected → **500** with the raw error message.
- The demo environment is rate limited (about 100 requests per 15 minutes per IP).

## Next steps

Review each requirement's **Open questions**, then design test cases with the `playwright-ts-test-requirements` skill (review → `test-cases.md` with traceability) or plan automation with the `playwright-ts-test-aqa-task` skill.
