/**
 * Shared by scripts/build-wordbank.mjs, scripts/validate-wordbank.mjs, scripts/validate-i18n.mjs
 * and the Jest suite: parsing, validating and building the translated word content
 * (meaning, example sentence, cultural note) for the app languages beyond it/en.
 *
 * Source files: scripts/wordbank/<target>/i18n/<lang>/<LEVEL>.tsv, five tab-separated columns:
 *   LEVEL  word  meaning  example  note
 * (`word` exactly as in the bank, `example` translates the example, `note` translates the
 * cultural note). Output: src/data/wordbank/<target>/i18n/<lang>.json, `{ "<LEVEL>:<word>": [m, e, n] }`.
 * Plain CommonJS so node scripts and jest can both require it.
 */

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const LANGS = ['fr', 'es', 'pt', 'ru', 'uk', 'pl', 'tr', 'zh', 'ja', 'hi', 'ar'];

const MAX_MEANING = 60;
const SCRIPT = {
  ru: /[Ѐ-ӿ]/,
  uk: /[Ѐ-ӿ]/,
  zh: /[一-鿿]/,
  ja: /[぀-ヿ一-鿿]/,
  hi: /[ऀ-ॿ]/,
  ar: /[؀-ۿ]/,
};
const MARKER = /\b(TODO|FIXME|XXX)\b|\?\?\?/;
const CONTROL = /[\t\r\n]/;

/** Must stay identical to normalizeLocal() in src/lib/exercises/distractors.ts (a test pins it). */
function normalizeLocal(s) {
  return s
    .toLowerCase()
    .replace(/[\s,.;:!?()[\]{}/\\'"`’‘«»„“”。、，；：！？（）・·…–—-]+/g, ' ')
    .trim();
}

const slug = (word) => word.toLowerCase().replace(/\s+/g, '-');
const keyOf = (level, word) => `${level}:${slug(word)}`;

function parseTsv(text, level) {
  const rows = [];
  const problems = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    if (!raw.trim() || raw.startsWith('#')) return;
    const line = i + 1;
    const parts = raw.split('\t');
    if (parts.length !== 5) {
      problems.push(`${level}.tsv line ${line}: ${parts.length} columns, expected 5`);
      return;
    }
    const [lvl, word, meaning, example, note] = parts.map((p) => p.trim());
    if (lvl !== level) {
      problems.push(`${level}.tsv line ${line}: level ${lvl} in the ${level} file`);
      return;
    }
    rows.push({ level: lvl, word, meaning, example, note, line });
  });
  return { rows, problems };
}

/** Returns a list of human-readable problems (empty = valid). `levels` limits what is required. */
function validateLanguage({ lang, rows, bank, levels = LEVELS }) {
  const problems = [];
  const expected = new Map();
  for (const level of levels) {
    for (const e of bank[level] ?? []) expected.set(keyOf(level, e.word), { level, e });
  }

  const seen = new Map();
  for (const r of rows) {
    const id = `${r.level}:${r.word}`;
    const k = keyOf(r.level, r.word);
    const at = r.line ? ` (line ${r.line})` : '';
    if (!expected.has(k)) {
      if (levels.includes(r.level)) problems.push(`unknown entry ${id}${at}`);
      continue;
    }
    if (seen.has(k)) {
      problems.push(`duplicate entry ${id}${at}`);
      continue;
    }
    seen.set(k, r);

    const { e } = expected.get(k);
    for (const field of ['meaning', 'example', 'note']) {
      const v = r[field];
      if (typeof v !== 'string' || v.trim() === '') {
        problems.push(`${id}: ${field} is empty${at}`);
        continue;
      }
      if (CONTROL.test(v)) problems.push(`${id}: ${field} has a control character (tab/newline)${at}`);
      if (MARKER.test(v)) problems.push(`${id}: ${field} has a leftover marker${at}`);
      if (SCRIPT[lang] && !SCRIPT[lang].test(v)) {
        problems.push(`${id}: ${field} is not in the ${lang} script${at}`);
      }
    }
    if (r.meaning && r.meaning.length > MAX_MEANING) {
      problems.push(`${id}: meaning is too long (${r.meaning.length} > ${MAX_MEANING})${at}`);
    }
    if (r.example && r.example.length > e.example_en.length * 3 + 40) {
      problems.push(`${id}: example is too long (${r.example.length} for an English source of ${e.example_en.length})${at}`);
    }
    if (r.note && r.note.length > e.cultural_note_en.length * 3 + 40) {
      problems.push(`${id}: note is too long (${r.note.length} for an English source of ${e.cultural_note_en.length})${at}`);
    }
    if (r.example && r.example.trim() === e.example.trim()) {
      problems.push(`${id}: example is still the source-language sentence${at}`);
    }
  }

  for (const [k, { level, e }] of expected) {
    if (!seen.has(k)) problems.push(`missing entry ${level}:${e.word}`);
  }

  // Two words of the same part of speech must not read identically in the learner's language
  // (multiple choice and matching would be ambiguous) unless English cannot tell them apart either.
  const byPos = new Map();
  for (const [k, r] of seen) {
    const { level, e } = expected.get(k);
    const key = `${e.part_of_speech}|${normalizeLocal(r.meaning)}`;
    if (!byPos.has(key)) byPos.set(key, []);
    byPos.get(key).push({ id: `${level}:${e.word}`, w: slug(e.word), en: normalizeLocal(e.meaning_en) });
  }
  for (const group of byPos.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        // The same word listed in two levels (e.g. trotzdem) is one word, not a collision.
        if (group[i].w !== group[j].w && group[i].en !== group[j].en) {
          problems.push(`collision: ${group[i].id} and ${group[j].id} both read "${meaningOf(seen, group[i].id)}" (English: "${group[i].en}" vs "${group[j].en}")`);
        }
      }
    }
  }
  return problems;
}

function meaningOf(seen, id) {
  const [level, ...w] = id.split(':');
  return seen.get(keyOf(level, w.join(':')))?.meaning ?? '';
}

function buildTable(rows) {
  const table = {};
  for (const r of rows) table[keyOf(r.level, r.word)] = [r.meaning, r.example, r.note];
  return table;
}

/** Rows (in bank order) from a built table, so a JSON file can be validated like a TSV. */
function rowsFromTable(table, bank) {
  const rows = [];
  for (const level of LEVELS) {
    for (const e of bank[level] ?? []) {
      const t = table[keyOf(level, e.word)];
      if (t) rows.push({ level, word: e.word, meaning: t[0], example: t[1], note: t[2] });
    }
  }
  return rows;
}

module.exports = {
  LEVELS, LANGS, MAX_MEANING, normalizeLocal, keyOf, slug,
  parseTsv, validateLanguage, buildTable, rowsFromTable,
};
