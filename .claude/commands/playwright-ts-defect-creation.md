---
description: Turn a reviewed triage report into Jira-style defect reports — one markdown file per product defect, with links to its attachments
argument-hint: '[<triage folder>] [--include-review] [--dry-run]'
---

# Defect creation

**Arguments**: $ARGUMENTS

## Current state

Triage folder:
!`ls -1 reports/triage 2>/dev/null || echo "reports/triage — not found"`

Triage rows by status:
!`node -e "const t=require('./reports/triage/triage-report.json');const c={};for(const r of t.tests)c[r.status]=(c[r.status]||0)+1;console.log(JSON.stringify(c),'| reviewed rows:',t.run.reviewed,'| run:',t.run.startTime??'n/a')" 2>/dev/null || echo "triage-report.json — not found"`

Failed-test artifact folders:
!`ls -1 reports/test-results 2>/dev/null | head -20 || echo "reports/test-results — not found"`

Defects written earlier:
!`ls -1 reports/triage/defects 2>/dev/null || echo "none yet"`

---

## Your task

Turn the triage of a finished run into defect reports a developer or a product owner can act on: **one markdown file per product defect**, written one by one into the triage folder, each linking to its own attachments.

Read only. Never edit project files, never re-run the suite (the demo server allows ~100 requests / 15 min per IP, so a re-run produces new noise, not evidence), and never write a defect for something the evidence does not show.

### Step 1 — Find the triage input (do not skip)

This command consumes a triage export; it does not produce one.

- A path in the arguments → use it (a triage folder, a `triage-report.json`, or a copied CI folder that contains one).
- Nothing in the arguments → `reports/triage/triage-report.json`.
- Missing → say exactly what is missing, give the command that produces it, and **stop**. Do not fall back to `reports/results.json` and triage it yourself here.

  ```bash
  npm run results:triage
  ```

- Present but `run.reviewed` is `0` → the statuses and steps are still the script's draft, scored by rules that never saw the evidence. Say so and **ask** whether to review first with the [playwright-ts-test-results](../skills/playwright-ts-test-results/SKILL.md) skill (its `references/triage-export.md`) or to continue on the draft statuses. Use the AskUserQuestion tool when it is available, and wait for the answer — defects filed from unreviewed rows are how a 429 becomes a bug ticket.

State the source file, the run start time and the counts by status in two lines before moving on.

### Step 2 — Choose the rows that deserve a defect

| Triage status    | Defect file                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------- |
| `defect`         | Yes                                                                                                           |
| `need to review` | Only with `--include-review` **and** only when the evidence shows the application misbehaving; otherwise skip |
| `automation bug` | No — the test, page object or framework is wrong; fix it instead                                              |
| `flaky`          | No — 429, network or timing noise; not a product problem                                                      |

`--all` in the arguments does not change the last two rows; list them as skipped with the reason.

**Group by root cause.** Several tests failing on the same endpoint with the same error are **one** defect that lists every affected test — five tickets for one broken `GET /api/articles` is noise, not coverage.

### Step 3 — Gather the evidence per defect (cheapest first)

- The triage row: `stepsToReproduce`, `reason`, `testMethod`, `status` and the three percentages.
- `reports/artifacts.json` — the entry with the same `fileName` and `line`: `error`, `image`, `video`, `html`, `network` (request and response body of every 4xx/5xx) and `console` (page errors).
- `reports/test-results/<dir>/error-context.md` — the page snapshot at failure time, for anything that failed on the page.
- The `logs` attachment of the result in `reports/results.json` — the request/response chain with statuses and timings.
- The trace — never open the zip; put the command in the defect instead: `npx playwright show-trace reports/test-results/<dir>/trace.zip`.

Quote status codes, response bodies and messages from these files exactly. Anything you cannot confirm from them — whether a user hits it outside the test, when it started, which build — is an **open question**, not a sentence in the report.

Rate limiting hides behind other symptoms: a `429` in `network` or in the logs means the page rendered blank, and that is `flaky`, not a defect. Check before writing.

### Step 4 — Agree the list before writing

Show the proposed defects compactly: key, summary, severity, the tests each one covers, and its evidence in one line. Add the rows you skipped and why. Ask for a go-ahead and wait for it.

