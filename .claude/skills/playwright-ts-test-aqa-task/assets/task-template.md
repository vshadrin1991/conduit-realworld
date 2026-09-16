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
| <TC-1> | <title> | <API/UI/hybrid/mocked UI> | <P1> | <notes> | <Confirmed / Draft — confirm> |

### <TC-1> — <title>

**Preconditions:** <user state, data created via API>
**Test data:** <generated with TestDataGenerator / specific values>

| # | Step | Expected result |
|---|---|---|
| 1 | <action> | <result> |

**Source:** <Qase ID, file, user answer>

## Pages and artifacts

*UI and hybrid tasks only — remove this section for an API-only task.*

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

*API and hybrid tasks only — remove this section for a UI-only task.*

Source: `api/<openapi.json>` <or HAR / examples / "no contract — see open questions">

| Method | Path | Auth | Success | Errors | Notes |
|---|---|---|---|---|---|
| <POST> | `/api/<path>` | <token/guest> | <201> | <401, 422> | <payload notes> |

**Error payload shape:** <`{ errors: { body: [string] } }` — source>

### Test data and users
- <Shared test user / user created in the test / generated data>

### Environment and constraints
- Shared demo server: ~100 requests / 15 min per IP, ~5 auth requests / hour — arrange and verify via API, keep sign-in and registration cases few
- <Browsers, viewport, feature flags>

## Implementation plan

Keep only the rows the chosen layer needs.

| Change | File | New / Extend | Notes |
|---|---|---|---|
| API spec | `tests/api/<feature>.api.spec.ts` | <New> | <cases TC-1, TC-2> |
| Path | `src/api/client/path/BasePath.ts` | <Extend> | `<PATH_NAME>` |
| Request / response model | `src/api/request/<domain>/<Name>.ts` | <New> | <from the contract> |
| Endpoint helper | `src/api/client/helpers/<domain>/<Domain><Verb>API.ts` | <New> | <path + models> |
| API flow | `src/api/client/api/<domain>/<Domain>API.ts` | <New> | <arrange + cleanup> |
| Response schema | `src/api/schemas/<domain>/<name>.schema.json` | <New> | `toMatchSchema(Schema.<X>)` |
| UI spec | `tests/ui/<feature>.ui.spec.ts` | <New> | <cases TC-3, TC-4> |
| Page object | `src/pageObject/pages/<Name>Page.ts` | <New> | <fields, buttons from the page description> |
| Route | `src/pageObject/pagePath/Routes.ts` | <Extend> | `<Route.name>` |

### Subtasks
- [ ] <Page object + route>
- [ ] <API helpers / flows>
- [ ] <Specs>
- [ ] <Docs / skill updates if a convention changes>

## Definition of done

- [ ] Every item of the Definition of done in the `playwright-ts-conduit-realworld` skill
- [ ] <Anything this task adds on top — a specific report, a doc update, a migration>

## Open questions

| # | Question | Blocks | Owner |
|---|---|---|---|
| 1 | <question> | <TC-1 / page object> | <PO, dev, QA> |

## Attachments

- `tasks/<KEY>/api/<name>.json` — <OpenAPI spec / HAR / request examples>
- `tasks/<KEY>/pages/<name>.html` (+ `<name>_files/`) — <state>
- `tasks/<KEY>/requirements/<file>`
