import type { ReviewCard } from '../../services/reviewService';
import type { Rng } from '../grammar';
import type { NativeLanguage } from '../../i18n/language';
import { PASS_QUALITY, toQuality } from './quality';
import { DEFAULT_GROUPS } from './registry';
import { tierOf } from './tier';
import type { GroupExerciseDefinition, MatchingModel } from './types';

/** A missed card comes back this many cards later (or at the end if fewer remain). */
export const RELEARN_GAP = 3;
/** Re-asks per card within one session. */
export const MAX_RETRIES = 2;

export interface SingleEntry {
  kind: 'single';
  card: ReviewCard;
  /** 0 = first attempt; >0 = relearning re-ask. */
  retry: number;
}

/** A set-based exercise covering several cards; always a first attempt. */
export interface GroupEntry {
  kind: 'group';
  model: MatchingModel;
  cards: ReviewCard[];
  retry: 0;
}

export type QueueEntry = SingleEntry | GroupEntry;

export interface SessionState {
  queue: QueueEntry[];
  position: number;
  /** Number of distinct due cards at the start (cards, not steps). */
  total: number;
  /** First attempts answered so far. */
  gradedCount: number;
  /** First attempts answered with quality >= PASS_QUALITY. */
  firstTryCorrect: number;
}

/** What to persist: only first attempts inform the schedule. */
export interface GradeInstruction {
  cardId: string;
  quality: number;
}

export interface SessionOptions {
  groups?: GroupExerciseDefinition[];
  rng?: Rng;
  /** Keep only the set-based rounds; cards that do not fit one are left out of the session. */
  groupsOnly?: boolean;
  /** The learner's app language: lets set-based rounds avoid repeated translated meanings. */
  lang?: NativeLanguage;
}

/**
 * Plans the queue: set-based rounds (e.g. matching) are formed first from the cards
 * whose tier they serve; every remaining card is a single, in its original order.
 */
export function createSession(cards: ReviewCard[], opts: SessionOptions = {}): SessionState {
  const groups = opts.groups ?? DEFAULT_GROUPS;
  const rng = opts.rng ?? Math.random;

  let rest = [...cards];
  const rounds: GroupEntry[] = [];
  for (const def of groups) {
    let pool = rest.filter((c) => def.tiers.includes(tierOf(c)));
    while (pool.length >= def.minSize) {
      const model = def.build(pool.slice(0, def.maxSize), rng, opts.lang);
      if (!model) break;
      rounds.push({ kind: 'group', model, cards: model.cards, retry: 0 });
      const used = new Set(model.cards.map((c) => c.id));
      pool = pool.filter((c) => !used.has(c.id));
      rest = rest.filter((c) => !used.has(c.id));
    }
  }

  const singles = opts.groupsOnly ? [] : rest.map((card): SingleEntry => ({ kind: 'single', card, retry: 0 }));
  return {
    queue: [...rounds, ...singles],
    position: 0,
    total: opts.groupsOnly ? rounds.reduce((n, r) => n + r.cards.length, 0) : cards.length,
    gradedCount: 0,
    firstTryCorrect: 0,
  };
}

export function currentEntry(s: SessionState): QueueEntry | undefined {
  return s.queue[s.position];
}

export function isFinished(s: SessionState): boolean {
  return s.position >= s.queue.length;
}

export function progress(s: SessionState): { current: number; total: number } {
  return { current: Math.min(s.gradedCount + 1, s.total), total: s.total };
}

/**
 * Records the result for the current single entry. Pure: returns the next state plus
 * the grade to persist (null for relearning retries, which are never graded).
 * A no-op when the current entry is a group (use submitGroupResult).
 */
export function submitResult(
  s: SessionState,
  rawQuality: number,
): { state: SessionState; grade: GradeInstruction | null } {
  const entry = currentEntry(s);
  if (!entry || entry.kind !== 'single') return { state: s, grade: null };

  const quality = toQuality(rawQuality);
  const passed = quality >= PASS_QUALITY;
  const firstAttempt = entry.retry === 0;

  const queue = [...s.queue];
  if (!passed && entry.retry < MAX_RETRIES) {
    const at = Math.min(s.position + 1 + RELEARN_GAP, queue.length);
    queue.splice(at, 0, { kind: 'single', card: entry.card, retry: entry.retry + 1 });
  }

  return {
    state: {
      ...s,
      queue,
      position: s.position + 1,
      gradedCount: s.gradedCount + (firstAttempt ? 1 : 0),
      firstTryCorrect: s.firstTryCorrect + (firstAttempt && passed ? 1 : 0),
    },
    grade: firstAttempt ? { cardId: entry.card.id, quality } : null,
  };
}

/**
 * Records a whole round: one grade per card (a missing quality counts as 0), and every
 * failing card is requeued as a single retry. A no-op when the current entry is not a group.
 */
export function submitGroupResult(
  s: SessionState,
  qualities: Record<string, number>,
): { state: SessionState; grades: GradeInstruction[] } {
  const entry = currentEntry(s);
  if (!entry || entry.kind !== 'group') return { state: s, grades: [] };

  const grades: GradeInstruction[] = entry.cards.map((card) => ({
    cardId: card.id,
    quality: toQuality(qualities[card.id] ?? 0),
  }));

  const queue = [...s.queue];
  let offset = 0;
  grades.forEach((g, i) => {
    if (g.quality >= PASS_QUALITY) return;
    const at = Math.min(s.position + 1 + RELEARN_GAP + offset, queue.length);
    queue.splice(at, 0, { kind: 'single', card: entry.cards[i], retry: 1 });
    offset += 1;
  });

  return {
    state: {
      ...s,
      queue,
      position: s.position + 1,
      gradedCount: s.gradedCount + grades.length,
      firstTryCorrect: s.firstTryCorrect + grades.filter((g) => g.quality >= PASS_QUALITY).length,
    },
    grades,
  };
}
