---
description: Write a copy-ready git commit message (feat / fix) for the current changes of this Playwright + TS project
argument-hint: '[staged|all] [copy]'
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git ls-files:*), Bash(pbcopy:*)
---

# Git commit message

**Arguments**: $ARGUMENTS

## Current changes

Staged:
!`git diff --cached --stat`

Working tree (staged, unstaged and untracked):
!`git status --short`

Recent commits (style reference):
!`git log --oneline -5`

---

## Your task

Return one commit message for the changes below. Read only — never run `git add`, `git commit`, `git stash` or anything else that changes the repository.

### 1. Scope

- `staged` in the arguments → only staged changes (`git diff --cached`).
- `all` in the arguments → every change in the working tree (`git diff HEAD` plus untracked files from `git ls-files --others --exclude-standard`).
- Neither → staged changes when something is staged, otherwise all changes.
- Nothing in the chosen scope → reply `No changes to describe.` and stop.

### 2. Understand the change

Start from the stat, then read the diff of the files that carry the purpose (`git diff --cached -- <path>` or `git diff HEAD -- <path>`; read untracked files directly). Group the changes by area — spec, page object, component, API client, utility, config, skill, command, docs — and find the main purpose. Never describe a change from its file name alone.

### 3. Type — exactly one

| Type   | Use when                                                                                                                                                                      |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fix`  | The change corrects wrong behaviour: a bug in framework code, a broken or flaky test, an outdated locator, a wrong expectation or test data, a config or reporting error      |
| `feat` | Everything else: new or extended tests, page objects, components, API endpoints and flows, utilities, config options, reporters, skills, commands, documentation, refactoring |

Mixed changes take the type of the main purpose; the other changes go to the body.

### 4. Write the message

- Subject: `<type>: <summary>` — one space after the colon, lowercase, imperative verb (`add`, `fix`, `move`, `update`), names the area, no trailing period, at most 72 characters.
- Body only when there is more than one logical change: a blank line, then one `- ` bullet per change (what changed and why, at most 72 characters each, no file-by-file list, no code).
- No co-author, "Generated with", ticket or emoji lines.

### 5. Reply

Reply with nothing before the message. Put the message alone in one fenced `text` block, then one line with the scope, e.g. `Scope: staged, 4 files`.

When the arguments contain `copy`, also copy exactly the message to the clipboard and add the line `Copied to clipboard.`:

```bash
pbcopy <<'EOF'
<message>
EOF
```

## Examples

```text
feat: add api and console error capture to interceptor

- move Interceptor from components to src/utilities/interceptor
- start capture for every test and attach it to failed tests
- add network and console entries to artifacts.json
```

```text
fix: update login page error locator after markup change
```
