import it from './fr/strings/it';
import en from './fr/strings/en';
import es from './fr/strings/es';
import pt from './fr/strings/pt';
import ru from './fr/strings/ru';
import uk from './fr/strings/uk';
import pl from './fr/strings/pl';
import tr from './fr/strings/tr';
import zh from './fr/strings/zh';
import ja from './fr/strings/ja';
import hi from './fr/strings/hi';
import ar from './fr/strings/ar';
import type { LanguagePack } from './types';

export const fr: LanguagePack = {
  code: 'fr',
  name: 'French',
  app: { name: 'FrenchBuddy', backupTag: 'FrenchBuddy', dbFile: 'frenchbuddy.db' },
  // The apostrophe is not a letter: l'ami splits into l | ami, so the noun alone is the word.
  letters: /([A-Za-zÀÂÆÇÉÈÊËÎÏÔŒÙÛÜŸàâæçéèêëîïôœùûüÿ]+)/,
  // Accents, cedilla, diaeresis and the ligatures fold away (the likeliest slip on a phone keyboard;
  // the meaning survives in context); the typographic apostrophe is the straight one.
  fold: (s) =>
    s
      .trim()
      .toLowerCase()
      .replace(/’/g, "'")
      .replace(/œ/g, 'oe')
      .replace(/æ/g, 'ae')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .normalize('NFC'),
  typoMinLength: 5,
  // U+00A0 / U+202F: French sets a no-break space before ? ! : ; and inside guillemets.
  punctuation: {
    lead: /^[«‹("“‘—  ]+/,
    trail: /[.,!?;:»›)"”’'…—  ]+$/,
  },
  collation: 'fr',
  speech: { locale: 'fr-FR', rate: 0.9 },
  ai: { languageName: 'French' },
  articles: {
    forms: ['le', 'la'],
    rule: 'NOUN_GENDER',
    genderOf: (article) => ({ le: 'm', la: 'f' } as const)[article as 'le' | 'la'],
  },
  // The slot looks at the card's own le/la directly before the noun: an elided l' hides the gender and is skipped.
  gender: {
    forms: { le: ['le', 'un'], la: ['la', 'une'] },
    neverValid: { le: ['la', 'une'], la: ['le', 'un'] },
    pluralLookalike: /$^/,
    lookalike: { skipArticle: '', onlyWrongFor: {} },
  },
  cases: null,
  choices: {
    ruleSets: {
      AUXILIARY_AVOIR_ETRE: [
        ['ai', 'suis'], ['as', 'es'], ['a', 'est'], ['avons', 'sommes'], ['avez', 'êtes'], ['ont', 'sont'],
      ],
      DIRECT_OBJECT_PRONOUN: [['le', 'la', 'les']],
      RELATIVE_QUI_QUE: [['qui', 'que']],
    },
  },
  quiz: [
    { n: 1, correctIndex: 1 },
    { n: 2, correctIndex: 1 },
    { n: 3, correctIndex: 0 },
    { n: 4, correctIndex: 1 },
    { n: 5, correctIndex: 0 },
  ],
  // No French: a native speaker does not learn French (a literal list, no import of i18n/language: import cycle).
  uiLanguages: ['it', 'en', 'es', 'pt', 'ru', 'uk', 'pl', 'tr', 'zh', 'ja', 'hi', 'ar'],
  strings: { it, en, es, pt, ru, uk, pl, tr, zh, ja, hi, ar },
};
