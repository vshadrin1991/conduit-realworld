# Requirements Testing Failed: REQ-02-home-feed-tags-and-pagination

**Date**: 2026-09-15  
**Base URL**: https://conduit-realworld-example-app.fly.dev  
**Browser**: Chrome (Playwright MCP), hash routing  

## Result

**FAILED** — 1 requirement(s) failed in Chrome.

## Failed Requirements

| REQ | Expected | Actual | Evidence | Likely Cause |
|---|---|---|---|---|
| REQ-02.15c | `offset` is a page index: skipped articles = `offset × limit`. For page 2 with `offset=3&limit=3`, skip 9 articles and start at the 10th newest article. | The UI sends `offset=3&limit=3` for page 2 and receives the 4th–6th newest articles (harbor chronicle entries 4, 3, 2). Skipped = 3 articles = `offset` value, so `offset` is an item offset, not a page index. | `GET /api/articles?limit=3&offset=3`; page 1 shows entries 5–3, page 2 shows entries 4–2; screenshot `live/live-REQ-02.15c.png` | **Requirement outdated** — REQ-02.15c contradicts the RealWorld API specification (which treats `offset` as an item offset, not a page index). The requirements document is "derived from the current implementation", so this reflects the actual product behaviour and the requirement statement diverges from the design. |

## Not Verified

Five rows were not verified in the live check and should be re-run or clarified:

| REQ | Reason |
|---|---|
| REQ-02.15b | `limit`/`offset` defaults only observable via direct API call; the UI always sends `limit=3&offset=0` |
| REQ-02.15a (tag) | No user with favorites reachable through the UI to verify the `favorited` filter |
| REQ-02.15a (unknown) | Unknown `favorited` username returned **500** `Cannot read properties of null (reading 'getFavorites')` — recorded as a finding; undefined behaviour in requirements |
| REQ-02.13 | `GET /api/articles/feed` without token (401 response) not triggerable from the UI; feed tab exists only when signed in |
| REQ-02.12 | The shared test user follows nobody; Your Feed returns empty state (`articlesCount: 0`). Listing rule cannot be observed without changing the shared user's follow state. |

## Blocking Findings

None — all findings are classified as major (open questions) or minor (clarifications), not blockers. Test design is not blocked.

## Findings Requiring Resolution

The automated review identified 14 major findings and 7 minor findings. Key majors blocking test case refinement:

1. **RV-1** (REQ-02.10) — The **Popular Tags** sidebar shows a bounded subset (50 observed), but the selection rule (which tags, how many, in what order) is undefined.
2. **RV-2** (REQ-02.15c) — **`offset` semantics diverge from the RealWorld specification**: the requirement states `offset` is a page index, but the implementation treats it as an item offset (matching RealWorld). Unclear if this is intentional or a defect to be fixed.
3. **RV-3** (REQ-02.7a) — Pagination control counts and **Jump forward** step size are undefined; "Previous page" and "Next page" disabled/hidden states not specified.
4. **RV-4** (REQ-02.4b) — Date format has no time zone or locale; an article created at 23:30 UTC may render on a different day depending on the browser's time zone.
5. **RV-5** (REQ-02.4c) — Favorite button behaviour is incomplete: behaviour for guests and signed-in users not specified.
6. **RV-7** (REQ-02.11b, REQ-02.12) — Empty feed states undefined (Your Feed with no follows, tag with no articles).
7. **RV-8** (REQ-02.15a) — Error handling for unknown usernames, unknown tags, and invalid `limit`/`offset` undefined.
8. **RV-9** (REQ-02.13, REQ-02.14) — Error body shapes not specified; which statuses can `GET /api/articles` return?
9. **RV-10** (REQ-02.14) — API schema incomplete: field types, nullability, and timestamp format not specified. `followersCount` presence unclear.
10. **RV-11** (REQ-02.2b) — Tab order and selected tab for signed-in users undefined.
11. **RV-12** (REQ-02.11a) — Tag tab lifecycle undefined: can it be closed, does a second tag replace it, does **Global Feed** clear the filter?
12. **RV-13** (REQ-02.18 vs REQ-02.10) — `GET /api/tags` is unbounded (3 400 tags observed) with no ordering or pagination; client-side filtering overhead undefined.
13. **RV-14** (whole set) — Requirements are "derived from the current implementation" with no authority tracing current behaviour to intended design.

## Environment

| Aspect | Status |
|---|---|
| **Site availability** | UP (HTTP 200) |
| **Base URL** | https://conduit-realworld-example-app.fly.dev |
| **Browser** | Chrome (Playwright MCP, hash routing) |
| **Test run** | Completed: 33 rows checked, 27 PASS, 1 FAIL, 5 NOT_VERIFIED |
| **HTTP errors** | None in main flow; one 500 error recorded in negative case (REQ-02.15a unknown value) |
| **Data snapshot** | `GET /api/articles?limit=3&offset=0` → `articlesCount: 10897`; `GET /api/tags` → 3 402 tags |
| **Test user** | Shared test user signed in once; no users registered, no data created |

### Notes on Environment

- The shared Conduit demo has concurrent article creation by other users, so feed contents change between requests (RV-6, non-deterministic test data).
- A likely backend defect was observed: `GET /api/articles?author=Mauricio` returned `articlesCount: 2` with only 1 article under `limit=3` — count/rows mismatch for filtered queries (outside the planned rows, recorded separately).

## Next Steps

1. **Clarify or fix REQ-02.15c** — Confirm whether `offset` as a page index is intended (diverging from RealWorld spec), or whether a backend fix is needed to match the specification. If the requirement is outdated, update it to reflect the actual item-offset semantics.

2. **Address the 14 major findings** — Answer the 14 questions for the author (listed in the requirements review) to unblock test case design. Prioritize:
   - **RV-2** (offset semantics intent)
   - **RV-1** (Popular Tags rule)
   - **RV-7** (empty states)
   - **RV-8** (error handling)
   - **RV-14** (who authorizes requirements as intended vs. observed)

3. **Re-run live checks** after clarifications:
   - REQ-02.15b (defaults): add direct API calls to verify defaults
   - REQ-02.12 (Your Feed): create a followed user or use a different test account
   - REQ-02.15a (favorited filter): locate or create a user with favorites
   - REQ-02.13 (401): add a direct API call without a token
   - REQ-02.15a (unknown value): once error handling is clarified, verify expected status and body

4. **Confirm or update the live-check-plan** — Once findings are resolved, the plan will move from "assumptions" to confirmed assertions. Currently marked "READY" but depends on author answers.

5. **Request a typed API schema** — RV-10 blocks reliable API contract tests; request a JSON Schema or OpenAPI spec for `Article` and `Author` models with nullability and timestamp format.

---

**Report generated**: 2026-09-15  
**Status**: Requirements testing failed; 1 FAIL, 5 NOT_VERIFIED  
**Artifacts folder**: `/Users/vitalyshadrin/.archon/workspaces/vshadrin1991/conduit-realworld/artifacts/runs/0c2502dc-b5bd-4107-bdd2-dbc47e5526cc/`
