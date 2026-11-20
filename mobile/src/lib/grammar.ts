import { LETTERS } from './cloze';

export type Rng = () => number;

export const ARTICLES = ['der', 'die', 'das'] as const;

export const ARTICLE_RULE = 'NOUN_GENDER';

/** Rules the case-cloze can drill, and the unambiguous determiner forms that test each. */
const RULE_FORMS: Record<string, string[]> = {
  ACCUSATIVE_MASC: ['einen'],
  ACCUSATIVE_PREP: ['einen'],
  DATIV_PREP: ['dem', 'einem'],
  DATIV_INDIRECT_OBJ: ['dem', 'einem'],
  GENITIV_CASE: ['des', 'eines'],
};

export const CASE_RULES = Object.keys(RULE_FORMS);

/** Every determiner form that fixes a case on its own (einen, dem, einem, des, eines). */
export const CASE_FORMS = new Set<string>(Object.values(RULE_FORMS).flat());

export const DEFINITE_FORMS = ['der', 'die', 'das', 'dem', 'den', 'des'];
export const INDEFINITE_FORMS = ['ein', 'eine', 'einen', 'einem', 'einer', 'eines'];

// After these, both accusative and dative are grammatical (dem/den both fit), so
// the blank would have two defensible answers.
export const TWO_WAY_PREPOSITIONS = new Set([
  'an', 'auf', 'hinter', 'in', 'neben', 'über', 'unter', 'vor', 'zwischen',
]);

export interface CaseCloze {
  before: string;
  after: string;
  answer: string;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Finds a determiner whose form alone fixes the case (dem, einem, einen, des,
 * eines) and that exercises `ruleCode`. Returns null if the sentence has none.
 */
export function buildCaseCloze(sentence: string | null | undefined, ruleCode: string): CaseCloze | null {
  const forms = RULE_FORMS[ruleCode];
  if (!sentence || !forms) return null;
  const parts = sentence.split(LETTERS);
  let prevWord = '';
  for (let i = 1; i < parts.length; i += 2) {
    const lower = parts[i].toLowerCase();
    if (forms.includes(lower) && !TWO_WAY_PREPOSITIONS.has(prevWord)) {
      return {
        before: parts.slice(0, i).join(''),
        after: parts.slice(i + 1).join(''),
        answer: lower,
      };
    }
    prevWord = lower;
  }
  return null;
}

export function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** The answer plus two distractors from the same definiteness family, shuffled. */
export function caseOptions(answer: string, rng: Rng = Math.random): string[] {
  const family = DEFINITE_FORMS.includes(answer) ? DEFINITE_FORMS : INDEFINITE_FORMS;
  const distractors = shuffle(family.filter((f) => f !== answer), rng).slice(0, 2);
  return shuffle([answer, ...distractors], rng);
}

/** Picks an index with probability proportional to `weights` (all > 0). */
export function pickWeighted(weights: number[], rng: Rng = Math.random): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}

export interface GrammarQuestion {
  id: string;
  ruleCode: string;
  before: string;
  after: string;
  options: string[];
  answer: string;
  /** Word to show with its meaning as a hint (article questions). */
  word: string;
  translationIt: string | null;
  translationEn: string | null;
  /** Bank level of the source entry (when known), so translated hints find the right row. */
  cefrBand?: string | null;
}

export function buildArticleQuestion(
  entry: { word: string; article: string | null; meaning_it: string; meaning_en: string; cefr_band?: string },
  rng: Rng = Math.random,
): GrammarQuestion | null {
  if (!entry.article || !(ARTICLES as readonly string[]).includes(entry.article)) return null;
  return {
    id: `art:${entry.word}`,
    ruleCode: ARTICLE_RULE,
    before: '',
    after: ` ${entry.word}`,
    options: shuffle([...ARTICLES], rng),
    answer: entry.article,
    word: entry.word,
    translationIt: entry.meaning_it,
    translationEn: entry.meaning_en,
    cefrBand: entry.cefr_band ?? null,
  };
}

export function buildCaseQuestion(
  entry: { word: string; example_de: string; example_it: string; example_en: string; grammar_angle: string; cefr_band?: string },
  rng: Rng = Math.random,
): GrammarQuestion | null {
  const cloze = buildCaseCloze(entry.example_de, entry.grammar_angle);
  if (!cloze) return null;
  const initial = cloze.before.trim() === '';
  const fmt = (s: string) => (initial ? capitalize(s) : s);
  return {
    id: `case:${entry.word}`,
    ruleCode: entry.grammar_angle,
    before: cloze.before,
    after: cloze.after,
    options: caseOptions(cloze.answer, rng).map(fmt),
    answer: fmt(cloze.answer),
    word: entry.word,
    translationIt: entry.example_it,
    translationEn: entry.example_en,
    cefrBand: entry.cefr_band ?? null,
  };
}
