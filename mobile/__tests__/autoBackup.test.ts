import { AppState, Platform } from 'react-native';
import { _resetDbForTests, getDb } from '../src/data/db';
import { submitOnboarding } from '../src/services/profileService';
import { fetchTodayWord, saveWord } from '../src/services/wordService';
import { fetchDueReviews, gradeReview } from '../src/services/reviewService';
import { buildBackup } from '../src/data/backup';
import { setKey, setProvider, setOpenAiBaseUrl } from '../src/lib/ai/keys';
import { useAutoBackupStore } from '../src/store/useAutoBackupStore';
import {
  requestAutoBackupFolder, commitAutoBackupFolder, ensureAutoBackupFolder, writeBackupToFolder,
  runAutoBackupIfEnabled, validateAutoBackupFolder, startAutoBackupTracking, setAutoBackupEnabled,
  initAutoBackup,
  FolderNotWritableError,
} from '../src/lib/autoBackup';
import { AUTO_BACKUP_KEEP, DEBOUNCE_MS, STARTUP_RETRY_MS } from '../src/lib/autoBackup/helpers';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sqlite = require('expo-sqlite');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { MMKV } = require('react-native-mmkv');

const mockSaf = {
  picker: { granted: true, directoryUri: 'content://tree/picked' } as { granted: boolean; directoryUri?: string },
  created: [] as { uri: string; name: string; mime: string }[],
  written: new Map<string, string>(),
  deleted: [] as string[],
  deleteCalls: [] as string[],
  failDelete: new Set<string>(),
  failCreate: false,
  failCode: '',
  failWrite: false,
  dirOk: true,
  dirHangs: false,
  readDirCalls: 0,
  counter: 0,
  events: [] as string[],
  onCreate: null as null | (() => void),
};

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.0.0' } },
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => {}),
}));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-file-system', () => ({
  cacheDirectory: 'file:///cache/',
  EncodingType: { UTF8: 'utf8' },
  writeAsStringAsync: jest.fn(async () => {}),
  readAsStringAsync: jest.fn(async () => ''),
  StorageAccessFramework: {
    requestDirectoryPermissionsAsync: jest.fn(async () => mockSaf.picker),
    createFileAsync: jest.fn(async (parent: string, name: string, mime: string) => {
      mockSaf.events.push('create:start');
      await Promise.resolve();
      await Promise.resolve();
      mockSaf.onCreate?.();
      if (mockSaf.failCreate) throw Object.assign(new Error('secret-detail'), mockSaf.failCode ? { code: mockSaf.failCode } : {});
      const uri = `${parent}/doc-${++mockSaf.counter}`;
      mockSaf.created.push({ uri, name, mime });
      mockSaf.events.push('create:end');
      return uri;
    }),
    writeAsStringAsync: jest.fn(async (uri: string, contents: string) => {
      if (mockSaf.failWrite) throw new Error('disk full');
      mockSaf.written.set(uri, contents);
    }),
    readDirectoryAsync: jest.fn(async () => {
      mockSaf.readDirCalls++;
      if (mockSaf.dirHangs) return new Promise<string[]>(() => {}); // a provider that never answers
      if (!mockSaf.dirOk) throw new Error('gone');
      return [];
    }),
    deleteAsync: jest.fn(async (uri: string) => {
      mockSaf.deleteCalls.push(uri);
      if (mockSaf.failDelete.has(uri)) throw new Error('nope');
      mockSaf.deleted.push(uri);
      mockSaf.written.delete(uri);
    }),
  },
}));

const FOLDER = 'content://tree/backups';
const PREFS = { food: 0.8, travel: 0.8, work: 0.3, culture: 0.3, home: 0.3, leisure: 0.3, health: 0.3, shopping: 0.3 };
const store = () => useAutoBackupStore.getState();
const doc = (n: number) => `${FOLDER}/doc-${n}`;

let os: { restore: () => void; replaceValue: (v: unknown) => void };

