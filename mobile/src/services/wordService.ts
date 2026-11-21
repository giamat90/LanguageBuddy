import { getDb } from '../data/db';
import { uid } from '../data/ids';
import { isoDate, updateStreak } from '../data/srs';
import { nextReviewDate } from '../data/srs';
import { pickNextWord } from '../data/dailyWord';
import { getInstallId } from '../data/installId';
import { fetchProfile } from './profileService';
import { activeTopicKeys } from '../lib/topics';
import { refreshReviewReminder } from './reviewService';
import { DailyWord } from '../types/domain';
import { WORD_BANK } from '../data/wordbank';
import type { CefrLevel } from '../data/wordbank';

export interface SaveWordResult {
  streak_days: number;
  already_saved: boolean;
}

interface DailyItemRow {
  id: string;
  date: string;
  word: string;
  article: string | null;
  part_of_speech: string | null;
  ipa: string | null;
  meaning_en: string | null;
  meaning_it: string | null;
  example_de: string | null;
  example_it: string | null;
  example_en: string | null;
  cultural_note: string | null;
  cultural_note_en: string | null;
  grammar_angle: string | null;
  topic_domain: string | null;
  cefr_band: string | null;
  session_scenario: string | null;
  saved_at: string | null;
}

function mapRow(r: DailyItemRow): DailyWord {
  return {
    id: r.id,
    word: r.word,
    article: r.article,
    partOfSpeech: r.part_of_speech,
    ipa: r.ipa,
    meaningIt: r.meaning_it,
    meaningEn: r.meaning_en,
    example: r.example_de,
    exampleIt: r.example_it,
    exampleEn: r.example_en,
    culturalNote: r.cultural_note,
    culturalNoteEn: r.cultural_note_en,
    grammarAngle: r.grammar_angle,
    topicDomain: r.topic_domain,
    cefrBand: r.cefr_band,
    date: r.date,
    isSaved: r.saved_at != null,
  };
}

async function usedWords(): Promise<Set<string>> {
  const db = await getDb();
  const a = await db.getAllAsync<{ word: string }>('SELECT word FROM daily_items');
  const b = await db.getAllAsync<{ word: string }>('SELECT word FROM vocabulary_items');
  return new Set([...a, ...b].map((r) => r.word.toLowerCase()));
}

