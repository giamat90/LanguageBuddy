import { create } from 'zustand';
import { MMKV } from 'react-native-mmkv';

/**
 * State of the automatic backup (TASK-023). Device-specific by nature (a folder grant
 * only exists on this phone), so it lives in its own MMKV store, `auto-backup`, which
 * is never part of a backup file and is excluded from Android's cloud backup.
 *
 * Key names are unique across stores on purpose: the jest MMKV mock shares one
 * dictionary between all store ids.
 */
const storage = new MMKV({ id: 'auto-backup' });

const KEY = {
  enabled: 'autoBackupEnabled',
  folderUri: 'autoBackupFolderUri',
  fileUris: 'autoBackupFileUris',
  lastRunAt: 'autoBackupLastRunAt',
  error: 'autoBackupError',
  dirty: 'autoBackupDirty',
} as const;

interface Data {
  /** The automatic trigger. The "Back up now" button works regardless. */
  enabled: boolean;
  /** SAF directory URI chosen by the user; null = not set. */
  folderUri: string | null;
  /** SAF file URIs this feature wrote itself, oldest first (used for rotation). */
  fileUris: string[];
  lastRunAt: string | null;
  /** A write failed: Settings shows a banner until a folder is chosen again. */
  error: boolean;
  /** Data changed since the last successful backup (survives an app restart). */
  dirty: boolean;
}

interface State extends Data {
  setEnabled: (v: boolean) => void;
  setFolderUri: (v: string | null) => void;
  setFileUris: (v: string[]) => void;
  setLastRunAt: (v: string | null) => void;
  setError: (v: boolean) => void;
  setDirty: (v: boolean) => void;
  reset: () => void;
}

const DEFAULTS: Data = {
  enabled: false,
  folderUri: null,
  fileUris: [],
  lastRunAt: null,
  error: false,
  dirty: false,
};

function readFileUris(): string[] {
  try {
    const parsed = JSON.parse(storage.getString(KEY.fileUris) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((u): u is string => typeof u === 'string') : [];
  } catch {
    return [];
  }
}

function load(): Data {
  return {
    enabled: storage.getBoolean(KEY.enabled) ?? false,
    folderUri: storage.getString(KEY.folderUri) ?? null,
    fileUris: readFileUris(),
    lastRunAt: storage.getString(KEY.lastRunAt) ?? null,
    error: storage.getBoolean(KEY.error) ?? false,
    dirty: storage.getBoolean(KEY.dirty) ?? false,
  };
}

function putString(key: string, value: string | null) {
  if (value === null) storage.delete(key);
  else storage.set(key, value);
}

export const useAutoBackupStore = create<State>((set) => ({
  ...load(),
  setEnabled: (enabled) => {
    storage.set(KEY.enabled, enabled);
    set({ enabled });
  },
  setFolderUri: (folderUri) => {
    putString(KEY.folderUri, folderUri);
    set({ folderUri });
  },
  setFileUris: (fileUris) => {
    storage.set(KEY.fileUris, JSON.stringify(fileUris));
    set({ fileUris });
  },
  setLastRunAt: (lastRunAt) => {
    putString(KEY.lastRunAt, lastRunAt);
    set({ lastRunAt });
  },
  setError: (error) => {
    storage.set(KEY.error, error);
    set({ error });
  },
  setDirty: (dirty) => {
    storage.set(KEY.dirty, dirty);
    set({ dirty });
  },
  reset: () => {
    Object.values(KEY).forEach((k) => storage.delete(k));
    set({ ...DEFAULTS });
  },
}));
