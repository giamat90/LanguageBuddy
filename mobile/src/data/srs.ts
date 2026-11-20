/**
 * Spaced-repetition + streak logic, ported verbatim from the old Python backend
 * (backend/app/services/srs.py and word_service.py) so behaviour is unchanged.
 */

import { toQuality } from '../lib/exercises/quality';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * backend srs.py:update_retention_score — recency-weighted update. `outcome` is a
 * boolean (pass/fail) or a graded quality in [0, 1] (partial credit).
 */
export function updateRetentionScore(
  currentScore: number,
  outcome: boolean | number,
  timesSeen: number,
): number {
  const weight = 1 / (1 + 0.1 * timesSeen);
  return round3(currentScore * (1 - weight) + toQuality(outcome) * weight);
}

/** backend srs.py:next_review_date — simplified SM-2, interval grows with retention. */
export function nextReviewDate(retentionScore: number, from: Date = new Date()): Date {
  let interval: number;
  if (retentionScore >= 0.9) interval = 21;
  else if (retentionScore >= 0.75) interval = 7;
  else if (retentionScore >= 0.6) interval = 3;
  else interval = 1;
  return new Date(from.getTime() + interval * DAY_MS);
}

/**
 * backend word_service.py:update_streak — call when the user saves the day's word.
 * `today`/`last` are calendar dates (YYYY-MM-DD).
 */
export function updateStreak(currentStreak: number, today: string, last: string | null): number {
  if (last === today) return currentStreak;
  if (last === isoDate(new Date(dateFromIso(today).getTime() - DAY_MS))) return currentStreak + 1;
  return 1;
}

export function isoDate(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function dateFromIso(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Grammar-rule mastery uses the same recency-weighted update as vocabulary retention. */
export const updateMastery = updateRetentionScore;

/** CLAUDE.md §7: rules below this are "weak". */
export const MASTERY_WEAK_THRESHOLD = 0.6;
