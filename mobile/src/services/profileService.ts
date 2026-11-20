import { getDb } from '../data/db';
import { uid } from '../data/ids';
import { isoDate } from '../data/srs';
import type { CefrLevel } from '../data/wordbank';
import { coerceNativeLanguage, type NativeLanguage } from '../i18n/language';
import { TOPIC_KEYS } from '../lib/topics';

export interface LocalProfile {
  id: string;
  cefrLevel: CefrLevel;
  topicPreferences: Record<string, number>;
  streakDays: number;
  lastActiveAt: string | null;
  totalWordsSeen: number;
  nativeLanguage: NativeLanguage;
}

export interface OnboardingInput {
  cefr_level: string;
  topic_preferences: Record<string, number>;
  native_language?: NativeLanguage;
}

interface ProfileRow {
  id: string;
  cefr_level: string;
  topic_preferences: string;
  streak_days: number;
  last_active_at: string | null;
  total_words_seen: number;
  native_language: string;
}

function mapRow(row: ProfileRow): LocalProfile {
  let prefs: Record<string, number> = {};
  try {
    prefs = JSON.parse(row.topic_preferences) as Record<string, number>;
  } catch {
    prefs = {};
  }
  return {
    id: row.id,
    cefrLevel: (row.cefr_level as CefrLevel) ?? 'A1',
    topicPreferences: prefs,
    streakDays: row.streak_days ?? 0,
    lastActiveAt: row.last_active_at,
    totalWordsSeen: row.total_words_seen ?? 0,
    nativeLanguage: coerceNativeLanguage(row.native_language),
  };
}

export async function fetchProfile(): Promise<LocalProfile | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<ProfileRow>('SELECT * FROM learner_profile LIMIT 1');
  return row ? mapRow(row) : null;
}

export async function submitOnboarding(payload: OnboardingInput): Promise<LocalProfile> {
  const db = await getDb();
  const existing = await db.getFirstAsync<ProfileRow>('SELECT * FROM learner_profile LIMIT 1');
  const prefs = JSON.stringify(payload.topic_preferences ?? {});
  const nativeLanguage = coerceNativeLanguage(payload.native_language);

  if (existing) {
    await db.runAsync(
      'UPDATE learner_profile SET cefr_level = ?, topic_preferences = ?, native_language = ? WHERE id = ?',
      [payload.cefr_level, prefs, nativeLanguage, existing.id],
    );
  } else {
    await db.runAsync(
      `INSERT INTO learner_profile (id, cefr_level, topic_preferences, created_at, streak_days, total_words_seen, native_language)
       VALUES (?, ?, ?, ?, 0, 0, ?)`,
      [uid('prof_'), payload.cefr_level, prefs, isoDate(), nativeLanguage],
    );
  }
  const profile = await fetchProfile();
  if (!profile) throw new Error('profile write failed');
  return profile;
}

/**
 * Replace the learner's topic selection. Takes effect from the next new daily word
 * (today's is already stored). An all-inactive map is rejected: it would silently
 * mean "every topic", which is not what the learner asked for.
 */
export async function setTopicPreferences(prefs: Record<string, number>): Promise<void> {
  if (!Object.entries(prefs).some(([k, v]) => TOPIC_KEYS.includes(k) && v >= 0.5)) {
    throw new Error('at least one topic must stay selected');
  }
  const db = await getDb();
  const profile = await fetchProfile();
  if (!profile) return;
  await db.runAsync('UPDATE learner_profile SET topic_preferences = ? WHERE id = ?', [
    JSON.stringify(prefs),
    profile.id,
  ]);
}

export async function setUserNativeLanguage(lang: NativeLanguage): Promise<void> {
  const db = await getDb();
  const profile = await fetchProfile();
  if (!profile) return;
  await db.runAsync('UPDATE learner_profile SET native_language = ? WHERE id = ?', [lang, profile.id]);
}
