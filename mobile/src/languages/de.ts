import type { LanguagePack } from './types';

const DATIVE_PREPOSITIONS = new Set(['aus', 'bei', 'mit', 'nach', 'seit', 'von', 'zu']);
const ACCUSATIVE_PREPOSITIONS = new Set(['durch', 'für', 'gegen', 'ohne', 'um']);

export const de: LanguagePack = {
  code: 'de',
  name: 'German',
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
  speech: { locale: 'de-DE', rate: 0.9 },
  ai: { languageName: 'German', exampleKey: 'de' },
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
};
