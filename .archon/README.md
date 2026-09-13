# Archon workflows

[Archon](https://archon.diy) workflows that run this project's Playwright work as repeatable multi-step flows. Each AI step loads the project skills from `.claude/skills/`, so the workflows follow the same conventions as working with Claude Code directly.

| Workflow | Input | What it does |
|---|---|---|
| `playwright-tests-implementation` | Task file (`tasks/<KEY>/<KEY>.md`) or a description | Page descriptions → plan (stops if open questions block it) → implement → typecheck/lint until clean → one verification run → review → report |
| `playwright-tests-review` | Files or folders (empty = changed files) | Typecheck and lint → conventions review + test design review (in parallel, read-only) → report with verdict |
| `playwright-tests-execution` | Playwright arguments (empty = quick suite without `@auth-quota`) | Preflight → run → triage → heal broken locators (only when needed) → report |

## Layout

```
.archon/
  workflows/   the three workflow definitions (DAG of nodes)
  commands/    prompts used by the AI nodes (playwright-*.md)
  config.yaml  Archon project config: default assistant and the model levels (aliases)
  .env.example Archon-only environment; documents the model levels
```

## Model levels

Workflow AI nodes never name a model directly — they reference a level, `model: '@implementer'`, defined under `aliases` in `.archon/config.yaml`. Change a level there and every node at that level follows, with no workflow edits.

| Level | Model / effort | Nodes |
|---|---|---|
| `@planner` | opus / high | implementation: `plan` |
| `@implementer` | opus / high | implementation: `implement`, `static_checks`, `verify`; execution: `heal` |
| `@reviewer` | opus / medium | implementation and review: `review_conventions`, `review_design` |
| `@general` | haiku / low | execution: `triage`; all workflows: `report` |

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

## Setup

1. Install the Archon CLI and run `archon doctor`.
2. Point Archon at Claude Code (AI nodes fail with "Claude Code not found" otherwise) — in `~/.archon/config.yaml`:

   ```yaml
   assistants:
     claude:
       claudeBinaryPath: /absolute/path/to/claude   # output of `which claude`
   ```

3. Archon works only inside a git repository. Without a git remote, add `--no-worktree` to every run (it runs in the live checkout instead of an isolated worktree).
4. Project setup as usual: `npm install && npx playwright install chromium`, `.env` from `.env.example`.

## Usage

```bash
archon workflow list
archon workflow run playwright-tests-implementation --no-worktree "tasks/AQA-20260913-settings/AQA-20260913-settings.md"
archon workflow run playwright-tests-review --no-worktree "tests/ui/articles.ui.spec.ts src/pageObject/pages/ArticlePage.ts"
archon workflow run playwright-tests-execution --no-worktree "tests/ui/articles.ui.spec.ts --project=ui"
```

- With a git remote, isolate code-changing runs on a branch: `archon workflow run playwright-tests-implementation --branch aqa/settings "<task file>"`.
- Reports are written to the run's artifacts directory (`~/.archon/workspaces/<owner>/<repo>/artifacts/runs/<run-id>/`): `plan.md`, `changed-files.txt`, `implementation-report.md`, `review.md`, `playwright-output.txt`, `execution-report.md`. `archon workflow runs` and `archon workflow get <run-id>` show past runs; `archon workflow resume <run-id>` continues a failed one.
- The execution run is headless by default; `HEADLESS=false archon workflow run playwright-tests-execution ...` shows the browser.

## Things to keep in mind

- **Rate limits.** The demo server allows ~100 requests / 15 min per IP and ~5 auth requests / hour. The implementation workflow runs only the new tests, once; give the execution workflow the smallest scope that answers the question, and do not loop runs.
- **Code changes.** `playwright-tests-implementation` writes code, and `playwright-tests-execution` may edit page-object locators when it heals them. Review the changes before committing; the review workflow is read-only.
- **Tasks first.** Prepare tasks with the `playwright-ts-test-aqa-task` skill; the implementation workflow turns saved pages in `tasks/*/pages/` into page descriptions (`npm run page:md`) before planning.
- **Variables.** `$ARGUMENTS` is inserted into bash nodes as typed, and node outputs (`$node.output`) are shell-quoted. Node ids use snake_case so `$review_conventions.output`-style references resolve.
