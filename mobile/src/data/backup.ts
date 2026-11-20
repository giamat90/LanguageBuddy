import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { MMKV } from 'react-native-mmkv';

import { getDb, resetDbHandle } from './db';
import { coerceNativeLanguage, isNativeLanguage, type NativeLanguage } from '../i18n/language';
import {
  getProvider, setProvider, getStoredKey, setKey,
  getOpenAiBaseUrl, setOpenAiBaseUrl, getOpenAiModel, setOpenAiModel,
  DEFAULT_OPENAI_BASE_URL, DEFAULT_OPENAI_MODEL, type AiProvider,
} from '../lib/ai/keys';

/**
 * On-device backup / restore for the standalone offline app.
 *
 * A backup is a single `.json` file holding:
 *   - `db`  — every row of the user-data tables (profile, saved words + SRS,
 *              daily-word history, review log)
 *   - `kv`  — the handful of MMKV values that live outside SQLite
 *             (install id, onboarding flag, CEFR level, streak)
 *   - manifest fields (`format`, `appVersion`, `createdAt`, `counts`) used for
 *             the restore confirmation and a compatibility check
 *
 * Export hands the file to the system share sheet (save to Drive / Files / send
 * to self). Restore replaces ALL local data with a picked backup. There is no
 * automatic app reload (expo-updates isn't bundled) — the caller tells the user
 * to relaunch.
 */

const BACKUP_FORMAT = 1;
const APP_TAG = 'GermanBuddy';

/** User-data tables, in FK-safe insert order. schema_meta is deliberately
 *  excluded — it's local bundle state, re-derived on next launch. */
const DATA_TABLES = [
  'learner_profile',
  'daily_items',
  'vocabulary_items',
  'review_log',
] as const;

/** Tables added after format 1; absent from older backups, so never required. */
const OPTIONAL_TABLES = ['grammar_mastery'] as const;
const ALL_TABLES = [...DATA_TABLES, ...OPTIONAL_TABLES];

/** Tables that make up a backup; a write to any of them means the backup is out of date. */
export const BACKUP_TABLES: readonly string[] = ALL_TABLES;

const appMeta = new MMKV({ id: 'app-meta' });
const userStore = new MMKV({ id: 'user-store' });
const wordStore = new MMKV({ id: 'word-store' });
const vaultStore = new MMKV({ id: 'vault-store' });

export interface BackupKv {
  installId?: string;
  hasProfile?: boolean;
  cefrLevel?: string;
  streakDays?: number;
  nativeLanguage?: NativeLanguage;
  /** AI settings: only present when the user opted in at export time. The keys
   *  are plaintext secrets. `anthropicApiKey` predates multi-provider support. */
  anthropicApiKey?: string;
  aiProvider?: AiProvider;
  openaiApiKey?: string;
  openaiBaseUrl?: string;
  openaiModel?: string;
}

export interface BackupOptions {
  includeAiKey?: boolean;
}

export interface BackupFile {
  format: number;
  app: string;
  appVersion: string;
  createdAt: string;
  counts: { vocab: number; daysLearned: number };
  db: Record<string, Record<string, unknown>[]>;
  kv: BackupKv;
}

export interface RestorePreview {
  data: BackupFile;
  compatible: boolean;
  reason?: string;
}

/** Sentinel: restore finished — the user just needs to relaunch the app. */
export const RESTART_REQUIRED = 'RESTART_REQUIRED';

function stamp(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
}

function collectAiKv(): BackupKv {
  const anthropicKey = getStoredKey('anthropic');
  const openaiKey = getStoredKey('openai');
  const baseUrl = getOpenAiBaseUrl();
  const model = getOpenAiModel();
  return {
    aiProvider: getProvider(),
    ...(anthropicKey ? { anthropicApiKey: anthropicKey } : {}),
    ...(openaiKey ? { openaiApiKey: openaiKey } : {}),
    ...(baseUrl !== DEFAULT_OPENAI_BASE_URL ? { openaiBaseUrl: baseUrl } : {}),
    ...(model !== DEFAULT_OPENAI_MODEL ? { openaiModel: model } : {}),
  };
}

function collectKv(opts: BackupOptions): BackupKv {
  return {
    ...(opts.includeAiKey ? collectAiKv() : {}),
    installId: appMeta.getString('installId'),
    hasProfile: userStore.getBoolean('hasProfile'),
    cefrLevel: userStore.getString('cefrLevel'),
    streakDays: wordStore.getNumber('streakDays'),
    nativeLanguage: userStore.getString('nativeLanguage') as NativeLanguage | undefined,
  };
}

// ─── export ───────────────────────────────────────────────────────────────────

