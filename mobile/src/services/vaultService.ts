import { getDb } from '../data/db';
import { allEntries } from '../data/wordbank';
import { VaultItem, VaultWordDetail } from '../types/domain';
import type { WordInsightResult } from '../lib/ai/wordInsight';
import type { NativeLanguage } from '../i18n/language';

interface VocabRow {
  id: string;
  word: string;
  article: string | null;
  translation_it: string | null;
  translation_en: string | null;
  part_of_speech: string | null;
  retention_score: number;
  next_review_at: string;
}

function mapRow(r: VocabRow): VaultItem {
  return {
    id: r.id,
    word: r.word,
    article: r.article,
    translationIt: r.translation_it,
    translationEn: r.translation_en,
    partOfSpeech: r.part_of_speech,
    retentionScore: r.retention_score,
    nextReviewAt: r.next_review_at,
  };
}

export async function fetchVault(
  page: number,
  pageSize = 20,
): Promise<{ items: VaultItem[]; total: number }> {
  const db = await getDb();
  const offset = (Math.max(1, page) - 1) * pageSize;

  const rows = await db.getAllAsync<VocabRow>(
    `SELECT id, word, article, translation_it, translation_en, part_of_speech, retention_score, next_review_at
       FROM vocabulary_items
       ORDER BY first_seen_at DESC
       LIMIT ? OFFSET ?`,
    [pageSize, offset],
  );
  const countRow = await db.getFirstAsync<{ c: number }>(
    'SELECT COUNT(*) AS c FROM vocabulary_items',
  );

  return { items: rows.map(mapRow), total: countRow?.c ?? 0 };
}

interface VocabDetailRow {
  id: string;
  word: string;
  article: string | null;
  translation_it: string | null;
  translation_en: string | null;
  part_of_speech: string | null;
  retention_score: number;
  next_review_at: string;
  times_seen: number;
  times_used: number;
  first_seen_at: string;
}

interface DailyDetailRow {
  ipa: string | null;
  meaning_it: string | null;
  example_de: string | null;
  example_it: string | null;
  example_en: string | null;
  cultural_note: string | null;
  cultural_note_en: string | null;
  cefr_band: string | null;
}

/**
 * Full card for one saved word. The SRS fields come from `vocabulary_items`; the
 * example sentence / cultural note / IPA come from the `daily_items` row it was
 * saved from, falling back to the bundled word bank if that row is gone.
 */
export async function fetchVaultWord(id: string): Promise<VaultWordDetail | null> {
  const db = await getDb();
  const v = await db.getFirstAsync<VocabDetailRow>(
    'SELECT * FROM vocabulary_items WHERE id = ?',
    [id],
  );
  if (!v) return null;

  const daily = await db.getFirstAsync<DailyDetailRow>(
    'SELECT ipa, meaning_it, example_de, example_it, example_en, cultural_note, cultural_note_en, cefr_band FROM daily_items WHERE word = ? ORDER BY saved_at DESC LIMIT 1',
    [v.word],
  );

  const bank = allEntries().find(
    (e) => e.entry.word.toLowerCase() === v.word.toLowerCase(),
  )?.entry;

  return {
    id: v.id,
    word: v.word,
    article: v.article,
    ipa: daily?.ipa ?? bank?.ipa ?? null,
    partOfSpeech: v.part_of_speech ?? bank?.part_of_speech ?? null,
    meaningIt: v.translation_it ?? daily?.meaning_it ?? bank?.meaning_it ?? null,
    meaningEn: v.translation_en ?? bank?.meaning_en ?? null,
    exampleDe: daily?.example_de ?? bank?.example_de ?? null,
    exampleIt: daily?.example_it ?? bank?.example_it ?? null,
    exampleEn: daily?.example_en ?? bank?.example_en ?? null,
    culturalNote: daily?.cultural_note ?? bank?.cultural_note ?? null,
    culturalNoteEn: daily?.cultural_note_en ?? bank?.cultural_note_en ?? null,
    cefrBand: daily?.cefr_band ?? bank?.cefr_band ?? null,
    retentionScore: v.retention_score,
    nextReviewAt: v.next_review_at,
    timesSeen: v.times_seen,
    timesUsed: v.times_used,
    firstSeenAt: v.first_seen_at,
  };
}

/**
 * Cached "Approfondisci" output for a word in the given app language, or null if
 * none was generated in that language. The table has one row per word (no schema
 * change), so the language is stored inside the payload; a row written in another
 * language, or before the language was recorded, is treated as absent so the
 * learner never sees translations in the wrong language.
 */
export async function getWordInsight(word: string, lang: NativeLanguage): Promise<WordInsightResult | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ payload: string }>(
    'SELECT payload FROM ai_word_notes WHERE word = ?',
    [word],
  );
  if (!row) return null;
  try {
    const { lang: cachedLang, ...result } = JSON.parse(row.payload) as WordInsightResult & { lang?: string };
    return cachedLang === lang ? (result as WordInsightResult) : null;
  } catch {
    return null;
  }
}

export async function saveWordInsight(word: string, result: WordInsightResult, lang: NativeLanguage): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO ai_word_notes (word, payload, created_at) VALUES (?, ?, ?)
       ON CONFLICT(word) DO UPDATE SET payload = excluded.payload, created_at = excluded.created_at`,
    [word, JSON.stringify({ ...result, lang }), new Date().toISOString()],
  );
}
