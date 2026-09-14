# REQ-01 — User registration, sign-in and session

| Field | Value |
|---|---|
| Status | Draft — derived from the current implementation, 2026-09-14 |
| Area | Authentication |
| Priority | High |
| Routes | `#/register`, `#/login` |
| API | `POST /api/users`, `POST /api/users/login`, `GET /api/user` |
| Sources | Live app (guest walkthrough), `backend/controllers/users.js`, `backend/controllers/user.js`, `backend/middleware/authentication.js`, `backend/helper/jwt.js`, `src/pageObject/pages/LoginPage.ts`, `src/pageObject/pages/RegisterPage.ts`, `src/pageObject/components/Header.ts`, `tests/ui/auth.ui.spec.ts`, `tests/api/users.api.spec.ts` |

## User story

As a visitor, I want to sign up with a username, email and password and then sign in with my email and password, so that I can use the features that need an account.

## Requirements

### Header

| ID | Requirement | Type | Evidence |
|---|---|---|---|
| REQ-01.1 | A guest's header shows the "conduit" logo (links to `#/`) and the links **Home**, **Login**, **Sign up** and **Source code**. | UI | observed |
| REQ-01.2 | A signed-in user's header shows **Home**, **New Article** and a user menu with the user's avatar. The menu contains **Profile**, **Settings** and **Logout**. | UI | tests (`Header`) |

### Sign-up (`#/register`)

| ID | Requirement | Type | Evidence |
|---|---|---|---|
| REQ-01.3 | The page shows the heading "Sign up" and the link "Sign in to your account" to `#/login`. Below are the fields **Your Name**, **Email** (email input) and **Password** (masked input), and the button **Sign up**. | UI | observed |
| REQ-01.4 | Username, email and password are required, checked in that order. A missing value responds **422** with `A username is required`, `An email is required` or `A password is required`. | Validation | code |
| REQ-01.5 | An email that already belongs to an account responds **422** `Email already exists.. try logging in`. | Validation | code |
| REQ-01.6 | A username that already exists is accepted (usernames are not unique). | Functional | tests (`app-behaviour.md`) |
| REQ-01.7 | A successful sign-up responds **201** with `{ user }` containing `email`, `username`, `bio`, `image` and `token`. The user is signed in, and the header shows their avatar and username. | Functional | code, tests |

### Sign-in (`#/login`)

| ID | Requirement | Type | Evidence |
|---|---|---|---|
| REQ-01.8 | The page shows the heading "Sign in" and the link "Need an account?" to `#/register`. Below are the fields **Email** (email input) and **Password** (masked input), and the button **Login**. | UI | observed |
| REQ-01.9 | An email with no account responds **404** `Email not found sign in first`. | Validation | code, tests |
| REQ-01.10 | A wrong password for an existing email responds **422** `Wrong email/password combination`. | Validation | code |
| REQ-01.11 | Server errors from sign-up and sign-in appear as text in one error block above the form, and the user stays on the page. | UI | tests |
| REQ-01.12 | A successful sign-in responds **200** with `{ user }` including `token`, and the header switches to the signed-in state (REQ-01.2). | Functional | code, tests |

### Session and access

| ID | Requirement | Type | Evidence |
|---|---|---|---|
| REQ-01.13 | The application keeps the signed-in user in browser `localStorage` under the key `loggedUser`. Reloading the page keeps the user signed in. | Functional | tests (`Session`) |
| REQ-01.14 | Requests that need an account send the header `Authorization: <scheme> <JWT>`. The backend uses the part after the first space and does not check the scheme word. | Security | code |
| REQ-01.15 | `GET /api/user` returns the signed-in user for a valid token. Without a token it responds **401** `You need to login first!`. | API | observed, tests |
| REQ-01.16 | **Logout** in the user menu removes `loggedUser` from `localStorage` and restores the guest header with **Login**. | Functional | tests |
| REQ-01.17 | A guest who opens a page that needs an account (`#/editor`, `#/settings`) is redirected to the home page `#/`. | Permissions | observed |

## Open questions

| ID | Question | Why |
|---|---|---|
| REQ-01.I1 | What are the rules for email format, password length and strength, and allowed username characters? Only presence is checked on the server; the browser checks only the email input type. | Validation rules are undefined |
| REQ-01.I2 | What should sign-in with an empty email or password return? Sign-in has no presence check. | Error behaviour is undefined |
| REQ-01.I3 | Are duplicate usernames intended? Profiles are addressed by username (`#/profile/<username>`), so duplicates make profile links ambiguous. | Possible contradiction with REQ-05 |
| REQ-01.I4 | Tokens are signed without an expiry, so a session never ends on the server. Is a session lifetime required? | Security expectation |
| REQ-01.I5 | A malformed or invalid `Authorization` header raises a generic error (**500** with the raw message, e.g. `Token missing or malformed`) instead of **401**. Which status is expected? | Error mapping |
| REQ-01.I6 | Should the forms validate input before submitting (empty fields, email format), and with which messages? | Not observed; no forms were submitted during the walkthrough |
