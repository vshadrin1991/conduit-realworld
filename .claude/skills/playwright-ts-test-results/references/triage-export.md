# Triage export (JSON + XLSX)

Part of the [playwright-ts-test-results](../SKILL.md) skill.

Read when producing or correcting the shared export (`npm run results:triage`) — the column map, the status rules and the review pass. Not needed to answer "what failed" or "why is this red".

Every triage ends with two files that can be filtered, shared and tracked:

```bash
npm run results:triage   # reports/results.json → reports/triage/triage-report.json + triage-report.xlsx
node .claude/skills/playwright-ts-test-results/scripts/triage-report.mjs <report.json | folder | archive.zip> --out-dir <dir> --name <file-name> --overrides <file.json>
```

One row per failed or flaky test (passed tests are left out):

| JSON key | XLSX column | Content |
|---|---|---|
| `status` | Status | `automation bug`, `defect` or `flaky` — the category whose likelihood reaches 60%; otherwise `need to review` |
| `testName` | Test name | `[project] Suite › title (spec file:line)` |
| `testMethod` | Test method | The step that failed (`ArticlePage.clickActionButton(postComment)`, `API :: PUT :: update current user`) with the error location; only the location when the failure happened outside a step |
| `defectPercent` | Defect % | Likelihood that the application misbehaves (5xx, wrong values, missing elements) |
| `automationBugPercent` | Automation bug % | Likelihood that the test, page object or framework is wrong (script errors, ambiguous or outdated locators) |
| `flakyPercent` | Flaky % | Likelihood of environment or timing noise (429, network, passed on retry, blank page) |
| `stepsToReproduce` | Steps to reproduce | Numbered plain-language steps up to the failing one, then `Actual result:` and `Expected result:` lines |
| `reason` | Reason | The evidence behind the percentages |

The three percentages always add up to 100. The XLSX has a **Triage** sheet (filters, frozen header, colored status) and a **Summary** sheet; the JSON adds a `run` object with totals, counts by status and the number of reviewed rows.

The script turns report steps into text by rules — page names, visible labels of elements, API actions, simulated responses — and scores only the error message, logs and page snapshot. Its output is a draft:

```text
1. Open the Login page
2. On the Login page, check that the "conduit", "Home", "Login", "Sign up" and "Source code" links in the header are shown
3. Wait for the Home page to open
Actual result: The test stopped with a technical error in the test framework: the browser page was closed while a file was still loading.
Expected result: The Home page opens.
```

### Review the export

After the script, go through every row with the evidence from the workflow and fix what the rules could not know:

1. **Status** — correct every `need to review` row and every status the evidence contradicts (a failure inside the framework is an `automation bug`, a blank page after a 429 is `flaky`). Keep the percentages consistent with the status: give all three (`defectPercent`, `automationBugPercent`, `flakyPercent`, adding up to 100, the status with the highest share) when the evidence is mixed; without them a changed status gets 100% and the other two 0%.
2. **Steps to reproduce** — rewrite into management language that a product owner or manual tester can follow in the application:
   - numbered actions with page names and the labels the user sees in quotes; no locators, selectors, class or method names, file paths, stack traces, emails, slugs, tokens or JSON;
   - test data in words: "the test user", "a new user", "an article created through the API";
   - stop at the step that failed; drop steps the failure never reached;
   - end with `Actual result:` — what happened, in words (a technical error becomes its meaning, e.g. "the test framework closed the page before it finished loading"), and `Expected result:` — what the user should see when the application works;
   - keep status codes only when they help a developer (`status 500`), and name the rate limit as "the server refused requests because too many were sent".
3. **Reason** — one sentence of evidence in the same language.

Write only the changed rows to `reports/triage/overrides.json`, keyed by spec file:line, and regenerate both files:

```json
{
  "tests/ui/session.ui.spec.ts:14": {
    "status": "automation bug",
    "stepsToReproduce": "1. Open the Login page\n2. On the Login page, check that the conduit logo and the Home, Login, Sign up and Source code links are shown in the header\nActual result: The test stopped because the test framework closed the page before it finished loading.\nExpected result: The logo and all four links are shown in the header.",
    "reason": "The failure comes from the test framework, not from the application."
  }
}
```

```bash
npm run results:triage -- --overrides reports/triage/overrides.json
```

The script prints how many rows were reviewed and lists keys that match no failed test. Mention the corrected statuses in the reply as well.
