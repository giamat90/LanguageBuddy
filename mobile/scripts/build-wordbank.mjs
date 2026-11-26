#!/usr/bin/env node
/**
 * Builds src/data/wordbank/<lang>/<LEVEL>.json from the compact TSV sources in
 * scripts/wordbank/<lang>/<LEVEL>.tsv (the editable source of truth), for every language folder
 * that has a language.json. Translated content: scripts/wordbank/<lang>/i18n/<native>/<LEVEL>.tsv
 * becomes src/data/wordbank/<lang>/i18n/<native>.json.
 *
 * TSV columns (tab-separated, no header, one entry per line):
 *   word  article  part_of_speech  ipa  meaning_en  meaning_it
 *   example  example_it  cultural_note  grammar_angle  topic_domain  session_scenario
 *   example_en  cultural_note_en
 * Use "-" for a null article (non-nouns). Blank lines and lines starting with # are ignored.
 *
 * language.json may add (TASK-072): "extraColumns" (appended in order, see EXTRA), "segmented"
 * (the example is written with a separator between words and punctuation) and "characters": true
 * (characters.tsv becomes characters.json, columns: see CHARACTER_COLS; every entry gets the
 * `syllables` of its headword).
 *
 * Options: --root <dir> --out <dir> (tests; the active-language seams are then left alone),
 *          --lang <code> (only that language). BUDDY_LANG picks the active language (default de).
 * Run: npm run build:wordbank   (also runs on pretest, before the validator)
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { setActiveLanguage, LEVELS as ALL_LEVELS } from './lib/active-language.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const i18n = require('./wordbank-i18n-lib.cjs');
const { syllablesFor } = require('./lib/pinyin.js');
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const custom = opt('--root') !== undefined || opt('--out') !== undefined;
const srcRoot = opt('--root') ?? join(here, 'wordbank');
const outRoot = opt('--out') ?? join(here, '..', 'src', 'data', 'wordbank');

const COLS = [
  'word', 'article', 'part_of_speech', 'ipa', 'meaning_en', 'meaning_it',
  'example', 'example_it', 'cultural_note', 'grammar_angle', 'topic_domain',
  'session_scenario', 'example_en', 'cultural_note_en',
];

/** Extra columns a language may declare, and the JSON value each cell becomes. */
const EXTRA = {
  example_pinyin: (v) => v,
  measure: (v) => (v === '-' || v === '' ? null : v),
  measure_also: (v) => (v === '-' ? [] : v.split(/\s+/).filter(Boolean)),
  stage: (v) => Number(v),
};
const CHARACTER_COLS = [
  'char', 'pinyin', 'meaning_en', 'meaning_it', 'parts', 'parts_en', 'parts_it', 'lookalikes', 'trick_en', 'trick_it',
];

/** One characters.tsv row as the app will read it. A part without a gloss keeps it empty for the validator. */
function characterEntry(c) {
  const optional = (v) => (v === '-' || v === '' ? null : v);
  const words = (v) => optional(v)?.split(/\s+/) ?? [];
  const glosses = (v) => optional(v)?.split(';').map((g) => g.trim()) ?? [];
  const chars = words(c.parts);
  const en = glosses(c.parts_en);
  const it = glosses(c.parts_it);
  const count = Math.max(chars.length, en.length, it.length);
  return {
    char: c.char,
    pinyin: c.pinyin.split(/\s+/).filter(Boolean),
    meaning_en: c.meaning_en,
    meaning_it: c.meaning_it,
    parts: Array.from({ length: count }, (_, i) => ({ char: chars[i] ?? '', en: en[i] ?? '', it: it[i] ?? '' })),
    lookalikes: words(c.lookalikes),
    trick_en: optional(c.trick_en),
    trick_it: optional(c.trick_it),
  };
}

let totalOut = 0;
const problems = [];

