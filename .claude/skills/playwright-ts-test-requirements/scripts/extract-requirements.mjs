#!/usr/bin/env node
/**
 * Converts requirement sources into Markdown text for review and test design.
 *
 * Usage (from the project root):
 *   node extract-requirements.mjs <file | folder> [--out <folder>]
 *
 * Default output: an `extracted/` folder next to the input folder (tasks/<KEY>/requirements/extracted).
 * Converted: md, txt, csv, tsv, xlsx, docx/doc/rtf/odt/html/webarchive (textutil on macOS; docx falls back to its XML),
 * json/yaml. Listed for manual reading with the Read tool: pdf and images.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const outOption = outIndex >= 0 ? args[outIndex + 1] : undefined;
const input = args.find((a, i) => !a.startsWith('--') && (outIndex < 0 || i !== outIndex + 1));

const COPY = new Set(['.md', '.markdown', '.txt']);
const TABLE = new Set(['.csv', '.tsv']);
const TEXTUTIL = new Set(['.docx', '.doc', '.rtf', '.odt', '.html', '.htm', '.webarchive']);
const CODE = new Set(['.json', '.yaml', '.yml']);
const MANUAL = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp']);

const rel = (p) => path.relative(process.cwd(), p);
const decode = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');
const cell = (value) => String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>').trim();

function markdownTable(rows) {
  const width = Math.max(0, ...rows.map((r) => r.length));
  if (!rows.length || !width) return '_(empty)_';
  const pad = (r) => [...r, ...Array(width - r.length).fill('')].map(cell);
  const [header, ...body] = rows;
  return [`| ${pad(header).join(' | ')} |`, `|${' --- |'.repeat(width)}`, ...body.map((r) => `| ${pad(r).join(' | ')} |`)].join('\n');
}

/** RFC 4180-style parser: quoted fields, escaped quotes, separators and newlines inside quotes. */
function parseDelimited(text, separator) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === separator) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field || row.length) rows.push([...row, field]);
  return rows.filter((r) => r.some((value) => value.trim()));
}

const unzipList = (file) => execFileSync('unzip', ['-Z1', file], { encoding: 'utf8' }).split('\n').filter(Boolean);
const unzipRead = (file, entry) => execFileSync('unzip', ['-p', file, entry], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

function xlsxToMarkdown(file) {
  const entries = unzipList(file);
  const shared = entries.includes('xl/sharedStrings.xml')
    ? [...unzipRead(file, 'xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(([, si]) =>
        decode([...si.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join('')),
      )
    : [];
  const workbook = unzipRead(file, 'xl/workbook.xml');
  const rels = unzipRead(file, 'xl/_rels/workbook.xml.rels');
  const targets = Object.fromEntries([...rels.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)].map((m) => [m[1], m[2]]));
  const sheets = [...workbook.matchAll(/<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)].map((m) => ({ name: decode(m[1]), target: targets[m[2]] }));

  return sheets
    .map(({ name, target }) => {
      const entry = `xl/${target.replace(/^\/?xl\//, '')}`;
      const xml = unzipRead(file, entry);
      const rows = [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map(([, rowXml]) => {
        const values = [];
        for (const [, attrs, body] of rowXml.matchAll(/<c([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
          const ref = attrs.match(/r="([A-Z]+)\d+"/)?.[1] ?? '';
          const index = [...ref].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
          const type = attrs.match(/t="(\w+)"/)?.[1];
          let value = '';
          if (type === 'inlineStr') value = [...(body ?? '').matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join('');
          else {
            const raw = (body ?? '').match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? '';
            value = type === 's' ? (shared[Number(raw)] ?? '') : raw;
          }
          values[index >= 0 ? index : values.length] = decode(value);
        }
        return Array.from(values, (v) => v ?? '');
      });
      return `## Sheet: ${name}\n\n${markdownTable(rows)}`;
    })
    .join('\n\n');
}

function textutilToText(file) {
  return execFileSync('textutil', ['-convert', 'txt', '-stdout', file], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function docxXmlToText(file) {
  const xml = unzipRead(file, 'word/document.xml');
  return decode(
    xml
      .replace(/<w:tab\/>/g, '\t')
      .replace(/<w:br[^>]*\/>/g, '\n')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function convert(file) {
  const ext = path.extname(file).toLowerCase();
  const text = () => fs.readFileSync(file, 'utf8');
  if (COPY.has(ext)) return { body: text(), how: 'copied' };
  if (TABLE.has(ext)) return { body: markdownTable(parseDelimited(text(), ext === '.tsv' ? '\t' : ',')), how: 'table' };
  if (ext === '.xlsx') return { body: xlsxToMarkdown(file), how: 'xlsx sheets' };
  if (CODE.has(ext)) return { body: `\`\`\`${ext.slice(1)}\n${text()}\n\`\`\``, how: 'code block' };
  if (TEXTUTIL.has(ext)) {
    try {
      return { body: textutilToText(file), how: 'textutil' };
    } catch (error) {
      if (ext === '.docx') return { body: docxXmlToText(file), how: 'docx XML (textutil unavailable)' };
      throw error;
    }
  }
  return undefined;
}

function main() {
  if (!input || !fs.existsSync(input)) {
    console.error('Usage: node extract-requirements.mjs <file | folder> [--out <folder>]');
    process.exit(2);
  }
  const isDir = fs.statSync(input).isDirectory();
  const files = isDir
    ? fs
        .readdirSync(input, { withFileTypes: true })
        .filter((e) => e.isFile() && !e.name.startsWith('.'))
        .map((e) => path.join(input, e.name))
        .sort()
    : [input];
  const outDir = outOption ?? path.join(path.dirname(isDir ? path.resolve(input) : path.dirname(path.resolve(input))), 'extracted');
  fs.mkdirSync(outDir, { recursive: true });

  const converted = [];
  const manual = [];
  const failed = [];
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (MANUAL.has(ext)) {
      manual.push(file);
      continue;
    }
    try {
      const result = convert(file);
      if (!result) {
        failed.push(`${rel(file)} — unsupported format ${ext || '(no extension)'}`);
        continue;
      }
      const target = path.join(outDir, `${path.basename(file)}.md`);
      const header = `<!-- Extracted from ${rel(file)} (${result.how}) on ${new Date().toISOString().slice(0, 10)}. Edit the source, not this file. -->\n\n# ${path.basename(file)}\n\n`;
      fs.writeFileSync(target, `${header}${result.body.trim()}\n`);
      converted.push(`${rel(file)} → ${rel(target)} (${result.how}, ${result.body.split(/\s+/).filter(Boolean).length} words)`);
    } catch (error) {
      failed.push(`${rel(file)} — ${String(error.message ?? error).split('\n')[0]}`);
    }
  }

  console.log(`# Requirement sources: ${files.length} file(s)\n`);
  if (converted.length) console.log(`## Converted\n${converted.map((l) => `- ${l}`).join('\n')}\n`);
  if (manual.length) console.log(`## Read directly with the Read tool\n${manual.map((f) => `- ${rel(f)}${path.extname(f).toLowerCase() === '.pdf' ? ' (use pages ranges for more than 10 pages)' : ''}`).join('\n')}\n`);
  if (failed.length) console.log(`## Not converted\n${failed.map((l) => `- ${l}`).join('\n')}\n`);
}

main();
