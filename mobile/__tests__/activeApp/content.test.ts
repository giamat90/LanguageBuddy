/** The active bank and its translated word content, as the app really reads them. */
import { WORD_BANK, CEFR_ORDER, allEntries } from '../../src/data/wordbank';
import { getActivePack } from '../../src/languages';
import { getWordContent, localizedText } from '../../src/i18n/wordContent';
import { coerceNativeLanguage, offeredLanguages, SUPPORTED_NATIVE_LANGUAGES } from '../../src/i18n/language';
import { pickNextWord } from '../../src/data/dailyWord';
import { TOPIC_KEYS } from '../../src/lib/topics';
import { current } from '../../test-support/appExpectations';

describe('the active word bank', () => {
  it('has the expected number of words per level (prevents a half-built or wrong bank)', () => {
    const counts = Object.fromEntries(CEFR_ORDER.map((l) => [l, WORD_BANK[l].length]));
    expect(counts).toEqual(current().wordsPerLevel);
  });

  it('every entry has the fields the screens read', () => {
    for (const { level, entry: e } of allEntries()) {
      for (const f of ['word', 'meaning_it', 'meaning_en', 'example', 'example_it', 'example_en', 'cultural_note', 'cultural_note_en', 'ipa'] as const) {
        if (typeof e[f] !== 'string' || !e[f].trim()) throw new Error(`${level}:${e.word} lacks ${f}`);
      }
      expect(TOPIC_KEYS).toContain(e.topic_domain);
    }
  });

  it('nouns carry an article of the language, other words none', () => {
    const forms = current().articleForms;
    for (const { level, entry: e } of allEntries()) {
      if (e.part_of_speech === 'noun') {
        if (!e.article || !forms.includes(e.article)) throw new Error(`${level}:${e.word} has article "${e.article}"`);
      } else if (e.article) {
        throw new Error(`${level}:${e.word} (${e.part_of_speech}) has an article`);
      }
    }
  });

  it('the sample word of each level exists at that level', () => {
    for (const l of CEFR_ORDER) expect(WORD_BANK[l].map((e) => e.word)).toContain(current().sampleWord[l]);
  });
});

describe('translated word content', () => {
  it('covers every word in every translated language with three non-empty strings', () => {
    const missing: string[] = [];
    for (const lang of current().translatedLanguages) {
      for (const { level, entry } of allEntries()) {
        const triple = getWordContent(lang as never, entry.word, level);
        if (!triple || triple.some((s) => typeof s !== 'string' || !s.trim())) missing.push(`${lang}:${level}:${entry.word}`);
      }
    }
    expect(missing.slice(0, 10)).toEqual([]);
  });

  it('has no table for a language it does not translate (the screens fall back to English)', () => {
    const translated = new Set(current().translatedLanguages);
    const untranslated = SUPPORTED_NATIVE_LANGUAGES.filter((l) => !translated.has(l) && l !== 'it' && l !== 'en');
    const sample = allEntries()[0];
    for (const lang of untranslated) {
      expect(getWordContent(lang, sample.entry.word, sample.level)).toBeNull();
      expect(localizedText(lang, 'meaning', { word: sample.entry.word, level: sample.level }, sample.entry.meaning_it, sample.entry.meaning_en))
        .toBe(sample.entry.meaning_en);
    }
  });

  it('a translated language reaches the screens through localizedText', () => {
    const { level, entry } = allEntries()[10];
    const lang = current().translatedLanguages[0] as never;
    const triple = getWordContent(lang, entry.word, level)!;
    expect(localizedText(lang, 'meaning', { word: entry.word, level }, entry.meaning_it, entry.meaning_en)).toBe(triple[0]);
  });
});

describe('app languages', () => {
  it('offers exactly the languages of the row, and never the language being learned (prevents offering Spanish to Spanish speakers)', () => {
    expect([...offeredLanguages()]).toEqual([...current().uiLanguages]);
    const target = getActivePack().code;
    const offered = offeredLanguages() as readonly string[];
    expect(offered).not.toContain(target);
  });

  it('coerceNativeLanguage maps a language the app does not offer to a default', () => {
    expect(offeredLanguages()).toContain(coerceNativeLanguage('xx'));
    for (const l of SUPPORTED_NATIVE_LANGUAGES) {
      const out = coerceNativeLanguage(l);
      expect(offeredLanguages()).toContain(out);
      if (offeredLanguages().includes(l)) expect(out).toBe(l);
    }
  });
});

describe('the daily word', () => {
  it('walks a level for 30 days without repeating and stays inside the bank', () => {
    for (const level of CEFR_ORDER) {
      const used = new Set<string>();
      const inBank = new Set(WORD_BANK[level].map((e) => e.word));
      for (let day = 0; day < 30; day++) {
        const pick = pickNextWord(level, 'install-1', used, undefined);
        expect(inBank.has(pick.entry.word)).toBe(true);
        expect(used.has(pick.entry.word.toLowerCase())).toBe(false);
        used.add(pick.entry.word.toLowerCase());
      }
      expect(used.size).toBe(30);
    }
  });

  it('prefers the chosen topics and is stable for one install', () => {
    const a = pickNextWord('A1', 'install-2', new Set(), ['food']);
    const b = pickNextWord('A1', 'install-2', new Set(), ['food']);
    expect(a.entry.word).toBe(b.entry.word);
    expect(a.entry.topic_domain).toBe('food');
    expect(a.outsideTopics).toBe(false);
  });
});