/** Builds the backup object from the live database + MMKV. Exported for tests. */
export async function buildBackup(opts: BackupOptions = {}): Promise<BackupFile> {
  const db = await getDb();
  try {
    await db.execAsync('PRAGMA wal_checkpoint(TRUNCATE);');
  } catch {
    /* non-fatal */
  }

  const dump: Record<string, Record<string, unknown>[]> = {};
  for (const table of ALL_TABLES) {
    dump[table] = await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${table}`);
  }

  return {
    format: BACKUP_FORMAT,
    app: APP_TAG,
    appVersion: Constants.expoConfig?.version ?? 'unknown',
    createdAt: new Date().toISOString(),
    counts: {
      vocab: dump.vocabulary_items.length,
      daysLearned: dump.daily_items.filter((r) => r.saved_at != null).length,
    },
    db: dump,
    kv: collectKv(opts),
  };
}

export async function exportBackup(opts: BackupOptions = {}): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('La condivisione non è disponibile su questo dispositivo.');
  }

  const backup = await buildBackup(opts);
  const target = `${FileSystem.cacheDirectory}${APP_TAG}-backup-${stamp()}.json`;
  await FileSystem.writeAsStringAsync(target, JSON.stringify(backup), {
    encoding: FileSystem.EncodingType.UTF8,
  });

  await Sharing.shareAsync(target, {
    mimeType: 'application/json',
    dialogTitle: 'Salva il backup di GermanBuddy',
    UTI: 'public.json',
  });
}

// ─── restore ──────────────────────────────────────────────────────────────────

function validate(raw: unknown): BackupFile {
  if (!raw || typeof raw !== 'object') throw new Error('Il file di backup non è valido.');
  const b = raw as Partial<BackupFile>;
  if (b.app !== APP_TAG || typeof b.format !== 'number' || !b.db || typeof b.db !== 'object') {
    throw new Error('Questo file non è un backup di GermanBuddy.');
  }
  for (const table of DATA_TABLES) {
    if (!Array.isArray(b.db[table])) {
      throw new Error('Il backup è incompleto o danneggiato.');
    }
  }
  return b as BackupFile;
}

/** Opens the file picker, parses + validates the backup, returns a preview for
 *  the confirmation dialog. Returns null if the user cancels. */
export async function pickBackup(): Promise<RestorePreview | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'application/octet-stream', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets?.[0]) return null;

  let text: string;
  try {
    text = await FileSystem.readAsStringAsync(res.assets[0].uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
  } catch {
    throw new Error('Impossibile leggere il file selezionato.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Il file di backup è danneggiato.');
  }

  const data = validate(parsed);

  let compatible = true;
  let reason: string | undefined;
  if (data.format > BACKUP_FORMAT) {
    compatible = false;
    reason = 'Questo backup è stato creato da una versione più recente di GermanBuddy. Aggiorna l\'app.';
  }

  return { data, compatible, reason };
}

/**
 * Replaces ALL local data with the previously-picked backup. The caller is
 * responsible for the "are you sure" confirmation. Throws RESTART_REQUIRED on
 * success — restore worked, the app just needs a manual relaunch.
 */
export async function restoreBackup(preview: RestorePreview): Promise<never> {
  if (!preview.compatible) {
    throw new Error(preview.reason ?? 'Questo backup non può essere ripristinato.');
  }

  const { db: dump, kv } = preview.data;
  const db = await getDb();

  // Column names from the file are interpolated into SQL, so only ever use ones the
  // installed schema really has. That also lets a backup from a newer app (extra
  // columns) restore here, and keeps a crafted file from injecting SQL via a key.
  const known = new Map<string, Set<string>>();
  for (const table of ALL_TABLES) {
    const info = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
    known.set(table, new Set(info.map((c) => c.name)));
  }

  await db.withTransactionAsync(async () => {
    // Wipe in reverse order, refill in forward order.
    for (const table of [...ALL_TABLES].reverse()) {
      await db.runAsync(`DELETE FROM ${table}`);
    }
    for (const table of ALL_TABLES) {
      const allowed = known.get(table)!;
      for (const row of dump[table] ?? []) {
        const cols = Object.keys(row).filter((c) => allowed.has(c));
        if (cols.length === 0) continue;
        const placeholders = cols.map(() => '?').join(', ');
        await db.runAsync(
          `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`,
          cols.map((c) =>
            table === 'learner_profile' && c === 'native_language'
              ? coerceNativeLanguage(row[c])
              : (row[c] as SQLiteBindValue),
          ),
        );
      }
    }
  });

  // MMKV values.
  if (kv.installId) appMeta.set('installId', kv.installId);
  if (typeof kv.hasProfile === 'boolean') userStore.set('hasProfile', kv.hasProfile);
  if (kv.cefrLevel) userStore.set('cefrLevel', kv.cefrLevel);
  else userStore.delete('cefrLevel');
  // A language this build does not know (tampered or future file) is dropped, not trusted.
  if (isNativeLanguage(kv.nativeLanguage)) userStore.set('nativeLanguage', kv.nativeLanguage);
  else userStore.delete('nativeLanguage');
  if (typeof kv.streakDays === 'number') wordStore.set('streakDays', kv.streakDays);
  restoreAiSettings(kv);

  // Drop the stale vault list cache so it re-reads from the restored DB.
  vaultStore.delete('vault_cache');

  // Force a clean DB handle on next launch.
  // Awaited: the callers re-open the database right away, and an old connection that is still
  // closing would answer the new one's first statement with "database is locked".
  await resetDbHandle();

  throw new Error(RESTART_REQUIRED);
}

/** Applies only what the backup carries; never clears existing AI settings. */
function restoreAiSettings(kv: BackupKv): void {
  if (kv.anthropicApiKey) setKey('anthropic', kv.anthropicApiKey);
  if (kv.openaiApiKey) setKey('openai', kv.openaiApiKey);
  if (kv.aiProvider === 'anthropic' || kv.aiProvider === 'openai') setProvider(kv.aiProvider);
  if (kv.openaiModel) setOpenAiModel(kv.openaiModel);
  // A base URL is only honoured together with the backup's own key: otherwise a
  // crafted file could repoint the user's EXISTING key at a hostile host.
  if (kv.openaiBaseUrl && kv.openaiApiKey) {
    try {
      setOpenAiBaseUrl(kv.openaiBaseUrl);
    } catch (err) {
      console.error('[backup] ignoring invalid openaiBaseUrl in backup:', err);
    }
  }
}

type SQLiteBindValue = string | number | null;
