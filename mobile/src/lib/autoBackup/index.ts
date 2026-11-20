import { AppState, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { addDatabaseChangeListener } from 'expo-sqlite';
import { BACKUP_TABLES, buildBackup } from '../../data/backup';
import { useAutoBackupStore } from '../../store/useAutoBackupStore';
import {
  AUTO_BACKUP_KEEP, STARTUP_RETRY_MS, autoBackupFileName, filesToPrune,
} from './helpers';
import { createBackupScheduler } from './scheduler';

/**
 * Automatic (and on-demand) backup to a folder the user picks once through Android's
 * Storage Access Framework (SAF) — TASK-023, ported from GymDiary's TASK-006.
 *
 * Provider-agnostic on purpose: the folder can be plain device storage, an SD card, or a
 * folder exposed by an installed cloud app (Google Drive, Dropbox…). This module only ever
 * calls the SAF API — no network call, no SDK, no OAuth, no token. If the folder is synced
 * by a cloud app, that app moves the file off the phone, not this code.
 *
 * Two independent triggers share `writeBackupToFolder`: the silent `runAutoBackupIfEnabled`
 * (driven by database changes through the scheduler) and the "Back up now" button in
 * Settings (always writes, whatever the switch says).
 *
 * The file is `buildBackup()` WITHOUT the AI key or provider settings: the folder may be
 * synced to the cloud by another app, so secrets never go in.
 *
 * Android only: the SAF API does not exist elsewhere.
 */

const isAndroid = () => Platform.OS === 'android';
const store = () => useAutoBackupStore.getState();

const TRACKED_TABLES = new Set<string>(BACKUP_TABLES);

/** Incremented on every relevant change; lets a write tell whether data changed while it ran. */
let changeSeq = 0;

// ─── folder ──────────────────────────────────────────────────────────────────

/** Opens the system folder picker; null if the user cancels. */
export async function requestAutoBackupFolder(): Promise<string | null> {
  const result = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  return result.granted ? result.directoryUri : null;
}

/** Records a newly chosen folder: fresh rotation list, no error, and data counts as unsaved
 *  so the new folder gets a copy. The old folder's files are left untouched. */
export function commitAutoBackupFolder(folderUri: string): void {
  const s = store();
  s.setFolderUri(folderUri);
  s.setFileUris([]);
  s.setError(false);
  s.setDirty(true);
}

/** The saved folder, or — if none — whatever the picker returns (committed). Null only when
 *  none was saved and the picker was cancelled. Shared by "enable" and "back up now". */
export async function ensureAutoBackupFolder(): Promise<string | null> {
  const existing = store().folderUri;
  if (existing) return existing;
  const folderUri = await requestAutoBackupFolder();
  if (!folderUri) return null;
  commitAutoBackupFolder(folderUri);
  return folderUri;
}

// ─── writing ─────────────────────────────────────────────────────────────────

/** Every write goes through this queue, so the automatic trigger and the button can never
 *  interleave their read-modify-write of the rotation list. */
let writeQueue: Promise<unknown> = Promise.resolve();

/**
 * Writes one backup into `folderUri` and prunes old ones down to AUTO_BACKUP_KEEP.
 * Throws on failure: callers decide whether to show it (the button) or swallow it (the
 * automatic path, see runAutoBackupIfEnabled).
 */
export function writeBackupToFolder(folderUri: string): Promise<void> {
  const run = writeQueue.then(() => writeNow(folderUri));
  // A rejected write must not poison the writes queued after it.
  writeQueue = run.catch(() => undefined);
  return run;
}

/**
 * The folder does not let this app create files in it. Seen with Google Drive folders: the
 * provider does not report them as writable through the folder grant (TASK-034). Callers
 * show a dedicated message and forget the folder instead of a vague "backup failed".
 */
export class FolderNotWritableError extends Error {
  constructor() {
    super('The backup folder cannot be written');
    this.name = 'FolderNotWritableError';
  }
}

type WriteStep = 'build' | 'create' | 'write';

/** Logs which step failed and the error's code, so a failure on one provider (Drive, say) can be
 *  told apart from another. Never the message: it can carry file names or learner content. */
function logStepFailure(step: WriteStep, err: unknown): void {
  const e = err as { name?: string; code?: string } | null;
  console.error('[autoBackup] step failed', step, e?.name, e?.code);
}

async function runStep<T>(step: WriteStep, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    logStepFailure(step, err);
    throw err;
  }
}

