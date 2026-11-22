#!/usr/bin/env node
/**
 * Validates the bundled word bank JSON files of every language (src/data/wordbank/<lang>/).
 * Runs automatically before `npm test` (see package.json "pretest").
 *
 * Per-language rules (grammar rule codes, parts of speech, articles, levels) come from
 * scripts/wordbank/<lang>/language.json. To extend a bank: edit the TSVs in
 * scripts/wordbank/<lang>/, run `npm run build:wordbank`, bump WORDBANK_VERSION in
 * src/data/wordbank/index.ts, then run `npm run validate:wordbank`.
 *
 * Options: --root <dir> (default scripts/wordbank), --out <dir> (default src/data/wordbank), --lang <code>.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const srcRoot = opt('--root') ?? join(here, 'wordbank');
const bankRoot = opt('--out') ?? join(here, '..', 'src', 'data', 'wordbank');

const ALL_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const TOPICS = new Set(['food', 'travel', 'work', 'culture', 'home', 'leisure', 'health', 'shopping']);
const STRING_FIELDS = [
  'word', 'part_of_speech', 'ipa', 'meaning_en', 'meaning_it',
  'example', 'example_it', 'cultural_note', 'grammar_angle',
  'topic_domain', 'cefr_band', 'session_scenario',
  'example_en', 'cultural_note_en',
];

const require = createRequire(import.meta.url);
const i18n = require('./wordbank-i18n-lib.cjs');
const errors = [];
let total = 0;
let i18nCount = 0;
let languages = 0;

/** Lower-case, accent-free form used for the "same word" checks of languages that ask for it. */
const fold = (s) => s.toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC');
const BS = String.fromCharCode(92);
const escapeRe = (s) => s.split('').map((c) => ('.*+?^${}()|[]'.includes(c) || c === BS ? BS + c : c)).join('');

/** Forms an adjective may take in a sentence: itself, feminine/plural by the usual endings, and the listed irregular ones. */
function adjectiveCandidates(word, pairs) {
  const out = new Set([word, word + 'e', word + 's', word + 'es', word + 'x']);
  for (const [masc, fem] of pairs) {
    if (!word.endsWith(masc)) continue;
    const base = word.slice(0, word.length - masc.length);
    out.add(base + fem);
    out.add(base + fem + 's');
  }
  return out;
}

