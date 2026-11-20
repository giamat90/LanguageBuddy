import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Local SQLite schema. Mirrors the subset of the old server schema the standalone
 * app needs (CLAUDE.md §4), minus anything user- or chat-scoped.
 *
 * Exported (not just internal) so tests can simulate a pre-migration database by
 * running only these base CREATE TABLE statements, without the additive
 * `ensureColumn` calls `runMigrations` applies afterwards.
 */
export const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS schema_meta (
     key   TEXT PRIMARY KEY,
     value TEXT NOT NULL
   )`,

  `CREATE TABLE IF NOT EXISTS learner_profile (
     id                TEXT PRIMARY KEY,
     cefr_level        TEXT NOT NULL DEFAULT 'A1',
     topic_preferences TEXT NOT NULL DEFAULT '{}',
     created_at        TEXT NOT NULL,
     streak_days       INTEGER NOT NULL DEFAULT 0,
     last_active_at    TEXT,
     total_words_seen  INTEGER NOT NULL DEFAULT 0
   )`,

  `CREATE TABLE IF NOT EXISTS daily_items (
     id               TEXT PRIMARY KEY,
     date             TEXT NOT NULL UNIQUE,
     word             TEXT NOT NULL,
     article          TEXT,
     part_of_speech   TEXT,
     ipa              TEXT,
     meaning_en       TEXT,
     meaning_it       TEXT,
     example_de       TEXT,
     example_it       TEXT,
     cultural_note    TEXT,
     grammar_angle    TEXT,
     topic_domain     TEXT,
     cefr_band        TEXT,
     session_scenario TEXT,
     saved_at         TEXT
   )`,

  `CREATE TABLE IF NOT EXISTS vocabulary_items (
     id              TEXT PRIMARY KEY,
     word            TEXT NOT NULL UNIQUE,
     article         TEXT,
     translation_en  TEXT,
     translation_it  TEXT,
     part_of_speech  TEXT,
     source          TEXT NOT NULL DEFAULT 'word_of_the_day',
     times_seen      INTEGER NOT NULL DEFAULT 1,
     times_used      INTEGER NOT NULL DEFAULT 0,
     retention_score REAL NOT NULL DEFAULT 0.5,
     first_seen_at   TEXT NOT NULL,
     next_review_at  TEXT NOT NULL
   )`,

  `CREATE TABLE IF NOT EXISTS review_log (
     id            TEXT PRIMARY KEY,
     vocab_item_id TEXT NOT NULL,
     reviewed_at   TEXT NOT NULL,
     was_correct   INTEGER NOT NULL
   )`,

  // Per grammar-rule mastery (CLAUDE.md §7), updated by the grammar drill.
  `CREATE TABLE IF NOT EXISTS grammar_mastery (
     rule_code     TEXT PRIMARY KEY,
     mastery       REAL NOT NULL DEFAULT 0.5,
     seen_count    INTEGER NOT NULL DEFAULT 0,
     error_count   INTEGER NOT NULL DEFAULT 0,
     last_seen_at  TEXT
   )`,

  `CREATE INDEX IF NOT EXISTS idx_vocab_next_review ON vocabulary_items (next_review_at)`,

  // Cached "Chiedi a Lena" output, one row per word (opt-in AI feature).
  `CREATE TABLE IF NOT EXISTS ai_word_notes (
     word       TEXT PRIMARY KEY,
     payload    TEXT NOT NULL,
     created_at TEXT NOT NULL
   )`,
];

/** Idempotent column-adder: `CREATE TABLE IF NOT EXISTS` doesn't add columns to a
 *  table that already exists, so additive schema changes go through here instead. */
async function ensureColumn(
  db: SQLiteDatabase,
  table: string,
  column: string,
  ddl: string,
): Promise<void> {
  const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (!cols.some((c) => c.name === column)) {
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  for (const sql of STATEMENTS) {
    await db.execAsync(sql);
  }
  await ensureColumn(db, 'learner_profile', 'native_language', "native_language TEXT NOT NULL DEFAULT 'it'");
  await ensureColumn(db, 'daily_items', 'example_en', 'example_en TEXT');
  await ensureColumn(db, 'daily_items', 'cultural_note_en', 'cultural_note_en TEXT');
  // Graded review outcome in [0, 1]; null on rows logged before graded outcomes.
  await ensureColumn(db, 'review_log', 'quality', 'quality REAL');
}
