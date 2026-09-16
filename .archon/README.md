# Archon workflows

[Archon](https://archon.diy) workflows that run this project's Playwright work as repeatable multi-step flows. Each AI step loads the project skills from `.claude/skills/`, so the workflows follow the same conventions as working with Claude Code directly.

| Workflow | Input | What it does |
|---|---|---|
| `playwright-tests-implementation` | Task file (`tasks/<KEY>/<KEY>.md`) or a description, plus the options `--requirements`, `--test-cases`, `--artifacts` ([Implementation inputs](#implementation-inputs)) | Inputs → page descriptions → plan (stops if open questions block it) → implement → typecheck/lint until clean → one verification run → Allure report served → review → report |
| `playwright-tests-review` | Files or folders (empty = changed files) | Typecheck and lint → conventions review + test design review (in parallel, read-only) → Allure report of the last run served → report with verdict |
| `playwright-tests-execution` | Playwright arguments (empty = the full suite) | Preflight → run → triage → heal broken locators (only when needed) → Allure report served → report |
| `playwright-requirements-testing` | `--r <requirements file>` ([Requirements testing](#requirements-testing)) | Inputs + environment check → requirements review → evidence from the app in Chrome (Playwright MCP) → gate → result and test cases; blocked only by a blocked review |

## Layout

```
.archon/
  workflows/   the workflow definitions (DAG of nodes)
  commands/    prompts used by the AI nodes (playwright-*.md)
  scripts/     deterministic helpers of bash nodes (implementation-inputs.mjs, allure-serve.sh, requirements-inputs.mjs, requirements-gate.mjs)
  mcp/         MCP servers of AI nodes (playwright.json — Chrome for requirements testing)
  config.yaml  Archon project config: default assistant and the model levels (aliases)
  .env.example Archon-only environment: PROJECT_PATH; documents the model levels
```

## Model levels

Workflow AI nodes never name a model directly — they reference a level, `model: '@implementer'`, defined under `aliases` in `.archon/config.yaml`. Change a level there and every node at that level follows, with no workflow edits.

| Level | Model / effort | Nodes |
|---|---|---|
| `@planner` | opus / high | implementation: `plan`; requirements testing: `result_report` |
| `@implementer` | opus / high | implementation: `implement`, `static_checks`, `verify`; execution: `heal` |
| `@reviewer` | opus / medium | implementation and review: `review_conventions`, `review_design`; requirements testing: `review`, `evidence` |
| `@general` | haiku / low | execution: `triage`; implementation, review, execution: `report`; requirements testing: `blocked_report` |

- Model values: `opus`, `sonnet`, `haiku` or a full Claude model id; effort: `low`, `medium`, `high`.
- A new AI node gets `model: '@<level>'` right after its `id`; a new level is added to `aliases` in `config.yaml` and to the table in `.archon/.env.example`.
- `archon validate workflows` checks the workflows after a change.

| Command | Used by | Role |
|---|---|---|
| `playwright-plan-tests` | implementation | Plan cases → layer → files; `READY` / `BLOCKED` |
| `playwright-implement-tests` | implementation | Write code by the plan; list changed files |
| `playwright-verify-tests` | implementation | Run the new tests once, triage, heal or fix |
| `playwright-review-conventions` | implementation, review | Framework rules review (read-only) |
| `playwright-review-test-design` | implementation, review | Value, isolation, flakiness, rate-limit cost (read-only) |
| `playwright-review-report` | review | `review.md` with verdict |
| `playwright-implementation-report` | implementation | `implementation-report.md` |
| `playwright-triage-results` | execution | Failures by category, `locator_failures` flag |
| `playwright-heal-locators` | execution | Page-object locator fixes, re-run healed tests |
| `playwright-execution-report` | execution | `execution-report.md` |
| `playwright-requirements-review` | requirements testing | Normalize and review the requirements, plan checks in Chrome; `READY` / `BLOCKED` |
| `playwright-requirements-evidence` | requirements testing | Observe the app in Chrome (Playwright MCP); `MATCHES` / `DIFFERS` / `NOT_OBSERVED` per requirement |
| `playwright-requirements-result-report` | requirements testing | `requirements-testing-result.md` + `test-cases.md` |
| `playwright-requirements-blocked-report` | requirements testing | `requirements-testing-blocked.md` when the review is blocked |

## Setup

Step by step, with the checks for each prerequisite: [SETUP.md](SETUP.md). In short:

1. Install the Archon CLI and run `archon doctor`.
2. Point Archon at Claude Code (AI nodes fail with "Claude Code not found" otherwise) — in `~/.archon/config.yaml`:

   ```yaml
   assistants:
     claude:
       claudeBinaryPath: /absolute/path/to/claude   # output of `which claude`
   ```

3. Archon works only inside a git repository. Without a git remote, add `--no-worktree` to every run (it runs in the live checkout instead of an isolated worktree).
4. Project setup as usual: `npm install && npx playwright install chromium`, `.env` from `.env.example`.
5. Copy `.archon/.env.example` to `.archon/.env` and set `PROJECT_PATH` to the absolute path of this project. Archon loads `.archon/.env` into every node; bash nodes `cd` to `PROJECT_PATH` (the current directory when it is unset), so the workflows always work on the live checkout.

## Usage

```bash
archon workflow list
archon workflow run playwright-tests-implementation --no-worktree "tasks/AQA-20260913-settings/AQA-20260913-settings.md"
archon workflow run playwright-tests-review --no-worktree "tests/ui/articles.ui.spec.ts src/pageObject/pages/ArticlePage.ts"
archon workflow run playwright-tests-execution --no-worktree "tests/ui/articles.ui.spec.ts --project=ui"
archon workflow run playwright-requirements-testing --no-worktree -- --r requirements/REQ-01-registration-and-sign-in.md
```

From another directory, pass the project path with `--cwd` (Archon reads `.archon/` and `.archon/.env` from there):

```bash
archon workflow run playwright-tests-execution --cwd <PROJECT_PATH> --no-worktree "tests/ui/articles.ui.spec.ts --project=ui"
```

## Implementation inputs

`playwright-tests-implementation` accepts named options next to the task file or description:

| Option | Alias | Value |
|---|---|---|
| `--requirements` | `--r` | Requirements: a file (Markdown, text, Word, PDF, spreadsheet, HTML, image), a folder of such files, or the requirements as text |
| `--test-cases` | `--tc` | Test cases: a file, a folder or the cases as text; given cases are implemented as written, without adding new ones |
| `--artifacts` | `--a` | Pages saved from the browser (Ctrl/Cmd+S): a folder with `*.html` files or one `.html` file |

```bash
archon workflow run playwright-tests-implementation --no-worktree -- --r requirements/REQ-01-registration-and-sign-in.md
archon workflow run playwright-tests-implementation --no-worktree -- --r requirements/REQ-01-registration-and-sign-in.md --tc tasks/AQA-1/test-cases.md --a tasks/AQA-1/pages
archon workflow run playwright-tests-implementation --no-worktree -- Automate the sign-in errors --tc Unknown email shows: Email not found sign in first
```

- **Put `--` after the Archon options.** Without it the Archon CLI takes `--r`, `--tc` and `--a` as its own (unknown) options and drops them, so only their values reach the workflow. A single quoted message works too when it starts with text: `"REQ-01 --r requirements/REQ-01-registration-and-sign-in.md"`.
- A value runs up to the next option, so text needs no quotes; `--r=<value>` also works. Repeat an option to pass several sources. Words outside the options are the task (file path or description).
- A value that exists on disk is used as a file or folder; anything else is text and is saved to `inputs/requirements.md` / `inputs/test-cases.md` in the run's artifacts directory. A single path-like word that does not exist (`requirements/REQ-9.md`) fails the run instead of being taken as text.
- Non-Markdown files and folders are extracted to text with the `playwright-ts-test-requirements` script (`inputs/extracted/`); saved pages get a page description next to each page (`<page>.md`, only when new or re-saved).
- The first node (`inputs`, `.archon/scripts/implementation-inputs.mjs`) writes `inputs.json` to the artifacts directory and stops the run with `Input error: ...` on invalid input, before any AI node runs. The plan, implement, test design review and report nodes receive the resolved inputs; the plan maps every case to its requirement or test case ID.

## Requirements testing

`playwright-requirements-testing` reviews one requirements file (static testing: gaps, ambiguity, contradictions, testability), collects evidence from the running application in Chrome and writes the review result plus ready test cases.

```bash
archon workflow run playwright-requirements-testing --no-worktree -- --r requirements/REQ-01-registration-and-sign-in.md
```

| Node | Kind | What it does |
|---|---|---|
| `inputs` | bash (`requirements-inputs.mjs`) | Takes `--requirements` / `--r <file>` (one file: Markdown, text, Word, PDF, spreadsheet, HTML, image), copies it to `tasks/<KEY>/requirements/source/` (`<KEY>` = file name without extension) and extracts text from non-Markdown files; stops the run with `Input error: ...` otherwise |
| `preflight` | bash | One request to the home page (`BASE_URL` or the demo URL) and a check that Google Chrome is installed |
| `review` | AI | Requirements review with the `playwright-ts-test-requirements` skill; `requirements-review.md` (requirements, findings `RV-n`, questions) and `live-check-plan.md` (what the browser can answer) |
| `evidence` | AI + MCP | Opens Chrome through `.archon/mcp/playwright.json` (`@playwright/mcp`, pinned version, in-memory profile), answers the open questions first, then the rest of the plan; `evidence.md` with `MATCHES` / `DIFFERS` / `NOT_OBSERVED`, and every difference classified (possible product defect / requirement may be outdated / not specified) with the question for the author |
| `gate` | bash (`requirements-gate.mjs`) | `BLOCKED` only when the review did not complete or found blockers; otherwise `READY`, with the evidence coverage (`COLLECTED` / `PARTIAL` / `NONE`) |
| `result_report` | AI | `tasks/<KEY>/requirements/requirements-testing-result.md` (result, requirements, findings and questions, what the application shows, coverage, next steps) and `test-cases.md` (traceability; cases affected by an open finding or a difference are `Draft — confirm`) |
| `blocked_report` | AI | `tasks/<KEY>/requirements/requirements-testing-blocked.md`: the blocker findings with their questions, evidence that helps answer them, environment problems, next steps |
| `outputs` | bash | Lists the files the run produced |

- **Differences are questions, not failures.** The application never "fails" a requirement here: a difference is either a product defect or an outdated requirement, and only the author decides. It is recorded with evidence and a question, and the test cases are written anyway — affected cases as drafts.
- **What stops the run:** a review that did not complete, or blocker findings that make test design impossible. An unreachable application, a missing Chrome or a rate limit only reduce the evidence: the review and the test cases are still written, and the result says what could not be observed.
- Result files are written to `tasks/<KEY>/requirements/` and copied to the run's artifacts with `requirements-review.md`, `live-check-plan.md`, `evidence.md` and `evidence/` screenshots. The MCP server's own files go to `reports/requirements-mcp/`.
- The browser window is visible (headed Chrome). The first run downloads `@playwright/mcp` with `npx`.
- Budget: opening the pages spends the site-wide limit (~100 requests / 15 min per IP) and a sign-in spends the auth quota (~5 / hour). Run one requirements file at a time.

## Runs and reports

- With a git remote, isolate code-changing runs on a branch: `archon workflow run playwright-tests-implementation --branch aqa/settings "<task file>"`.
- Reports are written to the run's artifacts directory (`~/.archon/workspaces/<owner>/<repo>/artifacts/runs/<run-id>/`): `plan.md`, `changed-files.txt`, `implementation-report.md`, `review.md`, `playwright-output.txt`, `execution-report.md`, `allure-results/`, `allure-report/`, `allure-serve.log`. `archon workflow runs` and `archon workflow get <run-id>` show past runs; `archon workflow resume <run-id>` continues a failed one.
- **Allure.** Every workflow has an `allure` bash node (`.archon/scripts/allure-serve.sh`): it copies `reports/allure-results` to `allure-results/` in the run's artifacts, generates `allure-report/` from the copy and serves it in the background with `allure open` (Allure 3's `serve`; serving raw results from a background process exits without starting the server, so the report is generated first). The report opens in the browser; its URL is in the node output and in the workflow report. The implementation workflow serves its verification run (skipped when the plan is `BLOCKED`), the execution workflow the run with healed re-runs, the review workflow the results of the last test run. The server keeps running after the workflow; the next `allure` node stops it (pid in `reports/allure-serve.pid`), or stop it yourself with `kill $(cat reports/allure-serve.pid)`. To reopen an old run: `npx allure open <artifacts>/allure-report`.
- The execution run is headless by default; `HEADLESS=false archon workflow run playwright-tests-execution ...` shows the browser.

## Things to keep in mind

- **Rate limits.** The demo server allows ~100 requests / 15 min per IP and ~5 auth requests / hour. The implementation workflow runs only the new tests, once; give the execution workflow the smallest scope that answers the question, and do not loop runs.
- **Code changes.** `playwright-tests-implementation` writes code, and `playwright-tests-execution` may edit page-object locators when it heals them. Review the changes before committing; the review workflow is read-only.
- **Tasks first.** Prepare tasks with the `playwright-ts-test-aqa-task` skill; the implementation workflow turns saved pages in `tasks/*/pages/` into page descriptions (`npm run page:md`) before planning.
- **Variables.** Bash nodes receive `PROJECT_PATH` (from `.archon/.env`) and the workflow message as the `ARGUMENTS` environment variable (quote it: `"$ARGUMENTS"`; a quoted heredoc does not expand it), and node outputs (`$node.output`) are shell-quoted. Node ids use snake_case so `$review_conventions.output`-style references resolve.