async function writeNow(folderUri: string): Promise<void> {
  const seq = changeSeq;
  const saf = FileSystem.StorageAccessFramework;
  const backup = await runStep('build', () => buildBackup()); // never includeAiKey

  const fileUri = await runStep('create', () =>
    saf.createFileAsync(folderUri, autoBackupFileName(new Date()), 'application/json'),
  ).catch(() => {
    throw new FolderNotWritableError(); // already logged by runStep
  });
  try {
    await runStep('write', () => saf.writeAsStringAsync(fileUri, JSON.stringify(backup)));
  } catch (err) {
    // Do not leave an empty file in the user's folder that rotation would never find.
    await saf.deleteAsync(fileUri).catch(() => undefined);
    throw err;
  }

  const uris = [...store().fileUris, fileUri];
  const deleted = new Set<string>();
  for (const uri of filesToPrune(uris, AUTO_BACKUP_KEEP)) {
    try {
      await saf.deleteAsync(uri);
      deleted.add(uri);
    } catch {
      // Stays tracked, and "oldest", so the next write retries it instead of leaking a file
      // that was never actually removed.
    }
  }

  const s = store();
  s.setFileUris(uris.filter((u) => !deleted.has(u)));
  s.setLastRunAt(new Date().toISOString());
  s.setError(false);
  // Only if nothing changed while we were writing; otherwise the scheduler already queued another run.
  if (seq === changeSeq) s.setDirty(false);
}

/** Silent path used by the scheduler and the startup retry. Never throws. Does nothing when
 *  there is nothing unsaved, so a retry and a scheduled run cannot both write the same data. */
export async function runAutoBackupIfEnabled(): Promise<void> {
  if (!isAndroid()) return;
  const s = store();
  if (!s.enabled || !s.folderUri || !s.dirty) return;
  try {
    await writeBackupToFolder(s.folderUri);
  } catch (err) {
    // Name only: never log learner content or provider messages.
    console.error('[autoBackup] write failed', (err as Error)?.name);
    store().setError(true);
  }
}

// ─── scheduling and tracking ─────────────────────────────────────────────────

const scheduler = createBackupScheduler({ run: runAutoBackupIfEnabled });

/** Turning the switch off also drops any backup that was waiting for its timer. */
export function setAutoBackupEnabled(enabled: boolean): void {
  store().setEnabled(enabled);
  if (!enabled) scheduler.cancel();
}

let stopTracking: (() => void) | null = null;

/**
 * Starts listening for database changes (call once, after bootstrap). While the switch is on,
 * a change to any backed-up table marks the data unsaved and schedules a backup; going to the
 * background flushes a pending one; unsaved changes left by a previous run are backed up shortly
 * after start. Returns a function that undoes all of it. Idempotent.
 */
export function startAutoBackupTracking(): () => void {
  if (!isAndroid()) return () => {};
  if (stopTracking) return stopTracking;

  const dbSubscription = addDatabaseChangeListener((event) => {
    if (!TRACKED_TABLES.has(event.tableName)) return;
    const s = store();
    if (!s.enabled || !s.folderUri) return;
    changeSeq++;
    if (!s.dirty) s.setDirty(true); // avoid a storage write per changed row
    scheduler.notifyChange();
  });

  const appSubscription = AppState.addEventListener('change', (state) => {
    if (state === 'background') scheduler.flush();
  });

  const initial = store();
  const startupRetry =
    initial.enabled && initial.folderUri && initial.dirty
      ? setTimeout(() => {
          void runAutoBackupIfEnabled();
        }, STARTUP_RETRY_MS)
      : null;

  const stop = () => {
    dbSubscription.remove();
    appSubscription.remove();
    if (startupRetry) clearTimeout(startupRetry);
    scheduler.cancel();
    stopTracking = null;
  };
  stopTracking = stop;
  return stop;
}

/**
 * What the app calls once the database is ready. Tracking starts IMMEDIATELY; the folder check
 * runs in the background. Order matters: a slow or unreachable provider (Drive offline, say) must
 * not delay tracking, or changes made meanwhile would never be marked unsaved. Safe to start
 * first: a folder that turns out to be stale just switches the feature off, and the tracker
 * already ignores changes while it is off.
 */
export function initAutoBackup(): () => void {
  if (!isAndroid()) return () => {};
  const stop = startAutoBackupTracking();
  void validateAutoBackupFolder().catch((err) => {
    console.error('[autoBackup] folder check failed', (err as Error)?.name);
  });
  return stop;
}

/**
 * Startup-only check: after a reinstall, Android's own backup can bring back the saved folder
 * while the SAF permission grant itself is gone. If the folder is no longer accessible, reset
 * quietly to "off / not set" — expected Android behaviour, not a malfunction, so no error banner.
 */
export async function validateAutoBackupFolder(): Promise<void> {
  if (!isAndroid()) return;
  const s = store();
  if (!s.folderUri) return;
  try {
    await FileSystem.StorageAccessFramework.readDirectoryAsync(s.folderUri);
  } catch {
    s.setEnabled(false);
    s.setFolderUri(null);
    s.setFileUris([]);
    s.setError(false);
    s.setDirty(false);
  }
}
