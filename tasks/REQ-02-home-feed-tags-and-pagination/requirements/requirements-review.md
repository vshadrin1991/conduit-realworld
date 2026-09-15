# Requirements review: Home page feeds, tag filter and pagination

| Field | Value |
|---|---|
| Key | REQ-02-home-feed-tags-and-pagination |
| Sources | `source/REQ-02-home-feed-tags-and-pagination.md` (Draft — derived from the current implementation, 2026-09-14) |
| Reviewed by | Claude (automated requirements review) · 2026-09-15 |
| Scope | Home page `#/`: banner, feed tabs, article previews, Global Feed, tag filter, Your Feed, pagination, `GET /api/articles`, `GET /api/articles/feed`, `GET /api/tags` · Out of scope: article page, editor, profiles, favoriting/following flows, auth screens |
| Result | Ready with open questions |

## Summary

| Severity | Open | Resolved |
|---|---|---|
| blocker | 0 | 0 |
| major | 14 | 0 |
| minor | 7 | 0 |

The set is testable: every requirement has an observable outcome, and no two statements contradict each other, so test design is not blocked. The main risk is that the document is explicitly *"derived from the current implementation"* — it records behaviour rather than intent, so a backend defect (the `offset` page-index semantics, RV-2) is written down as a rule and would be tested as correct. The largest gaps are around the **Popular Tags** selection rule (RV-1, RV-13), empty and error states (RV-7, RV-8, RV-9), and the shared demo environment, where "newest first" and page contents change between two requests (RV-6). Twelve of the fourteen majors are missing rules, not wrong ones, so they can each be covered by an assumption until the author answers.

## Requirements

Atomic split of the source table. Source IDs are kept; a compound statement is split with a letter suffix (`REQ-02.4a`).

