/**
 * TASK-065: the French word bank's translated content (meaning, example, cultural note) for the
 * 10 other app languages. Reads the real generated tables and the French bank directly; it
 * never imports the repo's active-language seams (the repo stays German).
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const lib = require('../scripts/wordbank-i18n-lib.cjs');

const root = join(__dirname, '..');
const LEVELS: string[] = lib.LEVELS;
const LANGS = ['es', 'pt', 'ru', 'uk', 'pl', 'tr', 'zh', 'ja', 'hi', 'ar'] as const;

type BankEntry = {
  word: string;
  example: string;
  example_en: string;
  cultural_note_en: string;
  meaning_en?: string;
};

const bank: Record<string, BankEntry[]> = {};
for (const level of LEVELS) {
  bank[level] = JSON.parse(readFileSync(join(root, 'src/data/wordbank/fr', `${level}.json`), 'utf8'));
}
const bankSize = LEVELS.reduce((n, l) => n + bank[l].length, 0);

function table(lang: string): Record<string, [string, string, string]> {
  const p = join(root, 'src/data/wordbank/fr/i18n', `${lang}.json`);
  if (!existsSync(p)) throw new Error(`missing generated table ${p}`);
  return JSON.parse(readFileSync(p, 'utf8'));
}

const SCRIPT: Record<string, RegExp> = {
  ru: /[Ѐ-ӿ]/,
  uk: /[Ѐ-ӿ]/,
  zh: /[一-鿿]/,
  ja: /[぀-ヿ一-鿿]/,
  hi: /[ऀ-ॿ]/,
  ar: /[؀-ۿ]/,
};


const tokens = (s: string) => s.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);
const frenchVocab = new Set<string>();
for (const level of LEVELS) {
  for (const e of bank[level]) [...tokens(e.word), ...tokens(e.example)].forEach((w) => frenchVocab.add(w));
}

describe.each(LANGS)('French translated content: %s', (lang) => {
  const t = table(lang);
  const rows = lib.rowsFromTable(t, bank);

  it('has exactly one key per bank entry', () => {
    const expected = LEVELS.flatMap((l) => bank[l].map((e) => lib.keyOf(l, e.word))).sort();
    expect(Object.keys(t).sort()).toEqual(expected);
    expect(Object.keys(t)).toHaveLength(bankSize);
  });

  it('has three clean, non-empty strings everywhere and short meanings', () => {
    for (const [key, triple] of Object.entries(t)) {
      expect(triple).toHaveLength(3);
      for (const s of triple) {
        expect(typeof s).toBe('string');
        expect(s.trim()).not.toBe('');
        expect(s).not.toMatch(/[\t\r\n]/);
        expect(s).not.toMatch(/\b(TODO|XXX)\b|\?\?\?/);
      }
      if (triple[0].length > 60) throw new Error(`${key}: meaning longer than 60`);
    }
  });

  it('passes the shared validator (no missing entries, no same-POS collisions)', () => {
    expect(lib.validateLanguage({ lang, rows, bank })).toEqual([]);
  });

  if (SCRIPT[lang]) {
    it('writes meaning, example and note in the language script', () => {
      for (const [key, triple] of Object.entries(t)) {
        for (const s of triple) {
          if (!SCRIPT[lang].test(s)) throw new Error(`${key}: "${s}" is not in the ${lang} script`);
        }
      }
    });
  } else {
    it('does not leave the French or English sentence as the translated example', () => {
      for (const level of LEVELS) {
        for (const e of bank[level]) {
          const [, example, note] = t[lib.keyOf(level, e.word)];
          if (example.trim() === e.example.trim()) throw new Error(`${level}:${e.word}: example is French`);
          if (example.trim() === e.example_en.trim()) throw new Error(`${level}:${e.word}: example is English`);
          // A note that is only a French quote plus a label such as "Plural" reads the same in English.
          const prose = tokens(note.replace(/«[^»]*»|"[^"]*"/g, ' ')).filter((w) => !frenchVocab.has(w));
          if (prose.length > 3 && note.trim() === e.cultural_note_en.trim()) throw new Error(`${level}:${e.word}: note is English`);
        }
      }
    });
  }

  it('guard: dropping one entry is reported as a missing entry', () => {
    const copy = { ...t };
    const victim = lib.keyOf('A1', bank.A1[0].word);
    delete copy[victim];
    const problems: string[] = lib.validateLanguage({ lang, rows: lib.rowsFromTable(copy, bank), bank });
    expect(problems.some((p) => p.startsWith('missing entry A1:'))).toBe(true);
  });
});
