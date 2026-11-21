import type { LanguagePack } from '../src/languages';
import { SUPPORTED_NATIVE_LANGUAGES } from '../src/i18n/language';

/** A Spanish-like fake language (accents, el/la, no cases) used only to prove the pack abstraction. */
export const testPack: LanguagePack = {
  code: 'de', // the code type is only widened by later tasks
  name: 'Spanish',
  app: { name: 'SpanishBuddy', backupTag: 'SpanishBuddy', dbFile: 'spanishbuddy.db' },
  letters: /([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)/,
  fold: (s) =>
    s
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/ñ/g, 'n'),
  typoMinLength: 5,
  punctuation: { lead: /^[¿¡"«(']+/, trail: /[.,!?;:"»)'…]+$/ },
  speech: { locale: 'es-ES', rate: 0.9 },
  ai: { languageName: 'Spanish' },
  articles: {
    forms: ['el', 'la'],
    rule: 'NOUN_GENDER',
    genderOf: (a) => ({ el: 'm', la: 'f' } as const)[a as 'el' | 'la'],
  },
  gender: {
    forms: { el: ['el'], la: ['la'] },
    neverValid: { el: ['la'], la: ['el'] },
    pluralLookalike: /$^/,
    lookalike: { skipArticle: '', onlyWrongFor: {} },
  },
  cases: null,
  // Different correct positions than German, to prove the quiz follows the pack.
  choices: null,
  quiz: [
    { n: 1, correctIndex: 1 }, { n: 2, correctIndex: 1 }, { n: 3, correctIndex: 0 },
    { n: 4, correctIndex: 0 }, { n: 5, correctIndex: 1 },
  ],
  // SpanishBuddy does not offer Spanish as an app language.
  uiLanguages: SUPPORTED_NATIVE_LANGUAGES.filter((l) => l !== 'es'),
  strings: {
    it: { welcome_subtitle: 'Una parola di spagnolo al giorno, da imparare davvero.' },
    en: { welcome_subtitle: 'One Spanish word a day, learned properly.' },
  },
};
