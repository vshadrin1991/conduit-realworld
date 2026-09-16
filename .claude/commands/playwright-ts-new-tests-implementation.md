---
description: Implement new Playwright tests end to end — asks for the test type (api or ui), gathers the input that type needs, agrees the case list, then writes the code
argument-hint: '<api|ui> [what to cover]'
---

# New tests implementation

**Arguments**: $ARGUMENTS

## Current state

Existing specs:
!`ls tests/api tests/ui 2>/dev/null`

Existing page objects:
!`ls src/pageObject/pages 2>/dev/null`

Existing endpoint helpers:
!`find src/api/client/helpers -name "*API.ts" -exec basename {} \; 2>/dev/null | sort`

---

## Your task

Drive the implementation of new tests. The knowledge lives in the skills — this command only decides which ones to use and in what order, so follow them rather than restating their rules from memory.

### Step 1 — Test type (do not skip)

The type decides everything after it, so resolve it before anything else.

- `api` or `ui` in the arguments → use it.
- Anything else, or nothing → **ask and wait**. Offer exactly `api` and `ui`; use the AskUserQuestion tool when it is available. Do not guess from the wording of the request, and do not start reading the codebase before the answer arrives.
- The user describes work that clearly spans both → say so, then agree a split: which cases are API and which are UI. Run step 2 for each part.

Restate the type and what is being covered in two lines before moving on.

### Step 2 — Gather the input that type needs

**api** — the contract comes first, because statuses and payload shapes cannot be guessed:

1. Ask for the OpenAPI/Swagger file or URL; if there is none, HAR, `curl` examples or real request/response pairs.
2. Ask which operations are in scope — method + path per case.
3. Derive the case list with the [playwright-ts-api-checklist](../skills/playwright-ts-api-checklist/SKILL.md) skill. Produce its coverage table, with a status code on every row.
4. Anything the contract does not state stays an open question — do not invent statuses or error texts.

**ui** — the pages come first, because locators must come from real markup:

1. Ask for the pages saved with Ctrl/Cmd+S as **Webpage, Complete**, one file per state the tests act on or assert, plus the route and state of each.
2. Generate the page descriptions: `npm run page:md -- "<folder>"`.
3. Take locators and element names from those descriptions. A locator remembered from the live site is a guess — treat it as one.
4. Resolve every open decision the descriptions list before writing the page object.

Either type: if the work already has a task file (`tasks/<KEY>/<KEY>.md`), read it first — its cases and requirements are the source of truth, and its open questions are resolved with the user, not assumed. The [playwright-ts-test-aqa-task](../skills/playwright-ts-test-aqa-task/SKILL.md) skill creates such a file when the input is still scattered.

### Step 3 — Agree the case list

Show the cases compactly: ID, title, expected result, and for API the expected status. Mark anything you drafted yourself as **Draft — confirm**. Ask for a go-ahead and wait for it — implementing unconfirmed drafts is how tests end up asserting the wrong thing.

### Step 4 — Implement

Follow the [playwright-ts-conduit-realworld](../skills/playwright-ts-conduit-realworld/SKILL.md) skill, and open the matching file in its `assets/` before writing each kind of file.

Order, so that each layer exists before the one that uses it:

1. routes, paths and models;
2. endpoint helpers and API flows;
3. page objects and components;
4. specs.

Reuse before adding: the lists above show what already exists. Extending `ArticlesGetAPI` beats creating a second helper for the same domain.

### Step 5 — Check

Run `npm run typecheck` and `npm run lint` and fix what they report.

Do **not** run the test suite here. The demo server allows ~100 requests / 15 min per IP and ~5 auth requests / hour, and a 429 renders pages blank, so a broad run produces misleading failures. Instead, offer the narrowest verification run and let the user decide:

```bash
npx playwright test tests/<project>/<file>.spec.ts
```

If the user asks for the run and something fails, triage with the [playwright-ts-test-results](../skills/playwright-ts-test-results/SKILL.md) skill before changing any expectation, and heal locators broken by a UI change with [playwright-ts-test-self-healing](../skills/playwright-ts-test-self-healing/SKILL.md).

### Step 6 — Report

- what was implemented, by case;
- created and changed files;
- spec locations of the new tests, e.g. `tests/api/comments.api.spec.ts:24`;
- open questions still unanswered, and what they block;
- the suggested verification command.
