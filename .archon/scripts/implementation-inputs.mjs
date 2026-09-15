#!/usr/bin/env node
/**
 * Resolves the named inputs of the `playwright-tests-implementation` workflow.
 *
 * Usage (from the project root):
 *   node .archon/scripts/implementation-inputs.mjs <arguments.txt> <artifacts-dir>
 *
 * <arguments.txt> holds the workflow message as typed. Options (a value runs up to the next option; quotes group words):
 *   --requirements | --r   <file | folder | text>   requirements to implement tests for
 *   --test-cases   | --tc  <file | folder | text>   test cases to implement
 *   --artifacts    | --a   <folder | page.html>     pages saved from the browser (Ctrl/Cmd+S)
 * `--r=value` works too. Everything outside an option is the task: a task file path or a description.
 *
 * Writes <artifacts-dir>/inputs.json, saves text values to <artifacts-dir>/inputs/*.md, extracts text from non-Markdown
 * requirement and test case files, turns new or re-saved HTML pages into page descriptions (<page>.md next to the page)
 * and prints a Markdown summary for the AI nodes. Exits with 1 on invalid input.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const OPTIONS = {
  '--requirements': 'requirements',
  '--r': 'requirements',
  '--test-cases': 'testCases',
  '--tc': 'testCases',
  '--artifacts': 'artifacts',
  '--a': 'artifacts',
};
const LABELS = { requirements: '--requirements', testCases: '--test-cases', artifacts: '--artifacts' };
const FILE_NAMES = { requirements: 'requirements', testCases: 'test-cases' };
const PAGE_TO_MD = '.claude/skills/playwright-ts-conduit-realworld/scripts/parse-page-to-md.mjs';
const EXTRACT = '.claude/skills/playwright-ts-test-requirements/scripts/extract-requirements.mjs';
const PLAIN_TEXT = /\.(md|markdown|txt)$/i;
const LOOKS_LIKE_PATH = /^[^\s]*(\/|\.(md|markdown|txt|html?|pdf|docx?|xlsx?|csv|json|png|jpe?g))$|^[^\s]+\/[^\s]*$/i;

const [argumentsFile, artifactsDir] = process.argv.slice(2);
if (!argumentsFile || !artifactsDir) {
  console.error('Usage: node .archon/scripts/implementation-inputs.mjs <arguments.txt> <artifacts-dir>');
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
 * Groups the words by option; each occurrence of an option starts a new group.
 * @param {string[]} tokens - words of the message
 * @return {{ task: string[], requirements: string[][], testCases: string[][], artifacts: string[][] }} grouped words
 */
function groupByOption(tokens) {
  const groups = { task: [], requirements: [], testCases: [], artifacts: [] };
  let current = groups.task;
  for (const token of tokens) {
    const [flag, inline] = token.includes('=') ? [token.slice(0, token.indexOf('=')), token.slice(token.indexOf('=') + 1)] : [token];
    const key = OPTIONS[flag];
    if (!key) {
      current.push(token);
      continue;
    }
    current = [];
    groups[key].push(current);
    if (inline) current.push(inline);
  }
  return groups;
}

/**
 * Resolves the groups of a requirements or test cases option into files the AI nodes read.
 * @param {'requirements' | 'testCases'} key - option key
 * @param {string[][]} groups - words of each occurrence of the option
 * @return {{ type: 'file' | 'folder' | 'text', path: string, extracted?: string }[]} sources
 */
