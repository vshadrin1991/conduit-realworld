# REQ-04 — Article page and comments

| Field    | Value                                                                                                                                                                                                       |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status   | Draft — derived from the current implementation, 2026-09-14                                                                                                                                                 |
| Area     | Content                                                                                                                                                                                                     |
| Priority | Medium                                                                                                                                                                                                      |
| Routes   | `#/article/<slug>`                                                                                                                                                                                          |
| API      | `GET /api/articles/:slug`, `GET /api/articles/:slug/comments`, `POST /api/articles/:slug/comments`, `DELETE /api/articles/:slug/comments/:id`                                                               |
| Sources  | Live app (guest walkthrough), `backend/controllers/articles.js`, `backend/controllers/comments.js`, `src/pageObject/pages/ArticlePage.ts`, `tests/api/comments.api.spec.ts`, `tests/ui/articles.ui.spec.ts` |

## User story

As a reader, I want to read an article and discuss it in comments, so that I can respond to the author and other readers.

## Requirements

### Reading an article

| ID       | Requirement                                                                                                                                                                                                                                                                            | Type       | Evidence        |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------- |
| REQ-04.1 | Anyone, including a guest, can open `#/article/<slug>`. `GET /api/articles/:slug` is public and returns `{ article }`.                                                                                                                                                                 | Functional | observed, tests |
| REQ-04.2 | The article page shows the title as a heading, the body and the article's tags.                                                                                                                                                                                                        | UI         | observed, tests |
| REQ-04.3 | The author block shows the avatar and username (both link to `#/profile/<username>`), the creation date as `Month D, YYYY`, a **Followers** button with the count `( n )` and a **Favorite** button with the count `( n )`. The block appears twice: in the banner and below the body. | UI         | observed        |
| REQ-04.4 | `GET /api/articles/:slug` for an unknown slug responds **404** `Article not found⎵`.                                                                                                                                                                                                   | API        | code            |

### Comments for guests

| ID       | Requirement                                                                                                                                                               | Type | Evidence       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | -------------- |
| REQ-04.5 | Instead of the comment form, a guest sees "Sign in or Sign up to add comments on this article.", where **Sign in** links to `#/login` and **Sign up** to `#/register`.    | UI   | observed       |
| REQ-04.6 | When an article has no comments, the page shows "There are no comments yet...".                                                                                           | UI   | observed       |
| REQ-04.7 | `GET /api/articles/:slug/comments` is public and returns `{ comments: Comment[] }`. Each comment has `id`, `body`, `createdAt`, `updatedAt` and `author` (without email). | API  | observed, code |

### Adding a comment

| ID        | Requirement                                                                                                                                     | Type        | Evidence              |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------- |
| REQ-04.8  | A signed-in user sees a comment form with the placeholder "Write a comment..." and the button **Post Comment**.                                 | UI          | tests (`ArticlePage`) |
| REQ-04.9  | After **Post Comment**, the new comment appears in the article's comment list with the entered text.                                            | Functional  | tests                 |
| REQ-04.10 | Posting responds **201** with `{ comment }`, whose `author` is the signed-in user.                                                              | API         | code, tests           |
| REQ-04.11 | An empty comment responds **422** `Comment body is required`.                                                                                   | Validation  | code                  |
| REQ-04.12 | Commenting without a token responds **401** `You need to login first!`. Commenting on an unknown article responds **404** `Article not found⎵`. | Permissions | code                  |

### Deleting a comment

| ID        | Requirement                                                                                                                                                                | Type        | Evidence    |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------- |
| REQ-04.13 | The comment's author can delete it. The API responds **200** `{ "message": { "body": ["Comment deleted successfully"] } }`, and the comment no longer appears in the list. | Functional  | code, tests |
| REQ-04.14 | Another user responds **403** `You are not the author of this comment`. An unknown comment id responds **404** `Comment not found⎵`.                                       | Permissions | code        |

## Known defects in the current implementation

| ID        | Defect                                                                                                                                                               | Evidence        |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| REQ-04.D1 | `DELETE /api/articles/:slug/comments/:id` does not check that the comment belongs to the article in the URL — a comment is deletable through another article's slug.   | tests, observed |
| REQ-04.D2 | `POST /api/articles/:slug/comments` without the `comment` wrapper responds **500** (`Cannot destructure property 'body'`) instead of a validation response.            | tests, observed |

## Open questions

| ID        | Question                                                                                                                                 | Why                                   |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| REQ-04.I1 | In which order should comments be listed (newest or oldest first)? The source does not sort them.                                        | Order is undefined                    |
| REQ-04.I2 | How does a user delete a comment in the UI (which control, and is there a confirmation)?                                                 | Not observed; only the API is covered |
| REQ-04.I3 | Deleting a comment does not check that it belongs to the article in the URL. Is a delete through another article's URL allowed?          | Possible authorization gap            |
| REQ-04.I4 | What should the page show for an unknown slug? While loading, the page briefly showed "Invalid Date" and links to `#/profile/undefined`. | No not-found state defined            |
| REQ-04.I5 | Is there a maximum comment length, and is Markdown or HTML rendered in comments?                                                         | Not defined                           |
