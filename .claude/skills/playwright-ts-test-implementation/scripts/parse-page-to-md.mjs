#!/usr/bin/env node
/**
 * Parses pages saved from the browser with Ctrl/Cmd+S ("Webpage, Complete") into markdown page descriptions used to
 * implement tests: elements grouped like page-object maps with suggested names and locators, forms, repeated items,
 * the existing page object they belong to, open decisions and a page-object draft that follows the framework.
 * Offline: page scripts are disabled and every non-file request is blocked — no server, no rate-limit budget.
 *
 * Usage (from the project root):
 *   node parse-page-to-md.mjs <saved-page.html | folder> [--out <file.md | folder>] [--name <PageClass>]
 *                             [--stdout] [--all] [--no-snapshot]
 *
 * Default output: <saved-page>.md next to each HTML file. A folder parses every *.html in it (not recursive).
 * --name sets the page-object class name (single file); --all includes hidden elements; --stdout prints instead.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const HELP = fs.readFileSync(new URL(import.meta.url), 'utf-8').split('*/')[0];
const PAGE_OBJECT_DIR = 'src/pageObject';
const MARK = 'data-page-md';

const SELECTOR = [
  'input:not([type=hidden])',
  'textarea',
  'select',
  'button',
  'a[href]',
  '[role=button]',
  '[role=link]',
  '[role=tab]',
  '[role=menuitem]',
  '[role=checkbox]',
  '[role=radio]',
  '[role=switch]',
  '[role=textbox]',
  '[role=combobox]',
  '[contenteditable=""]',
  '[contenteditable=true]',
  'h1',
  'h2',
  '[role=alert]',
  '.error-messages',
  '.invalid-feedback',
].join(', ');
const ERROR_SELECTOR = '[role=alert], .error-messages, .invalid-feedback';

const GROUP_BY_ROLE = {
  textbox: 'fields',
  searchbox: 'fields',
  combobox: 'fields',
  spinbutton: 'fields',
  listbox: 'fields',
  button: 'buttons',
  link: 'buttons',
  tab: 'buttons',
  menuitem: 'buttons',
  checkbox: 'checkboxes',
  switch: 'checkboxes',
  radio: 'radioButtons',
  heading: 'content',
  alert: 'errors',
};
/** Page-object groups in BasePage type-parameter order, then read-only locators. */
const GROUPS = [
  { key: 'fields', title: 'Fields', typeName: 'FieldName' },
  { key: 'buttons', title: 'Buttons and action links', typeName: 'ButtonName' },
  { key: 'checkboxes', title: 'Checkboxes', typeName: 'CheckboxName' },
  { key: 'radioButtons', title: 'Radio buttons', typeName: 'RadioButtonName' },
  { key: 'errors', title: 'Errors' },
  { key: 'content', title: 'Content' },
];
/** Utility/framework classes that say nothing about the element's meaning. */
const NON_SEMANTIC_CLASS =
  /^(btn(-.*)?|form-.*|col(-.*)?|row|pull-.*|text-.*|[mp][trblxy]?-\d+|d-.*|nav|nav-(item|link)|navbar(-.*)?|container.*|active|disabled|hidden|show|fade|ion-.*|clearfix|card(-.*)?|list-.*|float-.*|w-\d+|h-\d+)$/;
/** BasePage members a generated read-only locator must not shadow. */
const RESERVED = new Set(['page', 'header', 'log', 'input', 'button', 'checkbox', 'radioButton', 'text', 'root', 'fields', 'errors', 'buttons', 'checkboxes', 'radioButtons', 'then']);

const rel = (p) => path.relative(process.cwd(), p);
const quote = (text) => `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const cell = (value) => String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

function camel(text) {
  const words = (text ?? '')
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4);
  if (!words.length) return undefined;
  const name = words.map((w, i) => (i ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase())).join('');
  return /^\p{N}/u.test(name) ? `el${name}` : name;
}

const pascal = (text) => {
  const name = camel(text);
  return name ? name[0].toUpperCase() + name.slice(1) : undefined;
};

function parseArgs(argv) {
  const opts = { snapshot: true, all: false, stdout: false };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--out') opts.out = argv[++i];
    else if (arg === '--name') opts.name = argv[++i];
    else if (arg === '--stdout') opts.stdout = true;
    else if (arg === '--all') opts.all = true;
    else if (arg === '--no-snapshot') opts.snapshot = false;
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg.startsWith('--')) throw new Error(`Unknown option: ${arg}`);
    else positional.push(arg);
  }
  opts.input = positional[0];
  return opts;
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : full.endsWith('.ts') ? [full] : [];
  });
}

/** Page-object lines that already contain the literal as a quoted string (or the start of one). */
function existingUsages(files, literal) {
  if (!literal || literal.length < 2) return [];
  const found = [];
  for (const file of files) {
    fs.readFileSync(file, 'utf-8')
      .split('\n')
      .forEach((line, index) => {
        if (line.includes(`'${literal}'`) || line.includes(`"${literal}"`) || line.includes(`'${literal} `)) {
          found.push({ file: rel(file), line: index + 1 });
        }
      });
  }
  return found;
}

