# Setup — Archon workflows

What to install and configure before running the Playwright workflows in [`workflows/`](workflows).

For what the workflows do and which inputs they take, see [`README.md`](README.md).

## Prerequisites

| Requirement                | Why                                                                     | Check                |
| -------------------------- | ----------------------------------------------------------------------- | -------------------- |
| Node.js ≥ 20.12            | Playwright, Allure and the workflow scripts                             | `node -v`            |
| Git repository             | Archon only runs inside one; every run gets its own worktree            | `git status`         |
| Archon CLI                 | Runs the workflows                                                      | `archon version`     |
| Claude Code CLI, signed in | Every AI node (`plan`, `implement`, `verify`, reviews) shells out to it | `claude auth status` |

No Java is needed — Allure 3 is installed from npm with the other dependencies.

## 1. Project

```bash
npm install
npx playwright install chromium
cp .env.example .env
```

`.env` is optional; without it the defaults in `src/config/*.config.ts` apply. Set `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` to reuse one account — the auth endpoints allow only about 5 requests per hour per IP.

## 2. Archon CLI

Install it, then confirm:

```bash
archon version
```

It is a single binary (this machine has v0.9.0 at `/usr/local/bin/archon`), not a brew or npm package. `archon doctor` reports what is still missing.

## 3. Claude Code

The AI nodes fail without a Claude Code binary that is **installed, signed in, and pointed at by Archon**. All three are separate problems.

**Install** (one of):

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

```bash
npm install -g @anthropic-ai/claude-code
```

**Sign in** — needs a browser, so run it yourself:

```bash
claude auth login
```

```bash
claude auth status
```

`"loggedIn": true` is required. When the session expires, nodes fail with `Claude API error (authentication_failed): OAuth session expired and could not be refreshed`; sign in again.

**Point Archon at it** — otherwise `archon doctor` reports `Claude Code not found`. In `~/.archon/config.yaml`:

```yaml
assistants:
  claude:
    claudeBinaryPath: /opt/homebrew/bin/claude # output of `which claude`
```

## 4. Verify the setup

```bash
archon doctor
```

```bash
archon validate workflows && archon workflow list
```

`archon doctor` should show `✓ Claude binary: ... (spawns OK)`. The GitHub, Slack and Telegram lines stay optional — the Playwright workflows do not use them.

## Cost and model usage

`.archon/config.yaml` maps `@planner`, `@implementer` and `@reviewer` to **Opus** and `@general` to Haiku. A planning-only run used about 1.8M input and 30K output tokens.

The dollar figure in the Archon console is an **estimate** at Anthropic's published API prices, not a bill. What it actually consumes depends on how Claude Code is authenticated: a Claude subscription draws down its usage limits, an API key is billed per token. Lower the spend by pointing the aliases at Sonnet.

## Running the workflows

```bash
archon workflow run playwright-tests-implementation -- --r requirements/REQ-01-registration-and-sign-in.md
```

```bash
archon workflow run playwright-tests-review -- tests/ui/auth.ui.spec.ts
```

```bash
archon workflow run playwright-tests-execution -- tests/ui/auth.ui.spec.ts --project=ui
```

Watch a run in the console:

```bash
archon serve
```

```bash
archon workflow runs --limit 5
```

## Things that break runs

| Symptom                                                         | Cause                                                                                                                                     | Fix                                                                                                                                                                |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Cannot find package '@playwright/test'` in the first bash node | The worktree has no `node_modules`, because a worktree checks out tracked files only                                                      | `.archon/scripts/workspace-setup.sh` links it from `PROJECT_PATH`. Check that `PROJECT_PATH` in `.archon/.env` is right and that `npm install` has been run there. |
| `Input error: --artifacts: --cwd not found`                     | `--detach` appends Archon's own `--cwd` and `--conversation-id` to the workflow message, and they land inside the previous option's value | Do not use `--detach` with `--r` / `--tc` / `--a`. Run in the foreground, or start the run from the console.                                                       |
| Options `--r`, `--tc`, `--a` are dropped                        | The Archon CLI claimed them as its own                                                                                                    | Put `--` before them, as in the commands above.                                                                                                                    |
| `implement` skipped, `plan` returned `BLOCKED`                  | Open questions in the requirements blocked the plan                                                                                       | Answer them, or let the plan drop the blocked cases — `.archon/commands/playwright-plan-tests.md` now reports `BLOCKED` only when no case at all can be planned.   |
| The run stops at an AI node with an authentication error        | The Claude Code session expired                                                                                                           | `claude auth login`                                                                                                                                                |

## Reports

Playwright tests write to `reports/` (`allure-results`, `html`, `test-results` with traces, `results.json`). A workflow runs in a throwaway git worktree, so its `allure` node copies the whole folder to the run's artifacts — `~/.archon/workspaces/<owner>/<repo>/artifacts/runs/<run-id>/reports` — and serves the Allure report from that copy, opening it in the browser. The URL is in the node output.

Reopen the report of an old run:

```bash
npx allure serve ~/.archon/workspaces/<owner>/<repo>/artifacts/runs/<run-id>/reports/allure-results
```

Outside a workflow, from the checkout:

```bash
npm run allure:serve
```
