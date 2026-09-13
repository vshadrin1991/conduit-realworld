# Known Conduit behaviour

Part of the [playwright-ts-test-implementation](../SKILL.md) skill. Paths like `assets/…` and `scripts/…` are relative to the skill folder.

Read when a test touches feeds, the editor, article deletion, slugs or users — these quirks break naive tests.

## Known app behaviour to design around

- Hash routing: URLs look like `/#/article/<slug>`; use `Route.*` + `get(Page, route)`.
- Feeds show only 3 articles per page and other tests publish concurrently — never assert that a fresh article is on the first page; use `HomePage.findArticleInFeed(title)`.
- In the editor, pressing Enter in the tags field submits the form; enter tags comma-separated.
- Deleting an article opens a native `confirm` dialog — answer it with `Confirmation` before clicking.
- Title update regenerates the slug; omitting `tagList` on update clears tags.
- Unknown email login → 404; duplicate usernames are accepted; `PUT /api/user` with only `bio` → 500 (backend bug).
