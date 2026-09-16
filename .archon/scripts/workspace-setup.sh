#!/usr/bin/env bash
# Prepares the workspace of an Archon run so the project can build and run in it.
#
# Usage (first bash node of every workflow):
#   bash .archon/scripts/workspace-setup.sh
#
# Workflows run in an isolated git worktree. A worktree is a fresh checkout of the tracked files only, so everything
# .gitignore hides is missing: node_modules, .env, .auth and .archon/.env. This script links or copies them from the
# main checkout, which it takes from PROJECT_PATH or, when that is unset, from git. Run in the main checkout itself
# (`--no-worktree`) it is a no-op. A failure here stops the run: every later node depends on these files.
set -eu

workspace="$PWD"
echo "Workspace: $workspace"

main="${PROJECT_PATH:-}"
if [ -z "$main" ]; then
  common=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || common=""
  [ -n "$common" ] && main=$(dirname "$common")
fi

if [ -z "$main" ] || [ "$main" = "$workspace" ]; then
  echo "Running in the main checkout — nothing to link."
  exit 0
fi
echo "Main checkout: $main"

# The dependencies are linked, not installed: the worktree then uses the same node_modules and the same Playwright
# browser cache as the main checkout, and a run costs no install time.
if [ ! -e node_modules ]; then
  if [ -d "$main/node_modules" ]; then
    ln -s "$main/node_modules" node_modules
    echo "node_modules -> $main/node_modules"
  else
    echo "No node_modules in $main — installing in the workspace."
    npm ci
  fi
fi

# Local configuration and the cached test user. Copied, not linked: a run that refreshes the token must not write
# back into the main checkout.
for path in .env .auth .archon/.env; do
  if [ ! -e "$path" ] && [ -e "$main/$path" ]; then
    mkdir -p "$(dirname "$path")"
    cp -R "$main/$path" "$path"
    echo "Copied $path"
  fi
done

# tasks/ holds workflow inputs (saved pages passed as --artifacts) and results. Its contents are gitignored, so the
# worktree has only the few files that were committed: fill in the rest without overwriting them (-n).
if [ -d "$main/tasks" ]; then
  mkdir -p tasks
  cp -Rn "$main/tasks/." tasks/ 2>/dev/null || true
  echo "tasks/ filled in from $main/tasks"
fi

echo "Workspace ready."