/** Role and accessible name from the first line of an element's ARIA snapshot: `- button "Sign up"`. */
function parseSnapshot(snapshot) {
  const match = snapshot.split('\n')[0]?.match(/^- ([a-z]+)(?: "((?:[^"\\]|\\.)*)")?/);
  return match ? { role: match[1], name: match[2]?.replace(/\\"/g, '"').trim() || undefined } : {};
}

function inputFiles(input) {
  if (!fs.statSync(input).isDirectory()) return [input];
  return fs
    .readdirSync(input)
    .filter((file) => /\.html?$/i.test(file))
    .sort()
    .map((file) => path.join(input, file));
}

function outputPath(file, opts, multiple) {
  const mdName = path.basename(file).replace(/\.html?$/i, '.md');
  if (!opts.out) return file.replace(/\.html?$/i, '.md');
  const isDir = multiple || !opts.out.endsWith('.md') || (fs.existsSync(opts.out) && fs.statSync(opts.out).isDirectory());
  return isDir ? path.join(opts.out, mdName) : opts.out;
}

/** Runs in the saved page: marks candidate elements and collects what locators and names are built from. */
function collectDom({ selector, errorSelector, mark, nonSemantic }) {
  const nonSemanticRe = new RegExp(nonSemantic);
  const semantic = (c) => /^[a-z][a-z0-9-]{2,}$/.test(c) && !nonSemanticRe.test(c);
  const textOf = (el) => (el?.innerText || el?.textContent || '').trim().replace(/\s+/g, ' ');
  const forms = [...document.querySelectorAll('form')];

  const byClass = new Map();
  for (const el of document.body.querySelectorAll('[class]')) {
    for (const c of el.classList) if (semantic(c)) byClass.set(c, [...(byClass.get(c) ?? []), el]);
  }
  const repeated = [...byClass]
    .filter(
      ([, els]) =>
        els.length > 1 &&
        !els[0].matches('a, button, input, textarea, select, li') &&
        els.every((e) => e.querySelector('a[href], button, h1, h2, h3, h4')),
    )
    .map(([cls, els]) => ({ cls, count: els.length, sample: textOf(els[0]).slice(0, 80) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  const repeatedSelector = repeated.map((item) => `.${CSS.escape(item.cls)}`).join(', ');

  const elements = [...document.querySelectorAll(selector)].map((el, index) => {
    el.setAttribute(mark, String(index));
    const labelFor = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null;
    return {
      index,
      tag: el.tagName.toLowerCase(),
      placeholder: el.getAttribute('placeholder') ?? undefined,
      value: el.getAttribute('value') ?? undefined,
      label: textOf(labelFor ?? el.closest('label')) || undefined,
      testId: el.getAttribute('data-testid') ?? el.getAttribute('data-test') ?? undefined,
      classes: [...el.classList],
      text: textOf(el).slice(0, 80),
      isError: el.matches(errorSelector),
      form: forms.indexOf(el.closest('form')),
      // Elements inside repeated items (feed previews, comments) are reached through the item's locator method.
      inRepeated: repeatedSelector ? ([...el.parentElement.closest(repeatedSelector)?.classList ?? []].find((c) => repeated.some((r) => r.cls === c)) ?? undefined) : undefined,
      // Navigation belongs to the Header component, not to the page object.
      inNavigation: !!el.closest('nav, header, [role=navigation], [role=banner]'),
    };
  });

  const containers = [...byClass].filter(([cls, els]) => els.length === 1 && /-page$|^page-|-view$/.test(cls)).map(([cls]) => cls);

  return {
    elements,
    repeated,
    containers,
    forms: forms.map((form, index) => ({
      index,
      label: form.getAttribute('name') || form.id || [...form.classList].find(semantic) || `form ${index + 1}`,
    })),
  };
}

async function bestLocator(page, info, group, role, name, semanticClass) {
  const candidates = [];
  const byPlaceholder = info.placeholder && { code: `getByPlaceholder(${quote(info.placeholder)})`, locator: page.getByPlaceholder(info.placeholder) };
  const byRole = role && name && { code: `getByRole('${role}', { name: ${quote(name)} })`, locator: page.getByRole(role, { name }) };
  // Conduit inputs have no labels: when the accessible name is the placeholder, the placeholder locator is preferred.
  if (group === 'fields' && byPlaceholder && (!name || name === info.placeholder)) candidates.push(byPlaceholder, byRole);
  else candidates.push(byRole, byPlaceholder);
  if (info.label) candidates.push({ code: `getByLabel(${quote(info.label)})`, locator: page.getByLabel(info.label) });
  if (info.testId) candidates.push({ code: `getByTestId(${quote(info.testId)})`, locator: page.getByTestId(info.testId) });
  if (semanticClass) candidates.push({ code: `locator('.${semanticClass}')`, locator: page.locator(`.${semanticClass}`) });

  let best;
  for (const candidate of candidates.filter(Boolean)) {
    const count = await candidate.locator.count();
    if (count === 1) return { code: candidate.code, count };
    if (count > 1 && (!best || count < best.count)) best = { code: candidate.code, count };
  }
  return best;
}

async function parsePage(context, file, opts, pageObjectFiles, counter) {
  const html = fs.readFileSync(file, 'utf-8');
  const sourceUrl = html.match(/<!--\s*saved from url=\(\d+\)(\S+?)\s*-->/i)?.[1];
  const route = sourceUrl?.includes('#') ? sourceUrl.slice(sourceUrl.indexOf('#') + 1) || '/' : undefined;
  const resourcesDir = file.replace(/\.html?$/i, '_files');
  const blockedBefore = counter.blocked;
  const page = await context.newPage();

  try {
    await page.goto(pathToFileURL(path.resolve(file)).href, { waitUntil: 'load', timeout: 30_000 });
    const title = await page.title();
    const dom = await page.evaluate(collectDom, {
      selector: SELECTOR,
      errorSelector: ERROR_SELECTOR,
      mark: MARK,
      nonSemantic: NON_SEMANTIC_CLASS.source,
    });

    const rows = [];
    const rowByKey = new Map();
    const rowByIndex = new Map();
    let hidden = 0;
    for (const info of dom.elements) {
      const element = page.locator(`[${MARK}="${info.index}"]`);
      const visible = await element.isVisible();
      if (!visible) hidden++;
      if (!visible && !opts.all) continue;
      if (info.inRepeated) {
        const item = dom.repeated.find((r) => r.cls === info.inRepeated);
        if (item) item.inner = (item.inner ?? 0) + 1;
        continue;
      }

      const { role, name } = parseSnapshot(await element.ariaSnapshot().catch(() => ''));
      const group = info.isError ? 'errors' : (GROUP_BY_ROLE[role] ?? 'content');
      const semanticClass = info.classes.find((c) => /^[a-z][a-z0-9-]{2,}$/.test(c) && !NON_SEMANTIC_CLASS.test(c));
      const best = await bestLocator(page, info, group, role, name, semanticClass);
      const key = best?.code ?? `#${info.index}`;
      if (rowByKey.has(key)) {
        rowByIndex.set(info.index, rowByKey.get(key));
        continue;
      }

      const literal = name ?? info.placeholder ?? info.label;
      const existing = existingUsages(pageObjectFiles, literal ?? (semanticClass && `.${semanticClass}`));
      const row = {
        group,
        role: role ?? info.tag,
        tag: info.tag,
        locator: best?.code,
        matches: best?.count ?? 0,
        visible,
        existing,
        header: info.inNavigation || existing.some((usage) => /components[\\/]Header\.ts$/.test(usage.file)),
        placeholder: info.placeholder,
        value: info.value,
        text: info.text,
        // Error blocks are named after their class (`errorMessages`), not after the message they show right now.
        nameSource: group === 'errors' && semanticClass ? semanticClass : (literal ?? info.text ?? semanticClass),
      };
      rows.push(row);
      rowByKey.set(key, row);
      rowByIndex.set(info.index, row);
    }

    const used = new Map();
    for (const row of rows) {
      let base = row.group === 'content' ? ({ h1: 'title', h2: 'subtitle' }[row.tag] ?? camel(row.text)) : camel(row.nameSource);
      base ||= row.tag;
      if (['errors', 'content'].includes(row.group) && RESERVED.has(base)) base = `${base}Element`;
      const count = (used.get(`${row.group}:${base}`) ?? 0) + 1;
      used.set(`${row.group}:${base}`, count);
      row.name = count > 1 ? `${base}${count}` : base;
    }

    const rootCandidates = [
      ...dom.containers.map((cls) => ({ locator: `locator('.${cls}')`, reason: 'page container that exists only once' })),
      ...rows
        .filter((r) => r.visible && r.matches === 1 && r.role === 'heading')
        .map((r) => ({ locator: r.locator, reason: 'unique heading — its text must not be test data', heading: true })),
    ];

    const perPage = new Map();
    for (const row of rows) {
      for (const pageFile of new Set(row.existing.map((u) => u.file).filter((f) => /[\\/]pages[\\/]/.test(f)))) {
        perPage.set(pageFile, (perPage.get(pageFile) ?? 0) + 1);
      }
    }
    const [existingPage, existingCount] = [...perPage].sort((a, b) => b[1] - a[1])[0] ?? [];
    const segment = route === undefined ? undefined : (route.split('/').filter(Boolean)[0] ?? 'home');
    const className = opts.name ?? (existingPage ? path.basename(existingPage, '.ts') : `${pascal(segment ?? title) ?? 'Saved'}Page`);

    const forms = dom.forms.map((form) => ({
      ...form,
      rows: [...new Set(dom.elements.filter((e) => e.form === form.index).map((e) => rowByIndex.get(e.index)).filter(Boolean))],
    }));

    const model = {
      file,
      title,
      sourceUrl,
      route,
      resources: fs.existsSync(resourcesDir) ? resourcesDir : undefined,
      blocked: counter.blocked - blockedBefore,
      hidden,
      rows,
      forms,
      repeated: dom.repeated,
      rootCandidates,
      existingPage,
      existingCount,
      className,
      snapshot: opts.snapshot ? await page.locator('body').ariaSnapshot() : undefined,
    };
    model.decisions = openDecisions(model);
    return model;
  } finally {
    await page.close();
  }
}

function openDecisions(model) {
  const decisions = [];
  const root = model.rootCandidates[0];
  if (!model.resources) {
    decisions.push('No `_files` folder next to the HTML: the page may have been saved as "HTML only", so styles and visibility can be wrong. Re-save as **Webpage, Complete** if elements are missing.');
  }
  if (model.rows.length < 3) decisions.push('Very few elements: the page was probably saved before it rendered — re-save it once the content is visible.');
  if (!root) decisions.push('No root candidate: choose an element that exists only on this page.');
  else if (root.heading) decisions.push(`Root \`${root.locator}\` relies on visible text — if the text is test data (article title, username), use a page container instead.`);
  for (const row of model.rows) {
    if (!row.locator) decisions.push(`\`${row.name}\` (${row.group}): no stable locator for <${row.tag}>${row.text ? ` "${row.text}"` : ''} — needs a decision.`);
    else if (row.matches > 1) {
      decisions.push(`\`${row.name}\` (${row.group}): \`${row.locator}\` matches ${row.matches} elements — scope it to a container or filter it; \`.first()\` only with a comment explaining why.`);
    }
  }
  const headerRows = model.rows.filter((r) => r.header);
  if (headerRows.length) {
    decisions.push(
      `Navigation elements belong to the \`Header\` component: ${headerRows.map((r) => `\`${r.name}\``).join(', ')} — use \`page.header\` in tests (add missing ones to \`Header\`); left out of the draft.`,
    );
  }
  if (model.rows.some((r) => r.group === 'errors') && model.rows.some((r) => r.group === 'fields')) {
    decisions.push('Map error locators to field names in `errors` for `verifyErrorField` (the draft keeps them as read-only locators).');
  }
  if (model.rows.some((r) => r.group === 'content' && r.locator?.includes("name: '"))) {
    decisions.push('Content locators use visible text; replace any that show test data with a container locator or a parametrised method.');
  }
  return decisions;
}

function renderDraft(model) {
  const inDraft = (r) => r.visible && !r.header && r.locator;
  const groups = GROUPS.slice(0, 4).map((g) => ({ ...g, rows: model.rows.filter((r) => r.group === g.key && inDraft(r)) }));
  const lastUsed = groups.map((g) => g.rows.length > 0).lastIndexOf(true);
  const typeArgs = groups.slice(0, lastUsed + 1).map((g) => (g.rows.length ? g.typeName : 'never'));
  const todo = (r, indent) => (r.matches > 1 ? [`${indent}// TODO: ${r.matches} matches — scope or filter`] : []);
  const root = model.rootCandidates[0];

  const lines = ["import type { Locator } from '@playwright/test';", "import { BasePage } from '@/base/BasePage';", ''];
  for (const g of groups) if (g.rows.length) lines.push(`type ${g.typeName} = ${g.rows.map((r) => `'${r.name}'`).join(' | ')};`);
  lines.push(
    '',
    `/** ${model.title || model.className} page${model.route ? ` (\`#${model.route}\`)` : ''}. Draft generated from a saved page — resolve the open decisions. */`,
    `export class ${model.className} extends BasePage${typeArgs.length ? `<${typeArgs.join(', ')}>` : ''} {`,
  );
  if (root) lines.push(`  protected readonly root = this.page.${root.locator};`);
  else lines.push('  // TODO: choose an element that exists only on this page', "  protected readonly root = this.page.locator('body');");

  for (const g of groups) {
    if (!g.rows.length) continue;
    lines.push('', `  protected readonly ${g.key}: Record<${g.typeName}, Locator> = {`);
    for (const r of g.rows) lines.push(...todo(r, '    '), `    ${r.name}: this.page.${r.locator},`);
    lines.push('  };');
  }

  const readOnly = model.rows.filter((r) => ['errors', 'content'].includes(r.group) && inDraft(r));
  if (readOnly.length) lines.push('');
  for (const r of readOnly) lines.push(...todo(r, '  '), `  readonly ${r.name}: Locator = this.page.${r.locator};`);

  const taken = new Set(model.rows.map((r) => r.name));
  for (const item of model.repeated.slice(0, 3)) {
    let method = camel(item.cls);
    if (taken.has(method) || RESERVED.has(method)) method = `${method}Item`;
    taken.add(method);
    lines.push(
      '',
      '  /**',
      `   * One of the repeated \`.${item.cls}\` items (${item.count} on the saved page).`,
      '   * @param text - text inside the item, e.g. its title',
      '   * @return locator of the item',
      '   */',
      `  ${method}(text: string): Locator {`,
      `    return this.page.locator('.${item.cls}').filter({ hasText: text });`,
      '  }',
    );
  }
  lines.push('}');
  return lines.join('\n');
}

function renderMarkdown(model, opts) {
  const out = [];
  out.push(`# ${model.className}${model.route ? ` — \`#${model.route}\`` : ''}`, '');
  out.push(
    `> Page description generated from \`${rel(model.file)}\` by \`parse-page-to-md.mjs\` (offline) on ${new Date().toISOString().slice(0, 10)}. Regenerate it after re-saving the page instead of editing it by hand.`,
    '',
  );
  out.push('| Property | Value |', '|---|---|');
  out.push(`| Title | ${cell(model.title) || '—'} |`);
  out.push(`| Source URL | ${model.sourceUrl ? cell(model.sourceUrl) : 'unknown (no "saved from url" comment)'} |`);
  out.push(`| Route | ${model.route ? `\`#${model.route}\`` : '—'} |`);
  out.push(`| Saved resources | ${model.resources ? `\`${rel(model.resources)}/\`` : '**missing** — save as "Webpage, Complete"'} |`);
  out.push(`| Elements | ${model.rows.filter((r) => r.visible).length} visible${model.hidden ? `, ${model.hidden} hidden ${opts.all ? 'included' : 'skipped'}` : ''} |`);
  out.push(
    `| Existing page object | ${model.existingPage ? `\`${model.existingPage}\` — ${model.existingCount} locator(s) already declared: extend it` : 'none found — new page object'} |`,
  );
  out.push(`| Blocked network requests | ${model.blocked} |`, '');

  out.push('## Root', '');
  if (model.rootCandidates.length) {
    model.rootCandidates.slice(0, 3).forEach((c, i) => out.push(`${i + 1}. \`this.page.${c.locator}\` — ${c.reason}`));
  } else out.push('No candidate found.');
  out.push('', '## Elements', '');

  for (const g of GROUPS) {
    const rows = model.rows.filter((r) => r.group === g.key);
    if (!rows.length) continue;
    out.push(`### ${g.title}${g.typeName ? ` (\`${g.key}\`)` : ''}`, '', '| Name | Role | Locator | Matches | Details | In src/pageObject |', '|---|---|---|---|---|---|');
    for (const r of rows) {
      const details = [
        r.placeholder && `placeholder "${r.placeholder}"`,
        r.value && `value "${r.value}"`,
        r.group !== 'fields' && r.text && `text "${r.text}"`,
        !r.visible && 'hidden',
        r.header && 'Header component',
      ]
        .filter(Boolean)
        .join('; ');
      const existing = r.existing.length ? r.existing.slice(0, 2).map((u) => `${u.file}:${u.line}`).join(', ') : '—';
      const matches = r.matches === 1 ? '1' : `**${r.matches}**`;
      out.push(`| \`${r.name}\` | ${r.role} | ${r.locator ? `\`${cell(r.locator)}\`` : '—'} | ${matches} | ${cell(details) || '—'} | ${existing} |`);
    }
    out.push('');
  }

  if (model.forms.length) {
    out.push('## Forms', '');
    for (const form of model.forms) {
      const names = (key) => form.rows.filter((r) => r.group === key).map((r) => `\`${r.name}\``).join(', ') || '—';
      out.push(`### ${form.label}`, '', `- Fields: ${names('fields')}`, `- Buttons: ${names('buttons')}`);
      if (form.rows.some((r) => r.group === 'checkboxes')) out.push(`- Checkboxes: ${names('checkboxes')}`);
      if (form.rows.some((r) => r.group === 'radioButtons')) out.push(`- Radio buttons: ${names('radioButtons')}`);
      const fields = form.rows.filter((r) => r.group === 'fields' && !r.header);
      const submit = form.rows.find((r) => r.group === 'buttons');
      if (fields.length && submit) {
        out.push('', 'Steps in a spec:', '', '```ts', `await get(${model.className}${model.route ? ', Route.<route>' : ''})`);
        out.push(...fields.map((r) => `  .fillData('${r.name}', data.${r.name})`), `  .clickActionButton('${submit.name}');`, '```');
      }
      out.push('');
    }
  }

  if (model.repeated.length) {
    out.push('## Repeated items', '', '| Class | Count | Elements inside (skipped) | Sample text | Suggested locator |', '|---|---|---|---|---|');
    for (const item of model.repeated) {
      out.push(
        `| \`.${item.cls}\` | ${item.count} | ${item.inner ?? 0} | ${cell(item.sample)} | \`this.page.locator('.${item.cls}').filter({ hasText: text })\` |`,
      );
    }
    out.push('', 'Elements inside repeated items show test data, so they are not named in the maps: reach them through the item, e.g. `homePage.button.click(homePage.articlePreview(title).getByRole(\'link\'))`.', '');
  }

  out.push('## Open decisions', '');
  if (model.decisions.length) model.decisions.forEach((d, i) => out.push(`${i + 1}. ${d}`));
  else out.push('None.');

  out.push('', '## Page object draft', '', '```ts', renderDraft(model), '```', '');
  if (model.snapshot) out.push('<details><summary>ARIA snapshot of the saved page</summary>', '', '```yaml', model.snapshot, '```', '', '</details>', '');
  return out.join('\n');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.input) {
    console.log(HELP);
    process.exit(opts.help ? 0 : 2);
  }
  if (!fs.existsSync(opts.input)) throw new Error(`Not found: ${opts.input}`);
  const files = inputFiles(opts.input);
  if (!files.length) throw new Error(`No .html files in ${opts.input}`);
  if (opts.name && files.length > 1) throw new Error('--name can be used with a single file only');

  const pageObjectFiles = listFiles(PAGE_OBJECT_DIR);
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 720 } });
    const counter = { blocked: 0 };
    await context.route('**/*', (route) => {
      if (route.request().url().startsWith('file:')) return route.continue();
      counter.blocked++;
      return route.abort();
    });

    for (const file of files) {
      const model = await parsePage(context, file, opts, pageObjectFiles, counter);
      const markdown = renderMarkdown(model, opts);
      if (opts.stdout) {
        console.log(markdown);
        continue;
      }
      const target = outputPath(file, opts, files.length > 1);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, markdown);
      console.log(`${rel(target)} — ${model.className}: ${model.rows.length} element(s), ${model.decisions.length} open decision(s)`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
