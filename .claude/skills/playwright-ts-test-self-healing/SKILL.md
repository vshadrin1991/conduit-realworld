---
name: playwright-ts-test-self-healing
description: Use when UI tests in this Conduit Playwright + TypeScript project fail because a locator no longer matches the page — "element(s) not found", "strict mode violation ... resolved to N elements", timeouts in navigate / waitUntilPageLoaded or in a FunctionalPage step (fillData, clickActionButton, verify*) after a front-end change — or when the user asks to heal, repair, update or stabilise broken locators or page objects. Healing follows the project conventions of the playwright-ts-conduit-realworld skill.
---

# Self-healing locators (Conduit)

## Overview

Healing = changing a locator **declaration** in `src/pageObject/**` so it again finds the element the test always meant. It never changes what a test does or verifies. If the element's meaning changed, it is not a heal — it is a product change to report.

A heal is only as good as its evidence: every new locator must be backed by the failure's page snapshot, screenshot/trace, or a live probe that shows exactly one visible match.

## Base conventions

Healing edits framework code, so it follows the project conventions skill [playwright-ts-conduit-realworld](../playwright-ts-conduit-realworld/SKILL.md). Read its `SKILL.md` before the first heal and open the reference for what the heal touches:

| Healing touches | Conventions to apply |
|---|---|
| A locator declaration | [page-objects](../playwright-ts-conduit-realworld/references/page-objects.md): locator priority (role → placeholder / label / text → semantic CSS, no XPath), locators only, named maps with type unions, `root` present only when the page is rendered |
| A shared fragment or component (`Header`, element components) | [components](../playwright-ts-conduit-realworld/references/components.md): `BaseComponent` is for page components only; element components are called from the page |
| Code around the declaration | [code-conventions](../playwright-ts-conduit-realworld/references/code-conventions.md): no `//` or one-line comments, JSDoc only in the required format |
| A failure in sign-in steps (`LoginPage` steps in `beforeEach`) | [test-data-and-auth](../playwright-ts-conduit-realworld/references/test-data-and-auth.md): UI tests sign in through the login form and spend the auth quota — heal the `LoginPage` locator, never replace the steps with a session shortcut |
| Probes and verification runs | [execution-and-config](../playwright-ts-conduit-realworld/references/execution-and-config.md): rate limits, smallest scope, `AUTH_QUOTA` |
| App quirks behind a "broken" locator (feed paging, async re-render, native dialogs) | [app-behaviour](../playwright-ts-conduit-realworld/references/app-behaviour.md) |

A heal is done only when it also meets the Definition of done of the conventions skill for a page-object change: typecheck and lint pass, and the healed test passes when run alone.

## When not to heal

| Symptom | Category | Do instead |
|---|---|---|
| `-> 429` in the test's `logs`, blank or near-empty page snapshot | environment | Wait for `retry-after` and re-run; locators are fine |
| `ArticlePage has no button named "x"` | test code | Fix the name in the spec or the page's type union |
| Locator found, but `toHaveText` / `toHaveValue` / `toContainText` got another value | product change or bug | Report to the user; never edit expected values |
| Step `API :: ...` failed | API | `playwright-ts-test-results` skill |
| Element is gone or the feature moved to another page | product change | Report; the test needs a human decision |

## Workflow

1. **Triage the run** — `npm run results -- --failures-only`. Only `locator-or-timing` failures go further; everything else follows the [playwright-ts-test-results](../playwright-ts-test-results/SKILL.md) skill.
2. **Map failures to declarations** — `node .claude/skills/playwright-ts-test-self-healing/scripts/find-broken-locators.mjs` (reads `reports/results.json`; `--json` for machine output). Per failure it prints the verdict, broken locator, failing page step (`ArticlePage.clickActionButton(postComment)`), the declaration `file:line` and the artifacts. `navigate` / `waitUntilPageLoaded` steps point at the page's `root`.
3. **Read offline evidence first (free)** — in `test-results/<test>/error-context.md` the `# Page snapshot` section is the ARIA tree at the moment of failure: the main source for the new locator. Then `test-failed-1.png`, and `npx playwright show-trace test-results/<test>/trace.zip` for the steps before. A missing or near-empty snapshot means the page did not render → environment, stop.
4. **Choose the replacement** — find the element by what the test means (element name, step, test title), then write the locator by the priority in [page-objects](../playwright-ts-conduit-realworld/references/page-objects.md) of the conventions skill: `getByRole` + name → `getByPlaceholder` / `getByLabel` / `getByText` → semantic CSS. Keep the original scoping (`this.root.getBy...`).
5. **Probe live only when offline evidence is not enough** — it spends rate-limit budget (the SPA, its assets and API calls per run), so check all candidates in one run:
   `node .claude/skills/playwright-ts-test-self-healing/scripts/probe-locators.mjs --route /settings --login --try "getByPlaceholder('Email')" --try "getByRole('button', { name: 'Update Settings' })"`
   Accept only `UNIQUE` (one visible match). Write expressions as in page objects without `this.page.`; replace `this.root` with the root expression. Data pages (an article slug) have no URL after cleanup — use the snapshot, or re-run the failing test once with `TRACE=on`.
6. **Apply** — edit only the declaration. Keep the element name, type unions and specs unchanged. Grep the old locator string and fix every copy. If the new locator needs `.first()` / `nth()`, state the stable reason in the report — not in a code comment. If `root` is broken, heal it first and re-run before touching other elements of that page — its failure hides the rest.
7. **Verify** — `npm run typecheck && npm run lint`, then run only the healed tests once: `npx playwright test tests/ui/<file>.ui.spec.ts:<line>`. A 429 during verification is not a pass — report it as unverified.
8. **Report** — one table: Test | Element (`Page.name`) | Old locator | New locator | Evidence | Verified. List failures that were not healed with their category and reason.

## Healing rules

| Never | Why |
|---|---|
| Change assertions, expected texts, test steps or specs | Hides product changes; healing is page-object only |
| Add `.first()` / `nth()` just to silence a strict mode violation | Acts on an arbitrary element — narrow by `root`, container, `filter({ hasText })` or exact name |
| XPath, generated/hashed class names, `nth-child` chains | Break on the next change |
| `force: true`, `clickViaJs`, bigger timeouts, `waitForTimeout`, retries | Mask a missing, hidden or covered element |
| Fallback chains (`a.or(b)`), try/catch alternatives, runtime auto-healing code | A test that cannot fail on the broken UI proves nothing |
| A new locator without snapshot, screenshot or probe evidence | A guessed locator can pass against the wrong element |

## Common UI changes

| What changed | Heal |
|---|---|
| Button/link text renamed (`Sign in` → `Log in`) | Update the accessible name; if a test also asserts that text, report it as a product change |
| Role changed (button → link) | Update the role, keep the name |
| Placeholder changed or a label was added | Prefer the label; otherwise the new placeholder |
| Element duplicated (strict mode violation) | Scope to `root` or a container, or filter; `.first()` only with a stable reason stated in the report |
| Page heading changed, every step on the page times out | Heal `root`, re-run, then handle what is still failing |
| Wrapper markup changed, semantic class gone | Move up the priority list to role / text instead of chasing new CSS |
