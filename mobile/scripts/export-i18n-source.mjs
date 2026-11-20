#!/usr/bin/env node
/**
 * Writes the translators' source sheets: scripts/wordbank/i18n-source/<LEVEL>.tsv with
 *   LEVEL  word  article  part_of_speech  meaning_en  example_de  example_en  note_en
 * one line per bank entry, in bank order. Re-run after the word bank changes.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const bankDir = join(here, '..', 'src', 'data', 'wordbank');
const outDir = join(here, 'wordbank', 'i18n-source');
mkdirSync(outDir, { recursive: true });

for (const level of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) {
  const entries = JSON.parse(readFileSync(join(bankDir, `${level}.json`), 'utf8'));
  const lines = entries.map((e) =>
    [level, e.word, e.article ?? '-', e.part_of_speech, e.meaning_en, e.example_de, e.example_en, e.cultural_note_en].join('\t'),
  );
  writeFileSync(join(outDir, `${level}.tsv`), lines.join('\n') + '\n');
  console.log(`${level}: ${lines.length}`);
}
