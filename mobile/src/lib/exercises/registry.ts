import { buildCloze } from '../cloze';
import { pickWeighted, type Rng } from '../grammar';
import type { ReviewCard } from '../../services/reviewService';
import { buildMultipleChoice, getDistractorPool } from './distractors';
import { MATCH_MAX, MATCH_MIN, buildMatchingRound } from './matching';
import { buildFindMistake } from './mistake';
import { buildReorder } from './reorder';
import { buildToneChoice } from './tone';
import { tierOf } from './tier';
import type { NativeLanguage } from '../../i18n/language';
import type {
  ExerciseDefinition, ExerciseModel, FlashcardModel, GroupExerciseDefinition,
} from './types';

/** Production: type the missing word. Preferred for words the learner already knows somewhat. */
export const TYPED_CLOZE: ExerciseDefinition = {
  kind: 'typed_cloze',
  tiers: ['learning', 'strong'],
  weight: 2,
  build(card) {
    const cloze = buildCloze(card.example, card.word, undefined, card.segments);
    return cloze ? { kind: 'typed_cloze', card, before: cloze.before, after: cloze.after } : null;
  },
};

/** Syntax in context: rebuild the example sentence from tiles. */
export const SENTENCE_REORDER: ExerciseDefinition = {
  kind: 'sentence_reorder',
  tiers: ['learning', 'strong'],
  weight: 1,
  build: (card, rng) => buildReorder(card, rng),
};

/** Grammar in context: spot the wrong article or case form in the word's sentence, then fix it. */
export const FIND_MISTAKE: ExerciseDefinition = {
  kind: 'find_mistake',
  tiers: ['learning', 'strong'],
  weight: 1,
  build: (card, rng) => buildFindMistake(card, rng),
};

/** Recognition: the easy first rung for new or fragile words. */
export const MULTIPLE_CHOICE: ExerciseDefinition = {
  kind: 'multiple_choice',
  tiers: ['new'],
  weight: 1,
  build: (card, rng, lang) => buildMultipleChoice(card, getDistractorPool(), rng, lang),
};

/** Pronunciation: the tones of a new word (only languages with a reading layer can build it). */
export const TONE_CHOICE: ExerciseDefinition = {
  kind: 'tone_choice',
  tiers: ['new'],
  weight: 1,
  build: (card, rng) => buildToneChoice(card, rng),
};

function flashcardModel(card: ReviewCard): FlashcardModel {
  return { kind: 'flashcard', card };
}

export const FLASHCARD: ExerciseDefinition = {
  kind: 'flashcard',
  tiers: ['new', 'learning', 'strong'],
  fallback: true,
  build: flashcardModel,
};

/** New single-card formats are added here. The order maps a weighted pick to a format, so tests that pin an rng depend on it. */
export const DEFAULT_REGISTRY: ExerciseDefinition[] = [
  TYPED_CLOZE,
  SENTENCE_REORDER,
  FIND_MISTAKE,
  MULTIPLE_CHOICE,
  TONE_CHOICE,
  FLASHCARD,
];

/** Set-based exercise: a round of 4–5 new words on one screen. */
export const MATCHING: GroupExerciseDefinition = {
  kind: 'matching',
  tiers: ['new'],
  minSize: MATCH_MIN,
  maxSize: MATCH_MAX,
  build: buildMatchingRound,
};

export const DEFAULT_GROUPS: GroupExerciseDefinition[] = [MATCHING];

/**
 * Picks the exercise for a card: among non-fallback definitions that serve the
 * card's tier and can be built for it, one is chosen by weight with `rng`; if none
 * apply, the fallback (a flashcard, which can always be built).
 */
export function pickExercise(
  card: ReviewCard,
  registry: ExerciseDefinition[] = DEFAULT_REGISTRY,
  rng: Rng = Math.random,
  lang?: NativeLanguage,
): ExerciseModel {
  const tier = tierOf(card);
  const models: ExerciseModel[] = [];
  const weights: number[] = [];
  for (const def of registry) {
    if (def.fallback || !def.tiers.includes(tier)) continue;
    const model = def.build(card, rng, lang);
    if (!model) continue;
    models.push(model);
    weights.push(def.weight ?? 1);
  }
  if (models.length === 1) return models[0];
  if (models.length > 1) return models[pickWeighted(weights, rng)];
  return registry.find((d) => d.fallback)?.build(card, rng) ?? flashcardModel(card);
}
