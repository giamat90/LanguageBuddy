#!/usr/bin/env node
/**
 * Writes the translators' source sheets: scripts/wordbank/<lang>/i18n-source/<LEVEL>.tsv with
 *   LEVEL  word  article  part_of_speech  meaning_en  example  example_en  note_en
 * one line per bank entry, in bank order. Re-run after the word bank changes.
 * Usage: node scripts/export-i18n-source.mjs [--lang de]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const langIdx = process.argv.indexOf('--lang');
const lang = langIdx >= 0 ? process.argv[langIdx + 1] : 'de';
const bankDir = join(here, '..', 'src', 'data', 'wordbank', lang);
const outDir = join(here, 'wordbank', lang, 'i18n-source');
mkdirSync(outDir, { recursive: true });

for (const level of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) {
  const entries = JSON.parse(readFileSync(join(bankDir, `${level}.json`), 'utf8'));
  const lines = entries.map((e) =>
    [level, e.word, e.article ?? '-', e.part_of_speech, e.meaning_en, e.example, e.example_en, e.cultural_note_en].join('\t'),
  );
  writeFileSync(join(outDir, `${level}.tsv`), lines.join('\n') + '\n');
  console.log(`${level}: ${lines.length}`);
}
