import type { LanguagePack } from '../src/languages';

/**
 * A Chinese-like fake language: one level, no placement quiz, sentences without spaces whose words
 * come from the bank. It proves the engine can host such a language; it is not the Chinese pack.
 */
export const testPackCjk: LanguagePack = {
  code: 'de', // the code type is only widened by later tasks
  name: 'Chinese',
  app: { name: 'TestHanzi', backupTag: 'TestHanzi', dbFile: 'testhanzi.db' },
  levels: ['A1'],
  sentences: 'segmented',
  letters: /([㐀-鿿]+)/,
  fold: (s) => s.trim(),
  typoMinLength: 5,
  punctuation: { lead: /^[“‘《（]+/, trail: /[。，、？！：；”’》）…]+$/ },
  collation: 'zh',
  speech: { locale: 'zh-CN', rate: 0.8 },
  ai: { languageName: 'Chinese' },
  articles: null,
  gender: null,
  cases: null,
  choices: { ruleSets: { QUESTION_PARTICLE: [['吗', '呢']] } },
  quiz: [],
  uiLanguages: ['it', 'en'],
  strings: {},
};
