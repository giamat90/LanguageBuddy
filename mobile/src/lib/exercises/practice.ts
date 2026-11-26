import { buildCloze } from '../cloze';
import { getActivePack, type LanguagePack } from '../../languages';
import { pickWeighted, type Rng } from '../grammar';
import type { ReviewCard } from '../../services/reviewService';
import { distractorSupply } from './distractors';
import { MATCH_MIN, buildMatchingRound } from './matching';
import { buildFindMistake } from './mistake';
import { buildReorder } from './reorder';
import { buildToneChoice } from './tone';
import {
  DEFAULT_REGISTRY, FIND_MISTAKE, FLASHCARD, MATCHING, MULTIPLE_CHOICE, SENTENCE_REORDER, TONE_CHOICE,
  TYPED_CLOZE,
} from './registry';
import type { ExerciseDefinition, GroupExerciseDefinition, Tier } from './types';

/**
 * Free practice: the learner picks a format and trains on saved words whenever they like.
 * It reuses the review engine but ignores the review ladder (tiers) — and, by design,
 * only a miss ever touches the schedule (see gradePractice in reviewService).
 */

export type PracticeFormat =
  | 'mixed'
  | 'matching'
  | 'multiple_choice'
  | 'sentence_reorder'
  | 'find_mistake'
  | 'typed_cloze'
  | 'tone_choice';

/** The formats every language starts from, in menu order. */
export const PRACTICE_FORMATS: PracticeFormat[] = [
  'mixed', 'matching', 'multiple_choice', 'sentence_reorder', 'find_mistake', 'typed_cloze',
];

/** What the menu offers for a language: only formats it can build. */
export function practiceFormats(pack: LanguagePack = getActivePack()): PracticeFormat[] {
  const hasSlot = Boolean(pack.gender || pack.cases || pack.choices);
  const formats = PRACTICE_FORMATS.filter((f) => f !== 'find_mistake' || hasSlot);
  return pack.reading ? [...formats, 'tone_choice'] : formats;
}

export const PRACTICE_SIZE = 10;
/** Weak words are favoured, but strong ones still come up. */
export const PRACTICE_WEAK_FLOOR = 0.15;

const ALL_TIERS: Tier[] = ['new', 'learning', 'strong'];

function anyTier<T extends { tiers: Tier[] }>(def: T): T {
  return { ...def, tiers: ALL_TIERS };
}

/** Unknown or missing values (and bad URLs) mean "mixed". */
export function parsePracticeFormat(raw: unknown): PracticeFormat {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return practiceFormats().includes(value as PracticeFormat) ? (value as PracticeFormat) : 'mixed';
}

export interface PracticeConfig {
  registry: ExerciseDefinition[];
  groups: GroupExerciseDefinition[];
  /** Only set-based rounds: words that do not fit a round are left out, not turned into flip-cards. */
  groupsOnly: boolean;
}

export function practiceConfig(format: PracticeFormat): PracticeConfig {
  switch (format) {
    case 'typed_cloze':
      return { registry: [anyTier(TYPED_CLOZE), FLASHCARD], groups: [], groupsOnly: false };
    case 'sentence_reorder':
      return { registry: [anyTier(SENTENCE_REORDER), FLASHCARD], groups: [], groupsOnly: false };
    case 'multiple_choice':
      return { registry: [anyTier(MULTIPLE_CHOICE), FLASHCARD], groups: [], groupsOnly: false };
    case 'find_mistake':
      return { registry: [anyTier(FIND_MISTAKE), FLASHCARD], groups: [], groupsOnly: false };
    case 'tone_choice':
      return { registry: [anyTier(TONE_CHOICE), FLASHCARD], groups: [], groupsOnly: false };
    case 'matching':
      return { registry: [FLASHCARD], groups: [anyTier(MATCHING)], groupsOnly: true };
    case 'mixed':
      // Single-card formats only: with matching rounds a 10-word session would be little else.
      return {
        registry: DEFAULT_REGISTRY.map((d) => (d.fallback ? d : anyTier(d))),
        groups: [],
        groupsOnly: false,
      };
  }
}

/** Can this word be turned into an exercise of the given format? */
export function canPractice(card: ReviewCard, format: PracticeFormat, rng: Rng = Math.random): boolean {
  switch (format) {
    case 'typed_cloze':
      return buildCloze(card.example, card.word, undefined, card.segments) !== null;
    case 'sentence_reorder':
      return buildReorder(card, rng) !== null;
    case 'find_mistake':
      return buildFindMistake(card, rng) !== null;
    case 'tone_choice':
      return buildToneChoice(card, rng) !== null;
    case 'multiple_choice':
      // Cheap on purpose (this runs for every saved word): enough same-type words to draw from.
      // The rare card whose distractors then clash falls back to a flip-card in the session.
      return Boolean(
        card.partOfSpeech && card.translationIt && card.translationEn &&
          distractorSupply(card.partOfSpeech) > 3,
      );
    case 'matching':
      return Boolean(card.translationIt?.trim() && card.translationEn?.trim());
    case 'mixed':
      return true;
  }
}

const weakness = (c: ReviewCard) => Math.max(1 - c.retentionScore, 0) + PRACTICE_WEAK_FLOOR;

/**
 * Up to `count` words for a session: only words the format can be built for, drawn
 * without repeats, weaker words more likely. Matching needs MATCH_MIN usable words.
 */
export function selectPracticeCards(
  cards: ReviewCard[],
  format: PracticeFormat,
  count: number = PRACTICE_SIZE,
  rng: Rng = Math.random,
): ReviewCard[] {
  const pool = cards.filter((c) => canPractice(c, format, rng));
  if (format === 'matching' && pool.length < MATCH_MIN) return [];

  const picked: ReviewCard[] = [];
  while (picked.length < count && pool.length > 0) {
    picked.push(...pool.splice(pickWeighted(pool.map(weakness), rng), 1));
  }
  return picked;
}

/** Which formats the vault can support right now (drives the menu). */
export function practiceAvailability(cards: ReviewCard[]): Record<PracticeFormat, boolean> {
  const result = {} as Record<PracticeFormat, boolean>;
  for (const format of practiceFormats()) {
    if (format === 'matching') {
      const usable = cards.filter((c) => canPractice(c, 'matching'));
      result[format] = usable.length >= MATCH_MIN && buildMatchingRound(usable, () => 0) !== null;
    } else {
      result[format] = cards.some((c) => canPractice(c, format));
    }
  }
  return result;
}
