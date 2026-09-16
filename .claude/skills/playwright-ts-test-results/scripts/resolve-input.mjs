/**
 * Input resolution shared by the result scripts: a Playwright JSON report, a folder that contains one (a copied
 * `reports/` folder, a CI artifact) or a `.zip` archive of such a folder. Archives are unpacked to
 * `reports/unpacked/<archive name>/` so their traces, screenshots and `error-context.md` files stay available.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const MAX_DEPTH = 6;
const SKIP_DIRS = new Set(['node_modules', '.git']);

/**
 * Finds the report to read for a file, folder or zip archive.
 * @param input - path from the command line
 * @param options - `allowAllure: true` also accepts a folder of Allure raw results
 * @return `{ kind: 'playwright-json' | 'allure-results', path, root, unpackedFrom? }` — `root` is the folder artifacts are searched in
 */
export function resolveResultsInput(input, { allowAllure = false } = {}) {
  if (!fs.existsSync(input)) throw new Error(`Not found: ${input}`);

  let root = input;
  let unpackedFrom;
  if (fs.statSync(input).isFile() && /\.zip$/i.test(input)) {
    unpackedFrom = input;
    root = path.join('reports', 'unpacked', path.basename(input).replace(/\.zip$/i, ''));
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true });
    unpack(input, root);
  }

  if (fs.statSync(root).isFile()) return { kind: 'playwright-json', path: root, root: path.dirname(root) };

  const report = findPlaywrightReport(root);
  if (report) return { kind: 'playwright-json', path: report, root, unpackedFrom };
  if (allowAllure) {
    const allure = findAllureResults(root);
    if (allure) return { kind: 'allure-results', path: allure, root, unpackedFrom };
  }
  const expected = allowAllure ? 'Playwright JSON report or Allure results' : 'Playwright JSON report';
  throw new Error(`No ${expected} found in ${unpackedFrom ?? input}`);
}

/**
 * Maps an artifact path recorded on another machine (CI) to the same file inside the given folder.
 * @param artifactPath - path from the report attachments
 * @param root - folder the report was read from (or unpacked to)
 * @return an existing local path, or the original path when no copy is found
 */
export function rebaseArtifactPath(artifactPath, root) {
  if (!artifactPath || fs.existsSync(artifactPath)) return artifactPath;
  const normalized = artifactPath.replace(/\\/g, '/');
  const marker = normalized.lastIndexOf('/test-results/');
  if (marker < 0) return artifactPath;
  const relative = normalized.slice(marker + '/test-results/'.length);
  for (const dir of findDirs(root, 'test-results')) {
    const candidate = path.join(dir, relative);
    if (fs.existsSync(candidate)) return candidate;
  }
  return artifactPath;
}

function unpack(archive, destination) {
  try {
    execFileSync('unzip', ['-q', '-o', archive, '-d', destination], { stdio: 'pipe' });
  } catch (error) {
    // No unzip binary (Windows): bsdtar reads zip archives too.
    if (error.code !== 'ENOENT')
      throw new Error(`Cannot unpack ${archive}: ${String(error.stderr ?? error.message).trim()}`);
    execFileSync('tar', ['-xf', archive, '-C', destination], { stdio: 'pipe' });
  }
}

function* walk(dir, depth = 0) {
  if (depth > MAX_DEPTH) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('__MACOSX')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      yield { full, dir: true };
      yield* walk(full, depth + 1);
    } else yield { full, dir: false };
  }
}

function findDirs(root, name) {
  return [...walk(root)].filter((e) => e.dir && path.basename(e.full) === name).map((e) => e.full);
}

function isPlaywrightReport(file) {
  try {
    const head = fs.readFileSync(file, { encoding: 'utf-8', flag: 'r' }).slice(0, 4096);
    if (!head.trimStart().startsWith('{') || !/"(config|suites)"/.test(head)) return false;
    const json = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return Array.isArray(json.suites) && (json.stats !== undefined || json.config !== undefined);
  } catch {
    return false;
  }
}

/** The shallowest `results.json` wins; any other Playwright JSON report is the fallback. */
function findPlaywrightReport(root) {
  const candidates = [...walk(root)]
    .filter(
      (e) => !e.dir && e.full.endsWith('.json') && !/-(result|container)\.json$|package(-lock)?\.json$/.test(e.full),
    )
    .map((e) => e.full)
    .sort((a, b) => a.split(path.sep).length - b.split(path.sep).length);
  const named = candidates.filter((file) => path.basename(file) === 'results.json');
  return [...named, ...candidates.filter((file) => !named.includes(file))].find(isPlaywrightReport);
}

/** The folder with the most Allure `*-result.json` files. */
function findAllureResults(root) {
  const counts = new Map();
  for (const entry of walk(root)) {
    if (!entry.dir && entry.full.endsWith('-result.json')) {
      const dir = path.dirname(entry.full);
      counts.set(dir, (counts.get(dir) ?? 0) + 1);
    }
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
}
