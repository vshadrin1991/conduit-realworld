#!/usr/bin/env node
/**
 * Resolves the input of the `playwright-requirements-testing` workflow.
 *
 * Usage (from the project root):
 *   node .archon/scripts/requirements-inputs.mjs <arguments.txt> <artifacts-dir>
 *
 * <arguments.txt> holds the workflow message: `--requirements <file>` or `--r <file>` (`--r=<file>` works too; quote
 * paths with spaces). Copies the file to tasks/<KEY>/requirements/source/ (KEY = file name without extension),
 * extracts text from non-Markdown files, writes <artifacts-dir>/inputs.json and prints a Markdown summary for the
 * AI nodes. Exits with 1 on invalid input.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const EXTRACT = '.claude/skills/playwright-ts-test-requirements/scripts/extract-requirements.mjs';
const PLAIN_TEXT = /\.(md|markdown|txt)$/i;
const FLAGS = ['--r', '--requirements'];

const [argumentsFile, artifactsDir] = process.argv.slice(2);
if (!argumentsFile || !artifactsDir) {
  console.error('Usage: node .archon/scripts/requirements-inputs.mjs <arguments.txt> <artifacts-dir>');
  process.exit(2);
}

/**
 * Splits the message into words; quotes that start a word group words until the matching quote.
 * @param {string} input - workflow message as typed
 * @return {string[]} words
 */
function tokenize(input) {
  const tokens = [];
  let current = '';
  let quote = null;
  let started = false;
  for (const char of input) {
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
    } else if ((char === '"' || char === "'") && !started) {
      quote = char;
      started = true;
    } else if (/\s/.test(char)) {
      if (started) tokens.push(current);
      current = '';
      started = false;
    } else {
      current += char;
      started = true;
    }
  }
  if (started) tokens.push(current);
  return tokens;
}

/**
 * Finds the one requirements file given with `--requirements` / `--r`.
 * @param {string[]} tokens - words of the message
 * @return {string} path of the requirements file
 */
function requirementsFile(tokens) {
  const files = [];
  tokens.forEach((token, index) => {
    const equals = token.indexOf('=');
    const flag = equals > 0 ? token.slice(0, equals) : token;
    if (!FLAGS.includes(flag)) return;
    const value = equals > 0 ? token.slice(equals + 1) : tokens[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${flag} needs a requirements file`);
    files.push(value);
  });
  if (!files.length) throw new Error('give the requirements file: --r <file>');
  if (files.length > 1) throw new Error('give one requirements file per run');
  const [file] = files;
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(`${file} is not a file`);
  return file;
}

try {
  const file = requirementsFile(tokenize(fs.readFileSync(argumentsFile, 'utf-8').trim()));
  const key = path.basename(file).replace(/\.[^.]+$/, '');
  const outputDir = path.join('tasks', key, 'requirements');
  const source = path.join(outputDir, 'source', path.basename(file));
  fs.mkdirSync(path.dirname(source), { recursive: true });
  if (path.resolve(file) !== path.resolve(source)) fs.copyFileSync(file, source);
  let extracted = null;
  if (!PLAIN_TEXT.test(file)) {
    extracted = path.join(outputDir, 'extracted');
    execFileSync('node', [EXTRACT, source, '--out', extracted], { stdio: 'pipe' });
  }
  const inputs = { requirements: file, key, outputDir, source, extracted };
  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(path.join(artifactsDir, 'inputs.json'), `${JSON.stringify(inputs, null, 2)}\n`);
  console.log(
    [
      '## Workflow inputs',
      `- Requirements: \`${file}\``,
      `- Key: \`${key}\``,
      `- Output folder: \`${outputDir}\` (result files are written here and copied to the run artifacts)`,
      `- Source copy: \`${source}\``,
      `- Extracted text: ${extracted ? `\`${extracted}\`` : 'none — read the requirements file directly'}`,
    ].join('\n'),
  );
} catch (error) {
  const message = error.stderr ? String(error.stderr).trim().split('\n')[0] : error.message;
  console.error(`Input error: ${message}`);
  process.exit(1);
}
