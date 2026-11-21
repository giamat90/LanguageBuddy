import type { LanguagePack } from '../src/languages';

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
};
