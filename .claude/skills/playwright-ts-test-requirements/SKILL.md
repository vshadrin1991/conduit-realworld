---
name: playwright-ts-test-requirements
description: Use when the user sends requirements for the Conduit project — a user story, acceptance criteria, specification, PRD, design notes, API contract or a Jira/Confluence page, as Markdown, Word, PDF, HTML, text, spreadsheet, image or pasted text — and wants them tested or reviewed for gaps, ambiguity, contradictions and testability, or wants test cases, a test design, checklists or a traceability matrix written from them; including requests like "test these requirements", "review this spec", "write test cases for this story" or "prepare test documentation".
---

# Requirements testing and test case documentation (Conduit)

## Overview

One source, two deliverables:

1. **Requirements review** — static testing: defects in the requirements (gaps, ambiguity, contradictions, untestable statements) found before any code exists, each with a question or suggestion.
2. **Test case documentation** — test design, test cases and a traceability matrix that covers every requirement.

Never invent behaviour. Whatever the source does not state becomes a review finding; test cases that depend on an open question stay **Draft — confirm** until the user answers.

## Output

```
tasks/<KEY>/requirements/
  source/                  files as received (copied, never edited)
  extracted/               text versions written by the extraction script
  requirements.md          atomic requirements REQ-1… with source references
  requirements-review.md   findings, questions, answers   (assets/requirements-review-template.md)
  test-cases.md            test design, test cases, traceability   (assets/test-cases-template.md)
```

`<KEY>` is the Jira key when there is one, otherwise `REQ-<yyyyMMdd>-<short-slug>`. When the requirements belong to an automation task, use that task's folder (see [playwright-ts-test-aqa-task](../playwright-ts-test-aqa-task/SKILL.md)).

## Workflow

1. **Collect sources** — ask once for every file, link or pasted text, plus: version/date, feature area, what is in and out of scope. Copy files into `source/`.
2. **Extract text** — `node .claude/skills/playwright-ts-test-requirements/scripts/extract-requirements.mjs "tasks/<KEY>/requirements/source"`. It writes `extracted/<file>.md` and lists the files to read directly (PDF, images). Formats and fallbacks: [input-formats](references/input-formats.md).
3. **Normalize** — split the text into atomic, testable statements `REQ-n` in `requirements.md`: one behaviour each, with source reference (file › heading, page or row), type (functional, validation/message, UI, API, permissions, security, performance, accessibility, compatibility) and priority when the source gives one. Requirements that are only implied (by designs, the current app, common practice) go to a separate list as `REQ-In`, marked *implicit — confirm*.
4. **Review** — go through [review-checklist](references/review-checklist.md) for every requirement and for the set as a whole. Record findings `RV-n` in `requirements-review.md` with the quoted text, category, severity and a question or suggestion.
5. **Ask** — send the user the blocker and major questions as one numbered list and wait. Record answers in the review (Resolution), update the affected requirements, and close or keep each finding.
6. **Design tests** — for each requirement choose techniques from [test-design-techniques](references/test-design-techniques.md) and derive test conditions: positive flow, negative cases, boundaries, combinations, states, roles, error handling and the non-functional checks the requirement asks for. Merge conditions that duplicate each other.
7. **Write test cases** — fill `assets/test-cases-template.md`: every case has ID, title, requirement references, priority, type, preconditions, test data, steps, expected results, suggested layer (API / UI / hybrid by the test pyramid) and automation candidate. The traceability matrix maps every requirement to at least one case, or states why it cannot be tested.
8. **Hand off** — summarize: requirements, findings by severity, open questions, cases by priority and layer. Offer the next step: an automation task with the [playwright-ts-test-aqa-task](../playwright-ts-test-aqa-task/SKILL.md) skill, or implementation with the [playwright-ts-conduit-realworld](../playwright-ts-conduit-realworld/SKILL.md) skill.

## Rules

| Rule | Why |
|---|---|
| Quote the source text in every finding and name where it is | Reviewers verify the finding without searching |
| Expected results and messages come only from the requirements or the user's answers; messages verbatim | Invented expectations turn into false defects |
| Every requirement is traced; an untestable one is a finding, never silently skipped | Gaps in coverage stay visible |
| Steps in plain language — no code, locators or selectors | Test cases are read by manual QA, developers and product owners |
| Concrete test data (values, lengths, boundaries) | Anyone can reproduce the case |
| Design for a blocked requirement stays **Draft — confirm** | Work on unclear requirements is not presented as final |
| Check [app-behaviour](../playwright-ts-conduit-realworld/references/app-behaviour.md) before calling current behaviour a contradiction | Known demo-app behaviour is not a requirements defect |

## References

| Reference | Read when |
|---|---|
| [input-formats.md](references/input-formats.md) | A source is not plain Markdown or text |
| [review-checklist.md](references/review-checklist.md) | Reviewing requirements (step 4) |
| [test-design-techniques.md](references/test-design-techniques.md) | Deriving test conditions and cases (step 6) |
| [requirements-review-template.md](assets/requirements-review-template.md) | Writing `requirements-review.md` |
| [test-cases-template.md](assets/test-cases-template.md) | Writing `test-cases.md` |

## Common mistakes

| Mistake | Instead |
|---|---|
| Writing test cases straight from the raw document | Normalize into `REQ-n` first; cases trace to IDs |
| One test case per requirement, happy path only | Negative, boundary and error cases for every input and rule |
| "Should work correctly" as the expected result | An observable outcome: message text, value, status, state |
| Asking questions one by one during design | One numbered list after the review, then design |
| Treating a PDF or screenshot as unreadable | Read it directly; see input-formats |
