# Known Conduit behaviour

Part of the [playwright-ts-conduit-realworld](../SKILL.md) skill. Paths like `assets/…` and `scripts/…` are relative to the skill folder.

Read when a test touches feeds, the editor, article deletion, slugs or users — these quirks break naive tests.

## Known app behaviour to design around

- Hash routing: URLs look like `/#/article/<slug>`; use `Route.*` + `get(Page, route)`.
- Feeds show only 3 articles per page and other tests publish concurrently — never assert that a fresh article is on the first page; use `HomePage.findArticleInFeed(title)`.
- The feed list re-renders asynchronously after switching tabs or pages, so give each page time before deciding an article is not there (`findArticleInFeed` does).
- In the editor, pressing Enter in the tags field submits the form; enter tags comma-separated.
- Deleting an article opens a native `confirm` dialog — answer it with `get(ArticlePage).confirmation.answerNext('accept')` before clicking.
- Article author actions (Edit Article, Delete Article) are rendered twice — in the banner and below the body; page objects use the banner copy (`.first()`).
- Login and registration show server errors in one `.error-messages` block above the form (for example an unknown or invalid email).
- Title update regenerates the slug; omitting `tagList` on update clears tags.
- Unknown email login returns **404** "Email not found sign in first"; duplicate usernames are accepted on registration; `PUT /api/user` with only `bio` returns **500** "data and salt arguments required" (backend bug).
- Sign-up responds **201** without `bio`/`image` in `{ user }` (REQ-01.D1), and `PUT /api/user` echoes only the sent fields back — send `email` along when the response is asserted against `Schema.USER`.
- `GET /api/tags` returns every tag ever stored, including tags no article carries anymore — a "popular tag" can open an empty feed, so tag-filter tests click a tag of an article the test created.
- `GET /api/articles?favorited=<unknown username>` responds **500** ("Cannot read properties of null") instead of an empty list.
- `POST /api/articles` never awaits `setAuthor`, so an article can persist with `userId NULL`; after that every `GET /api/articles` responds **500** `toAppend.hasFollower is not a function` and the row is undeletable via the API (`article.author.id` throws). Remediation: `DELETE FROM Articles WHERE userId IS NULL` (plus its `TagList` rows) in MySQL (REQ-02.D3).
- A request body without the resource wrapper (`{}` instead of `{ article: ... }` / `{ user: ... }` / `{ comment: ... }`) responds **500** "Cannot destructure property" — never a 422.
- Invalid `limit`/`offset` (`-1`, `abc`) respond **500** with a raw SQL error; a non-matching `tag`/`author` filter is fine and answers an empty list.
- `PUT /api/articles/:slug` ignores `tagList` entirely (tags never change on update) and accepts a title whose slug is already taken — the duplicate slug then breaks lookups (REQ-03.D2).
- Follow, unfollow, favorite and unfavorite are idempotent: repeating them answers **200** with the count unchanged. Following yourself is allowed (**200**, the count rises).
- A comment can be deleted through any article's URL — `DELETE /api/articles/<other slug>/comments/<id>` removes it anyway (REQ-04.D1).
- Deleting an article or a comment twice answers **404** the second time; a deleted article's slug is free to reuse immediately.