/** Today's word — generates and persists it on first call each calendar day. */
export async function fetchTodayWord(): Promise<DailyWord | null> {
  const db = await getDb();
  const today = isoDate();

  const existing = await db.getFirstAsync<DailyItemRow>(
    'SELECT * FROM daily_items WHERE date = ?',
    [today],
  );
  if (existing) return mapRow(existing);

  const profile = await fetchProfile();
  if (!profile) return null;

  const level: CefrLevel = profile.cefrLevel ?? 'A1';
  const { entry, id } = pickNextWord(
    level,
    getInstallId(),
    await usedWords(),
    activeTopicKeys(profile.topicPreferences),
  );

  await db.runAsync(
    `INSERT INTO daily_items
       (id, date, word, article, part_of_speech, ipa, meaning_en, meaning_it,
        example_de, example_it, example_en, cultural_note, cultural_note_en, grammar_angle,
        topic_domain, cefr_band, session_scenario, saved_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    [
      `${id}:${today}`, today, entry.word, entry.article, entry.part_of_speech, entry.ipa,
      entry.meaning_en, entry.meaning_it, entry.example, entry.example_it, entry.example_en,
      entry.cultural_note, entry.cultural_note_en, entry.grammar_angle, entry.topic_domain,
      entry.cefr_band, entry.session_scenario,
    ],
  );

  await db.runAsync(
    'UPDATE learner_profile SET total_words_seen = total_words_seen + 1 WHERE id = ?',
    [profile.id],
  );

  const row = await db.getFirstAsync<DailyItemRow>('SELECT * FROM daily_items WHERE date = ?', [today]);
  return row ? mapRow(row) : null;
}

/** Save today's word into the vault, update the streak. */
export async function saveWord(): Promise<SaveWordResult> {
  const db = await getDb();
  const today = isoDate();

  const daily = await db.getFirstAsync<DailyItemRow>(
    'SELECT * FROM daily_items WHERE date = ?',
    [today],
  );
  if (!daily) throw new Error('no word for today');

  const profile = await fetchProfile();
  if (!profile) throw new Error('no profile');

  if (daily.saved_at) {
    return { streak_days: profile.streakDays, already_saved: true };
  }

  const now = new Date().toISOString();
  await db.runAsync('UPDATE daily_items SET saved_at = ? WHERE id = ?', [now, daily.id]);

  // upsert vocabulary_items (port of word_service.upsert_vocabulary_item)
  const existingVocab = await db.getFirstAsync<{ id: string; times_seen: number }>(
    'SELECT id, times_seen FROM vocabulary_items WHERE word = ?',
    [daily.word],
  );
  if (existingVocab) {
    await db.runAsync('UPDATE vocabulary_items SET times_seen = times_seen + 1 WHERE id = ?', [
      existingVocab.id,
    ]);
  } else {
    await db.runAsync(
      `INSERT INTO vocabulary_items
         (id, word, article, translation_en, translation_it, part_of_speech, source,
          times_seen, times_used, retention_score, first_seen_at, next_review_at)
       VALUES (?, ?, ?, ?, ?, ?, 'word_of_the_day', 1, 0, 0.5, ?, ?)`,
      [
        uid('vocab_'), daily.word, daily.article, daily.meaning_en, daily.meaning_it,
        daily.part_of_speech, now, nextReviewDate(0.5).toISOString(),
      ],
    );
  }

  const newStreak = updateStreak(
    profile.streakDays,
    today,
    profile.lastActiveAt ? profile.lastActiveAt.slice(0, 10) : null,
  );
  await db.runAsync(
    'UPDATE learner_profile SET streak_days = ?, last_active_at = ? WHERE id = ?',
    [newStreak, now, profile.id],
  );

  refreshReviewReminder().catch((err) =>
    console.warn('[wordService] refreshReviewReminder after save failed:', err),
  );

  return { streak_days: newStreak, already_saved: false };
}

export interface StartLearningResult {
  added: boolean;
  id: string | null;
}

// Starts run one at a time: two taps on the same word must not both pass the "already
// saved?" check. (The device has a single process and a single database handle.)
let startQueue: Promise<unknown> = Promise.resolve();

async function startLearningNow(level: CefrLevel, word: string): Promise<StartLearningResult> {
  // Only the level and the word come from the screen; everything stored comes from the bank.
  const entry = WORD_BANK[level]?.find((e) => e.word === word);
  if (!entry) throw new Error('unknown word');

  const db = await getDb();
  const wanted = entry.word.toLowerCase();
  const rows = await db.getAllAsync<{ id: string; word: string }>('SELECT id, word FROM vocabulary_items');
  const existing = rows.find((r) => r.word.toLowerCase() === wanted);
  if (existing) return { added: false, id: existing.id };

  const id = uid('vocab_');
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO vocabulary_items
       (id, word, article, translation_en, translation_it, part_of_speech, source,
        times_seen, times_used, retention_score, first_seen_at, next_review_at)
     VALUES (?, ?, ?, ?, ?, ?, 'catalog', 1, 0, 0.5, ?, ?)`,
    [id, entry.word, entry.article, entry.meaning_en, entry.meaning_it, entry.part_of_speech,
      now, nextReviewDate(0.5).toISOString()],
  );

  refreshReviewReminder().catch((err) =>
    console.warn('[wordService] refreshReviewReminder after start failed:', err),
  );
  return { added: true, id };
}

/**
 * Adds a word of the bank to the vault from a word list (CLAUDE.md §7): same starting state
 * as saving today's word, but it never touches the streak, the profile or the daily items.
 */
export function startLearning(level: CefrLevel, word: string): Promise<StartLearningResult> {
  const run = startQueue.then(() => startLearningNow(level, word));
  startQueue = run.catch(() => {}); // a failed start must not block the next one
  return run;
}
