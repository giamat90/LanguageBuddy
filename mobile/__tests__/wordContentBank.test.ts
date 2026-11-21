/**
 * Real translated word content: every language file that ships must be registered,
 * complete and actually reach the screens through localizedText().
 */
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { allEntries } from '../src/data/wordbank';
import { localizedText, getWordContent } from '../src/i18n/wordContent';
import { WORD_CONTENT_LOADERS } from '../src/i18n/wordContentLoaders';
import type { NativeLanguage } from '../src/i18n/language';

const dir = join(__dirname, '..', 'src', 'data', 'wordbank', 'de', 'i18n');
const shipped = (existsSync(dir) ? readdirSync(dir) : [])
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, '')) as NativeLanguage[];

const entries = allEntries();

test('the loader table is exactly the set of shipped language files', () => {
  expect(Object.keys(WORD_CONTENT_LOADERS).sort()).toEqual([...shipped].sort());
});

// jest rejects `.each([])`, which is the state before the first language ships.
describe.each(shipped.length ? shipped : (['none'] as unknown as NativeLanguage[]))('translated content: %s', (lang) => {
  if (!shipped.length) {
    it('is skipped until a language ships', () => {});
    return;
  }
  it('covers every word-bank entry with three non-empty strings', () => {
    const missing = entries.filter(({ level, entry }) => {
      const t = getWordContent(lang, entry.word, level);
      return !t || t.some((s) => typeof s !== 'string' || s.trim() === '');
    });
    expect(missing.map(({ level, entry }) => `${level}:${entry.word}`)).toEqual([]);
  });

  it('reaches the screens through localizedText for every field', () => {
    const sample = entries.filter((_, i) => i % 97 === 0);
    expect(sample.length).toBeGreaterThan(10);
    for (const { level, entry } of sample) {
      const ref = { word: entry.word, level };
      const t = getWordContent(lang, entry.word, level)!;
      expect(localizedText(lang, 'meaning', ref, entry.meaning_it, entry.meaning_en)).toBe(t[0]);
      expect(localizedText(lang, 'example', ref, entry.example_it, entry.example_en)).toBe(t[1]);
      expect(localizedText(lang, 'note', ref, entry.cultural_note, entry.cultural_note_en)).toBe(t[2]);
    }
  });

  it('gives the two levels of a word their own row', () => {
    for (const w of ['essen', 'fahren', 'gesund', 'trotzdem']) {
      const levels = entries.filter((e) => e.entry.word.toLowerCase() === w).map((e) => e.level);
      expect(levels).toHaveLength(2);
      for (const level of levels) expect(getWordContent(lang, w, level)).not.toBeNull();
    }
  });
});
