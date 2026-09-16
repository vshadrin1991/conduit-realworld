---
description: Collect evidence for the requirements from the running Conduit app in Chrome through the Playwright MCP server
argument-hint: --r <requirements file>
---

# Evidence from the running application

**Inputs**: $inputs.output

**Review**: $review.output

**Environment**: $preflight.output

---

## Your task

Observe the running application (base URL in **Environment**) in Chrome with the Playwright MCP tools (`mcp__playwright__browser_*`) and record what it does. You are collecting evidence for the review, not judging the requirements: the application never "fails" a requirement here — a difference is a question for the author, because it is either a product defect or an outdated requirement.

Work from `$ARTIFACTS_DIR/live-check-plan.md`, in this order:

1. **Open questions first** — requirements the review marked as unclear or unspecified: what the application does is the answer that unblocks test design.
2. **Then the rest of the plan** — requirements whose behaviour can be seen in the browser.

Rules of the run:

- The demo server allows about 100 requests per 15 minutes per IP and about 5 sign-ins per hour. Open each route once (`browser_navigate`, hash routes like `<base URL>/#/login`), read it with `browser_snapshot`, and check every requirement of that page before moving on.
- Read API answers with `browser_network_requests` after the UI action that sends them; never call the API directly.
- Sign in at most once, and only for requirements that need a signed-in user: take `email` and `password` of the shared test user from `.auth/user.json`, and never write the password or token anywhere. Without that file mark those rows `NOT_OBSERVED` (needs sign-in).
- Do not register users. Create data only when a requirement cannot be observed otherwise, and put `pwauto` in any title or name you enter.
- Take `browser_take_screenshot` with `filename: evidence-<REQ>.png` for every difference.
- Stop and return `ENV_BLOCKED` when the server answers 429 or pages stay blank; finish with `browser_close` in every case.

Verdict per row:

- `MATCHES` — the application behaves as the requirement states (quote what you saw).
- `DIFFERS` — it behaves differently. Record expected (quoted from the requirement), actual, evidence, and classify: **possible product defect** (the app breaks its own rules: server errors, data loss, broken flow), **requirement may be outdated** (the app is consistent and matches the wider specification of the product), or **not specified** (the requirement says nothing about this case). Always add the question the author has to answer.
- `NOT_OBSERVED` — not observable in the browser, needs a signed-in user or data you may not create, or was blocked; say which.

Write `$ARTIFACTS_DIR/evidence.md`: totals, then a table REQ | Check | Verdict | Expected | Observed | Classification and question | Evidence (snapshot excerpt or screenshot path), and a short section **Answers to open questions** that maps review findings (`RV-n`) to what the application showed. Copy the screenshots you cite from `reports/requirements-mcp/` to `$ARTIFACTS_DIR/evidence/`.

## Output

Return JSON with:

- `status` — `COLLECTED` (the plan was covered), `PARTIAL` (some rows could not be observed) or `ENV_BLOCKED` (nothing could be observed)
- `summary` — at most 5 lines
- `matches`, `differences`, `not_observed` — counts
