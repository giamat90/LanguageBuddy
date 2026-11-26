import it from './es/strings/it';
import en from './es/strings/en';
import fr from './es/strings/fr';
import pt from './es/strings/pt';
import ru from './es/strings/ru';
import uk from './es/strings/uk';
import pl from './es/strings/pl';
import tr from './es/strings/tr';
import zh from './es/strings/zh';
import ja from './es/strings/ja';
import hi from './es/strings/hi';
import ar from './es/strings/ar';
import type { LanguagePack } from './types';

export const es: LanguagePack = {
  code: 'es',
  name: 'Spanish',
  app: { name: 'SpanishBuddy', backupTag: 'SpanishBuddy', dbFile: 'spanishbuddy.db' },
  levels: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
  sentences: 'spaced',
  letters: /([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)/,
  // Vowel accents and ü fold away (the likeliest slip, the meaning survives); ñ is a different letter and stays.
  fold: (s) =>
    s
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/n\u0303/g, '\u0001')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\u0001/g, 'ñ')
      .normalize('NFC'),
  typoMinLength: 5,
  punctuation: {
    lead: /^[¿¡"«(‹'“‘—]+/,
    trail: /[.,!?;:”"»)›'’…—]+$/,
  },
  reading: null,
  italics: true,
  pronunciation: 'ipa',
  // Latin American neutral; a phone with only es-ES still speaks (QA in TASK-049).
  collation: 'es',
  speech: { locale: 'es-US', rate: 0.9 },
  ai: { languageName: 'Spanish' },
  articles: {
    forms: ['el', 'la'],
    rule: 'NOUN_GENDER',
    genderOf: (article) => ({ el: 'm', la: 'f' } as const)[article as 'el' | 'la'],
  },
  gender: {
    forms: { el: ['el', 'los'], la: ['la', 'las'] },
    neverValid: { el: ['la'], la: ['el'] },
    pluralLookalike: /$^/,
    lookalike: { skipArticle: '', onlyWrongFor: {} },
  },
  cases: null,
  choices: {
    ruleSets: {
      SER_ESTAR: [
        ['soy', 'estoy'], ['eres', 'estás'], ['es', 'está'], ['somos', 'estamos'], ['son', 'están'],
        ['era', 'estaba'], ['eran', 'estaban'], ['fue', 'estuvo'],
      ],
      POR_PARA: [['por', 'para']],
      DIRECT_OBJECT_PRONOUN: [['lo', 'la', 'los', 'las']],
    },
  },
  quiz: [
    { n: 1, correctIndex: 0 },
    { n: 2, correctIndex: 0 },
    { n: 3, correctIndex: 0 },
    { n: 4, correctIndex: 1 },
    { n: 5, correctIndex: 1 },
  ],
  // No Spanish: a native speaker does not learn Spanish (a literal list, no import of i18n/language: import cycle).
  uiLanguages: ['it', 'en', 'fr', 'pt', 'ru', 'uk', 'pl', 'tr', 'zh', 'ja', 'hi', 'ar'],
  strings: { it, en, fr, pt, ru, uk, pl, tr, zh, ja, hi, ar },
};
