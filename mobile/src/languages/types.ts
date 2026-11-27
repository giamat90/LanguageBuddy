/** The language being studied. Widened by later tasks ('fr', …). */
export type TargetLanguageCode = 'de' | 'es' | 'fr' | 'zh';

import type { NativeLanguage } from '../i18n/language';
import type { CefrLevel } from '../data/wordbank';
import type { ReadingSupport } from '../lib/reading/pinyin';

export type Gender = 'm' | 'f' | 'n';

/** One placement-quiz question: keys quiz_q<n>, quiz_q<n>_a, quiz_q<n>_b; which option is right. */
export interface QuizItem {
  n: 1 | 2 | 3 | 4 | 5;
  correctIndex: 0 | 1;
}

/** Texts that belong to the target language, for one app language (the overlay over src/i18n). */
export type TargetStrings = Record<string, string>;

export interface ArticleSupport {
  /** Definite articles in drill order, e.g. ['der', 'die', 'das']. */
  forms: readonly string[];
  /** Rule code of the article question (its explanation is the `grammar_rule_<code>` string). */
  rule: string;
  /** Article → gender, for the badge color. Unknown article → undefined. */
  genderOf(article: string): Gender | undefined;
}

export interface GenderSupport {
  /** Forms that can precede the noun in SOME case, per article (documentation and tests). */
  forms: Record<string, string[]>;
  /** Forms that can never precede a singular noun taking this article, in any case. */
  neverValid: Record<string, string[]>;
  /** Nouns whose plural looks like the singular: a gender mistake on them could be blamed on the verb. */
  pluralLookalike: RegExp;
  /** For lookalike nouns: the article that is skipped, and the only safe wrong forms for another one. */
  lookalike: { skipArticle: string; onlyWrongFor: Record<string, string[]> };
}

export interface CaseSupport {
  /** Rule code → the determiner forms that fix the case on their own. */
  ruleForms: Record<string, readonly string[]>;
  definiteForms: readonly string[];
  indefiniteForms: readonly string[];
  /** Prepositions after which two cases are grammatical, so the blank would have two answers. */
  twoWayPrepositions: ReadonlySet<string>;
  /** Which explanation fits a case-fixing determiner (both arguments lower-case). */
  ruleForForm(form: string, previousWord: string): string;
}

export interface ChoiceSupport {
  /** Rule code → sets of mutually exclusive forms. A token that is a member of a set is a possible blank. */
  ruleSets: Record<string, readonly (readonly string[])[]>;
  /** Languages with a reading layer: the pronunciation of every form. */
  readings?: Readonly<Record<string, string>>;
}

/** Words that stand between a number and a noun (Chinese: 一本书). */
export interface ClassifierSupport {
  /** Rule code of the question (its explanation is the `grammar_rule_<code>` string). */
  rule: string;
  /** The number the drill writes before the blank. */
  number: string;
  /** Offered as wrong answers unless the noun lists them. Containers (杯, 碗 …) fit too much to be here. */
  distractors: readonly string[];
  /** Never offered as wrong: the general word fits almost every noun. */
  never: readonly string[];
  /** What may precede a measure word in a sentence (numbers and demonstratives). */
  determiners: readonly string[];
  /** The pronunciation of every measure word the bank uses. */
  readings: Readonly<Record<string, string>>;
}

/** One section of the pronunciation primer; its texts are the `primer_<id>_title` and `_text` strings. */
export interface PrimerSection {
  id: string;
  examples: readonly { text: string; reading: string }[];
}

/**
 * Everything that is specific to the language being studied. Parts a language does not
 * have are `null`, and the features built on them switch off instead of failing.
 */
export interface LanguagePack {
  code: TargetLanguageCode;
  /** English name, used in AI prompts ("German"). */
  name: string;
  /** App identity: the name shown in dialogs, the tag written into (and required of) backups, the SQLite file. */
  app: { name: string; backupTag: string; dbFile: string };
  /** The levels this app has words for: a non-empty prefix of A1…C2. Read a stored level through `coerceLevel`. */
  levels: readonly CefrLevel[];
  /** 'spaced': words are found with `letters`. 'segmented': the bank says where they are, and no space joins them. */
  sentences: 'spaced' | 'segmented';
  /** What a word is made of: a regex with exactly ONE capture group (so `split` keeps the words). */
  letters: RegExp;
  /** Lower-cases, trims and folds the letters a learner may slip on (ß→ss, ä→a …). */
  fold(s: string): string;
  /** A word of at least this many letters tolerates one typo (graded `close`). */
  typoMinLength: number;
  /** Quotes and punctuation split off a token. */
  punctuation: { lead: RegExp; trail: RegExp };
  /** Typed pronunciation, tone choice and the pronunciation setting; null for a language without them. */
  reading: ReadingSupport | null;
  /** False for a script that must not be slanted: sentences and notes are then set upright. */
  italics: boolean;
  /** What the bank's `ipa` column holds. 'pinyin' is shown without slashes and orders the word lists. */
  pronunciation: 'ipa' | 'pinyin';
  /** BCP-47 tag used only to sort word lists (Spanish puts ñ after n). */
  collation: string;
  speech: { locale: string; rate: number };
  /** `rules`: extra instructions for the AI prompt that only this language needs. */
  ai: { languageName: string; rules?: readonly string[] };
  articles: ArticleSupport | null;
  /** null → "find the mistake" has no gender slot. */
  gender: GenderSupport | null;
  /** null → no case drill and no case slot in "find the mistake". */
  cases: CaseSupport | null;
  /** null → no choice drill and no choice slot in "find the mistake". */
  choices: ChoiceSupport | null;
  /** null → no measure-word drill and no such slot in "find the mistake". */
  classifiers: ClassifierSupport | null;
  /** A short guide to the pronunciation, shown in onboarding and from the grammar screen. */
  primer: { sections: readonly PrimerSection[] } | null;
  /** The placement quiz: the sentences live in `strings`, the right answers here. Empty = no quiz (one level). */
  quiz: readonly QuizItem[];
  /** The app languages (UI) this app offers; a native speaker of the target language is left out. */
  uiLanguages: readonly NativeLanguage[];
  /** Overlay strings per app language; a missing language falls back to English. */
  strings: Partial<Record<NativeLanguage, TargetStrings>>;
}
