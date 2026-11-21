import itStrings from '../src/i18n/it';
import { SUPPORTED_NATIVE_LANGUAGES, type NativeLanguage } from '../src/i18n/language';

const dictionaries = Object.fromEntries(
  SUPPORTED_NATIVE_LANGUAGES.map((c) => [c, require(`../src/i18n/${c}`).default]),
) as Record<NativeLanguage, Record<string, string>>;

const placeholders = (s: string) => (s.match(/%\{[a-zA-Z_]+\}/g) ?? []).sort().join(',');
const newlines = (s: string) => (s.match(/\n/g) ?? []).length;

// Keys whose value is legitimately the same in every language: a provider name and a
// pure-placeholder label. (The app name is %{app}; the quiz sentences live in the language overlay.)
const SAME_EVERYWHERE = (key: string) =>
  key === 'settings_ai_provider_anthropic' || key === 'catalog_row_a11y';

// True cognates: the Italian word is also the right word in that language. Each entry is
// reviewed by hand; do not add one just to silence the test.
const COGNATES: Partial<Record<NativeLanguage, string[]>> = {
  fr: ['topic_shopping'],
  es: ['topic_culture', 'review_cloze_prompt', 'grammar_prompt_case', 'word_detail_retention'],
  pt: ['topic_culture', 'topic_home', 'practice_format_mixed'],
};

describe.each(SUPPORTED_NATIVE_LANGUAGES.filter((c) => c !== 'it'))('UI strings: %s', (code) => {
  const dict = dictionaries[code];
  const keys = Object.keys(itStrings) as (keyof typeof itStrings)[];

  it('has exactly the keys of it.ts', () => {
    expect(Object.keys(dict).sort()).toEqual([...keys].sort());
  });

  it('has only non-empty strings', () => {
    const bad = keys.filter((k) => typeof dict[k] !== 'string' || dict[k].trim() === '');
    expect(bad).toEqual([]);
  });

  it('keeps the %{placeholders} of the Italian string', () => {
    const bad = keys.filter((k) => placeholders(dict[k]) !== placeholders(itStrings[k]));
    expect(bad).toEqual([]);
  });

  it('keeps line breaks where Italian has them', () => {
    const bad = keys.filter((k) => newlines(dict[k]) !== newlines(itStrings[k]));
    expect(bad).toEqual([]);
  });

  it('does not leave Italian prose untranslated', () => {
    if (code === 'en') return;
    const bad = keys.filter((k) => dict[k] === itStrings[k] && !SAME_EVERYWHERE(k) && !(COGNATES[code] ?? []).includes(k));
    expect(bad).toEqual([]);
  });
});
