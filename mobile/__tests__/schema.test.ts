import * as SQLite from 'expo-sqlite';
import { runMigrations, STATEMENTS } from '../src/data/schema';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sqlite = require('expo-sqlite');

beforeEach(() => {
  sqlite.__reset();
});

describe('runMigrations', () => {
  it('is idempotent — running it twice does not error or duplicate columns', async () => {
    const db = await SQLite.openDatabaseAsync('idempotent.db');
    await runMigrations(db);
    await expect(runMigrations(db)).resolves.not.toThrow();

    const cols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(learner_profile)');
    const names = cols.map((c) => c.name);
    expect(names.filter((n) => n === 'native_language')).toHaveLength(1);
  });

  it('adds native_language/example_en/cultural_note_en to a pre-migration database', async () => {
    const db = await SQLite.openDatabaseAsync('pre-migration.db');
    // Simulate a DB created before this task's columns existed.
    for (const sql of STATEMENTS) await db.execAsync(sql);

    await expect(runMigrations(db)).resolves.not.toThrow();

    const profileCols = (await db.getAllAsync<{ name: string }>('PRAGMA table_info(learner_profile)')).map((c) => c.name);
    expect(profileCols).toContain('native_language');

    const dailyCols = (await db.getAllAsync<{ name: string }>('PRAGMA table_info(daily_items)')).map((c) => c.name);
    expect(dailyCols).toContain('example_en');
    expect(dailyCols).toContain('cultural_note_en');

    // A row inserted before the migration (no native_language value) still reads
    // back without error — the app-level fallback to 'it' lives in profileService.
    await db.runAsync(
      `INSERT INTO learner_profile (id, cefr_level, topic_preferences, created_at, streak_days, total_words_seen)
       VALUES ('p1', 'A1', '{}', '2026-01-01', 0, 0)`,
    );
    const row = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM learner_profile WHERE id = ?',
      ['p1'],
    );
    expect(row?.id).toBe('p1');
  });

  it('adds review_log.quality to a pre-migration database, once', async () => {
    const db = await SQLite.openDatabaseAsync('pre-quality.db');
    for (const sql of STATEMENTS) await db.execAsync(sql);

    const before = (await db.getAllAsync<{ name: string }>('PRAGMA table_info(review_log)')).map((c) => c.name);
    expect(before).not.toContain('quality'); // base statements must stay untouched

    await runMigrations(db);
    await runMigrations(db);

    const after = (await db.getAllAsync<{ name: string }>('PRAGMA table_info(review_log)')).map((c) => c.name);
    expect(after.filter((n) => n === 'quality')).toHaveLength(1);
  });
});
