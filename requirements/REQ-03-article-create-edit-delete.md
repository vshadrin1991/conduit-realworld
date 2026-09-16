# REQ-03 — Creating, editing and deleting articles

| Field    | Value                                                                                                                                                                                                                                                           |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status   | Draft — derived from the current implementation, 2026-09-14                                                                                                                                                                                                     |
| Area     | Content                                                                                                                                                                                                                                                         |
| Priority | High                                                                                                                                                                                                                                                            |
| Routes   | `#/editor` (new article), `#/editor/<slug>` (edit), `#/article/<slug>`                                                                                                                                                                                          |
| API      | `POST /api/articles`, `PUT /api/articles/:slug`, `DELETE /api/articles/:slug`                                                                                                                                                                                   |
| Sources  | Live app (guest walkthrough), `backend/controllers/articles.js`, `backend/helper/helpers.js`, `src/pageObject/pages/EditorPage.ts`, `src/pageObject/pages/ArticlePage.ts`, `tests/api/articles.api.spec.ts`, `tests/ui/articles.ui.spec.ts`, `app-behaviour.md` |

## User story

As an author, I want to publish, update and delete my articles, so that I control the content I share.

## Requirements

### Access

| ID       | Requirement                                                                                            | Type        | Evidence         |
| -------- | ------------------------------------------------------------------------------------------------------ | ----------- | ---------------- |
| REQ-03.1 | A guest who opens `#/editor` is redirected to the home page `#/`.                                      | Permissions | observed         |
| REQ-03.2 | Creating, updating or deleting an article without a token responds **401** `You need to login first!`. | Permissions | tests, code      |
| REQ-03.3 | A signed-in user opens the editor from the **New Article** link in the header.                         | UI          | tests (`Header`) |

### Editor

| ID       | Requirement                                                                                                                                                                                                                                     | Type | Evidence                   |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | -------------------------- |
| REQ-03.4 | The editor has the fields **Article Title**, **What's this article about?**, **Write your article (in markdown)** and **Enter tags**. The submit button reads **Publish Article** for a new article and **Update Article** for an existing one. | UI   | tests (`EditorPage`)       |
| REQ-03.5 | Tags are entered comma-separated. Pressing Enter in the tags field submits the form.                                                                                                                                                            | UI   | tests (`app-behaviour.md`) |

### Create

| ID        | Requirement                                                                                                                                                                                                                                            | Type       | Evidence            |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------------------- |
| REQ-03.6  | Title, description and body are required, checked in that order. A missing value responds **422** with `A title is required`, `A description is required` or `An article body is required`.                                                            | Validation | code, tests (title) |
| REQ-03.7  | The slug is built from the title: surrounding spaces are trimmed, letters are lowercased, and every character that is not a letter or digit (including spaces and underscores) is replaced by `-`. For example, "Hello World!" becomes `hello-world-`. | Functional | code                |
| REQ-03.8  | A title whose slug already exists responds **422** `Title already exists..⎵`.                                                                                                                                                                          | Validation | code                |
| REQ-03.9  | A tag that already exists is attached to the article. A new tag is created only when it is longer than 2 characters. Surrounding spaces are trimmed from stored tag names.                                                                             | Functional | code                |
| REQ-03.10 | A successful create responds **201** with `{ article }`, with the signed-in user as `author` and `favoritesCount` 0.                                                                                                                                   | API        | code, tests         |
| REQ-03.11 | After **Publish Article**, the user is taken to `#/article/<slug>`, which shows the entered title, body and tags. The article also appears in **Global Feed**.                                                                                         | Functional | tests               |

### Update

| ID        | Requirement                                                                                                                                    | Type        | Evidence                                  |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------- |
| REQ-03.12 | Only the author sees **Edit Article** and **Delete Article** on the article page. They appear twice: in the banner and below the body.         | UI          | tests (`ArticlePage`, `app-behaviour.md`) |
| REQ-03.13 | An update changes only the fields sent with a non-empty value among `title`, `description` and `body`.                                         | Functional  | code, tests                               |
| REQ-03.14 | Changing the title regenerates the slug by the rule in REQ-03.7, so the article moves to `#/article/<new-slug>`.                               | Functional  | code, tests (`app-behaviour.md`)          |
| REQ-03.15 | A user who is not the author responds **403** `You are not the author of this article`. An unknown slug responds **404** `Article not found⎵`. | Permissions | code                                      |

### Delete

| ID        | Requirement                                                                                                                                                     | Type        | Evidence    |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------- |
| REQ-03.16 | **Delete Article** first shows the browser confirmation "Want to delete the article?".                                                                          | UI          | tests       |
| REQ-03.17 | After the user accepts, the article is deleted and the home page opens. The API responds **200** `{ "message": { "body": ["Article deleted successfully"] } }`. | Functional  | tests, code |
| REQ-03.18 | A deleted article is no longer available: `GET /api/articles/:slug` responds **404** `Article not found⎵`.                                                      | Functional  | tests, code |
| REQ-03.19 | A user who is not the author responds **403** `You are not the author of this article`.                                                                         | Permissions | code        |

## Open questions

| ID        | Question                                                                                                                                                        | Why                                        |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| REQ-03.I1 | Are tags optional? The source loops over `tagList` without a default, so creating an article without `tagList` likely fails with **500**.                       | Presence rule is undefined                 |
| REQ-03.I2 | Tags of 1–2 characters are silently not stored, but the create response still echoes them in `tagList`. Is this intended, and should the user be told?          | Response contradicts the stored data       |
| REQ-03.I3 | Updating a title does not check whether the new slug is taken, so two articles could end up with the same slug. What should happen?                             | Possible data conflict                     |
| REQ-03.I4 | Tags on update: the framework notes say omitting `tagList` on update clears the tags, while the source's update ignores `tagList`. Which behaviour is required? | The deployed build and the source disagree |
| REQ-03.I5 | Dismissing the delete confirmation should keep the article and stay on the page — _implicit — confirm_.                                                         | Not tested                                 |
| REQ-03.I6 | Are there length limits or allowed characters for title, description, body and tags?                                                                            | No limits in the source                    |
| REQ-03.I7 | Should the editor show validation messages before submitting (empty required fields)?                                                                           | Only server-side validation exists         |