function resolveDocuments(key, groups) {
  const sources = [];
  groups.forEach((words, index) => {
    if (!words.length) throw new Error(`${LABELS[key]} needs a file path, a folder or text`);
    if (words.every((word) => fs.existsSync(word))) {
      for (const word of words) {
        const type = fs.statSync(word).isDirectory() ? 'folder' : 'file';
        const source = { type, path: word };
        if (type === 'folder' || !PLAIN_TEXT.test(word)) source.extracted = extract(key, word);
        sources.push(source);
      }
      return;
    }
    if (words.length === 1 && LOOKS_LIKE_PATH.test(words[0])) throw new Error(`${LABELS[key]}: ${words[0]} not found`);
    const file = path.join(artifactsDir, 'inputs', `${FILE_NAMES[key]}${groups.length > 1 ? `-${index + 1}` : ''}.md`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${words.join(' ').trim()}\n`);
    sources.push({ type: 'text', path: file });
  });
  return sources;
}

/**
 * Extracts readable text from a non-Markdown file or a folder with the requirements skill script.
 * @param {'requirements' | 'testCases'} key - option key, names the output folder
 * @param {string} input - file or folder to extract
 * @return {string} folder with the extracted text, or a note when extraction failed
 */
function extract(key, input) {
  const out = path.join(artifactsDir, 'inputs', 'extracted', FILE_NAMES[key]);
  try {
    execFileSync('node', [EXTRACT, input, '--out', out], { stdio: 'pipe' });
    return out;
  } catch (error) {
    return `extraction failed (${String(error.stderr ?? error.message).trim().split('\n')[0]}) — read the source directly`;
  }
}

/**
 * Turns saved pages into page descriptions; only pages without a description or saved again after it are parsed.
 * @param {string[][]} groups - words of each occurrence of the artifacts option
 * @return {{ page: string, description: string, status: 'created' | 'updated' | 'up to date' }[]} page descriptions
 */
function resolveArtifacts(groups) {
  const pages = [];
  for (const words of groups) {
    if (!words.length) throw new Error('--artifacts needs a folder or an HTML file');
    for (const word of words) {
      if (!fs.existsSync(word)) throw new Error(`--artifacts: ${word} not found`);
      const htmlFiles = fs.statSync(word).isDirectory()
        ? fs.readdirSync(word).filter((name) => /\.html?$/i.test(name)).map((name) => path.join(word, name))
        : [word];
      const saved = htmlFiles.filter((file) => /\.html?$/i.test(file));
      if (!saved.length) throw new Error(`--artifacts: no saved HTML pages in ${word}`);
      for (const html of saved.sort()) {
        const description = html.replace(/\.html?$/i, '.md');
        const exists = fs.existsSync(description);
        let status = 'up to date';
        if (!exists || fs.statSync(html).mtimeMs > fs.statSync(description).mtimeMs) {
          execFileSync('node', [PAGE_TO_MD, html], { stdio: 'pipe' });
          status = exists ? 'updated' : 'created';
        }
        pages.push({ page: html, description, status });
      }
    }
  }
  return pages;
}

/**
 * Formats the resolved inputs as the Markdown summary the AI nodes receive.
 * @param {object} inputs - resolved inputs
 * @return {string} Markdown summary
 */
function summary(inputs) {
  const documents = (sources) =>
    sources.length
      ? sources
          .map((s) => `  - ${s.type === 'text' ? 'text, saved to' : s.type} \`${s.path}\`${s.extracted ? ` (extracted text: \`${s.extracted}\`)` : ''}`)
          .join('\n')
      : '  - none';
  const pages = inputs.artifacts.length
    ? inputs.artifacts.map((p) => `  - \`${p.page}\` → \`${p.description}\` (${p.status})`).join('\n')
    : '  - none';
  return [
    '## Workflow inputs',
    `- Task: ${inputs.task ? inputs.task : 'none'}`,
    '- Requirements (`--requirements`):',
    documents(inputs.requirements),
    '- Test cases (`--test-cases`):',
    documents(inputs.testCases),
    '- Page descriptions from saved pages (`--artifacts`):',
    pages,
  ].join('\n');
}

try {
  const groups = groupByOption(tokenize(fs.readFileSync(argumentsFile, 'utf-8').trim()));
  const inputs = {
    task: groups.task.join(' ').trim(),
    requirements: resolveDocuments('requirements', groups.requirements),
    testCases: resolveDocuments('testCases', groups.testCases),
    artifacts: resolveArtifacts(groups.artifacts),
  };
  if (!inputs.task && !inputs.requirements.length && !inputs.testCases.length) {
    throw new Error('nothing to implement: give a task file or description, --requirements or --test-cases');
  }
  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(path.join(artifactsDir, 'inputs.json'), `${JSON.stringify(inputs, null, 2)}\n`);
  console.log(summary(inputs));
} catch (error) {
  console.error(`Input error: ${error.message}`);
  process.exit(1);
}
