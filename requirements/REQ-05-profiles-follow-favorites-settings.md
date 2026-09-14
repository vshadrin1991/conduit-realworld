# REQ-05 — Profiles, following, favorites and user settings

| Field | Value |
|---|---|
| Status | Draft — derived from the current implementation, 2026-09-14 |
| Area | Social / account |
| Priority | Medium |
| Routes | `#/profile/<username>`, `#/profile/<username>/favorites`, `#/settings` |
| API | `GET /api/profiles/:username`, `POST` / `DELETE /api/profiles/:username/follow`, `POST` / `DELETE /api/articles/:slug/favorite`, `PUT /api/user` |
| Sources | Live app (guest walkthrough), `backend/controllers/profiles.js`, `backend/controllers/favorites.js`, `backend/controllers/user.js`, `backend/controllers/articles.js`, `backend/middleware/authentication.js`, `src/pageObject/components/Header.ts`, the example `SettingsPage` of the implementation skill, `app-behaviour.md` |

## User story

As a member, I want to see other authors' profiles, follow them, favorite articles and keep my own profile up to date, so that I can personalize what I read and how others see me.

## Requirements

### Profile page

| ID | Requirement | Type | Evidence |
|---|---|---|---|
| REQ-05.1 | Anyone, including a guest, can open `#/profile/<username>`. The page shows the user's avatar, the username as a heading, a **Followers** button with the count `( n )`, and the tabs **My Articles** (`#/profile/<username>`) and **Favorited Articles** (`#/profile/<username>/favorites`). | UI | observed |
| REQ-05.2 | **My Articles** lists the articles written by the user, newest first, 3 per page, with pagination. While loading, it shows "Loading <username> articles...". | Functional | observed, code |
| REQ-05.3 | **Favorited Articles** lists the articles the user has favorited, 3 per page, with pagination. | Functional | observed, code |
| REQ-05.4 | `GET /api/profiles/:username` is public and returns `{ profile }` with `username`, `bio`, `image`, `following` and `followersCount`. The email is never included. | API | observed, code |
| REQ-05.5 | An unknown username responds **404** `User profile not found⎵`. | API | code |
| REQ-05.6 | For requests without a token, `following` is `false`. | API | observed, code |

### Following

| ID | Requirement | Type | Evidence |
|---|---|---|---|
| REQ-05.7 | A signed-in user follows a profile with `POST /api/profiles/:username/follow` and unfollows with `DELETE` on the same path. Both respond `{ profile }` with the updated `following` and `followersCount`. | Functional | code |
| REQ-05.8 | Following without a token responds **401** `You need to login first!`. An unknown username responds **404** `User profile not found⎵`. | Permissions | code |
| REQ-05.9 | Articles by followed authors appear in **Your Feed** (see REQ-02.12). | Functional | code |

### Favorites

| ID | Requirement | Type | Evidence |
|---|---|---|---|
| REQ-05.10 | A signed-in user favorites an article with `POST /api/articles/:slug/favorite` and removes the favorite with `DELETE` on the same path. Both respond `{ article }` with the updated `favorited` and `favoritesCount`. | Functional | code |
| REQ-05.11 | Favoriting without a token responds **401** `You need to login first!`. An unknown slug responds **404** `Article not found⎵`. | Permissions | code |
| REQ-05.12 | The count on the favorite button of an article preview and of the article page, shown as `( n )`, equals the article's `favoritesCount`. | UI | observed |
| REQ-05.13 | When a guest clicks the favorite button in a feed, nothing changes: the count stays the same and the page stays on `#/`. | UI | observed |

### Settings

| ID | Requirement | Type | Evidence |
|---|---|---|---|
| REQ-05.14 | A guest who opens `#/settings` is redirected to the home page `#/`. | Permissions | observed |
| REQ-05.15 | A signed-in user opens **Settings** from the user menu. The page shows the heading "Your Settings", the fields **URL of profile picture**, **Your Name**, **Short bio about you**, **Email** and **Password**, and the button **Update Settings**. | UI | tests (the implementation skill's example page object, not yet automated) — confirm |
| REQ-05.16 | `PUT /api/user` updates each field that is sent (`username`, `email`, `bio`, `image`), stores a sent `password` as a hash, and responds `{ user }`. | Functional | code |
| REQ-05.17 | Updating settings without a token responds **401** `You need to login first!`. | Permissions | code |

## Known defects in the current implementation

| ID | Defect | Evidence |
|---|---|---|
| REQ-05.D1 | An update without `password` (e.g. only `bio`) responds **500** `data and salt arguments required`. The server always re-hashes the password, because its check `password !== undefined \|\| password !== ""` is always true. Expected: the current password is kept. | tests (`app-behaviour.md`), code |

## Open questions

| ID | Question | Why |
|---|---|---|
| REQ-05.I1 | Should a guest who clicks **Favorite** or **Followers** be sent to the sign-in page, or see a hint? Currently nothing happens. | No feedback for guests |
| REQ-05.I2 | Must username and email stay unique when changed in settings? The update has no uniqueness checks. | Possible duplicate accounts |
| REQ-05.I3 | Can users follow themselves? The source does not prevent it. | Undefined rule |
| REQ-05.I4 | For **Favorited Articles**, `articlesCount` counts every favorite of the user and ignores the tag and author filters. Should pagination use the filtered count? | Count can disagree with the list |
| REQ-05.I5 | After a user changes their email, the stored token still carries the old email, and the server looks users up by email, so the token no longer finds the user. Should the update return a new token, or force a new sign-in? | Session breaks after an email change |
| REQ-05.I6 | What format should the profile picture URL have, and what does a profile without an image show? | Not defined |