`--dry-run` in the arguments → stop here and write nothing.

### Step 5 — Write the files, one by one

Location: `reports/triage/defects/` inside the triage folder in use.
Name: `BUG-<yyyyMMdd>-<nn>-<short-slug>.md` — the run date, `nn` from `01` in the order of the agreed list, the slug from the summary (`BUG-20260917-01-global-feed-returns-500.md`).

Finish each file completely before starting the next, and print one line per file as it lands. A defect for a root cause that already has a file in the folder updates that file — add the new affected tests and run date instead of creating a second key.

Fill the template below section by section. Remove the sections that do not apply; never leave a `<placeholder>`.

```md
# <KEY>: <one line — what breaks, where>

| Field        | Value                                                            |
| ------------ | ---------------------------------------------------------------- |
| Issue type   | Bug                                                              |
| Component    | Conduit / <feature — Home feed, Article, Settings, Comments API> |
| Severity     | <Critical, Major, Minor, Trivial>                                |
| Priority     | <Highest, High, Medium, Low>                                     |
| Environment  | <base URL>, <project: api / ui>, <browser>                       |
| Found in run | <run start time from `run.startTime`>                            |
| Labels       | `defect`, `playwright`, `<feature>`                              |
| Found by     | Automated run — `<spec file:line>`                               |
| Reporter     | QA Automation                                                    |

## Summary

<One or two sentences in business language: what a user sees and why it matters.>

## Steps to reproduce

1. <Action a person can repeat in the application or with a request>
2. <...>

## Actual result

<What happens, with the status code or message that proves it.>

## Expected result

<What the application should do.>

## Evidence

| What               | Value                                |
| ------------------ | ------------------------------------ |
| Failing request    | `<METHOD> <path>` → `<status>`       |
| Response body      | `<body, quoted from artifacts.json>` |
| Console error      | `<text>`                             |
| Error from the run | `<one line of the test error>`       |

## Affected automated tests

| Test            | Spec          | Triage status | Defect % |
| --------------- | ------------- | ------------- | -------- |
| <Suite › title> | `<file:line>` | `<status>`    | <n>      |

## Attachments

| File                  | Link                                                            |
| --------------------- | --------------------------------------------------------------- |
| Screenshot at failure | [test-failed-1.png](../../test-results/<dir>/test-failed-1.png) |
| Video                 | [video.webm](../../test-results/<dir>/video.webm)               |
| Page DOM at failure   | [dom.html](../../test-results/<dir>/dom.html)                   |
| Page snapshot         | [error-context.md](../../test-results/<dir>/error-context.md)   |

Trace: `npx playwright show-trace reports/test-results/<dir>/trace.zip`

## Open questions

- <What the run could not answer, and who answers it.>
```

Rules for the content:

- **Language** — the reader is a developer or a product owner, not the person who wrote the test. No locators, selectors, class or method names, stack traces, tokens, slugs or generated emails. Test data becomes words: "the test user", "an article created through the API".
- **Steps** — the reviewed `stepsToReproduce` of the row, ending at the step that failed; drop the steps the run never reached. For an API defect, the step is the request in words plus the method and path.
- **Severity** — `Critical`: a core flow is unusable for everyone, or data is lost (5xx on feed, article or auth). `Major`: a feature is broken but has a workaround. `Minor`: wrong text, count or state with the flow intact. `Trivial`: cosmetic.
- **Attachments** — link only files that exist; check the folder first. API tests have no screenshot, video or DOM, so those rows go. Links are relative to the defect file (`../../test-results/<dir>/<file>` from `reports/triage/defects/`), so they open from the markdown; give the repo path in the text when a row needs it.
- **One defect, one root cause** — if two tests fail for two different reasons, they are two files, even in the same feature.

### Step 6 — Index and reply

Write `reports/triage/defects/index.md`: one table with Key, Summary, Severity, Component, Affected tests, and a link to each file, above a line with the source report and the run start time.

Then reply with:

- the files created and updated, one line each;
- the triage rows skipped, grouped by reason (automation bug, flaky, unconfirmed review row);
- the open questions that block a defect from being filed as it stands;
- a reminder that `reports/` is outside git — copy the file into the tracker to file it.
