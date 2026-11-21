/**
 * Pure helpers for the automatic backup (TASK-023, ported from GymDiary TASK-006).
 * No React Native, no storage: everything here is unit-testable in plain Node.
 */
import { getActivePack } from '../../languages';

/** Newest automatic backups kept in the folder. More than GymDiary's 5: data changes far more often than workouts end. */
export const AUTO_BACKUP_KEEP = 10;
/** A backup is written this long after the LAST change, so a burst of changes is one backup. */
export const DEBOUNCE_MS = 30_000;
/** During continuous activity a backup still happens at most this long after the FIRST unsaved change. */
export const MAX_WAIT_MS = 5 * 60_000;
/** After app start, unsaved changes from the previous run are backed up after this short delay. */
export const STARTUP_RETRY_MS = 10_000;

/**
 * Sortable by construction (zero-padded, most significant first), in local time. No
 * extension: the document provider adds ".json" from the MIME type given to createFileAsync.
 */
export function autoBackupFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `${getActivePack().app.backupTag.toLowerCase()}-auto-${date}-${time}`;
}

/**
 * Given the SAF file URIs this feature wrote itself, oldest first, returns the ones to
 * delete to stay at `keep`. The order comes from our own bookkeeping, not from listing
 * the folder: SAF document URIs are opaque and do not reliably encode a name or a time
 * across providers (Drive, Dropbox, local storage).
 */
export function filesToPrune(uris: readonly string[], keep: number): string[] {
  if (uris.length <= keep) return [];
  return uris.slice(0, uris.length - keep);
}
