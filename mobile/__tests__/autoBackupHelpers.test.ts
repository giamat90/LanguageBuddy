import {
  autoBackupFileName, filesToPrune,
  AUTO_BACKUP_KEEP, DEBOUNCE_MS, MAX_WAIT_MS, STARTUP_RETRY_MS,
} from '../src/lib/autoBackup/helpers';
import { setActivePackForTests } from '../src/languages';
import { es } from '../src/languages/es';

describe('constants', () => {
  it('keeps 10 files, debounces 30 s, waits at most 5 min, retries 10 s after start', () => {
    expect(AUTO_BACKUP_KEEP).toBe(10);
    expect(DEBOUNCE_MS).toBe(30_000);
    expect(MAX_WAIT_MS).toBe(300_000);
    expect(STARTUP_RETRY_MS).toBe(10_000);
  });
});

describe('autoBackupFileName', () => {
  it('uses the local time, zero-padded', () => {
    expect(autoBackupFileName(new Date(2026, 9, 8, 15, 30, 45))).toBe('germanbuddy-auto-20261008-153045');
    expect(autoBackupFileName(new Date(2026, 0, 2, 5, 3, 9))).toBe('germanbuddy-auto-20260102-050309');
  });

  it('sorts in chronological order, so names can stand in for time', () => {
    const times = [
      new Date(2026, 0, 31, 23, 59, 59),
      new Date(2026, 1, 1, 0, 0, 0),
      new Date(2026, 1, 1, 0, 0, 1),
      new Date(2026, 11, 31, 12, 0, 0),
      new Date(2027, 0, 1, 0, 0, 0),
    ];
    const names = times.map(autoBackupFileName);
    expect([...names].sort()).toEqual(names);
  });

  it('has no extension: the provider adds .json from the MIME type', () => {
    expect(autoBackupFileName(new Date())).not.toMatch(/\./);
  });
});

describe('filesToPrune', () => {
  const uris = (n: number) => Array.from({ length: n }, (_, i) => `uri-${i + 1}`);

  it('deletes nothing when there are no files, fewer than keep, or exactly keep', () => {
    expect(filesToPrune([], 10)).toEqual([]);
    expect(filesToPrune(uris(4), 10)).toEqual([]);
    expect(filesToPrune(uris(10), 10)).toEqual([]);
  });

  it('deletes the oldest (first in the list) when there are more than keep', () => {
    expect(filesToPrune(uris(11), 10)).toEqual(['uri-1']);
    expect(filesToPrune(uris(13), 10)).toEqual(['uri-1', 'uri-2', 'uri-3']);
  });

  it('works with other limits and does not mutate its input', () => {
    const list = uris(5);
    expect(filesToPrune(list, 2)).toEqual(['uri-1', 'uri-2', 'uri-3']);
    expect(list).toEqual(uris(5));
  });
});

describe('autoBackupFileName follows the active pack (TASK-047)', () => {
  afterEach(() => setActivePackForTests(null));
  it('is spanishbuddy-auto-… under the Spanish pack', () => {
    setActivePackForTests(es);
    expect(autoBackupFileName(new Date(2026, 9, 8, 15, 30, 45))).toBe('spanishbuddy-auto-20261008-153045');
  });
});
