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
- Unknown email login → 404; duplicate usernames are accepted; `PUT /api/user` with only `bio` → 500 (backend bug).
