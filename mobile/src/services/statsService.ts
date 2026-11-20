import { getDb } from '../data/db';
import {
  computeStats, selectStatRows, statTierOf,
  type LearningStats, type StatTier, type VocabStatRow, type WordFilter,
} from '../lib/stats';
import type { SavedState } from '../lib/catalog';
import type { VaultItem } from '../types/domain';
import { fetchProfile } from './profileService';

export interface StatsSnapshot extends LearningStats {
  streakDays: number;
}

interface VocabRow {
  word: string;
  retention_score: number;
  times_seen: number;
}

/** Everything the statistics screen shows. Read-only; one pass over the vault. */
export async function fetchStats(): Promise<StatsSnapshot> {
  const db = await getDb();
  const vocab = await db.getAllAsync<VocabRow>(
    'SELECT word, retention_score, times_seen FROM vocabulary_items',
  );
  const logs = await db.getAllAsync<{ was_correct: number }>('SELECT was_correct FROM review_log');
  const profile = await fetchProfile();

  const rows: VocabStatRow[] = vocab.map((r) => ({
    word: r.word,
    retentionScore: r.retention_score,
    timesSeen: r.times_seen,
  }));
  const reviews = { total: logs.length, correct: logs.filter((l) => l.was_correct === 1).length };

  return { ...computeStats(rows, reviews), streakDays: profile?.streakDays ?? 0 };
}

export interface StatWord extends VaultItem {
  tier: StatTier;
}

interface WordRow {
  id: string;
  word: string;
  article: string | null;
  translation_it: string | null;
  translation_en: string | null;
  part_of_speech: string | null;
  retention_score: number;
  times_seen: number;
  next_review_at: string;
}

/** The saved words behind one number on the statistics screen, newest first. */
export async function fetchStatWords(filter: WordFilter): Promise<StatWord[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<WordRow>(
    `SELECT id, word, article, translation_it, translation_en, part_of_speech,
            retention_score, times_seen, next_review_at
       FROM vocabulary_items
       ORDER BY first_seen_at DESC`,
  );
  const mapped = rows.map((r) => ({
    id: r.id,
    word: r.word,
    article: r.article,
    translationIt: r.translation_it,
    translationEn: r.translation_en,
    partOfSpeech: r.part_of_speech,
    retentionScore: r.retention_score,
    timesSeen: r.times_seen,
    nextReviewAt: r.next_review_at,
  }));
  return selectStatRows(mapped, filter).map(({ timesSeen, ...item }) => ({
    ...item,
    tier: statTierOf({ retentionScore: item.retentionScore, timesSeen }),
  }));
}

/** The vault as the word catalog needs it: lowercased word -> id and SRS state (one query). */
export async function fetchSavedStates(): Promise<Map<string, SavedState>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string; word: string; retention_score: number; times_seen: number }>(
    'SELECT id, word, retention_score, times_seen FROM vocabulary_items',
  );
  const map = new Map<string, SavedState>();
  for (const r of rows) {
    const k = r.word.toLowerCase();
    if (!map.has(k)) map.set(k, { id: r.id, retentionScore: r.retention_score, timesSeen: r.times_seen });
  }
  return map;
}
