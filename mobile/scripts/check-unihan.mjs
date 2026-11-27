/**
 * Compare the readings of the Chinese character table with Unicode's Unihan database (TASK-077).
 *
 *   npm run check:unihan [-- path/to/Unihan_Readings.txt]
 *
 * Download Unihan.zip from https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip by hand and put
 * Unihan_Readings.txt in the gitignored scripts/reference-lists/. Reads only; changes nothing.
 */
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const { parseReadings, readingProblems } = createRequire(import.meta.url)('./lib/unihan.js');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = process.argv[2] ? resolve(process.argv[2]) : join(root, 'scripts', 'reference-lists', 'Unihan_Readings.txt');

if (!existsSync(file)) {
  console.error(
    `No file at ${file}\nDownload https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip and put its Unihan_Readings.txt `
      + 'at mobile/scripts/reference-lists/Unihan_Readings.txt',
  );
  process.exit(2);
}

const rows = JSON.parse(readFileSync(join(root, 'src', 'data', 'wordbank', 'zh', 'characters.json'), 'utf8'));
const problems = readingProblems(rows, parseReadings(readFileSync(file, 'utf8')));
for (const p of problems) console.log(p);
console.log(`${rows.length} characters checked, ${problems.length} readings to look at`);
process.exit(problems.length ? 1 : 0);