| ID | Requirement | Type | Priority | Source | Verified by |
|---|---|---|---|---|---|
| REQ-02.1 | The home page shows the banner title "conduit" and the tagline "A place to share your knowledge.". | UI | High | `REQ-02…md` › Home page layout, row REQ-02.1 | ui |
| REQ-02.2a | A guest sees exactly one feed tab, **Global Feed**. | UI | High | › row REQ-02.2 | ui |
| REQ-02.2b | A signed-in user sees an additional feed tab, **Your Feed**. | UI | High | › row REQ-02.2 | ui-signed-in |
| REQ-02.3a | While the articles load, the feed shows "Loading articles list...". | UI | Medium | › row REQ-02.3 | ui |
| REQ-02.3b | While the tags load, the tag sidebar shows "Loading tags...". | UI | Medium | › row REQ-02.3 | ui |
| REQ-02.4a | Each article preview shows the author's avatar and username, both linking to `#/profile/<username>`. | UI | High | › row REQ-02.4 | ui |
| REQ-02.4b | Each article preview shows the creation date as `Month D, YYYY` (e.g. "September 13, 2026"). | UI | Medium | › row REQ-02.4 | ui |
| REQ-02.4c | Each article preview shows a favorite button with the count in the form `( n )`. | UI | High | › row REQ-02.4 | ui |
| REQ-02.4d | Each article preview shows the article title and description. | UI | High | › row REQ-02.4 | ui |
| REQ-02.4e | Each article preview shows a "Read more..." link pointing to `#/article/<slug>`. | UI | High | › row REQ-02.4 | ui |
| REQ-02.4f | Each article preview shows the article's tags. | UI | Medium | › row REQ-02.4 | ui |
| REQ-02.5 | **Global Feed** lists the articles of all authors, newest first by creation time. | Functional | High | › Global Feed, row REQ-02.5 | ui |
| REQ-02.6 | The feed shows 3 articles per page. | Functional | High | › row REQ-02.6 | ui |
| REQ-02.7a | Below the list, pagination shows **Previous page**, the first page numbers, **Jump forward**, the last page numbers and **Next page**. | UI | High | › row REQ-02.7 | ui |
| REQ-02.7b | The current page is announced as "Page N is your current page". | UI | Medium | › row REQ-02.7 | ui |
| REQ-02.8 | The number of pages equals ⌈articlesCount ÷ 3⌉. | Functional | High | › row REQ-02.8 | ui |
| REQ-02.9 | Selecting a page number shows that page's articles and marks the page as current. | Functional | High | › row REQ-02.9 | ui |
| REQ-02.10 | The **Popular Tags** sidebar shows tags as clickable buttons. | UI | High | › Tag filter, row REQ-02.10 | ui |
| REQ-02.11a | Clicking a tag adds a tab named after the tag next to **Global Feed**, and that tab becomes the selected feed. | Functional | High | › row REQ-02.11 | ui |
| REQ-02.11b | The tag tab lists only articles carrying that tag, newest first, 3 per page, with its own pagination. | Functional | High | › row REQ-02.11 | ui |
| REQ-02.12 | **Your Feed** lists articles written by the authors the signed-in user follows, newest first, 3 per page. | Functional | High | › Your Feed, row REQ-02.12 | ui-signed-in |
| REQ-02.13 | `GET /api/articles/feed` without a token responds **401** with the message `You need to login first!`. | Permissions | High | › row REQ-02.13 | api |
| REQ-02.14 | `GET /api/articles` is public and returns `{ articles: Article[], articlesCount: number }`, each article carrying `slug`, `title`, `description`, `body`, `tagList`, `createdAt`, `updatedAt`, `favorited`, `favoritesCount` and `author` (`username`, `bio`, `image`, `following`, `followersCount`). | API | High | › API, row REQ-02.14 | api |
| REQ-02.15a | `GET /api/articles` accepts the filters `tag`, `author` (username) and `favorited` (username of the user who favorited). | API | High | › row REQ-02.15 | api |
| REQ-02.15b | `GET /api/articles` accepts `limit` (default 3) and `offset` (default 0). | API | High | › row REQ-02.15 | api |
| REQ-02.15c | `offset` is a page index: the number of skipped articles is `offset × limit`. | API | High | › row REQ-02.15 | api |
| REQ-02.16 | `articlesCount` is the total number of articles matching the filters, not the number returned on the page. | API | High | › row REQ-02.16 | api |
| REQ-02.17 | For requests without a token, every article has `favorited: false` and `author.following: false`. | API | Medium | › row REQ-02.17 | api |
| REQ-02.18 | `GET /api/tags` is public and returns `{ tags: string[] }` with every stored tag. | API | Medium | › row REQ-02.18 | api |

**29 atomic requirements** — 15 `ui`, 2 `ui-signed-in`, 12 `api`, 0 `static`.

### Implicit requirements (confirm)

| ID | Requirement | Why it is implied |
|---|---|---|
| REQ-02.I-a | The **Popular Tags** sidebar shows a bounded subset of the stored tags (50 were observed against 3 400 returned by `GET /api/tags`). | Current app; the selection rule is not in the backend sources — *implicit — confirm* (see RV-1) |
| REQ-02.I-b | **Global Feed** is the selected tab when the home page opens. | Current app, guest walkthrough — *implicit — confirm* (see RV-11) |
| REQ-02.I-c | Selecting a feed tab or a tag resets pagination to page 1. | Current app / common practice — *implicit — confirm* (see RV-18) |
| REQ-02.I-d | The home page feed is rendered from `GET /api/articles` with `limit=3`, so REQ-02.6 and REQ-02.15b describe the same page size. | Routes + API rows of the source — *implicit — confirm* (see RV-17) |

## Findings

