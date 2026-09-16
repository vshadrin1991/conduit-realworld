#!/usr/bin/env bash
# Copies the report folder of the run to the run artifacts and opens the Allure report from there in the browser.
#
# Usage (Archon bash node; ARTIFACTS_DIR is set by Archon):
#   bash .archon/scripts/allure-serve.sh
#
# A workflow runs in a throwaway git worktree, so its reports/ folder disappears with the worktree: the whole folder
# is copied to $ARTIFACTS_DIR/reports (~/.archon/workspaces/<owner>/<repo>/artifacts/runs/<run-id>/reports), which
# outlives the run. The Allure report is then built and served from that copy.
#
# `allure serve <results>` is not used, although it is the one command that would do all of it: started from a
# workflow node it exits after about two seconds without serving anything, with an empty log — it needs a terminal,
# and a pseudo-terminal (`script -q /dev/null`) does not satisfy it either. `allure generate` followed by
# `allure open <report>` is the same report and survives the node, so that is what runs here. The server is started
# with nohup and the URL is opened in the browser explicitly, because the node has no terminal to hand it to. The
# previous server started by this script is stopped first. Never fails the workflow.
#
# A workflow that runs no tests (the review workflow) has no results in its workspace and falls back to the results
# of the last test run in the main checkout.
set -u

reports="$ARTIFACTS_DIR/reports"
results="$reports/allure-results"
report="$reports/allure-report"
log="$ARTIFACTS_DIR/allure-serve.log"
pid_file="$ARTIFACTS_DIR/../allure-serve.pid"
allure="$PWD/node_modules/.bin/allure"

source_dir=reports
if [ -z "$(ls -A "$source_dir/allure-results" 2>/dev/null)" ]; then
  main="${PROJECT_PATH:-}"
  if [ -z "$main" ]; then
    common=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || common=""
    [ -n "$common" ] && main=$(dirname "$common")
  fi
  if [ -n "$main" ] && [ -n "$(ls -A "$main/reports/allure-results" 2>/dev/null)" ]; then
    source_dir="$main/reports"
    echo "No Allure results in this workspace — using the last run in $main."
  else
    echo "No Allure results in $PWD/reports/allure-results — nothing to serve."
    exit 0
  fi
fi
if [ ! -x "$allure" ]; then
  echo "Allure CLI not found at $allure — run npm install."
  exit 0
fi

rm -rf "$reports"
mkdir -p "$reports"
cp -R "$source_dir/." "$reports/"
echo "Report folder copied to $reports ($(du -sh "$reports" | cut -f1))"

if ! "$allure" generate --output "$report" "$results" > "$log" 2>&1; then
  echo "Allure report generation failed; log: $log"
  tail -20 "$log"
  exit 0
fi
echo "Allure report generated: $report"

if [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
  kill "$(cat "$pid_file")" && echo "Stopped the previous Allure server (pid $(cat "$pid_file"))"
fi

nohup "$allure" open "$report" >> "$log" 2>&1 < /dev/null &
pid=$!
echo "$pid" > "$pid_file"

url=""
for _ in $(seq 1 30); do
  url=$(grep -Eo 'http://localhost:[0-9]+' "$log" | head -1)
  [ -n "$url" ] && break
  kill -0 "$pid" 2>/dev/null || break
  sleep 1
done

if [ -z "$url" ]; then
  echo "Allure server did not start; log: $log"
  tail -20 "$log"
  exit 0
fi

if command -v open > /dev/null 2>&1; then
  open "$url"
elif command -v xdg-open > /dev/null 2>&1; then
  xdg-open "$url"
fi
echo "Allure report: $url (pid $pid; stop it with: kill $pid)"
exit 0
