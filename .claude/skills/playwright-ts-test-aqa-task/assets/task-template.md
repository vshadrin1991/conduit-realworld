# <KEY>: <Summary>

| Field | Value |
|---|---|
| Issue type | Task — Test Automation |
| Project / Component | Conduit QA Automation / <UI tests, API tests> |
| Priority | <Highest, High, Medium, Low> |
| Labels | `automation`, `playwright`, `<feature>` |
| Epic / Links | <epic, story, bug, design links> |
| Assignee | <name or unassigned> |
| Estimate | <story points or hours> |

## Description

### Context
<Why this coverage is needed: feature, change, bug, risk.>

### Goal
<What will be automated and what confidence it gives.>

### Scope
- <Feature area / flows covered>
- Layers: <API, UI, hybrid, mocked UI> — <reason by the test pyramid>

### Out of scope
- <What is explicitly not covered>

## Acceptance criteria

- [ ] All cases from **Test cases** with status *Confirmed* are automated
- [ ] <Criterion from requirements (source)>

## Test cases

| ID | Title | Layer | Priority | Tags | Status |
|---|---|---|---|---|---|
| <TC-1> | <title> | <API/UI/hybrid/mocked UI> | <P1> | <`@auth-quota`> | <Confirmed / Draft — confirm> |

### <TC-1> — <title>

**Preconditions:** <user state, data created via API>
**Test data:** <generated with TestDataGenerator / specific values>

| # | Step | Expected result |
|---|---|---|
| 1 | <action> | <result> |

**Source:** <Qase ID, file, user answer>

## Pages and artifacts

| Page | Route | State | Saved file | Page object |
|---|---|---|---|---|
| <Settings> | `#/settings` | <logged in, empty form> | `pages/<name>.html` | <new `SettingsPage` / extend `ArticlePage`> |

### <PageName> — `#/<route>`, <state>

Page description: `pages/<name>.md` · Root: `<locator>`

| Group | Name | Locator | Matches | In src/pageObject |
|---|---|---|---|---|
| fields | <title> | `<getByPlaceholder('...')>` | 1 | <file:line or —> |

## Requirements

### Business rules and messages
- <Rule or exact message> — *source*

### API contract

| Method | Path | Auth | Success | Errors | Notes |
|---|---|---|---|---|---|
| <POST> | `/api/<path>` | <token/guest> | <201> | <401, 422> | <payload notes> |

### Test data and users
- <Shared test user / user created in the test (AUTH_QUOTA) / generated data>

### Environment and constraints
- Shared demo server: ~100 requests / 15 min per IP, ~5 auth requests / hour — arrange and verify via API, tag auth tests `AUTH_QUOTA`
- <Browsers, viewport, feature flags>

## Implementation plan

| Change | File | New / Extend | Notes |
|---|---|---|---|
| UI spec | `tests/ui/<feature>.ui.spec.ts` | <New> | <cases TC-1, TC-2> |
| Page object | `src/pageObject/pages/<Name>Page.ts` | <New> | <fields, buttons from extraction> |
| Route | `src/pageObject/routes.ts` | <Extend> | `<Route.name>` |
| Endpoint helper | `src/api/client/helpers/<domain>/<Domain><Verb>API.ts` | <New> | <path + models> |
| API flow | `src/api/client/api/<domain>/<Domain>API.ts` | <New> | <arrange + cleanup> |

### Subtasks
- [ ] <Page object + route>
- [ ] <API helpers / flows>
- [ ] <Specs>
- [ ] <Docs / skill updates if a convention changes>

## Definition of done

- [ ] `npm run typecheck` and `npm run lint` pass
- [ ] New tests pass when run alone (and with `--repeat-each=2` if the rate-limit budget allows)
- [ ] Each test fails for the right reason when its expectation is broken
- [ ] Created data is registered for cleanup
- [ ] Quota-consuming tests are tagged `AUTH_QUOTA`
- [ ] API calls start with `get(ConduitRestClient)`; element components are called from pages
- [ ] Skills, templates and README are updated if a convention changed

## Open questions

| # | Question | Blocks | Owner |
|---|---|---|---|
| 1 | <question> | <TC-1 / page object> | <PO, dev, QA> |

## Attachments

- `tasks/<KEY>/pages/<name>.html` (+ `<name>_files/`) — <state>
- `tasks/<KEY>/requirements/<file>`
