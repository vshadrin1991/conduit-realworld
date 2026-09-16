# REQ-02 — Home page feeds, tag filter and pagination

| Field    | Value                                                                                                                                                         |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status   | Draft — derived from the current implementation, 2026-09-14                                                                                                   |
| Area     | Discovery                                                                                                                                                     |
| Priority | High                                                                                                                                                          |
| Routes   | `#/`                                                                                                                                                          |
| API      | `GET /api/articles`, `GET /api/articles/feed`, `GET /api/tags`                                                                                                |
| Sources  | Live app (guest walkthrough), `backend/controllers/articles.js`, `backend/routes/tags.js`, `src/pageObject/pages/HomePage.ts`, `tests/ui/articles.ui.spec.ts` |

## User story

As a reader, I want to browse the newest articles, narrow them down by tag and move between pages, so that I can find content to read.

## Requirements

### Home page layout

| ID       | Requirement                                                                                                                                                                                                                                                                                                                | Type | Evidence                                         |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------ |
| REQ-02.1 | The home page shows the banner title "conduit" and the tagline "A place to share your knowledge.".                                                                                                                                                                                                                         | UI   | observed                                         |
| REQ-02.2 | A guest sees one feed tab, **Global Feed**. A signed-in user additionally sees **Your Feed**.                                                                                                                                                                                                                              | UI   | observed (guest), tests (page object `HomePage`) |
| REQ-02.3 | While data loads, the feed shows "Loading articles list..." and the tag sidebar shows "Loading tags...".                                                                                                                                                                                                                   | UI   | observed                                         |
| REQ-02.4 | Each article preview shows the author's avatar and username (both link to `#/profile/<username>`), the creation date as `Month D, YYYY` (e.g. "September 13, 2026"), a favorite button with the count in the form `( n )`, the title, the description, a "Read more..." link to `#/article/<slug>` and the article's tags. | UI   | observed                                         |

### Global Feed

| ID       | Requirement                                                                                                                                                                                            | Type       | Evidence                           |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ---------------------------------- |
| REQ-02.5 | **Global Feed** lists the articles of all authors, newest first (by creation time).                                                                                                                    | Functional | code                               |
| REQ-02.6 | The feed shows 3 articles per page.                                                                                                                                                                    | Functional | observed, code (`limit` default 3) |
| REQ-02.7 | Below the list, pagination shows **Previous page**, the first page numbers, **Jump forward**, the last page numbers and **Next page**. The current page is announced as "Page N is your current page". | UI         | observed                           |
| REQ-02.8 | The number of pages equals ⌈articlesCount ÷ 3⌉. For example, 10 894 articles give 3 632 pages.                                                                                                         | Functional | observed                           |
| REQ-02.9 | Selecting a page number shows that page's articles and marks the page as current.                                                                                                                      | Functional | observed                           |

### Tag filter

| ID        | Requirement                                                                                                                                                          | Type       | Evidence       |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------- |
| REQ-02.10 | The **Popular Tags** sidebar shows tags as clickable buttons.                                                                                                        | UI         | observed       |
| REQ-02.11 | Clicking a tag adds a tab named after the tag next to **Global Feed**. The tab lists only articles with that tag, newest first, 3 per page, with its own pagination. | Functional | observed, code |

### Your Feed

| ID        | Requirement                                                                                               | Type        | Evidence |
| --------- | --------------------------------------------------------------------------------------------------------- | ----------- | -------- |
| REQ-02.12 | **Your Feed** lists articles written by the authors the signed-in user follows, newest first, 3 per page. | Functional  | code     |
| REQ-02.13 | `GET /api/articles/feed` without a token responds **401** `You need to login first!`.                     | Permissions | observed |

### API

| ID        | Requirement                                                                                                                                                                                                                                                                                       | Type | Evidence |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | -------- |
| REQ-02.14 | `GET /api/articles` is public and returns `{ articles: Article[], articlesCount: number }`. Each article has `slug`, `title`, `description`, `body`, `tagList`, `createdAt`, `updatedAt`, `favorited`, `favoritesCount` and `author` (`username`, `bio`, `image`, `following`, `followersCount`). | API  | observed |
| REQ-02.15 | `GET /api/articles` accepts the filters `tag`, `author` (username) and `favorited` (username of the user who favorited), plus `limit` (default 3) and `offset` (default 0). `offset` is a **page index**: the number of skipped articles is `offset × limit`.                                     | API  | code     |
| REQ-02.16 | `articlesCount` is the total number of articles that match the filters, not the number returned on the page.                                                                                                                                                                                      | API  | code     |
| REQ-02.17 | For requests without a token, every article has `favorited: false` and `author.following: false`.                                                                                                                                                                                                 | API  | code     |
| REQ-02.18 | `GET /api/tags` is public and returns `{ tags: string[] }` with every stored tag.                                                                                                                                                                                                                 | API  | observed |

## Open questions

| ID        | Question                                                                                                                                                           | Why                                                                        |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| REQ-02.I1 | Which tags count as "Popular", and in what order? The sidebar showed 50 tags, while `GET /api/tags` returned 3 400 tags with no ordering.                          | The UI selection rule is not visible in the backend — _implicit — confirm_ |
| REQ-02.I2 | Is `offset` meant to be a page index? The public RealWorld API specification defines it as the number of items to skip.                                            | API clients built on the spec would get the wrong pages                    |
| REQ-02.I3 | What should `GET /api/articles?favorited=<unknown username>` return? The source looks the user up and does not handle "not found", so an error response is likely. | Undefined error behaviour                                                  |
| REQ-02.I4 | What does an empty feed show (e.g. **Your Feed** for a user who follows nobody, or a tag without articles)?                                                        | No empty-state text was observed                                           |
| REQ-02.I5 | Can the tag tab be closed, and does returning to **Global Feed** clear the tag filter?                                                                             | Not observed                                                               |
