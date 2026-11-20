import { getDb, getMeta, setMeta } from './db';
import { WORDBANK_VERSION } from './wordbank';

/**
 * Runs once on app start: opens + migrates the local DB and records which word
 * bank version is bundled. No network, no remote seed — the word bank lives in
 * JS memory and daily words are generated lazily (see services/wordService.ts).
 */
export async function bootstrapLocalData(): Promise<void> {
  await getDb(); // opens + runs migrations
  const stored = await getMeta('wordbank_version');
  if (stored !== WORDBANK_VERSION) {
    await setMeta('wordbank_version', WORDBANK_VERSION);
    await setMeta('wordbank_seeded_at', new Date().toISOString());
  }
}
