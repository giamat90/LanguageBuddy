import { buildChoiceCloze, caseForms, caseOptions, choiceOptions, shuffle, type Rng } from '../grammar';
import { getActivePack, type LanguagePack } from '../../languages';
import type { ReviewCard } from '../../services/reviewService';
import { FORMAT_QUALITY } from './quality';
import { sentenceTokens } from '../sentence';
import type { FindMistakeModel } from './types';

/**
 * "Find the mistake": the word's own example sentence with ONE deliberately wrong
 * determiner. The learner taps the wrong word, then picks the right form.
 *
 * An exercise that marks a correct sentence as wrong is worse than none, so the
 * corruption is conservative:
 *  - gender kind: the article directly before the target noun is replaced by a form
 *    that is never valid for that noun's gender, in any case (pack.gender.neverValid);
 *  - case kind: a case-fixing determiner (dem, einem, einen, des, eines) is replaced by
 *    another form of its family. The governing verb/preposition fixes the case, so any
 *    other form is wrong there. Two-way prepositions (in, auf, …) are skipped: after
 *    them both dem and den can be right.
 */

export const MISTAKE_MIN_TOKENS = 4;
export const MISTAKE_MAX_TOKENS = 12;

/** Splits quotes and punctuation off a token so the bare word can be compared and rebuilt. */
export function splitToken(
  token: string,
  pack: LanguagePack = getActivePack(),
): { lead: string; core: string; trail: string } {
  const lead = token.match(pack.punctuation.lead)?.[0] ?? '';
  const rest = token.slice(lead.length);
  const trail = rest.match(pack.punctuation.trail)?.[0] ?? '';
  return { lead, core: rest.slice(0, rest.length - trail.length), trail };
}

/** Which grammar explanation fits a German case-fixing determiner (both arguments lower-case). */
export function ruleForCaseForm(form: string, previousWord: string, pack: LanguagePack = getActivePack()): string {
  return pack.cases ? pack.cases.ruleForForm(form, previousWord) : '';
}

/** Capitalises `form` iff `like` starts with an upper-case letter (sentence-initial determiners). */
function matchCase(form: string, like: string): string {
  const first = like.charAt(0);
  const isUpper = first !== '' && first !== first.toLowerCase();
  return isUpper ? form.charAt(0).toUpperCase() + form.slice(1) : form;
}

export function mistakeQuality(found: boolean, fixed: boolean): number {
  if (!found) return FORMAT_QUALITY.find_mistake.missed;
  return fixed ? FORMAT_QUALITY.find_mistake.fixed : FORMAT_QUALITY.find_mistake.foundOnly;
}

function pick<T>(list: T[], rng: Rng): T {
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
}

/**
 * rng is consumed in a fixed order so seeded tests are reproducible: (1) one call to choose the
 * kind, only when both kinds are possible; (2) one call for the wrong form; (3) the options shuffle.
 */
export function buildFindMistake(card: ReviewCard, rng: Rng, pack: LanguagePack = getActivePack()): FindMistakeModel | null {
  if (!card.example) return null;
  const tokens = sentenceTokens(card.example, card.segments, pack);
  if (tokens.length < MISTAKE_MIN_TOKENS || tokens.length > MISTAKE_MAX_TOKENS) return null;

  const core = (i: number) => splitToken(tokens[i], pack).core.toLowerCase();
  const { gender, cases } = pack;

  // Gender slot: the card's own article directly before the word.
  const article = card.article;
  const lookalike = gender ? gender.pluralLookalike.test(card.word) : false;
  let genderAt = -1;
  if (
    gender && card.partOfSpeech === 'noun' && article && article in gender.forms &&
    !(lookalike && article === gender.lookalike.skipArticle)
  ) {
    const word = card.word.toLowerCase();
    for (let j = 1; j < tokens.length; j++) {
      if (core(j) === word && core(j - 1) === article) {
        genderAt = j - 1;
        break;
      }
    }
  }

  // Case slot: the first case-fixing determiner that is not right after a two-way preposition.
  const forms = caseForms(pack);
  let caseAt = -1;
  if (cases) {
    for (let i = 0; i < tokens.length; i++) {
      if (forms.has(core(i)) && !cases.twoWayPrepositions.has(i > 0 ? core(i - 1) : '')) {
        caseAt = i;
        break;
      }
    }
  }

  // Choice slot: the first member of a form set of the sentence's tagged rule.
  const choice = card.grammarAngle ? buildChoiceCloze(card.example, card.grammarAngle, pack, card.segments) : null;
  let choiceAt = -1;
  if (choice) {
    const sets = pack.choices!.ruleSets[card.grammarAngle as string];
    for (let i = 0; i < tokens.length; i++) {
      if (sets.some((s) => s.includes(core(i)))) {
        choiceAt = i;
        break;
      }
    }
  }

  // One rng call picks the kind, only when several are possible (two kinds: floor(rng()*2) equals rng() < 0.5 flipped).
  const kinds: Array<'gender' | 'case' | 'choice'> = [];
  if (genderAt >= 0) kinds.push('gender');
  if (caseAt >= 0) kinds.push('case');
  if (choiceAt >= 0) kinds.push('choice');
  if (kinds.length === 0) return null;
  const kind = kinds.length === 1 ? kinds[0] : kinds[Math.min(kinds.length - 1, Math.floor(rng() * kinds.length))];
  const useGender = kind === 'gender';
  const index = useGender ? genderAt : kind === 'case' ? caseAt : choiceAt;

  const original = tokens[index];
  const { lead, core: originalCore, trail } = splitToken(original, pack);
  const originalLower = originalCore.toLowerCase();

  let wrongForm: string;
  let choiceSet: readonly string[] = [];
  if (kind === 'choice') {
    choiceSet = choice!.set.includes(originalLower) ? choice!.set : pack.choices!.ruleSets[card.grammarAngle as string].find((s) => s.includes(originalLower))!;
    wrongForm = pick(choiceSet.filter((f) => f !== originalLower), rng);
  } else if (useGender) {
    const safe = lookalike ? gender!.lookalike.onlyWrongFor[article as string] : undefined;
    wrongForm = pick(safe ?? gender!.neverValid[article as string], rng);
  } else {
    const family = cases!.definiteForms.includes(originalLower) ? cases!.definiteForms : cases!.indefiniteForms;
    wrongForm = pick(family.filter((f) => f !== originalLower), rng);
  }

  const corrupted = [...tokens];
  corrupted[index] = lead + matchCase(wrongForm, originalCore) + trail;

  const genderForms = pack.articles ? pack.articles.forms : Object.keys(gender?.forms ?? {});
  const optionForms =
    kind === 'choice' ? choiceOptions(originalLower, choiceSet, rng)
    : useGender ? shuffle([...genderForms], rng)
    : caseOptions(originalLower, rng, pack);
  const options = optionForms.map((f) => matchCase(f, originalCore));

  return {
    kind: 'find_mistake',
    card,
    mistakeKind: kind,
    ruleCode: kind === 'choice' ? (card.grammarAngle as string) : useGender ? (pack.articles?.rule ?? '') : ruleForCaseForm(originalLower, index > 0 ? core(index - 1) : '', pack),
    tokens: corrupted,
    wrongIndex: index,
    correctToken: original,
    options,
    correctOption: options.indexOf(matchCase(originalLower, originalCore)),
  };
}
