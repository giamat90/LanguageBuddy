import {
  CASE_FORMS, DEFINITE_FORMS, INDEFINITE_FORMS, TWO_WAY_PREPOSITIONS, caseOptions, shuffle, type Rng,
} from '../grammar';
import type { ReviewCard } from '../../services/reviewService';
import { FORMAT_QUALITY } from './quality';
import type { FindMistakeModel } from './types';

/**
 * "Find the mistake": the word's own example sentence with ONE deliberately wrong
 * determiner. The learner taps the wrong word, then picks the right form.
 *
 * An exercise that marks a correct sentence as wrong is worse than none, so the
 * corruption is conservative:
 *  - gender kind: the article directly before the target noun is replaced by a form
 *    that is never valid for that noun's gender, in any case (NEVER_VALID);
 *  - case kind: a case-fixing determiner (dem, einem, einen, des, eines) is replaced by
 *    another form of its family. The governing verb/preposition fixes the case, so any
 *    other form is wrong there. Two-way prepositions (in, auf, …) are skipped: after
 *    them both dem and den can be right.
 */

export const MISTAKE_MIN_TOKENS = 4;
export const MISTAKE_MAX_TOKENS = 12;

type Article = 'der' | 'die' | 'das';

/** Forms that can precede this noun in SOME case (documentation and tests). */
export const GENDER_FORMS: Record<Article, string[]> = {
  der: ['der', 'den', 'dem', 'des'],
  die: ['die', 'der'],
  das: ['das', 'dem', 'des'],
};

/** Forms that can never precede a singular noun of this gender, in any case. */
export const NEVER_VALID: Record<Article, string[]> = {
  der: ['die', 'das'],
  die: ['das', 'den', 'dem', 'des'],
  das: ['der', 'die', 'den'],
};

/**
 * Nouns ending like this often have a plural identical to the singular (der Lehrer / die Lehrer,
 * das Zimmer / die Zimmer, das Handelsabkommen / die Handelsabkommen). For them "Die X wird …" reads
 * as a plural with the wrong verb, so the learner could blame the verb. Every article form is valid
 * for a neuter one (singular or plural), so neuter ones are skipped; for masculine ones only "das"
 * is certainly wrong.
 */
const PLURAL_LOOKALIKE = /(er|el|en|chen|lein)$/i;

const LEAD = /^[„"«(‹‚“‘']+/;
const TRAIL = /[.,!?;:“”"»)›’'…]+$/;

/** Splits quotes and punctuation off a token so the bare word can be compared and rebuilt. */
export function splitToken(token: string): { lead: string; core: string; trail: string } {
  const lead = token.match(LEAD)?.[0] ?? '';
  const rest = token.slice(lead.length);
  const trail = rest.match(TRAIL)?.[0] ?? '';
  return { lead, core: rest.slice(0, rest.length - trail.length), trail };
}

const DATIVE_PREPOSITIONS = new Set(['aus', 'bei', 'mit', 'nach', 'seit', 'von', 'zu']);
const ACCUSATIVE_PREPOSITIONS = new Set(['durch', 'für', 'gegen', 'ohne', 'um']);

/** Which grammar explanation fits a case-fixing determiner (both arguments lower-case). */
export function ruleForCaseForm(form: string, previousWord: string): string {
  if (form === 'des' || form === 'eines') return 'GENITIV_CASE';
  if (form === 'einen') return ACCUSATIVE_PREPOSITIONS.has(previousWord) ? 'ACCUSATIVE_PREP' : 'ACCUSATIVE_MASC';
  return DATIVE_PREPOSITIONS.has(previousWord) ? 'DATIV_PREP' : 'DATIV_INDIRECT_OBJ';
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
export function buildFindMistake(card: ReviewCard, rng: Rng): FindMistakeModel | null {
  if (!card.exampleDe) return null;
  const tokens = card.exampleDe.trim().split(/\s+/);
  if (tokens.length < MISTAKE_MIN_TOKENS || tokens.length > MISTAKE_MAX_TOKENS) return null;

  const core = (i: number) => splitToken(tokens[i]).core.toLowerCase();

  // Gender slot: the card's own article directly before the word.
  const article = card.article as Article | null;
  const lookalike = PLURAL_LOOKALIKE.test(card.word);
  let genderAt = -1;
  if (card.partOfSpeech === 'noun' && article && article in GENDER_FORMS && !(lookalike && article === 'das')) {
    const word = card.word.toLowerCase();
    for (let j = 1; j < tokens.length; j++) {
      if (core(j) === word && core(j - 1) === article) {
        genderAt = j - 1;
        break;
      }
    }
  }

  // Case slot: the first case-fixing determiner that is not right after a two-way preposition.
  let caseAt = -1;
  for (let i = 0; i < tokens.length; i++) {
    if (CASE_FORMS.has(core(i)) && !TWO_WAY_PREPOSITIONS.has(i > 0 ? core(i - 1) : '')) {
      caseAt = i;
      break;
    }
  }

  if (genderAt < 0 && caseAt < 0) return null;
  const useGender = genderAt >= 0 && (caseAt < 0 || rng() < 0.5);
  const index = useGender ? genderAt : caseAt;

  const original = tokens[index];
  const { lead, core: originalCore, trail } = splitToken(original);
  const originalLower = originalCore.toLowerCase();

  let wrongForm: string;
  if (useGender) {
    wrongForm = pick(lookalike && article === 'der' ? ['das'] : NEVER_VALID[article as Article], rng);
  } else {
    const family = DEFINITE_FORMS.includes(originalLower) ? DEFINITE_FORMS : INDEFINITE_FORMS;
    wrongForm = pick(family.filter((f) => f !== originalLower), rng);
  }

  const corrupted = [...tokens];
  corrupted[index] = lead + matchCase(wrongForm, originalCore) + trail;

  const forms = useGender ? shuffle(['der', 'die', 'das'], rng) : caseOptions(originalLower, rng);
  const options = forms.map((f) => matchCase(f, originalCore));

  return {
    kind: 'find_mistake',
    card,
    mistakeKind: useGender ? 'gender' : 'case',
    ruleCode: useGender ? 'NOUN_GENDER' : ruleForCaseForm(originalLower, index > 0 ? core(index - 1) : ''),
    tokens: corrupted,
    wrongIndex: index,
    correctToken: original,
    options,
    correctOption: options.indexOf(matchCase(originalLower, originalCore)),
  };
}
