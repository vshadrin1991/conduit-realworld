# Test cases: <feature>

| Field         | Value                                                                   |
| ------------- | ----------------------------------------------------------------------- |
| Key           | <KEY>                                                                   |
| Requirements  | `requirements.md` (<n> requirements) · Review: `requirements-review.md` |
| Author · date | <name> · <date>                                                         |
| Status        | <Ready / Contains drafts>                                               |

## Summary

| Priority | Cases | API | UI  | Hybrid | Manual only | Drafts |
| -------- | ----- | --- | --- | ------ | ----------- | ------ |
| P1       | <n>   | <n> | <n> | <n>    | <n>         | <n>    |
| P2       | <n>   | <n> | <n> | <n>    | <n>         | <n>    |
| P3       | <n>   | <n> | <n> | <n>    | <n>         | <n>    |

## Test design

| REQ   | Technique                 | Test conditions               |
| ----- | ------------------------- | ----------------------------- |
| REQ-1 | <Boundary value analysis> | <title length 0, 1, 255, 256> |

## Test cases

| ID            | Title                       | REQ   | Priority | Type                                                | Layer               | Automation          | Status                         |
| ------------- | --------------------------- | ----- | -------- | --------------------------------------------------- | ------------------- | ------------------- | ------------------------------ |
| TC-<AREA>-001 | <behaviour in one sentence> | REQ-1 | <P1>     | <positive / negative / boundary / permission / NFR> | <API / UI / hybrid> | <yes / no — reason> | <Ready / Draft — confirm RV-n> |

### TC-<AREA>-001 — <title>

**Requirements:** REQ-1 · **Priority:** P1 · **Type:** positive · **Layer:** UI · **Automation:** yes
**Preconditions:** <user state, existing data>
**Test data:** <concrete values>

| #   | Step                       | Expected result                         |
| --- | -------------------------- | --------------------------------------- |
| 1   | <action in plain language> | <observable result, exact message text> |

**Notes:** <open question, assumption, known app behaviour>

## Traceability matrix

| REQ   | Test cases                   | Coverage                                          |
| ----- | ---------------------------- | ------------------------------------------------- |
| REQ-1 | TC-<AREA>-001, TC-<AREA>-002 | <Covered / Partly — RV-n / Not testable — reason> |

## Not covered

- <requirement or aspect, and why: out of scope, not testable, blocked by RV-n>
