#!/usr/bin/env node
/**
 * Validates the bundled word bank JSON files.
 * Runs automatically before `npm test` (see package.json "pretest").
 *
 * To extend the bank: add entries to src/data/wordbank/<LEVEL>.json following the
 * same object shape, keep `word` unique within a level, bump WORDBANK_VERSION in
 * src/data/wordbank/index.ts, then run `npm run validate:wordbank`.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const bankDir = join(here, '..', 'src', 'data', 'wordbank');

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const RULE_CODES = new Set([
  'VERB_CONJ_REGULAR', 'NOUN_GENDER', 'WORD_ORDER_V2', 'NEGATION_NICHT_KEIN',
  'VERB_CONJ_IRREGULAR', 'ACCUSATIVE_MASC', 'ACCUSATIVE_PREP', 'SEPARABLE_VERB',
  'DATIV_PREP', 'DATIV_INDIRECT_OBJ', 'MODAL_VERB', 'PERF_SEIN_HABEN', 'SUBORD_VERB_FINAL',
  'KONJUNKTIV_II', 'GENITIV_CASE', 'PASSIVE_VOICE',
  'KONJUNKTIV_I', 'EXTENDED_ATTR',
]);
const TOPICS = new Set(['food', 'travel', 'work', 'culture', 'home', 'leisure', 'health', 'shopping']);
const POS = new Set(['noun', 'verb', 'adj', 'prep', 'conj', 'adv']);
const STRING_FIELDS = [
  'word', 'part_of_speech', 'ipa', 'meaning_en', 'meaning_it',
  'example_de', 'example_it', 'cultural_note', 'grammar_angle',
  'topic_domain', 'cefr_band', 'session_scenario',
  'example_en', 'cultural_note_en',
];

const errors = [];
let total = 0;

for (const level of LEVELS) {
  const file = join(bankDir, `${level}.json`);
  let entries;
  try {
    entries = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    errors.push(`${level}.json: not valid JSON — ${e.message}`);
    continue;
  }
  if (!Array.isArray(entries)) {
    errors.push(`${level}.json: top level must be an array`);
    continue;
  }
  const seen = new Set();
  entries.forEach((entry, i) => {
    total++;
    const at = `${level}.json[${i}] (${entry?.word ?? '?'})`;
    for (const f of STRING_FIELDS) {
      if (typeof entry[f] !== 'string' || entry[f].trim() === '') {
        errors.push(`${at}: field "${f}" must be a non-empty string`);
      }
    }
    if (!('article' in entry) || (entry.article !== null && typeof entry.article !== 'string')) {
      errors.push(`${at}: field "article" must be a string or null`);
    }
    if (!POS.has(entry.part_of_speech)) errors.push(`${at}: invalid part_of_speech "${entry.part_of_speech}"`);
    if (!RULE_CODES.has(entry.grammar_angle)) errors.push(`${at}: invalid grammar_angle "${entry.grammar_angle}"`);
    if (!TOPICS.has(entry.topic_domain)) errors.push(`${at}: invalid topic_domain "${entry.topic_domain}"`);
    if (entry.cefr_band !== level) errors.push(`${at}: cefr_band "${entry.cefr_band}" must equal "${level}"`);
    if (entry.part_of_speech === 'noun' && !entry.article) {
      errors.push(`${at}: nouns must have an article`);
    }
    if (entry.part_of_speech !== 'noun' && entry.article) {
      errors.push(`${at}: only nouns may have an article`);
    }
    const key = entry.word?.toLowerCase();
    if (seen.has(key)) errors.push(`${at}: duplicate word within ${level}`);
    seen.add(key);
  });
}

// ─── translated content (TASK-025): every JSON present must be complete and clean
const require = createRequire(import.meta.url);
const i18n = require('./wordbank-i18n-lib.cjs');
const i18nDir = join(bankDir, 'i18n');
let i18nCount = 0;
if (existsSync(i18nDir) && errors.length === 0) {
  const bank = Object.fromEntries(
    LEVELS.map((l) => [l, JSON.parse(readFileSync(join(bankDir, `${l}.json`), 'utf8'))]),
  );
  for (const file of readdirSync(i18nDir).filter((f) => f.endsWith('.json'))) {
    const lang = file.replace(/\.json$/, '');
    if (!i18n.LANGS.includes(lang)) {
      errors.push(`i18n/${file}: not a supported language code`);
      continue;
    }
    let table;
    try {
      table = JSON.parse(readFileSync(join(i18nDir, file), 'utf8'));
    } catch (e) {
      errors.push(`i18n/${file}: not valid JSON — ${e.message}`);
      continue;
    }
    const shapeOk = Object.values(table).every(
      (v) => Array.isArray(v) && v.length === 3 && v.every((s) => typeof s === 'string'),
    );
    if (!shapeOk) {
      errors.push(`i18n/${file}: every value must be [meaning, example, note] strings`);
      continue;
    }
    const rows = i18n.rowsFromTable(table, bank);
    const extra = Object.keys(table).length - rows.length;
    if (extra > 0) errors.push(`i18n/${file}: ${extra} key(s) not in the word bank`);
    i18n.validateLanguage({ lang, rows, bank }).forEach((p) => errors.push(`i18n/${lang}: ${p}`));
    i18nCount++;
  }
}

if (errors.length) {
  console.error(`\n✗ Word bank validation failed (${errors.length} problem(s)):\n`);
  for (const e of errors) console.error('  - ' + e);
  console.error('');
  process.exit(1);
}
console.log(
  `✓ Word bank valid — ${total} entries across ${LEVELS.length} levels` +
    (i18nCount ? `, ${i18nCount} translated language(s).` : '.'),
);
