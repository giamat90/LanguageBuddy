import it from './zh/strings/it';
import en from './zh/strings/en';
import type { LanguagePack } from './types';

export const zh: LanguagePack = {
  code: 'zh',
  name: 'Chinese',
  app: { name: 'ChineseBuddy', backupTag: 'ChineseBuddy', dbFile: 'chinesebuddy.db' },
  levels: ['A1'],
  // No spaces between words: the bank says where they are.
  sentences: 'segmented',
  letters: /([㐀-鿿]+)/,
  // There is no letter to slip on: only stray spaces are forgiven, and a wrong character is wrong.
  fold: (s) => s.replace(/\s+/g, ''),
  typoMinLength: Number.POSITIVE_INFINITY,
  punctuation: {
    lead: /^[“‘《（]+/,
    trail: /[。，、？！：；”’》）…]+$/,
  },
  pronunciation: 'pinyin',
  collation: 'zh',
  // Mainland Mandarin, a little slower than the others so the tones can be heard.
  speech: { locale: 'zh-CN', rate: 0.8 },
  ai: {
    languageName: 'Mandarin Chinese',
    rules: [
      'write all Chinese in simplified characters, as used in mainland China',
      'begin every "native" text of an example with the pinyin (with tone marks) of its Chinese sentence in square brackets',
    ],
  },
  articles: null,
  gender: null,
  cases: null,
  choices: null,
  // One level, so no placement quiz.
  quiz: [],
  // No Chinese: a native speaker does not learn Chinese here.
  uiLanguages: ['it', 'en'],
  strings: { it, en },
};
