import { getDb } from '../data/db';
import { uid } from '../data/ids';
import { nextReviewDate, updateRetentionScore } from '../data/srs';
import { allEntries } from '../data/wordbank';
import { PASS_QUALITY, toQuality } from '../lib/exercises/quality';
import { cancelReviewReminder, scheduleReviewReminder } from '../lib/notifications';

export interface ReviewCard {
  id: string;
  word: string;
  article: string | null;
  translationIt: string | null;
  translationEn: string | null;
  exampleDe: string | null;
  exampleIt: string | null;
  exampleEn: string | null;
  /** From the word bank; null/absent when the word is not in it. Used to pick multiple-choice distractors. */
  partOfSpeech?: string | null;
  cefrBand?: string | null;
  topicDomain?: string | null;
  timesSeen: number;
  retentionScore: number;
}

interface ReviewRow {
  id: string;
  word: string;
  article: string | null;
  translation_it: string | null;
  translation_en: string | null;
  times_seen: number;
  retention_score: number;
}

interface BankInfo {
  de: string;
  it: string;
  en: string;
  pos: string;
  band: string;
  topic: string;
}

let bankIndex: Map<string, BankInfo> | null = null;

function bankFor(word: string): BankInfo | undefined {
  if (!bankIndex) {
    bankIndex = new Map();
    for (const { level, entry } of allEntries()) {
      bankIndex.set(entry.word.toLowerCase(), {
        de: entry.example_de,
        it: entry.example_it,
        en: entry.example_en,
        pos: entry.part_of_speech,
        band: level,
        topic: entry.topic_domain,
      });
    }
  }
  return bankIndex.get(word.toLowerCase());
}

function toCard(r: ReviewRow): ReviewCard {
  const bank = bankFor(r.word);
  return {
    id: r.id,
    word: r.word,
    article: r.article,
    translationIt: r.translation_it,
    translationEn: r.translation_en,
    exampleDe: bank?.de ?? null,
    exampleIt: bank?.it ?? null,
    exampleEn: bank?.en ?? null,
    partOfSpeech: bank?.pos ?? null,
    cefrBand: bank?.band ?? null,
    topicDomain: bank?.topic ?? null,
    timesSeen: r.times_seen,
    retentionScore: r.retention_score,
  };
}

export async function dueCount(now: Date = new Date()): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>(
    'SELECT COUNT(*) AS c FROM vocabulary_items WHERE next_review_at <= ?',
    [now.toISOString()],
  );
  return row?.c ?? 0;
}

/** The smallest `next_review_at` across the whole vault, or null if it's empty. */
export async function earliestReviewDate(): Promise<Date | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ next_review_at: string }>(
    'SELECT next_review_at FROM vocabulary_items ORDER BY next_review_at ASC LIMIT 1',
  );
  return row ? new Date(row.next_review_at) : null;
}

async function refreshNow(): Promise<void> {
  const [due, earliest] = await Promise.all([dueCount(), earliestReviewDate()]);
  if (!earliest) {
    await cancelReviewReminder();
    return;
  }
  await scheduleReviewReminder(earliest, due);
}

// Refreshes cancel-then-schedule a single stored notification, so two running at once
// (a matching round grades 4–5 cards together) would each schedule one and orphan the
// other. Queue them: each recomputes from the DB, so the last one wins correctly.
let refreshQueue: Promise<unknown> = Promise.resolve();

/**
 * Recomputes and (re)schedules the local "ripasso" reminder from the vault's
 * current due dates. Call after anything that can change `next_review_at`:
 * saving today's word, grading a review, or restoring a backup.
 */
export function refreshReviewReminder(): Promise<void> {
  const run = refreshQueue.then(refreshNow, refreshNow);
  refreshQueue = run.catch(() => {}); // a failed refresh must not block the next one
  return run;
}

export async function fetchDueReviews(now: Date = new Date()): Promise<ReviewCard[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ReviewRow>(
    `SELECT id, word, article, translation_it, translation_en, times_seen, retention_score
       FROM vocabulary_items
       WHERE next_review_at <= ?
       ORDER BY next_review_at ASC`,
    [now.toISOString()],
  );
  return rows.map(toCard);
}

/** Every saved word, due or not, newest first: the pool free practice draws from. */
export async function fetchVaultCards(): Promise<ReviewCard[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ReviewRow>(
    `SELECT id, word, article, translation_it, translation_en, times_seen, retention_score
       FROM vocabulary_items
       ORDER BY first_seen_at DESC`,
  );
  return rows.map(toCard);
}

/**
 * Free-practice result for one word. Only a miss counts: it lowers retention and can
 * only move the next review EARLIER. A pass changes nothing, so repeating easy exercises
 * can never push a word's schedule out. Counters, the review log and the streak are untouched.
 */
export async function gradePractice(itemId: string, outcome: boolean | number): Promise<void> {
  const quality = toQuality(outcome);
  if (quality >= PASS_QUALITY) return;

  const db = await getDb();
  const row = await db.getFirstAsync<{ retention_score: number; times_seen: number; next_review_at: string }>(
    'SELECT retention_score, times_seen, next_review_at FROM vocabulary_items WHERE id = ?',
    [itemId],
  );
  if (!row) return;

  const newScore = updateRetentionScore(row.retention_score, quality, row.times_seen);
  const candidate = nextReviewDate(newScore).toISOString();
  // ISO timestamps sort lexicographically.
  const next = candidate < row.next_review_at ? candidate : row.next_review_at;

  await db.runAsync(
    'UPDATE vocabulary_items SET retention_score = ?, next_review_at = ? WHERE id = ?',
    [newScore, next, itemId],
  );

  refreshReviewReminder().catch((err) =>
    console.warn('[reviewService] refreshReviewReminder after practice failed:', err),
  );
}

/**
 * Grade one card: updates retention + schedules the next review. `outcome` is a
 * boolean (pass/fail) or a quality in [0, 1]; qualities >= PASS_QUALITY count as correct.
 */
export async function gradeReview(itemId: string, outcome: boolean | number): Promise<void> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ retention_score: number; times_seen: number; times_used: number }>(
    'SELECT retention_score, times_seen, times_used FROM vocabulary_items WHERE id = ?',
    [itemId],
  );
  if (!row) return;

  const quality = toQuality(outcome);
  const passed = quality >= PASS_QUALITY;
  const newScore = updateRetentionScore(row.retention_score, quality, row.times_seen);
  const next = nextReviewDate(newScore).toISOString();

  await db.runAsync(
    `UPDATE vocabulary_items
       SET retention_score = ?, next_review_at = ?, times_seen = ?, times_used = ?
       WHERE id = ?`,
    [
      newScore,
      next,
      row.times_seen + 1,
      row.times_used + (passed ? 1 : 0),
      itemId,
    ],
  );
  await db.runAsync(
    'INSERT INTO review_log (id, vocab_item_id, reviewed_at, was_correct, quality) VALUES (?, ?, ?, ?, ?)',
    [uid('rev_'), itemId, new Date().toISOString(), passed ? 1 : 0, quality],
  );

  refreshReviewReminder().catch((err) =>
    console.warn('[reviewService] refreshReviewReminder after grade failed:', err),
  );
}