async function seedWord(): Promise<string> {
  await submitOnboarding({ cefr_level: 'A1', topic_preferences: PREFS });
  await fetchTodayWord();
  await saveWord();
  const [card] = await fetchDueReviews(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000));
  return card.id;
}

function enable() {
  store().setFolderUri(FOLDER);
  store().setEnabled(true);
}

beforeEach(() => {
  sqlite.__reset();
  _resetDbForTests();
  new MMKV().clearAll();
  store().reset();
  Object.assign(mockSaf, {
    picker: { granted: true, directoryUri: 'content://tree/picked' },
    created: [], deleted: [], deleteCalls: [], events: [], counter: 0,
    failDelete: new Set(), failCreate: false, failCode: '', failWrite: false, dirOk: true, dirHangs: false, readDirCalls: 0, onCreate: null,
  });
  mockSaf.written.clear();
  (AppState.addEventListener as jest.Mock).mockClear(); // shared mock: forget earlier tests' subscriptions
  os = jest.replaceProperty(Platform, 'OS', 'android') as unknown as typeof os;
});

afterEach(() => {
  os.restore();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('the store', () => {
  it('writes through to MMKV and resets cleanly', () => {
    store().setEnabled(true);
    store().setFolderUri(FOLDER);
    store().setFileUris([doc(1), doc(2)]);
    store().setDirty(true);
    const mmkv = new MMKV({ id: 'auto-backup' });
    expect(mmkv.getBoolean('autoBackupEnabled')).toBe(true);
    expect(mmkv.getString('autoBackupFolderUri')).toBe(FOLDER);
    expect(JSON.parse(mmkv.getString('autoBackupFileUris')!)).toEqual([doc(1), doc(2)]);

    store().reset();
    expect(store()).toMatchObject({ enabled: false, folderUri: null, fileUris: [], lastRunAt: null, error: false, dirty: false });
    expect(mmkv.getString('autoBackupFolderUri')).toBeUndefined();
  });
});

describe('database', () => {
  it('opens with the change listener enabled', async () => {
    _resetDbForTests();
    await getDb();
    expect(sqlite.__lastOpenOptions()).toMatchObject({ enableChangeListener: true });
  });
});

describe('writeBackupToFolder', () => {
  it('writes one file with the backup content and tracks it', async () => {
    await seedWord();
    await writeBackupToFolder(FOLDER);

    expect(mockSaf.created).toHaveLength(1);
    expect(mockSaf.created[0].name).toMatch(/^germanbuddy-auto-\d{8}-\d{6}$/);
    expect(mockSaf.created[0].mime).toBe('application/json');

    const written = JSON.parse(mockSaf.written.get(mockSaf.created[0].uri)!);
    const built = await buildBackup();
    expect(written.app).toBe('GermanBuddy');
    expect(written.db).toEqual(built.db);
    expect(written.kv).toEqual(built.kv);
    expect(store().fileUris).toEqual([mockSaf.created[0].uri]);
  });

  it('never puts the AI key or provider settings in the file, even when they are set', async () => {
    await seedWord();
    setKey('anthropic', 'sk-ant-secret');
    setKey('openai', 'sk-oa-secret');
    setProvider('openai');
    setOpenAiBaseUrl('https://api.groq.com/openai/v1');

    await writeBackupToFolder(FOLDER);
    const text = mockSaf.written.get(mockSaf.created[0].uri)!;
    for (const forbidden of ['sk-ant-secret', 'sk-oa-secret', 'aiProvider', 'openaiApiKey', 'anthropicApiKey', 'groq']) {
      expect(text).not.toContain(forbidden);
    }
  });

  it('keeps only the newest 10 files, deleting the oldest from its own list', async () => {
    await seedWord();
    expect(AUTO_BACKUP_KEEP).toBe(10);
    for (let i = 0; i < 12; i++) await writeBackupToFolder(FOLDER);

    expect(store().fileUris).toHaveLength(10);
    expect(store().fileUris[0]).toBe(doc(3));
    expect(store().fileUris[9]).toBe(doc(12));
    expect(mockSaf.deleted).toEqual([doc(1), doc(2)]);
  });

  it('a failed delete stays tracked and is retried on the next write', async () => {
    await seedWord();
    mockSaf.failDelete.add(doc(1));
    for (let i = 0; i < 12; i++) await writeBackupToFolder(FOLDER);

    expect(store().fileUris).toContain(doc(1)); // never silently forgotten
    expect(mockSaf.deleteCalls.filter((u) => u === doc(1)).length).toBeGreaterThanOrEqual(2);

    mockSaf.failDelete.clear();
    await writeBackupToFolder(FOLDER);
    expect(mockSaf.deleted).toContain(doc(1));
    expect(store().fileUris).not.toContain(doc(1));
    expect(store().fileUris).toHaveLength(10);
  });

  it('runs one write at a time', async () => {
    await seedWord();
    await Promise.all([writeBackupToFolder(FOLDER), writeBackupToFolder(FOLDER)]);
    expect(mockSaf.events).toEqual(['create:start', 'create:end', 'create:start', 'create:end']);
  });

  it('does not leave an empty file behind when writing the content fails', async () => {
    await seedWord();
    mockSaf.failWrite = true;
    await expect(writeBackupToFolder(FOLDER)).rejects.toThrow('disk full');

    expect(mockSaf.created).toHaveLength(1);
    expect(mockSaf.deleted).toEqual([mockSaf.created[0].uri]); // cleaned up
    expect(store().fileUris).toEqual([]);
  });

  it('a failed write does not block the next one', async () => {
    await seedWord();
    mockSaf.failCreate = true;
    await expect(writeBackupToFolder(FOLDER)).rejects.toThrow();
    mockSaf.failCreate = false;
    await expect(writeBackupToFolder(FOLDER)).resolves.toBeUndefined();
    expect(mockSaf.created).toHaveLength(1);
  });

  it('records the time and clears the error flag on success', async () => {
    await seedWord();
    store().setError(true);
    await writeBackupToFolder(FOLDER);
    expect(store().error).toBe(false);
    expect(Math.abs(Date.now() - Date.parse(store().lastRunAt!))).toBeLessThan(5000);
  });

  it('clears the dirty flag when nothing changed meanwhile', async () => {
    await seedWord();
    store().setDirty(true);
    await writeBackupToFolder(FOLDER);
    expect(store().dirty).toBe(false);
  });

  it('keeps the dirty flag when data changes during the write', async () => {
    jest.useFakeTimers();
    await seedWord();
    enable();
    store().setDirty(true);
    const stop = startAutoBackupTracking();

    mockSaf.onCreate = () => sqlite.__emitChange('vocabulary_items');
    await writeBackupToFolder(FOLDER);
    expect(store().dirty).toBe(true);

    stop();
  });
});

describe('runAutoBackupIfEnabled', () => {
  it('does nothing while the switch is off or no folder is set', async () => {
    await seedWord();
    await runAutoBackupIfEnabled();
    store().setEnabled(true); // no folder
    await runAutoBackupIfEnabled();
    store().setEnabled(false);
    store().setFolderUri(FOLDER); // folder but switch off
    await runAutoBackupIfEnabled();
    expect(mockSaf.created).toHaveLength(0);
  });

  it('writes when enabled and there are unsaved changes', async () => {
    await seedWord();
    enable();
    store().setDirty(true);
    await runAutoBackupIfEnabled();
    expect(mockSaf.created).toHaveLength(1);
    expect(store().dirty).toBe(false);
  });

  it('skips the write when nothing is unsaved (e.g. a startup retry already saved it)', async () => {
    await seedWord();
    enable();
    store().setDirty(false);
    await runAutoBackupIfEnabled();
    expect(mockSaf.created).toHaveLength(0);
  });

  it('fails silently: flags the error, keeps the dirty flag, never throws, logs only the error name', async () => {
    await seedWord();
    enable();
    store().setDirty(true);
    mockSaf.failCreate = true;
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(runAutoBackupIfEnabled()).resolves.toBeUndefined();
    expect(store().error).toBe(true);
    expect(store().dirty).toBe(true);
    expect(spy).toHaveBeenCalled();
    expect(JSON.stringify(spy.mock.calls)).toContain('write failed');
    expect(JSON.stringify(spy.mock.calls)).not.toContain('secret-detail');
  });
});

describe('failure diagnostics (TASK-032)', () => {
  const logged = (spy: jest.SpyInstance) => JSON.stringify(spy.mock.calls);

  it('logs which step failed and the error code, never the message', async () => {
    await seedWord();
    mockSaf.failCreate = true;
    mockSaf.failCode = 'ERR_FILESYSTEM_CANNOT_CREATE_FILE';
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(writeBackupToFolder(FOLDER)).rejects.toThrow();
    expect(logged(spy)).toContain('create');
    expect(logged(spy)).toContain('ERR_FILESYSTEM_CANNOT_CREATE_FILE');
    expect(logged(spy)).not.toContain('secret-detail');
  });

  it('names the write step when writing the content fails', async () => {
    await seedWord();
    mockSaf.failWrite = true;
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(writeBackupToFolder(FOLDER)).rejects.toThrow('disk full');
    expect(logged(spy)).toContain('"write"');
    expect(logged(spy)).not.toContain('disk full');
  });
});

describe('unwritable folder (TASK-034)', () => {
  it('a failing create step rejects with FolderNotWritableError', async () => {
    await seedWord();
    mockSaf.failCreate = true;
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const err = await writeBackupToFolder(FOLDER).catch((e) => e);
    expect(err).toBeInstanceOf(FolderNotWritableError);
  });

  it('a failing write step does not', async () => {
    await seedWord();
    mockSaf.failWrite = true;
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const err = await writeBackupToFolder(FOLDER).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(FolderNotWritableError);
  });
});

describe('error banner wording (TASK-032)', () => {
  it('does not claim the folder was moved or deleted in any language', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const it = require('../src/i18n/it').default ?? require('../src/i18n/it');
    const text: string = (it.settings_autobackup_error ?? it.default?.settings_autobackup_error) as string;
    expect(text).toBeTruthy();
    expect(text).not.toMatch(/spostata|eliminata/i);
  });
});

describe('choosing the folder', () => {
  it('requestAutoBackupFolder returns the picked URI, or null when cancelled', async () => {
    expect(await requestAutoBackupFolder()).toBe('content://tree/picked');
    mockSaf.picker = { granted: false };
    expect(await requestAutoBackupFolder()).toBeNull();
  });

  it('commitAutoBackupFolder starts a fresh rotation list, clears the error and marks data dirty', () => {
    store().setFileUris([doc(1)]);
    store().setError(true);
    commitAutoBackupFolder('content://tree/new');
    expect(store()).toMatchObject({ folderUri: 'content://tree/new', fileUris: [], error: false, dirty: true });
  });

  it('ensureAutoBackupFolder uses the saved folder, otherwise asks, otherwise returns null', async () => {
    store().setFolderUri(FOLDER);
    expect(await ensureAutoBackupFolder()).toBe(FOLDER);

    store().reset();
    expect(await ensureAutoBackupFolder()).toBe('content://tree/picked');
    expect(store().folderUri).toBe('content://tree/picked');

    store().reset();
    mockSaf.picker = { granted: false };
    expect(await ensureAutoBackupFolder()).toBeNull();
    expect(store().folderUri).toBeNull();
  });
});

describe('validateAutoBackupFolder (stale grant after a reinstall)', () => {
  it('silently resets an inaccessible folder: switch off, no error banner', async () => {
    enable();
    store().setFileUris([doc(1)]);
    store().setDirty(true);
    mockSaf.dirOk = false;
    await validateAutoBackupFolder();
    expect(store()).toMatchObject({ enabled: false, folderUri: null, fileUris: [], error: false, dirty: false });
  });

  it('leaves a readable folder alone', async () => {
    enable();
    await validateAutoBackupFolder();
    expect(store()).toMatchObject({ enabled: true, folderUri: FOLDER });
  });

  it('does not touch the provider when no folder is saved', async () => {
    await validateAutoBackupFolder();
    expect(mockSaf.readDirCalls).toBe(0);
  });
});

describe('tracking changes', () => {
  beforeEach(() => jest.useFakeTimers());

  const backgroundHandler = () => {
    const call = (AppState.addEventListener as jest.Mock).mock.calls.find((c) => c[0] === 'change');
    return call![1] as (state: string) => void;
  };

  it('a real review answer is backed up 30 s later, once', async () => {
    const id = await seedWord();
    enable();
    const stop = startAutoBackupTracking();

    await gradeReview(id, true);
    await gradeReview(id, 0.7);
    expect(store().dirty).toBe(true);
    expect(mockSaf.created).toHaveLength(0);

    await jest.advanceTimersByTimeAsync(DEBOUNCE_MS - 1);
    expect(mockSaf.created).toHaveLength(0);
    await jest.advanceTimersByTimeAsync(1);
    expect(mockSaf.created).toHaveLength(1);
    expect(store().dirty).toBe(false);
    stop();
  });

  it('a real word save is tracked too', async () => {
    await submitOnboarding({ cefr_level: 'A1', topic_preferences: PREFS });
    await fetchTodayWord();
    enable();
    const stop = startAutoBackupTracking();

    await saveWord();
    await jest.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(mockSaf.created).toHaveLength(1);
    stop();
  });

  it('ignores tables that are not part of a backup', async () => {
    await seedWord();
    enable();
    const stop = startAutoBackupTracking();

    const db = await getDb();
    await db.runAsync('INSERT INTO schema_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', ['k', 'v']);
    await db.runAsync('INSERT INTO ai_word_notes (word, payload, created_at) VALUES (?, ?, ?)', ['Haus', '{}', 'now']);
    await jest.advanceTimersByTimeAsync(DEBOUNCE_MS * 3);
    expect(mockSaf.created).toHaveLength(0);
    expect(store().dirty).toBe(false);
    stop();
  });

  it('tracks nothing while the switch is off', async () => {
    const id = await seedWord();
    store().setFolderUri(FOLDER); // folder but switch off
    const stop = startAutoBackupTracking();

    await gradeReview(id, true);
    await jest.advanceTimersByTimeAsync(DEBOUNCE_MS * 3);
    expect(mockSaf.created).toHaveLength(0);
    expect(store().dirty).toBe(false);
    stop();
  });

  it('writes immediately when the app goes to the background', async () => {
    const id = await seedWord();
    enable();
    const stop = startAutoBackupTracking();

    await gradeReview(id, true);
    backgroundHandler()('background');
    await jest.advanceTimersByTimeAsync(0);
    expect(mockSaf.created).toHaveLength(1);

    backgroundHandler()('background'); // nothing changed since
    await jest.advanceTimersByTimeAsync(0);
    expect(mockSaf.created).toHaveLength(1);
    stop();
  });

  it('turning the switch off cancels a pending backup', async () => {
    const id = await seedWord();
    enable();
    const stop = startAutoBackupTracking();

    await gradeReview(id, true);
    expect(jest.getTimerCount()).toBeGreaterThan(0); // a backup is scheduled
    setAutoBackupEnabled(false);
    expect(store().enabled).toBe(false);
    expect(jest.getTimerCount()).toBe(0); // and switching off really cancelled it
    await jest.advanceTimersByTimeAsync(DEBOUNCE_MS * 3);
    expect(mockSaf.created).toHaveLength(0);
    stop();
  });

  it('the stop function unsubscribes everything', async () => {
    const id = await seedWord();
    enable();
    const stop = startAutoBackupTracking();
    expect(sqlite.__listenerCount()).toBe(1);

    stop();
    expect(sqlite.__listenerCount()).toBe(0);
    const subscription = (AppState.addEventListener as jest.Mock).mock.results[0].value;
    expect(subscription.remove).toHaveBeenCalled();

    await gradeReview(id, true);
    await jest.advanceTimersByTimeAsync(DEBOUNCE_MS * 3);
    expect(mockSaf.created).toHaveLength(0);
  });

  it('starting twice does not subscribe twice', () => {
    enable();
    const stop1 = startAutoBackupTracking();
    const stop2 = startAutoBackupTracking();
    expect(sqlite.__listenerCount()).toBe(1);
    stop1();
    stop2();
    expect(sqlite.__listenerCount()).toBe(0);
  });

  it('at start, unsaved changes from a previous run are backed up after a short delay', async () => {
    await seedWord();
    enable();
    store().setDirty(true);
    const stop = startAutoBackupTracking();

    await jest.advanceTimersByTimeAsync(STARTUP_RETRY_MS - 1);
    expect(mockSaf.created).toHaveLength(0);
    await jest.advanceTimersByTimeAsync(1);
    expect(mockSaf.created).toHaveLength(1);
    expect(store().dirty).toBe(false);
    stop();
  });

  it('a startup retry followed by a scheduled backup writes once, not twice', async () => {
    await seedWord();
    enable();
    store().setDirty(true);
    const stop = startAutoBackupTracking();

    await jest.advanceTimersByTimeAsync(2000);
    sqlite.__emitChange('review_log'); // a change shortly after launch: schedules a backup at +30 s
    await jest.advanceTimersByTimeAsync(STARTUP_RETRY_MS); // the retry fires first, and saves everything
    expect(mockSaf.created).toHaveLength(1);

    await jest.advanceTimersByTimeAsync(DEBOUNCE_MS); // the scheduled run finds nothing left to save
    expect(mockSaf.created).toHaveLength(1);
    stop();
  });

  it('stopping before the startup retry cancels it', async () => {
    await seedWord();
    enable();
    store().setDirty(true);
    const stop = startAutoBackupTracking();
    stop();
    await jest.advanceTimersByTimeAsync(STARTUP_RETRY_MS * 2);
    expect(mockSaf.created).toHaveLength(0);
  });

  it('no retry at start when nothing is unsaved', async () => {
    await seedWord();
    enable();
    const stop = startAutoBackupTracking();
    await jest.advanceTimersByTimeAsync(STARTUP_RETRY_MS * 2);
    expect(mockSaf.created).toHaveLength(0);
    stop();
  });
});

describe('initAutoBackup', () => {
  beforeEach(() => jest.useFakeTimers());

  it('listens for changes straight away, even if the folder check is slow or never answers', async () => {
    const id = await seedWord();
    enable();
    mockSaf.dirHangs = true;

    const stop = initAutoBackup();
    expect(sqlite.__listenerCount()).toBe(1); // not waiting for the provider

    await gradeReview(id, true); // a change made while the check is still pending
    expect(store().dirty).toBe(true);
    await jest.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(mockSaf.created).toHaveLength(1);
    stop();
  });

  it('still resets a stale folder, in the background', async () => {
    enable();
    mockSaf.dirOk = false;
    const stop = initAutoBackup();
    await jest.advanceTimersByTimeAsync(0);
    expect(store()).toMatchObject({ enabled: false, folderUri: null, error: false });
    stop();
  });

  it('never throws, and its stop function removes the listeners', () => {
    mockSaf.dirOk = false;
    const stop = initAutoBackup();
    expect(sqlite.__listenerCount()).toBe(1);
    stop();
    expect(sqlite.__listenerCount()).toBe(0);
  });

  it('is a no-op outside Android', () => {
    os.replaceValue('ios');
    const stop = initAutoBackup();
    expect(sqlite.__listenerCount()).toBe(0);
    expect(mockSaf.readDirCalls).toBe(0);
    stop();
  });
});

describe('outside Android', () => {
  it('everything is a no-op', async () => {
    await seedWord();
    enable();
    store().setDirty(true);
    os.replaceValue('ios');

    const stop = startAutoBackupTracking();
    expect(sqlite.__listenerCount()).toBe(0);
    stop();

    await runAutoBackupIfEnabled();
    await validateAutoBackupFolder();
    expect(mockSaf.created).toHaveLength(0);
    expect(mockSaf.readDirCalls).toBe(0);
  });
});
