/**
 * What each app must look like. The suites in this folder are written once and run for whichever
 * app is active (`npm test` = German, `npm run test:app -- es` = Spanish). A new language is gated by
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
    wordsPerLevel: { A1: 369, A2: 365, B1: 365, B2: 365, C1: 365, C2: 365 },
    uiLanguages: ALL_13,
    translatedLanguages: ['fr', 'es', 'pt', 'ru', 'uk', 'pl', 'tr', 'zh', 'ja', 'hi', 'ar'],
    articleForms: ['der', 'die', 'das'],
    choiceRules: [],
    hasCases: true,
    sampleWord: { A1: 'Apfel', A2: 'Küche', B1: 'dürfen', B2: 'würde', C1: 'Doppelgänger', C2: 'Sprachgefühl' },
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
    wordsPerLevel: { A1: 304, A2: 293, B1: 286, B2: 287, C1: 288, C2: 281 },
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
