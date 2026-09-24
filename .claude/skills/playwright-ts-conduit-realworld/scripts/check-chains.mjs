import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2] ?? 'tests/ui';
const chainEnd = /^\s+await get\((\w+Page)(?:, [^;]*)?\)(?:\.\w+\([^;]*\))*;$/;
const sameStep =
  /^\s+await get\((\w+Page)\)\.(fillData|clickActionButton|checkCheckbox|uncheckCheckbox|clickRadioButton|verify\w+|waitUntilPageLoaded|navigate)\(/;

let hits = 0;
for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.spec.ts'))) {
  const lines = fs.readFileSync(path.join(dir, file), 'utf8').split('\n');
  lines.forEach((line, index) => {
    const previous = index > 0 ? chainEnd.exec(lines[index - 1]) : null;
    const current = sameStep.exec(line);
    if (previous && current && previous[1] === current[1]) {
      hits++;
      console.log(`${path.join(dir, file)}:${index + 1}: ${line.trim()}`);
    }
  });
}
console.log(`${hits} statement(s) can join the chain above`);
process.exitCode = hits ? 1 : 0;
