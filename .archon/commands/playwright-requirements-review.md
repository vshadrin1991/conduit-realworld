---
description: Review a requirements file and plan the checks in Chrome for a requirements testing run
argument-hint: --r <requirements file>
---

# Requirements review

**Input**: $ARGUMENTS

**Inputs**: $inputs.output

---

## Your task

Follow the `playwright-ts-test-requirements` skill (normalize and review, steps 3–4) for the requirements file above. Check known app behaviour in the `playwright-ts-conduit-realworld` skill (`references/app-behaviour.md`) before calling something a contradiction. The run is non-interactive: never ask questions — every question becomes an open finding.

1. Read the requirements file (the extracted text for non-Markdown files).
2. Normalize the text into atomic requirements; keep the IDs of the source (`REQ-01.4`) when it already has them.
3. Review every requirement and the set as a whole with the skill's review checklist; record findings `RV-n` with the quoted source text, category, severity and a question or suggestion.
4. Classify each requirement by how it can be verified on the running app:
   - `ui` — visible in Chrome as a guest (texts, fields, links, redirects);
   - `ui-signed-in` — visible only for a signed-in user;
   - `api` — a status code or response body, observable in the browser's network requests after a UI action;
   - `static` — not observable in the app (backend-only rules, non-functional statements).
5. Write `$ARTIFACTS_DIR/requirements-review.md` with the skill's review template.
6. Write `$ARTIFACTS_DIR/live-check-plan.md`: one row per `ui`, `ui-signed-in` and `api` requirement — ID, class, route, steps in plain language, expected observable result quoted from the requirement. Group rows by route so each page is opened once.

`BLOCKED` only when a blocker finding makes the requirements untestable (contradicting statements, no expected result for a core flow). Open major and minor findings do not block.

## Output

Return JSON with:
- `status` — `READY` or `BLOCKED`
- `summary` — at most 5 lines
- `requirements`, `blockers`, `majors`, `minors`, `live_checks` — counts
