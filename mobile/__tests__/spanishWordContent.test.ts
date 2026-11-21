/**
 * TASK-046b: the Spanish word bank's translated content (meaning, example, cultural note) for the
 * 10 app languages of Spanish. Reads the real generated tables and the Spanish bank directly; it
 * never imports the repo's active-language seams (the repo stays German).
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const lib = require('../scripts/wordbank-i18n-lib.cjs');

const root = join(__dirname, '..');
const LEVELS: string[] = lib.LEVELS;
const LANGS = ['fr', 'pt', 'ru', 'uk', 'pl', 'tr', 'zh', 'ja', 'hi', 'ar'] as const;

type BankEntry = {
  word: string;
  example: string;
  example_en: string;
  cultural_note_en: string;
  meaning_en?: string;
};

const bank: Record<string, BankEntry[]> = {};
for (const level of LEVELS) {
  bank[level] = JSON.parse(readFileSync(join(root, 'src/data/wordbank/es', `${level}.json`), 'utf8'));
}
const bankSize = LEVELS.reduce((n, l) => n + bank[l].length, 0);

function table(lang: string): Record<string, [string, string, string]> {
  const p = join(root, 'src/data/wordbank/es/i18n', `${lang}.json`);
  if (!existsSync(p)) throw new Error(`missing generated table ${p}`);
  return JSON.parse(readFileSync(p, 'utf8'));
}

/** Small seeded generator so the "random" sample is the same on every run. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
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
const spanishVocab = new Set<string>();
for (const level of LEVELS) {
  for (const e of bank[level]) [...tokens(e.word), ...tokens(e.example)].forEach((w) => spanishVocab.add(w));
}

/**
 * The «…» fragments of the English note that are Spanish text to keep verbatim: made only of Spanish
 * words, longer than one letter, not the entry's own headword (a note may drop its subject) and not
 * an English gloss that happens to be spelled like a Spanish word.
 */
function spanishFragments(e: BankEntry & { meaning_en?: string }): string[] {
  const gloss = `${e.meaning_en ?? ''} ${e.example_en}`.toLowerCase();
  const out: string[] = [];
  for (const m of e.cultural_note_en.matchAll(/«([^»]+)»/g)) {
    const frag = m[1];
    const tk = tokens(frag);
    if (frag.length < 2 || !tk.length || !tk.every((w) => spanishVocab.has(w))) continue;
    if (frag.toLowerCase() === e.word.toLowerCase() || gloss.includes(frag.toLowerCase())) continue;
    out.push(frag);
  }
  return out;
}

describe.each(LANGS)('Spanish translated content: %s', (lang) => {
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
    it('does not leave the Spanish or English sentence as the translated example', () => {
      for (const level of LEVELS) {
        for (const e of bank[level]) {
          const [, example, note] = t[lib.keyOf(level, e.word)];
          if (example.trim() === e.example.trim()) throw new Error(`${level}:${e.word}: example is Spanish`);
          if (example.trim() === e.example_en.trim()) throw new Error(`${level}:${e.word}: example is English`);
          // A note that is only a Spanish quote plus a label such as "Plural" reads the same in English.
          const prose = tokens(note.replace(/«[^»]*»/g, ' '));
          if (prose.length > 3 && note.trim() === e.cultural_note_en.trim()) throw new Error(`${level}:${e.word}: note is English`);
        }
      }
    });
  }

  it('keeps the quoted Spanish words of the note in their original spelling', () => {
    const all = LEVELS.flatMap((l) => bank[l].map((e) => ({ level: l, e })));
    const rand = seeded(46_000 + lang.charCodeAt(0));
    const withQuotes = all.filter(({ e }) => spanishFragments(e).length > 0);
    expect(withQuotes.length).toBeGreaterThan(500);
    const sample: typeof all = [];
    while (sample.length < 20) sample.push(withQuotes[Math.floor(rand() * withQuotes.length)]);
    for (const { level, e } of sample) {
      const note = t[lib.keyOf(level, e.word)][2].toLowerCase();
      for (const frag of spanishFragments(e)) {
        if (!note.includes(`«${frag.toLowerCase()}»`)) throw new Error(`${level}:${e.word}: note lost «${frag}»`);
      }
    }
  });

  it('guard: dropping one entry is reported as a missing entry', () => {
    const copy = { ...t };
    const victim = lib.keyOf('A1', bank.A1[0].word);
    delete copy[victim];
    const problems: string[] = lib.validateLanguage({ lang, rows: lib.rowsFromTable(copy, bank), bank });
    expect(problems.some((p) => p.startsWith('missing entry A1:'))).toBe(true);
  });
});
