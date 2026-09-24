# Live check plan: Home page feeds, tag filter and pagination

| Field | Value |
|---|---|
| Key | REQ-02-home-feed-tags-and-pagination |
| Review | `requirements-review.md` |
| Checks | 29 requirements (33 rows) — 15 `ui`, 2 `ui-signed-in`, 12 `api`, 0 `static` |
| Browser | Chrome, hash routing (`/#/`) |

Rows are grouped by route so each page is opened once. Expected results are quoted from the requirements; where a finding leaves the expectation undefined, the row says what to **record** instead of what to assert (assumptions A1–A9 in the review).

---

## Group 1 — Route `#/` as a guest (open the home page once, checks run on the loaded page)

| ID | Class | Route | Steps | Expected observable result |
|---|---|---|---|---|
| REQ-02.3a | ui | `#/` | Throttle the network (slow 3G) or delay `GET /api/articles`, then open the home page and watch the feed area before the list renders. | The feed shows "Loading articles list..." (RV-15: transient — needs the response delayed). |
| REQ-02.3b | ui | `#/` | With the same delay on `GET /api/tags`, watch the sidebar before the tags render. | The tag sidebar shows "Loading tags...". |
| REQ-02.1 | ui | `#/` | Read the banner at the top of the page. | The banner title is "conduit" and the tagline is "A place to share your knowledge.". |
| REQ-02.2a | ui | `#/` | Read the feed tab strip above the article list while signed out. | Exactly one tab: "A guest sees one feed tab, **Global Feed**" — no **Your Feed** tab. |
| REQ-02.4a | ui | `#/` | On the first article preview, read the author's avatar and username and open each link's target. | "the author's avatar and username (both link to `#/profile/<username>`)" — both point to the same profile route for that username. |
| REQ-02.4b | ui | `#/` | Read the date next to the author on the first preview. | "the creation date as `Month D, YYYY` (e.g. "September 13, 2026")" — pattern only (A4; time zone undefined, RV-4). |
| REQ-02.4c | ui | `#/` | Read the button in the top-right corner of the first preview. | "a favorite button with the count in the form `( n )`". Record what a guest click does (RV-5 — behaviour undefined, do not assert). |
| REQ-02.4d | ui | `#/` | Read the body of the first preview. | The preview shows "the title, the description" of the article — both non-empty. |
| REQ-02.4e | ui | `#/` | Read the link at the bottom of the first preview and open its target. | "a "Read more..." link to `#/article/<slug>`" — the slug matches the article opened. |
| REQ-02.4f | ui | `#/` | Read the tag list at the bottom of the first preview and compare with that article's `tagList` in the `GET /api/articles` response. | The preview shows "the article's tags" — the same tags as the response (an empty list when the article has none). |
| REQ-02.6 | ui | `#/` | Count the article previews on the Global Feed's first page. | "The feed shows 3 articles per page." |
| REQ-02.5 | ui | `#/` | Read the dates of the 3 previews in order, top to bottom, and confirm with `createdAt` in the same `GET /api/articles` response. | "**Global Feed** lists the articles of all authors, newest first (by creation time)" — each `createdAt` is ≥ the next within that one response (A5). |
| REQ-02.7a | ui | `#/` | Scroll below the list and read the pagination controls. | "pagination shows **Previous page**, the first page numbers, **Jump forward**, the last page numbers and **Next page**" — record the number of page buttons at each end and the **Jump forward** step (RV-3: counts undefined, do not assert). |
| REQ-02.7b | ui | `#/` | Inspect the accessible name / screen-reader text of the highlighted page button on page 1. | The current page is announced as "Page N is your current page" (N = 1). |
| REQ-02.8 | ui | `#/` | Read `articlesCount` from the `GET /api/articles` response of this page load, read the last page number in the pagination, and compare. | "The number of pages equals ⌈articlesCount ÷ 3⌉" — computed from the same response, never hard-coded (A9). |
| REQ-02.9 | ui | `#/` | Click page number 2, wait for the list to re-render, and compare the 3 titles with page 1 and with `GET /api/articles?offset=1` in the network tab. | "Selecting a page number shows that page's articles and marks the page as current" — a different set of 3 articles, and page 2 announced as "Page 2 is your current page". |
| REQ-02.10 | ui | `#/` | Read the **Popular Tags** sidebar (click nothing yet). | "The **Popular Tags** sidebar shows tags as clickable buttons" — at least one clickable tag, each name present in `GET /api/tags` (A1: count and order not asserted, RV-1). |
| REQ-02.11a | ui | `#/` | Click the first tag in the sidebar and look at the tab strip. | "Clicking a tag adds a tab named after the tag next to **Global Feed**", and that tab becomes the selected feed. |
| REQ-02.11b | ui | `#/` | On the open tag tab, read the tags of each preview, count the previews, read their dates in order, and scroll to the pagination. | "The tab lists only articles with that tag, newest first, 3 per page, with its own pagination" — every preview carries the clicked tag; at most 3 previews; dates descending; pagination present. Then click **Global Feed** and record whether the tag tab stays or the filter clears (RV-12 — undefined). |

