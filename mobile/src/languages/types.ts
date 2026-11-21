/** The language being studied. Widened by later tasks ('es', 'fr', …); today only German ships. */
export type TargetLanguageCode = 'de';

export type Gender = 'm' | 'f' | 'n';

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
  /** What a word is made of: a regex with exactly ONE capture group (so `split` keeps the words). */
  letters: RegExp;
  /** Lower-cases, trims and folds the letters a learner may slip on (ß→ss, ä→a …). */
  fold(s: string): string;
  /** A word of at least this many letters tolerates one typo (graded `close`). */
  typoMinLength: number;
  /** Quotes and punctuation split off a token. */
  punctuation: { lead: RegExp; trail: RegExp };
  speech: { locale: string; rate: number };
  ai: { languageName: string };
  articles: ArticleSupport | null;
  /** null → "find the mistake" has no gender slot. */
  gender: GenderSupport | null;
  /** null → no case drill and no case slot in "find the mistake". */
  cases: CaseSupport | null;
}
