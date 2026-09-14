# Requirements review checklist

Part of the [playwright-ts-test-requirements](../SKILL.md) skill.

Check every requirement, then the set as a whole. Each problem becomes a finding `RV-n` with the quoted text, category, severity and a question or suggestion.

## Categories

| Category | Look for |
|---|---|
| Completeness | Missing error handling, empty and loading states, limits (length, size, count), defaults, required vs optional fields, roles and permissions, what happens to existing data, notifications, audit/history, undo |
| Ambiguity | Vague words (see below), undefined terms, "and/or", pronouns without a clear subject, missing units or formats (dates, time zones, currency) |
| Consistency | Contradictions inside the document, with other documents, with designs, or with the current application |
| Testability | No observable outcome, no measurable criterion, results that depend on unstated data or timing |
| Correctness and feasibility | Rules that cannot hold together, impossible performance targets, dependencies on things that do not exist |
| Uniqueness and traceability | Duplicated requirements, missing IDs, one statement that mixes several behaviours |
| UI | Exact texts of labels and messages, when validation happens (typing, leaving the field, submit), disabled states, navigation after an action, responsive or browser scope |
| API | Endpoint, method, auth, request fields with types and limits, success status and body, every error status with its body |
| Security and privacy | Who may see or change what, authorization of every action, data exposed in URLs or logs, rate limiting |
| Non-functional | Performance targets with numbers, accessibility level, supported browsers and devices, localization |

## Vague words to question

fast, quickly, user-friendly, intuitive, easy, simple, flexible, robust, secure, efficient, appropriate, normal, reasonable, as needed, if possible, etc., and so on, some, several, many, few, usually, generally, should, may, might, could, support, handle, manage, optimize, minimize, maximize, up to date, real time, seamless.

Ask for the concrete meaning: a number, a list, a rule or an observable result.

## Severity

| Severity | Meaning |
|---|---|
| blocker | The behaviour cannot be designed or implemented without an answer (missing rule, contradiction on a core flow) |
| major | Likely to produce a defect, rework or a wrong test (missing error case, undefined limit, ambiguous rule) |
| minor | Wording, naming or formatting that does not change behaviour |

## Conduit context

- The app is a public demo (articles, comments, profiles, favorites, follow, tags, auth) used by other people at the same time: requirements that assume an empty or exclusive environment need a finding.
- Compare with [app-behaviour](../../playwright-ts-test-implementation/references/app-behaviour.md) before reporting a contradiction with the current application — known behaviour is documented there.
- Rate limits of the demo server are an environment constraint, not a requirement to test.
