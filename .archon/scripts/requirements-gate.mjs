#!/usr/bin/env node
/**
 * Decides whether the deliverables of the `playwright-requirements-testing` workflow can be written.
 *
 * Usage (Archon bash node; ARTIFACTS_DIR is set by Archon):
 *   node .archon/scripts/requirements-gate.mjs <review output> <evidence output> <preflight output>
 *
 * Each argument is the node's JSON output, or an empty string when the node did not run or failed. Only a requirements
 * review that did not complete or that is BLOCKED stops the run: a difference between a requirement and the running
 * application is a question for the author, not a failure, and missing evidence only limits what the report can state.
 * Prints `{ verdict, reasons, evidence, evidenceNote, differences, notObserved, outputDir }`;
 * verdict is "READY", "BLOCKED" or "NO_INPUT" (the inputs node already stopped the run with the input error).
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

/**
 * Describes how much the run could observe in the browser.
 * @param {object | null} evidence - output of the evidence node
 * @param {object | null} preflight - output of the preflight node
 * @return {{ evidence: 'COLLECTED' | 'PARTIAL' | 'NONE', evidenceNote: string }} coverage of the evidence
 */
function coverage(evidence, preflight) {
  if (evidence?.status === 'COLLECTED') return { evidence: 'COLLECTED', evidenceNote: 'The planned checks were observed in the browser.' };
  if (evidence?.status === 'PARTIAL') {
    return { evidence: 'PARTIAL', evidenceNote: `Some checks were not observed: ${evidence.summary ?? 'see evidence.md'}` };
  }
  if (evidence?.status === 'ENV_BLOCKED') {
    return { evidence: 'NONE', evidenceNote: `The browser check was blocked by the environment: ${evidence.summary ?? 'see evidence.md'}` };
  }
  if (!preflight) return { evidence: 'NONE', evidenceNote: 'The environment check did not run, so nothing was observed in the browser.' };
  if (preflight.site !== 'UP') {
    return { evidence: 'NONE', evidenceNote: `The application ${preflight.base_url} was not reachable (HTTP ${preflight.http_status}), so nothing was observed in the browser.` };
  }
  if (preflight.chrome !== 'yes') {
    return { evidence: 'NONE', evidenceNote: 'Google Chrome is not installed, so nothing was observed in the browser.' };
  }
  return { evidence: 'NONE', evidenceNote: 'The browser check did not complete, so the requirements were reviewed without evidence from the application.' };
}

const inputsFile = path.join(process.env.ARTIFACTS_DIR ?? '.', 'inputs.json');
if (!fs.existsSync(inputsFile)) {
  console.log(JSON.stringify({ verdict: 'NO_INPUT', reasons: ['The requirements file was not resolved.'], outputDir: null }));
  process.exit(0);
}
const { outputDir } = JSON.parse(fs.readFileSync(inputsFile, 'utf-8'));
const [review, evidence, preflight] = process.argv.slice(2, 5).map(parse);
const reasons = [];

if (!review) reasons.push('The requirements review did not complete.');
else if (review.status === 'BLOCKED') reasons.push(`The requirements review is blocked: ${review.blockers} blocker finding(s) make test design impossible.`);

console.log(
  JSON.stringify({
    verdict: reasons.length ? 'BLOCKED' : 'READY',
    reasons,
    ...coverage(evidence, preflight),
    differences: evidence?.differences ?? 0,
    notObserved: evidence?.not_observed ?? 0,
    outputDir,
  }),
);
