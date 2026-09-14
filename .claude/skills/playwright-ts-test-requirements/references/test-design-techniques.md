# Test design techniques

Part of the [playwright-ts-test-requirements](../SKILL.md) skill.

Pick techniques per requirement, derive test conditions, then turn conditions into test cases. Name the technique in the test design section so the coverage is explainable.

| Technique | Use for | How |
|---|---|---|
| Equivalence partitioning | Inputs with valid and invalid groups (email formats, tag lists, roles) | One case per group; invalid groups one at a time so each failure has one cause |
| Boundary value analysis | Lengths, counts, ranges, dates, page sizes | For a range min..max test min−1, min, min+1, max−1, max, max+1; for "up to N" test N and N+1; empty value separately |
| Decision table | Rules that combine conditions (logged in × author × published) | List conditions and actions, one case per meaningful column, collapse columns with the same outcome |
| State transition | Objects with a lifecycle (draft → published → deleted, followed ↔ unfollowed) | Cover every valid transition once and the invalid transitions that the UI or API could still attempt |
| Pairwise | Many independent parameters (browser × role × language) | Cover every pair of values instead of every combination; state the parameter list |
| Use case / scenario | End-to-end user goals | Main flow, alternative flows and exception flows as separate cases |
| Error guessing | Places where defects usually hide | See the list below |
| Checklist | Non-functional or UI consistency requirements | Short verifiable checks, each with an observable result |

## Error guessing for Conduit

- Text fields: empty, only spaces, leading and trailing spaces, maximum length and one more, very long words, Unicode and emoji, HTML and Markdown in content, SQL-like and script-like strings.
- Titles and slugs: duplicate titles, titles that differ only in case or punctuation, characters that change the generated slug.
- Users: duplicate username or email, case differences in email, changed username with existing articles and comments.
- Lists and feeds: zero, one and many items, pagination edges, items created by other users at the same time.
- Actions: double submit, going back after submit, acting on data deleted meanwhile, actions without permission through the API directly.
- Sessions: expired or missing token, logout in another tab.

## Coverage expectations

| Requirement type | Minimum cases |
|---|---|
| Form or input rule | Valid case, every invalid partition, boundaries of every limit, required-field checks, the exact error messages |
| Business rule | Decision table columns with distinct outcomes |
| Permissions | Allowed role positive case, every denied role, direct API attempt for denied actions |
| Lifecycle | Every valid transition, the invalid transitions reachable from the UI or API |
| API endpoint | Success, each documented error status, auth missing, invalid payload |
| Non-functional | One measurable check per stated target |

## Priority and layer

- **P1** — core flows and data integrity (publish, login, delete), security and permissions. **P2** — main alternative and negative flows. **P3** — cosmetic, rare edge cases.
- Suggest the layer by the test pyramid, as in the [playwright-ts-test-implementation](../../playwright-ts-test-implementation/SKILL.md) skill: rules, validation, statuses and permissions → API; what needs a browser (rendering, navigation, dialogs) → UI; UI checks with data arranged through the API → hybrid.
- Automation candidate: yes when the result is deterministic and observable; no (manual) for visual judgement, one-off checks or behaviour the shared demo server cannot produce on demand.