| ID | REQ | Category | Severity | Source text | Problem | Question / suggestion | Status | Resolution |
|---|---|---|---|---|---|---|---|---|
| RV-1 | REQ-02.10 | Completeness / Ambiguity | major | "The **Popular Tags** sidebar shows tags as clickable buttons." | "Popular" is never defined: no selection rule, no count, no ordering. The source's own note says the sidebar showed 50 tags while the API returned 3 400 with no ordering, so no assertion beyond "at least one tag is clickable" can be written. | Which tags are shown, how many, and in what order (by article count, alphabetical, insertion order)? Suggested wording: "The sidebar shows the first N tags of `GET /api/tags` ordered by …". | Open | |
| RV-2 | REQ-02.15c | Consistency / Correctness | major | "`offset` is a **page index**: the number of skipped articles is `offset × limit`." | Contradicts the public RealWorld API specification, where `offset` is the number of items to skip. The document is "derived from the current implementation", so a likely backend defect is recorded as the rule and a test written from it would certify the defect. | Is the page-index semantics intended, or a defect to be fixed to the spec? If intended, state explicitly that this API deliberately diverges from RealWorld. | Open | |
| RV-3 | REQ-02.7a | Ambiguity / Testability | major | "pagination shows **Previous page**, the first page numbers, **Jump forward**, the last page numbers and **Next page**." | "the first page numbers" and "the last page numbers" give no count, and **Jump forward** has no defined step. With ⌈10 894 ÷ 3⌉ = 3 632 pages the rendered control set cannot be predicted. | How many page numbers are rendered at each end, and how many pages does **Jump forward** move? Are **Previous page** / **Next page** disabled or hidden on the first and last page? | Open | |
| RV-4 | REQ-02.4b | Ambiguity | major | "the creation date as `Month D, YYYY` (e.g. "September 13, 2026")" | No time zone and no locale. `createdAt` is a UTC timestamp; an article created at 23:30 UTC renders as a different day in a client east or west of UTC, and the month name depends on locale. | Is the date formatted in UTC, in the browser's time zone, or in the author's? Is the month name always English, or locale-dependent? | Open | |
| RV-5 | REQ-02.4c | Completeness | major | "a favorite button with the count in the form `( n )`" | The button is described but not its behaviour: nothing states what a guest sees or what happens when a guest clicks it (redirect to `#/login`, error, no-op), nor how the count and the button state change for a signed-in user. | What does the favorite button do on the home page for a guest and for a signed-in user? | Open | |
| RV-6 | REQ-02.5, REQ-02.11b, REQ-02.12 | Testability | major | "lists the articles of all authors, newest first (by creation time)" | The Conduit demo is shared and other users publish concurrently, so the contents of page 1 change between two requests, and no tie-break is defined for articles with identical `createdAt`. "Newest first" is only verifiable within a single response. | Confirm that ordering is asserted within one response (each `createdAt` ≥ the next), and define the tie-break for equal timestamps (e.g. by `id` descending). | Open | |
| RV-7 | REQ-02.11b, REQ-02.12 | Completeness | major | "**Your Feed** lists articles written by the authors the signed-in user follows" | No empty state. A user following nobody, or a tag with no articles, has undefined rendering — text, an empty list, or pagination with zero pages. Source open question REQ-02.I4 confirms it was never observed. | What text and controls does an empty feed show, and is the pagination hidden when `articlesCount` is 0? | Open | |
| RV-8 | REQ-02.15a | Completeness / API | major | "the filters `tag`, `author` (username) and `favorited` (username of the user who favorited)" | Only the happy path is specified. Behaviour for an unknown `author` or `favorited` username, an unknown `tag`, and for an invalid `limit`/`offset` (0, negative, non-numeric, above any maximum) is undefined. Source open question REQ-02.I3 expects an error for an unknown `favorited` user. | What status and body are returned for an unknown username, an unknown tag, and out-of-range or non-numeric `limit`/`offset`? Should an unknown filter value return an empty list with `articlesCount: 0` rather than an error? | Open | |
| RV-9 | REQ-02.13, REQ-02.14 | API | major | "responds **401** `You need to login first!`" | The error body shape is not given — only the message text, without the wrapping field (`errors.body[0]`, `message`, plain string). Nor does REQ-02.14 define any error status for `GET /api/articles`. | What is the exact JSON body of the 401, and which error statuses can `GET /api/articles` return? | Open | |
| RV-10 | REQ-02.14 | API / Completeness | major | "`author` (`username`, `bio`, `image`, `following`, `followersCount`)" | Field types, nullability and required-vs-optional are not stated: `bio` and `image` are commonly `null`, `tagList` may be empty, and the date format of `createdAt`/`updatedAt` (ISO 8601, UTC) is unspecified. `followersCount` is also not part of the RealWorld author model, so contract tests written against the spec would fail. | Give a typed schema with nullability and the timestamp format, and confirm `followersCount` is an intentional extension. | Open | |
| RV-11 | REQ-02.2b | Completeness / Ambiguity | major | "A signed-in user additionally sees **Your Feed**." | Neither the tab order nor the selected tab is stated. "Additionally" suggests **Your Feed** is added, but the current app shows it first and selected, so a test could assert either. | In what order are the tabs rendered for a signed-in user, and which one is selected when the home page opens? | Open | |
| RV-12 | REQ-02.11a | Completeness | major | "Clicking a tag adds a tab named after the tag next to **Global Feed**." | The lifecycle of the tag tab is undefined: whether it can be closed, whether clicking a second tag replaces it or adds another tab, whether selecting **Global Feed** clears the filter, and whether the tab survives a reload. Source open question REQ-02.I5 confirms this. | Can the tag tab be closed? Does a second tag replace the first? Does returning to **Global Feed** clear the tag filter? | Open | |
| RV-13 | REQ-02.18 vs REQ-02.10 | Consistency / Non-functional | major | "`GET /api/tags` … returns `{ tags: string[] }` with **every** stored tag." | Returning all stored tags (3 400 observed) is unbounded and unordered, yet the sidebar shows a bounded "Popular" subset, so the selection must happen client-side over the full list. No ordering, pagination, limit or response-time target is defined. | Should `GET /api/tags` support a limit or ordering, and what response time is acceptable as the tag count grows? | Open | |
| RV-14 | whole set | Correctness / Traceability | major | "Status — Draft — derived from the current implementation, 2026-09-14" | The document reverse-engineers the running app, so current behaviour cannot be tested against intent — any existing defect (see RV-2) reads as a requirement, and "Evidence: observed" gives no authority to resolve a disagreement between app and spec. | Who signs off these requirements as intended behaviour, and which rows are confirmed intent versus recorded observation? | Open | |
| RV-15 | REQ-02.3a, REQ-02.3b | Testability | minor | "While data loads, the feed shows "Loading articles list..." and the tag sidebar shows "Loading tags..."." | The loading state is transient and has no defined trigger or minimum duration, so it is not reliably observable — on a fast response the text may never render. | Confirm the text only needs to be verified with the response delayed, and state whether the loading text replaces the list or is shown above it. | Open | |
| RV-16 | REQ-02.4 | Uniqueness | minor | "Each article preview shows the author's avatar and username …, the creation date …, a favorite button …, the title, the description, a "Read more..." link … and the article's tags." | One row mixes seven independent behaviours, so a single failure cannot be traced to an ID. | Split into one row per element, as done here (REQ-02.4a–REQ-02.4f). | Open | |
| RV-17 | REQ-02.6 | Ambiguity | minor | "The feed shows 3 articles per page." | It is not stated whether 3 is fixed for the UI or merely the API default that the UI happens to use, nor whether the user can change the page size. | Is the home page size fixed at 3, or configurable? | Open | |
| RV-18 | REQ-02.9 | Completeness | minor | "Selecting a page number shows that page's articles and marks the page as current." | Says nothing about the URL (the route stays `#/`, so the page is not shareable or restorable on reload), scroll position, or what happens to the selected page when the feed tab changes. | Should the selected page appear in the URL, and does switching tabs reset to page 1? | Open | |
| RV-19 | REQ-02.12 | Completeness | minor | "**Your Feed** lists articles … newest first, 3 per page." | Pagination is implied by "3 per page" but the controls are only specified for the Global Feed (REQ-02.7a). | Confirm **Your Feed** and the tag tabs render the same pagination control set as the Global Feed. | Open | |
| RV-20 | whole set | Non-functional | minor | — (no such section) | No non-functional requirements at all: no feed or tag load-time target, no accessibility level (the document quotes the screen-reader text "Page N is your current page" without naming a standard), no supported browsers or viewports, no localization. | Which browsers, viewports and accessibility level (e.g. WCAG 2.1 AA) are in scope, and what is the acceptable load time for the feed? | Open | |
| RV-21 | REQ-02.8 | Testability | minor | "For example, 10 894 articles give 3 632 pages." | The arithmetic is right, but the example uses a live count from a shared demo database that changes constantly, so it cannot be reused as test data. | Keep the formula and mark the numbers as a snapshot of 2026-09-14, or replace them with an invented example (e.g. 10 articles → 4 pages). | Open | |

