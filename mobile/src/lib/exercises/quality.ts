/**
 * Graded outcomes for exercises. A review is no longer just pass/fail: a typo, a
 * hint or a retry earns less credit than a clean answer, so the spaced-repetition
 * schedule reflects how hard the recall really was.
 */

/** Quality at or above this counts as a pass (logged as correct, bumps times_used). */
export const PASS_QUALITY = 0.5;

export const QUALITY = {
  exact: 1,
  close: 0.7,
  wrong: 0,
  /** Using the hint caps the credit for an otherwise correct answer. */
  hintCap: 0.6,
} as const;

/**
 * Quality ceilings per format. Recognising a word (or its sentence) is weaker
 * evidence than typing it, so these stay below 1: guessing alone cannot "master" a
 * word. They are also chosen so a clean answer never hurts the schedule: choice and
 * matching only serve fragile (new-tier, retention < 0.6) words, where 0.7/0.8 raise
 * the score, and reorder at 0.9 keeps any card at or above 0.9 there.
 */
export const FORMAT_QUALITY = {
  multiple_choice: 0.8,
  /** By mistakes made on that word during the round: 0, 1, 2 or more. */
  matching: [0.7, 0.4, 0] as readonly number[],
  sentence_reorder: { exact: 0.9, selfApproved: 0.5, wrong: 0 },
  /** Right word and right form / right word, wrong form (a miss on purpose) / wrong word. */
  find_mistake: { fixed: 0.9, foundOnly: 0.4, missed: 0 },
} as const;

export function matchingQuality(mistakes: number): number {
  const table = FORMAT_QUALITY.matching;
  return table[Math.min(Math.max(mistakes, 0), table.length - 1)];
}

export type TypedResult = 'exact' | 'close' | 'wrong';

/** Quality for a typed answer. A wrong answer stays 0 whether or not a hint was used. */
export function typedQuality(result: TypedResult, hintUsed: boolean): number {
  const q: number = QUALITY[result];
  return hintUsed ? Math.min(q, QUALITY.hintCap) : q;
}

/** Booleans become 1/0; numbers are clamped to [0, 1]; NaN counts as a fail. */
export function toQuality(outcome: boolean | number): number {
  if (typeof outcome === 'boolean') return outcome ? 1 : 0;
  if (Number.isNaN(outcome)) return 0;
  return Math.min(1, Math.max(0, outcome));
}
