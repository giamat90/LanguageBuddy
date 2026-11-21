import { de } from '../languages/de';
import { getActivePack, type LanguagePack } from '../languages';

export type Rng = () => number;

/** Rule codes the case-cloze can drill for this language (none when it has no cases). */
export function caseRules(pack: LanguagePack = getActivePack()): string[] {
  return pack.cases ? Object.keys(pack.cases.ruleForms) : [];
}

/** The article question's rule code, or null when the language has no article drill. */
export function articleRule(pack: LanguagePack = getActivePack()): string | null {
  return pack.articles ? pack.articles.rule : null;
}

// German constants kept for callers and tests that name them; code paths read the pack.
/** Every determiner form that fixes a case on its own (einen, dem, einem, des, eines). */
export const CASE_FORMS = new Set<string>(Object.values(de.cases!.ruleForms).flat());
export const DEFINITE_FORMS = de.cases!.definiteForms;
export const INDEFINITE_FORMS = de.cases!.indefiniteForms;
// After these, both accusative and dative are grammatical (dem/den both fit), so
// the blank would have two defensible answers.
export const TWO_WAY_PREPOSITIONS = de.cases!.twoWayPrepositions;

/** Every case-fixing form of the pack (see CASE_FORMS for German). */
export function caseForms(pack: LanguagePack = getActivePack()): Set<string> {
  return new Set(pack.cases ? Object.values(pack.cases.ruleForms).flat() : []);
}

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
export function buildCaseCloze(
  sentence: string | null | undefined,
  ruleCode: string,
  pack: LanguagePack = getActivePack(),
): CaseCloze | null {
  const cases = pack.cases;
  const forms = cases?.ruleForms[ruleCode];
  if (!cases || !sentence || !forms) return null;
  const parts = sentence.split(pack.letters);
  let prevWord = '';
  for (let i = 1; i < parts.length; i += 2) {
    const lower = parts[i].toLowerCase();
    if (forms.includes(lower) && !cases.twoWayPrepositions.has(prevWord)) {
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
export function caseOptions(answer: string, rng: Rng = Math.random, pack: LanguagePack = getActivePack()): string[] {
  const cases = pack.cases;
  if (!cases) return [answer];
  const family = cases.definiteForms.includes(answer) ? cases.definiteForms : cases.indefiniteForms;
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
  pack: LanguagePack = getActivePack(),
): GrammarQuestion | null {
  const articles = pack.articles;
  if (!articles || !entry.article || !articles.forms.includes(entry.article)) return null;
  return {
    id: `art:${entry.word}`,
    ruleCode: articles.rule,
    before: '',
    after: ` ${entry.word}`,
    options: shuffle([...articles.forms], rng),
    answer: entry.article,
    word: entry.word,
    translationIt: entry.meaning_it,
    translationEn: entry.meaning_en,
    cefrBand: entry.cefr_band ?? null,
  };
}

export function buildCaseQuestion(
  entry: { word: string; example: string; example_it: string; example_en: string; grammar_angle: string; cefr_band?: string },
  rng: Rng = Math.random,
  pack: LanguagePack = getActivePack(),
): GrammarQuestion | null {
  const cloze = buildCaseCloze(entry.example, entry.grammar_angle, pack);
  if (!cloze) return null;
  const initial = cloze.before.trim() === '';
  const fmt = (s: string) => (initial ? capitalize(s) : s);
  return {
    id: `case:${entry.word}`,
    ruleCode: entry.grammar_angle,
    before: cloze.before,
    after: cloze.after,
    options: caseOptions(cloze.answer, rng, pack).map(fmt),
    answer: fmt(cloze.answer),
    word: entry.word,
    translationIt: entry.example_it,
    translationEn: entry.example_en,
    cefrBand: entry.cefr_band ?? null,
  };
}