## Group 2 — Route `#/` signed in (sign in once, reopen the home page)

| ID | Class | Route | Steps | Expected observable result |
|---|---|---|---|---|
| REQ-02.2b | ui-signed-in | `#/` | Sign in with a registered user and read the feed tab strip. | "A signed-in user additionally sees **Your Feed**" — both **Your Feed** and **Global Feed** are present (A8: tab order and selected tab not asserted, RV-11). |
| REQ-02.12 | ui-signed-in | `#/` | As a user who follows at least one author, select **Your Feed**, read the author of each preview, count them, read their dates in order, and compare with `GET /api/articles/feed` in the network tab. | "**Your Feed** lists articles written by the authors the signed-in user follows, newest first, 3 per page" — every author is followed, at most 3 previews, dates descending. Also run it with a user who follows nobody and record the empty state (RV-7 — undefined, do not assert). |

## Group 3 — API observed in the network tab (triggered by the actions above on `#/`)

| ID | Class | Route | Steps | Expected observable result |
|---|---|---|---|---|
| REQ-02.14 | api | `GET /api/articles` (guest load of `#/`) | Open the request from the guest home-page load and inspect status and body. | "`GET /api/articles` is public and returns `{ articles: Article[], articlesCount: number }`", each article carrying `slug`, `title`, `description`, `body`, `tagList`, `createdAt`, `updatedAt`, `favorited`, `favoritesCount` and `author` (`username`, `bio`, `image`, `following`, `followersCount`). Record null values and the timestamp format (RV-10 — types undefined). |
| REQ-02.17 | api | `GET /api/articles` (guest) | In the same guest response, check `favorited` and `author.following` on every article. | "For requests without a token, every article has `favorited: false` and `author.following: false`." |
| REQ-02.16 | api | `GET /api/articles` (guest) | Compare `articlesCount` with `articles.length` in the same response. | "`articlesCount` is the total number of articles that match the filters, not the number returned on the page" — `articlesCount` far exceeds the 3 returned. |
| REQ-02.15b | api | `GET /api/articles` (guest) | Replay the request from the network tab with no query parameters. | "`limit` (default 3) and `offset` (default 0)" — 3 articles returned, starting at the newest. |
| REQ-02.15c | api | `GET /api/articles?offset=1` (page 2 click) | Replay with `limit=3&offset=0`, then `limit=3&offset=1`, and compare the slugs. | "`offset` is a **page index**: the number of skipped articles is `offset × limit`" — `offset=1` starts at the 4th newest article, not the 2nd. Note the divergence from the RealWorld spec (RV-2, A2). |
| REQ-02.15a (tag) | api | `GET /api/articles?tag=<tag>` (tag click) | Open the request fired by clicking a sidebar tag. | "accepts the filters `tag`" — every returned article has that tag in `tagList`. |
| REQ-02.15a (author) | api | `GET /api/articles?author=<username>` | Replay the articles request with `author` set to the username of an author seen in the feed. | "accepts the filters … `author` (username)" — every returned article has that `author.username`. |
| REQ-02.15a (favorited) | api | `GET /api/articles?favorited=<username>` | Replay with `favorited` set to a user known to have favorited an article. | "accepts the filters … `favorited` (username of the user who favorited)" — only that user's favorited articles are returned. |
| REQ-02.15a (unknown value) | api | `GET /api/articles?favorited=<unknown>` | Replay with a username that does not exist, then with a tag that does not exist. | No expected result is defined (RV-8, source question REQ-02.I3) — record the status and body observed, do not assert (A7). |
| REQ-02.13 | api | `GET /api/articles/feed` | While signed out, replay `GET /api/articles/feed` with no `Authorization` header. | "responds **401** `You need to login first!`" — record the exact JSON wrapper of the message (RV-9). |
| REQ-02.18 | api | `GET /api/tags` (guest load of `#/`) | Open the tags request from the home-page load and inspect status and body. | "`GET /api/tags` is public and returns `{ tags: string[] }` with every stored tag" — public (no token sent), body is an array of strings. Record the count and the response time (RV-13). |
| REQ-02.18 (sidebar cross-check) | api | `GET /api/tags` vs sidebar | Compare the tag names rendered in **Popular Tags** with the array returned. | Every sidebar tag is present in the `tags` array; record the sidebar count against the array length (RV-1 — no selection rule to assert). |