## Questions for the author

No blockers — test design can start. Majors, as one list:

1. [RV-1, major] Which tags does **Popular Tags** show, how many, and in what order?
2. [RV-2, major] Is `offset` as a page index intended, or a defect against the RealWorld specification?
3. [RV-3, major] How many page numbers are rendered at each end of the pagination, and how many pages does **Jump forward** move? Are **Previous page** / **Next page** disabled on the first and last page?
4. [RV-4, major] In which time zone and locale is the article date formatted?
5. [RV-5, major] What does the favorite button on a preview do for a guest, and for a signed-in user?
6. [RV-6, major] Is "newest first" asserted within a single response, and what is the tie-break for equal `createdAt`?
7. [RV-7, major] What does an empty feed show (Your Feed with no follows, tag with no articles)?
8. [RV-8, major] What is returned for an unknown `author`/`favorited` username, an unknown `tag`, and for invalid `limit`/`offset`?
9. [RV-9, major] What is the exact JSON body of the 401, and which error statuses can `GET /api/articles` return?
10. [RV-10, major] Can we get a typed schema for the article and author models, with nullability and timestamp format? Is `followersCount` an intentional extension?
11. [RV-11, major] For a signed-in user, in what order are the tabs shown and which is selected on load?
12. [RV-12, major] Can the tag tab be closed, does a second tag replace the first, and does **Global Feed** clear the filter?
13. [RV-13, major] Should `GET /api/tags` be bounded or ordered, and what response time is acceptable?
14. [RV-14, major] Who signs these requirements off as intended behaviour rather than recorded observation?

