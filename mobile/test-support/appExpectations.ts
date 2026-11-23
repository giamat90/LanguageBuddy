/**
 * What each app must look like. The suites in this folder are written once and run for whichever
 * app is active (`npm test` = German, `npm run test:app -- es` = Spanish, `npm run test:app -- fr` = French). A new language is gated by
 * adding a row here (plus its variant and store files): without one, every suite fails with a pointer.
 */
import { getActivePack } from '../src/languages';

export interface AppExpectation {
  appName: string;
  dbFile: string;
  backupTag: string;
  packageName: string;
  speechLocale: string;
  /** Bank entries per level, A1..C2. */
  wordsPerLevel: Record<'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2', number>;
  /** App (UI) languages this app offers. */
  uiLanguages: readonly string[];
  /** Languages whose translated word tables must cover every word. */
  translatedLanguages: readonly string[];
  articleForms: readonly string[];
  /** Choice-drill rule codes ([] = none). */
  choiceRules: readonly string[];
  hasCases: boolean;
  /** A word of each level that exists in the bank. */
  sampleWord: Record<'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2', string>;
  aiLanguageName: string;
  /** Words that the pack's collation sorts differently from code-point order. */
  collationSample: readonly [string, string, string];
  /** Characters the app must render and type without losing them. */
  specialCharacters: string;
}

const ALL_13 = ['it', 'en', 'fr', 'es', 'pt', 'ru', 'uk', 'pl', 'tr', 'zh', 'ja', 'hi', 'ar'];

export const EXPECT: Record<string, AppExpectation> = {
  de: {
    appName: 'GermanBuddy',
    dbFile: 'germanbuddy.db',
    backupTag: 'GermanBuddy',
    packageName: 'com.giamat90.germanbuddy',
    speechLocale: 'de-DE',
    wordsPerLevel: { A1: 375, A2: 379, B1: 372, B2: 419, C1: 375, C2: 359 },
    uiLanguages: ALL_13,
    translatedLanguages: ['fr', 'es', 'pt', 'ru', 'uk', 'pl', 'tr', 'zh', 'ja', 'hi', 'ar'],
    articleForms: ['der', 'die', 'das'],
    choiceRules: [],
    hasCases: true,
    sampleWord: { A1: 'Apfel', A2: 'Küche', B1: 'dürfen', B2: 'Gemütlichkeit', C1: 'Doppelgänger', C2: 'Sprachgefühl' },
    aiLanguageName: 'German',
    collationSample: ['Käse', 'Kind', 'Küche'],
    specialCharacters: 'äöüß',
  },
  es: {
    appName: 'SpanishBuddy',
    dbFile: 'spanishbuddy.db',
    backupTag: 'SpanishBuddy',
    packageName: 'com.giamat90.spanishbuddy',
    speechLocale: 'es-US',
    wordsPerLevel: { A1: 311, A2: 299, B1: 308, B2: 291, C1: 299, C2: 286 },
    uiLanguages: ALL_13.filter((l) => l !== 'es'),
    translatedLanguages: ['fr', 'pt', 'ru', 'uk', 'pl', 'tr', 'zh', 'ja', 'hi', 'ar'],
    articleForms: ['el', 'la'],
    choiceRules: ['SER_ESTAR', 'POR_PARA', 'DIRECT_OBJECT_PRONOUN'],
    hasCases: false,
    sampleWord: { A1: 'mañana', A2: 'montaña', B1: 'colocar', B2: 'revisar', C1: 'rebaja', C2: 'zozobra' },
    aiLanguageName: 'Spanish',
    collationSample: ['mano', 'manzana', 'mañana'],
    specialCharacters: 'ñáéíóú¿¡',
  },
  fr: {
    appName: 'FrenchBuddy',
    dbFile: 'frenchbuddy.db',
    backupTag: 'FrenchBuddy',
    packageName: 'com.giamat90.frenchbuddy',
    speechLocale: 'fr-FR',
    wordsPerLevel: { A1: 312, A2: 325, B1: 313, B2: 331, C1: 295, C2: 289 },
    uiLanguages: ALL_13.filter((l) => l !== 'fr'),
    translatedLanguages: ['es', 'pt', 'ru', 'uk', 'pl', 'tr', 'zh', 'ja', 'hi', 'ar'],
    articleForms: ['le', 'la'],
    choiceRules: ['AUXILIARY_AVOIR_ETRE', 'DIRECT_OBJECT_PRONOUN', 'RELATIVE_QUI_QUE'],
    hasCases: false,
    sampleWord: { A1: 'maison', A2: 'remarquer', B1: 'serrure', B2: 'échelle', C1: 'habitat', C2: 'mordicus' },
    aiLanguageName: 'French',
    collationSample: ['eau', 'étage', 'facile'],
    specialCharacters: 'éèêàçœîôù',
  },
};

/** The row of the active app, or a failing message telling a new language what to add. */
export function current(): AppExpectation {
  const code = getActivePack().code;
  const row = EXPECT[code];
  if (!row) {
    throw new Error(
      `no expectations for "${code}": add a row to test-support/appExpectations.ts, a mobile/variants/${code}.json, ` +
        `store/${code}/support.json (and listing/), and a scripts/wordbank/${code}/language.json with a "name".`,
    );
  }
  return row;
}
export const activeCode = () => getActivePack().code;
