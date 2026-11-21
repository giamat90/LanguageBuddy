#!/usr/bin/env node
/**
 * Writes a readable sample of the bank for a native reader: scripts/wordbank/<lang>/review/sample-<LEVEL>.md,
 * `--per` random rows per level (default 40), deterministic for a seed (default 1).
 * Usage: node scripts/export-review-sample.mjs --lang es [--per 40] [--seed 1] [--bank <dir>] [--out <dir>]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const lang = opt('--lang', 'de');
const per = Number(opt('--per', '40'));
let seed = Number(opt('--seed', '1'));
const bankDir = opt('--bank', join(here, '..', 'src', 'data', 'wordbank', lang));
const outDir = opt('--out', join(here, 'wordbank', lang, 'review'));
mkdirSync(outDir, { recursive: true });

const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const cell = (s) => String(s ?? '').replace(/\|/g, '\|').replace(/\s+/g, ' ');

for (const level of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) {
  const file = join(bankDir, `${level}.json`);
  if (!existsSync(file)) continue;
  const entries = JSON.parse(readFileSync(file, 'utf8'));
  const idx = entries.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const rows = idx.slice(0, per).sort((a, b) => a - b).map((i) => entries[i]);
  const lines = [
    `# ${lang} ${level}: ${rows.length} of ${entries.length} entries for review`,
    '',
    'Mark each row OK or write the fix. Check: the Spanish is natural and neutral, the Italian is right, the note is true, the grammar tag fits the sentence.',
    '',
    '| word | article | pos | example | example_it | note_it | rule |',
    '|---|---|---|---|---|---|---|',
    ...rows.map((e) => `| ${[e.word, e.article ?? '-', e.part_of_speech, e.example, e.example_it, e.cultural_note, e.grammar_angle].map(cell).join(' | ')} |`),
    '',
  ];
  writeFileSync(join(outDir, `sample-${level}.md`), lines.join('\n'));
  console.log(`${level}: ${rows.length}`);
}
