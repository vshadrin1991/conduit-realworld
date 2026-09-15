---
description: Verify requirements on the running Conduit app in Chrome through the Playwright MCP server
argument-hint: --r <requirements file>
---

# Requirements check in Chrome

**Inputs**: $inputs.output

**Review**: $review.output

**Environment**: $preflight.output

---

## Your task

Verify the requirements planned in `$ARTIFACTS_DIR/live-check-plan.md` on the running application (base URL in **Environment**) in Chrome, using the Playwright MCP tools (`mcp__playwright__browser_*`). This is manual-style testing: do not write test code and do not edit project files.

The demo server allows about 100 requests per 15 minutes per IP and about 5 sign-ins per hour — open each route once and keep the run small.

1. For every route in the plan: `browser_navigate` (hash routes: `<base URL>/#/login`), then `browser_snapshot`. The ARIA snapshot is the main evidence. Check all requirements of that page before moving on.
2. Verify only what the requirement states: texts verbatim, visible fields, links and buttons, input types, redirects, error messages. For `api` requirements, perform the UI action and read `browser_network_requests`; never call the API directly.
3. Sign in at most once, and only when `ui-signed-in` checks exist: use the shared test user's `email` and `password` from `.auth/user.json`. Never write the password or token to any file or output. Without that file, mark those checks `NOT_VERIFIED` (needs sign-in).
4. Do not register users, and create data only when a requirement cannot be checked otherwise; any title or name you enter must contain `pwauto`.
5. Verdict per requirement: `PASS` (observed as stated), `FAIL` (observed differently — quote expected and actual), `NOT_VERIFIED` (not observable, or blocked). Take `browser_take_screenshot` with `filename: live-<REQ>.png` for every `FAIL`.
6. HTTP 429, a blank page or a browser that does not start: stop, and return `ENV_BLOCKED` with what happened.
7. Finish with `browser_close`. Copy the screenshots you cite from `reports/requirements-mcp/` to `$ARTIFACTS_DIR/live/`.
8. Write `$ARTIFACTS_DIR/live-check.md`: totals, then one table — REQ | Check | Verdict | Expected | Actual | Evidence (snapshot excerpt or screenshot path).

## Output

Return JSON with:
- `status` — `PASSED` (no `FAIL`), `FAILED` or `ENV_BLOCKED`
- `summary` — at most 5 lines
- `passed`, `failed`, `not_verified` — counts