/** Content rules of a language's example sentences (language.json `exampleRules`); returns problem texts. */
function exampleProblems(entry, rules) {
  const out = [];
  const ex = entry.example.trim();
  const words = ex.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);
  const tokens = ex.split(/[ \t\r\n]+/);
  const word = entry.word.toLowerCase();
  const joined = ' ' + words.join(' ') + ' ';
  let found = joined.includes(' ' + word.split(/[^\p{L}]+/u).join(' ') + ' ');
  if (!found && entry.part_of_speech === 'verb') {
    let stem;
    if (rules.verbEndings) {
      // Pronominal headwords carry their particle (se souvenir); the stem is that of the verb itself.
      const bare = word.replace(/^(se |s')\s*/, '');
      stem = bare.replace(new RegExp('(' + rules.verbEndings.join('|') + ')$'), '');
    } else {
      stem = word.replace(/(ar|er|ir)(se)?$/, '');
    }
    found = stem.length >= (rules.stemMinLength ?? 3) && words.some((w) => w.startsWith(stem));
  }
  if (!found && entry.part_of_speech === 'adj') {
    if (rules.adjectiveForms) {
      const forms = adjectiveCandidates(word, rules.adjectiveForms);
      found = words.some((w) => forms.has(w));
    } else if (word.endsWith('o')) {
      const stem = word.slice(0, -1);
      found = words.some((w) => w === stem + 'a' || w === stem + 'os' || w === stem + 'as');
    }
  }
  if (!found) out.push('example must contain the word or its stem');
  if (tokens.length < rules.minTokens || tokens.length > rules.maxTokens) {
    out.push(`example has ${tokens.length} tokens (${rules.minTokens}–${rules.maxTokens})`);
  }
  const first = ex.replace(/^[¿¡"«(\s  ]+/, '').charAt(0);
  if (!first || first === first.toLowerCase() || !/[.?!]$/.test(ex)) out.push('example must start upper-case and end with . ? or !');
  for (const re of rules.forbidden ?? []) {
    if (new RegExp(re, 'iu').test(ex)) out.push(`example uses forbidden form /${re}/`);
  }
  if (rules.invertedQuestionMarks !== false && ex.includes('¿') !== ex.includes('?')) out.push('"¿" and "?" must come together');
  if (rules.straightApostrophe && ex.includes('’')) out.push("apostrophe must be straight '");
  if (rules.nbspBefore) {
    if (/ {2,}/.test(ex)) out.push('example has a double space');
    for (const mark of rules.nbspBefore) {
      const m = escapeRe(mark);
      if (new RegExp(' ' + m).test(ex)) out.push(`ordinary space before ${mark}`);
      else if (new RegExp(String.raw`[\p{L}\p{N})»"']` + m, 'u').test(ex)) out.push(`missing no-break space before ${mark}`);
    }
  }
  return out;
}

const wanted = opt('--lang');
const folders = readdirSync(srcRoot).filter((d) => statSync(join(srcRoot, d)).isDirectory());
for (const lang of folders) {
  if (wanted && lang !== wanted) continue;
  const cfgPath = join(srcRoot, lang, 'language.json');
  if (!existsSync(cfgPath)) {
    errors.push(`${lang}: language.json missing`);
    continue;
  }
  const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
  if (cfg.draft && !(cfg.levels ?? ALL_LEVELS).some((l) => existsSync(join(bankRoot, lang, `${l}.json`)))) {
    console.log(`skipped draft language ${lang}`);
    continue;
  }
  languages++;
  // A draft language is checked for the levels it already has; any other must have them all.
  const LEVELS = (cfg.levels ?? ALL_LEVELS).filter((l) => !cfg.draft || existsSync(join(bankRoot, lang, `${l}.json`)));
  const RULES = cfg.exampleRules;
  const RULE_CODES = new Set(cfg.ruleCodes);
  const POS = new Set(cfg.partsOfSpeech);
  const ARTICLES = new Set(cfg.articles);
  const bankDir = join(bankRoot, lang);
  const firstLevel = new Map();
  const before = errors.length;

  for (const level of LEVELS) {
    const file = join(bankDir, `${level}.json`);
    const tag = `${lang}/${level}.json`;
    let entries;
    try {
      entries = JSON.parse(readFileSync(file, 'utf8'));
    } catch (e) {
      errors.push(`${tag}: not valid JSON — ${e.message}`);
      continue;
    }
    if (!Array.isArray(entries)) {
      errors.push(`${tag}: top level must be an array`);
      continue;
    }
    const seen = new Set();
    entries.forEach((entry, i) => {
      total++;
      const at = `${tag}[${i}] (${entry?.word ?? '?'})`;
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
      const levelRule = cfg.levelRules?.[level];
      if (levelRule?.allowedCodes && !levelRule.allowedCodes.includes(entry.grammar_angle)) {
        errors.push(`${at}: grammar_angle ${entry.grammar_angle} is not allowed at ${level}`);
      }
      const sameKey = (w) => (cfg.uniqueAcrossLevels === 'folded' ? fold(w) : w.toLowerCase());
      if (cfg.uniqueAcrossLevels && typeof entry.word === 'string') {
        const other = firstLevel.get(sameKey(entry.word));
        if (other && other !== level) errors.push(`${at}: word "${entry.word}" also appears in ${other}`);
        else firstLevel.set(sameKey(entry.word), level);
      }
      if (RULES && typeof entry.example === 'string') {
        exampleProblems(entry, { ...RULES, maxTokens: levelRule?.maxTokens ?? RULES.maxTokens }).forEach((p) => errors.push(`${at}: ${p}`));
      }
      const check = cfg.ruleChecks?.[entry.grammar_angle];
      if (check && typeof entry.example === 'string') {
        const words = entry.example.toLowerCase().split(/[^\p{L}]+/u);
        if (!check.mustContainAny.some((f) => words.includes(f.toLowerCase()))) {
          errors.push(`${at}: example for ${entry.grammar_angle} has none of its forms`);
        }
        if (check.exactlyOneOf && words.filter((w) => check.exactlyOneOf.includes(w)).length !== 1) {
          errors.push(`${at}: example for ${entry.grammar_angle} must contain exactly one of ${check.exactlyOneOf.join('/')}`);
        }
        const joined = ' ' + words.join(' ') + ' ';
        if (check.noElision) {
          const forms = check.mustContainAny.map(escapeRe).join('|');
          if (new RegExp(String.raw`\p{L}['’](` + forms + String.raw`)(?!\p{L})`, 'iu').test(entry.example)) {
            errors.push(`${at}: example for ${entry.grammar_angle} uses its form inside an elision`);
          }
        }
        const phrase = (check.forbiddenPhrases ?? []).find((p) => joined.includes(' ' + p + ' '));
        if (phrase) errors.push(`${at}: example for ${entry.grammar_angle} uses a fixed phrase (${phrase})`);
      }
      if (!TOPICS.has(entry.topic_domain)) errors.push(`${at}: invalid topic_domain "${entry.topic_domain}"`);
      if (entry.cefr_band !== level) errors.push(`${at}: cefr_band "${entry.cefr_band}" must equal "${level}"`);
      if (entry.part_of_speech === 'noun' && !entry.article) {
        errors.push(`${at}: nouns must have an article`);
      }
      if (entry.part_of_speech === 'noun' && entry.article && !ARTICLES.has(entry.article)) {
        errors.push(`${at}: invalid article "${entry.article}" for ${lang}`);
      }
      if (entry.part_of_speech !== 'noun' && entry.article) {
        errors.push(`${at}: only nouns may have an article`);
      }
      const key = typeof entry.word === 'string' ? sameKey(entry.word) : undefined;
      if (seen.has(key)) errors.push(`${at}: duplicate word within ${level}`);
      seen.add(key);
    });
  }

  // translated content (TASK-025): every JSON present must be complete and clean
  const i18nDir = join(bankDir, 'i18n');
  if (existsSync(i18nDir) && errors.length === before) {
    const bank = Object.fromEntries(
      LEVELS.map((l) => [l, JSON.parse(readFileSync(join(bankDir, `${l}.json`), 'utf8'))]),
    );
    for (const file of readdirSync(i18nDir).filter((f) => f.endsWith('.json'))) {
      const native = file.replace(/\.json$/, '');
      const tag = `${lang}/i18n/${file}`;
      if (!(cfg.i18nLanguages ?? i18n.LANGS).includes(native)) {
        errors.push(`${tag}: not a supported language code`);
        continue;
      }
      let table;
      try {
        table = JSON.parse(readFileSync(join(i18nDir, file), 'utf8'));
      } catch (e) {
        errors.push(`${tag}: not valid JSON — ${e.message}`);
        continue;
      }
      const shapeOk = Object.values(table).every(
        (v) => Array.isArray(v) && v.length === 3 && v.every((s) => typeof s === 'string'),
      );
      if (!shapeOk) {
        errors.push(`${tag}: every value must be [meaning, example, note] strings`);
        continue;
      }
      const rows = i18n.rowsFromTable(table, bank);
      const extra = Object.keys(table).length - rows.length;
      if (extra > 0) errors.push(`${tag}: ${extra} key(s) not in the word bank`);
      i18n.validateLanguage({ lang: native, rows, bank, levels: LEVELS }).forEach((p) => errors.push(`${lang}/i18n/${native}: ${p}`));
      i18nCount++;
    }
  }
}

if (errors.length) {
  console.error(`\n✗ Word bank validation failed (${errors.length} problem(s)):\n`);
  for (const e of errors) console.error('  - ' + e);
  console.error('');
  process.exit(1);
}
console.log(
  `✓ Word bank valid — ${total} entries in ${languages} language(s)` +
    (i18nCount ? `, ${i18nCount} translated table(s).` : '.'),
);