## Assumptions

Used for test design until confirmed; each is tied to a finding and each test case resting on one stays **Draft — confirm**.

- **A1 (RV-1)** — The sidebar is only asserted to contain at least one clickable tag whose name appears in `GET /api/tags`; neither the count nor the order is asserted.
- **A2 (RV-2)** — `offset` is tested as the current implementation states (page index), and a separate finding-linked note records the divergence from the RealWorld specification.
- **A3 (RV-3)** — Pagination is asserted by behaviour (the requested page becomes current and its articles load), not by the exact number of rendered page buttons.
- **A4 (RV-4)** — The date is asserted against the `Month D, YYYY` pattern only, not against a specific expected day derived from `createdAt`.
- **A5 (RV-6)** — Ordering is asserted inside one API response (`createdAt[i] ≥ createdAt[i+1]`); no assertion is made that a specific article sits on page 1.
- **A6 (RV-7)** — No expected empty-state text is asserted; empty-feed cases are written as Draft.
- **A7 (RV-8, RV-9)** — Negative API cases record the observed status and body as findings instead of asserting an expected value.
- **A8 (RV-11)** — For a signed-in user, both tabs are asserted to be present; the selected tab is not asserted.
- **A9 (RV-14, RV-21)** — Any assertion on a live-data value (`articlesCount`, page count, tag count) is derived from the same response under test, never hard-coded.
