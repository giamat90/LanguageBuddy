import type { LanguagePack } from './types';
import it from './de/strings/it';
import en from './de/strings/en';
import fr from './de/strings/fr';
import es from './de/strings/es';
import pt from './de/strings/pt';
import ru from './de/strings/ru';
import uk from './de/strings/uk';
import pl from './de/strings/pl';
import tr from './de/strings/tr';
import zh from './de/strings/zh';
import ja from './de/strings/ja';
import hi from './de/strings/hi';
import ar from './de/strings/ar';

const DATIVE_PREPOSITIONS = new Set(['aus', 'bei', 'mit', 'nach', 'seit', 'von', 'zu']);
const ACCUSATIVE_PREPOSITIONS = new Set(['durch', 'für', 'gegen', 'ohne', 'um']);

export const de: LanguagePack = {
  code: 'de',
  name: 'German',
  app: { name: 'GermanBuddy', backupTag: 'GermanBuddy', dbFile: 'germanbuddy.db' },
  levels: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
  sentences: 'spaced',
  letters: /([A-Za-zÄÖÜäöüß]+)/,
  fold: (s) =>
    s
      .trim()
      .toLowerCase()
      .replace(/ß/g, 'ss')
      .replace(/ä/g, 'a')
      .replace(/ö/g, 'o')
      .replace(/ü/g, 'u'),
  typoMinLength: 5,
  punctuation: {
    lead: /^[„"«(‹‚“‘']+/,
    trail: /[.,!?;:“”"»)›’'…]+$/,
  },
  reading: null,
  italics: true,
  pronunciation: 'ipa',
  collation: 'de',
  speech: { locale: 'de-DE', rate: 0.9 },
  ai: { languageName: 'German' },
  articles: {
    forms: ['der', 'die', 'das'],
    rule: 'NOUN_GENDER',
    genderOf: (article) => ({ der: 'm', die: 'f', das: 'n' } as const)[article as 'der' | 'die' | 'das'],
  },
  gender: {
    forms: {
      der: ['der', 'den', 'dem', 'des'],
      die: ['die', 'der'],
      das: ['das', 'dem', 'des'],
    },
    neverValid: {
      der: ['die', 'das'],
      die: ['das', 'den', 'dem', 'des'],
      das: ['der', 'die', 'den'],
    },
    // Plural identical to the singular (der Lehrer / die Lehrer, das Zimmer / die Zimmer).
    pluralLookalike: /(er|el|en|chen|lein)$/i,
    // Every article form is valid for a neuter one, so those are skipped; for a masculine one only "das" is certainly wrong.
    lookalike: { skipArticle: 'das', onlyWrongFor: { der: ['das'] } },
  },
  cases: {
    ruleForms: {
      ACCUSATIVE_MASC: ['einen'],
      ACCUSATIVE_PREP: ['einen'],
      DATIV_PREP: ['dem', 'einem'],
      DATIV_INDIRECT_OBJ: ['dem', 'einem'],
      GENITIV_CASE: ['des', 'eines'],
    },
    definiteForms: ['der', 'die', 'das', 'dem', 'den', 'des'],
    indefiniteForms: ['ein', 'eine', 'einen', 'einem', 'einer', 'eines'],
    // After these both accusative and dative are grammatical (dem/den both fit).
    twoWayPrepositions: new Set(['an', 'auf', 'hinter', 'in', 'neben', 'über', 'unter', 'vor', 'zwischen']),
    ruleForForm(form, previousWord) {
      if (form === 'des' || form === 'eines') return 'GENITIV_CASE';
      if (form === 'einen') return ACCUSATIVE_PREPOSITIONS.has(previousWord) ? 'ACCUSATIVE_PREP' : 'ACCUSATIVE_MASC';
      return DATIVE_PREPOSITIONS.has(previousWord) ? 'DATIV_PREP' : 'DATIV_INDIRECT_OBJ';
    },
  },
  choices: null,
  quiz: [
    { n: 1, correctIndex: 0 },
    { n: 2, correctIndex: 0 },
    { n: 3, correctIndex: 0 },
    { n: 4, correctIndex: 1 },
    { n: 5, correctIndex: 0 },
  ],
  // Every app language (a literal list: importing i18n/language here would make an import cycle).
  uiLanguages: ['it', 'en', 'fr', 'es', 'pt', 'ru', 'uk', 'pl', 'tr', 'zh', 'ja', 'hi', 'ar'],
  strings: { it, en, fr, es, pt, ru, uk, pl, tr, zh, ja, hi, ar },
};
