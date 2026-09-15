#!/usr/bin/env node
/**
 * Decides whether requirements testing passed, from the outputs of the earlier `playwright-requirements-testing` nodes.
 *
 * Usage (Archon bash node; ARTIFACTS_DIR is set by Archon):
 *   node .archon/scripts/requirements-gate.mjs <preflight output> <review output> <live_testing output>
 *
 * Each argument is the node's JSON output, or an empty string when the node did not run or failed.
 * Prints `{ "verdict": "PASSED" | "FAILED" | "NO_INPUT", "reasons": [...], "outputDir": "tasks/<KEY>/requirements" }`.
 * NO_INPUT (no inputs.json) skips both reports: the inputs node already stopped the run with the input error.
 */
import fs from 'node:fs';
import path from 'node:path';

/**
 * Parses a node output; empty or non-JSON output means the node did not produce a result.
 * @param {string | undefined} text - node output
 * @return {object | null} parsed output
 */
function parse(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

const inputsFile = path.join(process.env.ARTIFACTS_DIR ?? '.', 'inputs.json');
if (!fs.existsSync(inputsFile)) {
  console.log(JSON.stringify({ verdict: 'NO_INPUT', reasons: ['The requirements file was not resolved.'], outputDir: null }));
  process.exit(0);
}
const { outputDir } = JSON.parse(fs.readFileSync(inputsFile, 'utf-8'));
const [preflight, review, live] = process.argv.slice(2, 5).map(parse);
const reasons = [];

if (!preflight) {
  reasons.push('The environment check did not run.');
} else {
  if (preflight.site !== 'UP') reasons.push(`The application ${preflight.base_url} is not reachable (HTTP ${preflight.http_status}).`);
  if (preflight.chrome !== 'yes') reasons.push('Google Chrome is not installed, so the Playwright MCP server cannot open it.');
}
if (!review) reasons.push('The requirements review did not complete.');
else if (review.status === 'BLOCKED') reasons.push(`The requirements review is blocked: ${review.blockers} blocker finding(s).`);
if (review?.status === 'READY' && preflight?.site === 'UP' && preflight?.chrome === 'yes') {
  if (!live) reasons.push('The requirements check in Chrome did not complete.');
  else if (live.status === 'FAILED') reasons.push(`${live.failed} requirement(s) failed in Chrome.`);
  else if (live.status === 'ENV_BLOCKED') reasons.push(`The requirements check in Chrome was blocked by the environment: ${live.summary}`);
}

console.log(JSON.stringify({ verdict: reasons.length ? 'FAILED' : 'PASSED', reasons, outputDir }));
