---
description: Heal page-object locators broken by a UI change after a Playwright run
argument-hint: <Playwright arguments that were run>
---

# Heal broken locators

**Input**: $ARGUMENTS

**Triage**: $triage.output

---

## Your task

Follow the `playwright-ts-test-self-healing` skill exactly.

1. List candidates: `node .claude/skills/playwright-ts-test-self-healing/scripts/find-broken-locators.mjs`. Skip everything that is not `locator: candidate for healing`.
2. Take the new locator from offline evidence first (`error-context.md` page snapshot, screenshot, trace). Probe the live page only when that is not enough — it costs rate-limit budget.
3. Edit only locator declarations in `src/pageObject/**`: keep element names, specs and assertions unchanged; fix every copy of the broken locator; heal a broken `root` first.
4. Run `npm run typecheck && npm run lint`, then re-run each healed test once: `HEADLESS=true npx playwright test <spec:line>`.
5. Never use `.first()` just to silence strict mode, `force`, bigger timeouts, sleeps, `.or()` fallbacks or weaker assertions.

## Output

A table: Test | Element (`Page.name`) | Old locator | New locator | Evidence | Verified — and the failures that were not healed, with the reason.