const folders = readdirSync(srcRoot).filter((d) => statSync(join(srcRoot, d)).isDirectory());
const wanted = opt('--lang');
for (const lang of folders) {
  if (wanted && lang !== wanted) continue;
  const srcDir = join(srcRoot, lang);
  const outDir = join(outRoot, lang);
  const cfgPath = join(srcDir, 'language.json');
  if (!existsSync(cfgPath)) {
    problems.push(`${lang}: language.json missing in ${srcDir}`);
    continue;
  }
  const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
  // A draft language is built from the levels it already has; with none it is skipped.
  if (cfg.draft && !(cfg.levels ?? ALL_LEVELS).some((l) => existsSync(join(srcDir, `${l}.tsv`)))) {
    console.log(`skipped draft language ${lang}`);
    continue;
  }
  const CONFIGURED = cfg.levels ?? ALL_LEVELS;
  const LEVELS = [];
  const extra = cfg.extraColumns ?? [];
  const unknown = extra.filter((c) => !Object.hasOwn(EXTRA, c));
  if (unknown.length) {
    problems.push(`${lang}: unknown extra column(s) in language.json: ${unknown.join(', ')}`);
    continue;
  }
  const columns = [...COLS, ...extra];
  mkdirSync(outDir, { recursive: true });
  console.log(`${lang}:`);

  // Characters come first: the headwords' syllables are derived from their readings.
  let readings = null;
  if (cfg.characters) {
    const file = join(srcDir, 'characters.tsv');
    if (!existsSync(file)) {
      problems.push(`${lang}: characters.tsv missing`);
    } else {
      const rows = [];
      readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, idx) => {
        if (!line.trim() || line.startsWith('#')) return;
        const parts = line.split('\t').map((p) => p.trim());
        if (parts.length !== CHARACTER_COLS.length) {
          problems.push(`${lang}/characters.tsv:${idx + 1} has ${parts.length} columns, expected ${CHARACTER_COLS.length}`);
          return;
        }
        rows.push(characterEntry(Object.fromEntries(CHARACTER_COLS.map((c, i) => [c, parts[i]]))));
      });
      readings = new Map(rows.map((r) => [r.char, r.pinyin]));
      writeFileSync(join(outDir, 'characters.json'), JSON.stringify(rows, null, 2) + '\n');
      console.log(`  characters: ${rows.length}`);
    }
  }

  for (const level of CONFIGURED) {
    const tsvPath = join(srcDir, `${level}.tsv`);
    if (!existsSync(tsvPath)) {
      if (cfg.draft) console.log(`${lang}: no ${level}.tsv (draft)`);
      else problems.push(`${lang}: ${level}.tsv missing`);
      continue;
    }
    LEVELS.push(level);
    const raw = readFileSync(tsvPath, 'utf8');
    const entries = [];
    const seen = new Set();
    raw.split(/\r?\n/).forEach((line, idx) => {
      if (!line.trim() || line.startsWith('#')) return;
      const parts = line.split('\t');
      if (parts.length !== columns.length) {
        problems.push(`${lang}/${level}.tsv:${idx + 1} has ${parts.length} columns, expected ${columns.length}`);
        return;
      }
      const e = {};
      columns.forEach((c, i) => (e[c] = parts[i].trim()));
      // A segmented example is written cut into words; the sentence is those pieces joined.
      const segments = cfg.segmented ? e.example.split(cfg.segmented.separator).filter((s) => s !== '') : null;
      if (segments) e.example = segments.join('');
      e.article = e.article === '-' || e.article === '' ? null : e.article;
      e.cefr_band = level;
      const key = e.word.toLowerCase();
      if (seen.has(key)) {
        problems.push(`${lang}/${level}.tsv:${idx + 1} duplicate word "${e.word}"`);
        return;
      }
      seen.add(key);
      entries.push({
        word: e.word,
        article: e.article,
        part_of_speech: e.part_of_speech,
        ipa: e.ipa,
        meaning_en: e.meaning_en,
        meaning_it: e.meaning_it,
        example: e.example,
        ...(segments ? { segments } : {}),
        example_it: e.example_it,
        cultural_note: e.cultural_note,
        grammar_angle: e.grammar_angle,
        topic_domain: e.topic_domain,
        cefr_band: level,
        session_scenario: e.session_scenario,
        example_en: e.example_en,
        cultural_note_en: e.cultural_note_en,
        ...Object.fromEntries(extra.map((c) => [c, EXTRA[c](e[c])])),
        // null (pinyin that does not spell the word) is left for the validator to report
        ...(readings ? { syllables: syllablesFor(e.ipa, e.word, readings, cfg.pinyin ?? {}) } : {}),
      });
    });
    writeFileSync(join(outDir, `${level}.json`), JSON.stringify(entries, null, 2) + '\n');
    totalOut += entries.length;
    console.log(`  ${level}: ${entries.length} entries`);
  }

  // translated content (TASK-025): <lang>/i18n/<native>/<LEVEL>.tsv → <lang>/i18n/<native>.json
  const i18nSrc = join(srcDir, 'i18n');
  const i18nOut = join(outDir, 'i18n');
  if (existsSync(i18nSrc) && problems.length === 0) {
    const bank = Object.fromEntries(
      LEVELS.map((l) => [l, JSON.parse(readFileSync(join(outDir, `${l}.json`), 'utf8'))]),
    );
    mkdirSync(i18nOut, { recursive: true });
    for (const native of readdirSync(i18nSrc)) {
      const dir = join(i18nSrc, native);
      if (!(cfg.i18nLanguages ?? i18n.LANGS).includes(native)) {
        problems.push(`${lang}/i18n/${native}: not a supported language code`);
        continue;
      }
      const rows = [];
      let broken = false;
      for (const level of LEVELS) {
        const file = join(dir, `${level}.tsv`);
        if (!existsSync(file)) {
          problems.push(`${lang}/i18n/${native}/${level}.tsv missing`);
          broken = true;
          continue;
        }
        const parsed = i18n.parseTsv(readFileSync(file, 'utf8'), level);
        parsed.problems.forEach((p) => problems.push(`${lang}/i18n/${native}/${p}`));
        rows.push(...parsed.rows);
      }
      if (broken) continue;
      const found = i18n.validateLanguage({ lang: native, rows, bank, levels: LEVELS });
      found.forEach((p) => problems.push(`${lang}/i18n/${native}: ${p}`));
      if (found.length === 0) {
        writeFileSync(join(i18nOut, `${native}.json`), JSON.stringify(i18n.buildTable(rows)) + '\n');
        console.log(`  i18n ${native}: ${rows.length} entries`);
      }
    }
  }
}

if (problems.length === 0 && !custom) {
  const active = process.env.BUDDY_LANG ?? 'de';
  const res = setActiveLanguage(active, { root: srcRoot, src: join(here, '..', 'src'), nativeCodes: i18n.LANGS });
  res.problems.forEach((p) => problems.push(`active language: ${p}`));
}

if (problems.length) {
  console.error(`\n✗ Word bank build had ${problems.length} problem(s):`);
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log(`✓ Built word bank — ${totalOut} entries.`);
