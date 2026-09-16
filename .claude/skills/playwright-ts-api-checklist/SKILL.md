---
name: playwright-ts-api-checklist
description: General API test coverage checklist for this Conduit Playwright + TypeScript project — the case families every endpoint deserves (JSON Schema validation, POST/GET/PUT/DELETE, status codes, error payloads, pagination, invalid and non-existent IDs) and how each one is written with get(APIClient). Use this skill whenever the user asks what to cover for an endpoint, wants an API coverage plan, checklist or case list, asks "did we miss anything" about API tests, reviews API coverage for gaps, or starts automating a new endpoint — including requests like "what should I test for POST /articles", "make a checklist for the comments API", "review our API coverage" or "cover this endpoint", even when they do not say the word checklist.
---

# API coverage checklist (Conduit)

## Overview

Turns an endpoint into a concrete list of test cases, so coverage comes from a repeatable checklist instead of whatever came to mind. Produces a coverage table; implementation then follows the [playwright-ts-conduit-realworld](../playwright-ts-conduit-realworld/SKILL.md) skill.

The checklist is a prompt, not a quota. An item that does not apply to an endpoint is dropped **with the reason written down** — that record is what makes a review able to tell "not applicable" apart from "forgotten".

## How to use it

1. **Name the operations in scope** — method + path per case. Work one operation at a time; a resource with four verbs is four passes.
2. **Walk the families below** for that verb, plus **Data structure** and **Cross-cutting**, which apply to every operation.
3. **Decide per item**: covered by a new case, already covered (name the existing test), or not applicable (name the reason).
4. **Write the coverage table** (format below).
5. **Trim for the rate limit** before implementing — see [Trimming](#trimming).
6. Confirm the table with the user, then implement per the `playwright-ts-conduit-realworld` skill.

Where the expected status or error text is not in a contract or the requirements, it is an **open question** — never invent one. The [playwright-ts-test-aqa-task](../playwright-ts-test-aqa-task/SKILL.md) skill collects the contract (block 3A).

## Output format

Every row carries a **Status code**, because a status that is only implied is a check nobody wrote:

| #   | Check                  | Request                     | Status code | Response body                         | Priority | Notes        |
| --- | ---------------------- | --------------------------- | ----------- | ------------------------------------- | -------- | ------------ |
| 1   | All fields valid       | `POST /articles` full body  | 201         | `toMatchSchema(Schema.ARTICLE)`       | P1       |              |
| 2   | Required field missing | `POST /articles` no `title` | 422         | `errors.body` contains `<exact text>` | P1       | text: source |

`Response body` names the schema for success rows and the exact expected message for error rows. `<exact text>` stays a placeholder until the source is known.

## Data structure — every operation

- **Schema validation of the success response** — `expect(model).toMatchSchema(Schema.ARTICLE)`, schemas in `src/api/schemas/<domain>/`. A new response shape needs a new schema file registered in `Schema`.
- **Schema validation of the error response** — `Schema.ERROR` exists; assert the error shape, not only the status.
- **Field-level assertions the schema cannot make**: values echo the request (`toMatchObject`), server-generated fields are present and well-formed (ids, slugs).
- **Creation and update timestamps** — `createdAt` present and a valid date on create; `updatedAt` changes on update and not on read.

## POST

| Item                                | Note for this API                                                                            |
| ----------------------------------- | -------------------------------------------------------------------------------------------- |
| All fields filled with valid data   | The happy path; assert the schema and that the response echoes the input                     |
| Only required fields filled         | Confirms optional fields are truly optional                                                  |
| Not all required fields filled      | One case per required field — this is what finds per-field validation gaps                   |
| No field filled                     | `{ user: {} }` / `{ article: {} }` — checks the whole required set at once                   |
| Empty JSON                          | `{}` — no resource wrapper at all; often a different code path from the case above           |
| Field validation, valid and invalid | Per field: type, format, boundaries, empty string, whitespace only, very long value, unicode |
| Uniqueness                          | A second create with a value that must be unique (email, slug)                               |
| Creation date                       | `createdAt` is set and plausible                                                             |

## GET

| Item                            | Note for this API                                                                                                                                  |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Empty list                      | On a shared server the resource is never empty — get an empty list through a filter that matches nothing (a generated `tag`), not by deleting data |
| Populated list                  | Arrange via an API flow so the test owns its data                                                                                                  |
| Pagination — `limit` / `offset` | `ArticleQuery` carries `limit` and `offset`; assert page size, and that pages do not overlap                                                       |
| Limit on the number of entries  | Includes the server's own cap and its default page size                                                                                            |
| Invalid parameter value         | `limit=-1`, `limit=abc`, `offset=-1` — assert the documented status and the error body, not just "not 200"                                         |
| Sorting                         | Conduit's list has no sort parameter: assert the **default order** (newest first) instead                                                          |
| Filtering                       | `tag`, `author`, `favorited` — a match, a non-match, and a combination                                                                             |
| Get by valid ID                 | Returns exactly the created entity                                                                                                                 |
| Non-existent ID, valid format   | A generated slug that was never created                                                                                                            |
| Invalid ID                      | Empty, wrong shape, path-breaking characters — `buildPath` encodes them, so this tests the server                                                  |
| Deleted entity                  | Reading after delete — see DELETE                                                                                                                  |

## PUT / PATCH

Conduit has no `PATCH`: `PUT /articles/{slug}` accepts a partial body, so partial update is tested through `PUT`.

| Item                          | Note for this API                                                                               |
| ----------------------------- | ----------------------------------------------------------------------------------------------- |
| Update with valid data        | Assert the schema, the changed fields, and that untouched fields kept their values              |
| Partial update                | Only one field in the body — the rest must not be reset                                         |
| Non-existent ID               | Valid format, never created                                                                     |
| Invalid ID                    | As in GET                                                                                       |
| Field validation              | The same per-field matrix as POST                                                               |
| Update changes derived fields | A slug derived from the title changes when the title changes — and the old slug stops resolving |
| No-op update                  | Sending the current values again                                                                |

## DELETE

| Item                             | Note for this API                                                                                           |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Delete an existing object        | Then confirm it is gone with a GET — the delete status alone proves little                                  |
| Delete an already deleted object | Second call; `ArticlesDeleteAPI` accepts `[200, 404]`, so a case that pins the real status is worth writing |
| Non-existent ID                  | Valid format, never created                                                                                 |
| Invalid ID                       | As in GET                                                                                                   |
| Re-create after delete           | Matters where a field is unique: does the freed slug/email become reusable                                  |
| Cascade                          | Deleting a parent — what happens to its comments and favorites                                              |

## Cross-cutting — every operation

- **Auth**: as the owner (`get(APIClient)`), as a guest (`get(APIClient, { guest: true })`), and as **another user** (`get(APIClient, { token })`). The third is the one usually missing, and it is the one that finds broken permissions.
- **Malformed token**: a token that is absent, expired or wrong in shape.
- **Every status in the contract has a case**, including the ones the happy path never reaches.
- **Error payload shape**, not only the status — assert against `Schema.ERROR` and the exact message.
- **Rate limiting**: `429` is an environment condition here, not a product assertion — do not write a test that provokes it.

## How each check is written

Success paths go through the endpoint helpers; negative cases go through the raw call, which is where an expected status is declared:

```ts
const created = await get(APIClient).post.articles.with(article);
expect(created).toMatchSchema(Schema.ARTICLE);

await get(APIClient, { guest: true }).response({
  name: 'create article as guest',
  path: BasePath.ARTICLES,
  method: 'POST',
  body: { article },
  statusCode: 401,
});
```

`statusCode` accepts an array when more than one is acceptable, and `0` to skip the check when the case asserts the body itself. Arrange data with API flows (`get(APIClient).api.articles.create()`) so it is cleaned up; track anything created another way. Details: [api-client](../playwright-ts-conduit-realworld/references/api-client.md).

## Trimming

A full walk of this checklist generates far more cases than the environment can run: ~100 requests / 15 min per IP and ~5 auth requests / hour. Before implementing:

- Fold the per-field validation matrix into **one table-driven test** rather than one test per field.
- Keep the field-by-field expansion for endpoints where the order of validation errors is itself a requirement.
- Cover a rule once, at the cheapest layer — the checklist describes API cases, so a rule proved here does not need a UI case.
- Put sign-up and sign-in cases last: they spend the auth quota.

## Common mistakes

| Mistake                                                            | Instead                                                                                              |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Copying the whole checklist into the task as if every item applies | One decision per item: covered, already covered (name the test), or not applicable (name the reason) |
| A row without a status code                                        | Every row carries the expected status — including the success rows                                   |
| Asserting only the status on a negative case                       | Assert the error payload shape and the exact message too                                             |
| Inventing a status or an error text the contract does not state    | An open question in the task                                                                         |
| "Empty list" tested by deleting other tests' data                  | An empty list through a filter that matches nothing                                                  |
| Delete proved by its own status code                               | Confirm with a follow-up GET                                                                         |
| Only the owner's token exercised                                   | Guest and another user's token as well                                                               |
| One test per validated field, on a rate-limited server             | One table-driven test, unless error ordering is the requirement                                      |
