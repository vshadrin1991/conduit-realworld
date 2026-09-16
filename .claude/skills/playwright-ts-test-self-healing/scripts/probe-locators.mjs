#!/usr/bin/env node
/**
 * Opens a page of the app in headless Chromium, prints its ARIA snapshot and checks candidate locators.
 * Spends rate-limit budget: every run loads the SPA (HTML, JS, CSS) and the API calls of the page.
 *
 * Usage (from the project root):
 *   node probe-locators.mjs --route <hash route> [--login] [--try "<locator>"]... [--scope "<locator>"]
 *                           [--wait-for "<locator>"] [--no-snapshot] [--max-lines 150]
 *
 * Locators are written as in page objects without `this.page.`:
 *   --try "getByRole('button', { name: 'Post Comment' })" --try "locator('.article-page').getByPlaceholder('Write a comment...')"
 * --login injects the cached shared user (.auth/user.json) into localStorage (a probe shortcut; tests sign in through the login form).
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const HELP = fs.readFileSync(new URL(import.meta.url), 'utf-8').split('*/')[0];

function parseArgs(argv) {
  const opts = { tries: [], login: false, snapshot: true, maxLines: 150 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--route') opts.route = argv[++i];
    else if (arg === '--try') opts.tries.push(argv[++i]);
    else if (arg === '--scope') opts.scope = argv[++i];
    else if (arg === '--wait-for') opts.waitFor = argv[++i];
    else if (arg === '--login') opts.login = true;
    else if (arg === '--no-snapshot') opts.snapshot = false;
    else if (arg === '--max-lines') opts.maxLines = Number(argv[++i]);
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return opts;
}

/** Same precedence as src/config/loader.ts: environment > .env.<TEST_ENV> > .env > default. */
function readConfig() {
  const parse = (file) =>
    fs.existsSync(file)
      ? Object.fromEntries(
          fs
            .readFileSync(file, 'utf-8')
            .split('\n')
            .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
            .filter(Boolean)
            .map(([, key, value]) => [key, value.replace(/^['"]|['"]$/g, '')]),
        )
      : {};
  const base = parse('.env');
  const testEnv = process.env.TEST_ENV || base.TEST_ENV;
  const merged = { ...base, ...(testEnv ? parse(`.env.${testEnv}`) : {}) };
  const value = (key, fallback) => process.env[key] || merged[key] || fallback;
  return {
    baseUrl: value('BASE_URL', 'https://conduit-realworld-example-app.fly.dev').replace(/\/$/, ''),
    authDir: value('AUTH_DIR', '.auth'),
  };
}

function resolveLocator(page, expression) {
  const code = expression.trim().replace(/^(this\.)?page\./, '');
  return new Function('page', `return page.${code};`)(page);
}

async function describeMatches(locator) {
  const count = await locator.count();
  const matches = [];
  for (let index = 0; index < Math.min(count, 5); index++) {
    const element = locator.nth(index);
    const visible = await element.isVisible();
    const info = await element.evaluate((el) => ({
      tag: el.tagName.toLowerCase(),
      text: (el.innerText || el.value || el.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 80),
      className: typeof el.className === 'string' ? el.className.slice(0, 60) : '',
    }));
    matches.push({ visible, ...info });
  }
  const visibleCount = matches.filter((m) => m.visible).length;
  const verdict =
    count === 0
      ? 'NOT FOUND'
      : count > 1
        ? `AMBIGUOUS (${count} matches, ${visibleCount} visible of first 5)`
        : visibleCount
          ? 'UNIQUE'
          : 'HIDDEN';
  return { count, verdict, matches };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.route) {
    console.log(HELP);
    process.exit(opts.help ? 0 : 2);
  }
  const config = readConfig();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'en-US' });
  let rateLimited = 0;

  try {
    if (opts.login) {
      const userFile = path.join(config.authDir, 'user.json');
      if (!fs.existsSync(userFile))
        throw new Error(`${userFile} not found: run any authenticated test once to cache the user`);
      const user = JSON.parse(fs.readFileSync(userFile, 'utf-8'));
      const session = JSON.stringify({
        headers: { Authorization: `Token ${user.token}` },
        isAuth: true,
        loggedUser: { email: user.email, username: user.username, bio: null, image: null, token: user.token },
      });
      await context.addInitScript((value) => window.localStorage.setItem('loggedUser', value), session);
    }

    const page = await context.newPage();
    page.on('response', (response) => {
      if (response.status() === 429) rateLimited++;
    });
    const url = `${config.baseUrl}/#${opts.route}`;
    console.log(`# Probe ${url}${opts.login ? ' (logged in)' : ''}\n`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    if (opts.waitFor) await resolveLocator(page, opts.waitFor).first().waitFor({ timeout: 15_000 });
    else await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

    if (rateLimited)
      console.log(
        `> WARNING: ${rateLimited} response(s) with HTTP 429 — the page may be incomplete, results are unreliable.\n`,
      );

    for (const expression of opts.tries) {
      try {
        const { verdict, matches } = await describeMatches(resolveLocator(page, expression));
        console.log(`## ${verdict}: ${expression}`);
        for (const m of matches)
          console.log(
            `  - <${m.tag}> ${m.visible ? 'visible' : 'hidden'} "${m.text}"${m.className ? ` .${m.className}` : ''}`,
          );
      } catch (error) {
        console.log(`## ERROR: ${expression}\n  ${String(error.message ?? error).split('\n')[0]}`);
      }
    }

    if (opts.snapshot) {
      const scope = opts.scope ? resolveLocator(page, opts.scope).first() : page.locator('body');
      const lines = (await scope.ariaSnapshot()).split('\n');
      console.log(`\n## ARIA snapshot${opts.scope ? ` of ${opts.scope}` : ''} (${lines.length} lines)\n`);
      console.log(lines.slice(0, opts.maxLines).join('\n'));
      if (lines.length > opts.maxLines)
        console.log(`... ${lines.length - opts.maxLines} more lines (use --scope or --max-lines)`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
