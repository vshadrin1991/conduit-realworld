#!/usr/bin/env bash
# Serves the Allure report of the last test run from the workflow artifacts.
#
# Usage (Archon bash node; ARTIFACTS_DIR is set by Archon, PROJECT_PATH comes from .archon/.env):
#   bash "${PROJECT_PATH:-$PWD}/.archon/scripts/allure-serve.sh"
#
# Copies reports/allure-results to $ARTIFACTS_DIR/allure-results, generates $ARTIFACTS_DIR/allure-report from the copy
# and serves it in the background with `allure open` (Allure 3's `serve`), so the report opens in the browser and stays
# available after the workflow ends. The report is generated first because serving raw results from a background
# process exits without starting the server. The previous server started by this script is stopped first
# (pid in reports/allure-serve.pid). Never fails the workflow.
set -u
cd "${PROJECT_PATH:-$PWD}" || exit 0

source_dir=reports/allure-results
results="$ARTIFACTS_DIR/allure-results"
report="$ARTIFACTS_DIR/allure-report"
log="$ARTIFACTS_DIR/allure-serve.log"
pid_file=reports/allure-serve.pid
allure="$PWD/node_modules/.bin/allure"

if [ -z "$(ls -A "$source_dir" 2>/dev/null)" ]; then
  echo "No Allure results in $source_dir — nothing to serve."
  exit 0
fi
if [ ! -x "$allure" ]; then
  echo "Allure CLI not found at $allure — run npm install."
  exit 0
fi

rm -rf "$results" "$report"
mkdir -p "$results"
cp -R "$source_dir/." "$results/"
echo "Allure results copied to $results ($(ls "$results" | wc -l | tr -d ' ') files)"

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

if [ -n "$url" ]; then
  echo "Allure report: $url (pid $pid; stop it with: kill $pid)"
else
  echo "Allure server did not start; log: $log"
  tail -20 "$log"
fi
exit 0
