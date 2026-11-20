import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert, Platform, Switch } from 'react-native';
import SettingsScreen from '../src/screens/SettingsScreen';
import { useAutoBackupStore } from '../src/store/useAutoBackupStore';
import { _resetDbForTests } from '../src/data/db';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sqlite = require('expo-sqlite');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { MMKV } = require('react-native-mmkv');

const mockSaf = {
  picker: { granted: true, directoryUri: 'content://tree/picked' } as { granted: boolean; directoryUri?: string },
  created: [] as string[],
  failCreate: false,
  failWrite: false,
  counter: 0,
};

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }));
jest.mock('../src/components/ui/NotificationSettings', () => () => null);
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.0' } } }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn(async () => {}) }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-file-system', () => ({
  cacheDirectory: 'file:///cache/',
  EncodingType: { UTF8: 'utf8' },
  writeAsStringAsync: jest.fn(async () => {}),
  readAsStringAsync: jest.fn(async () => ''),
  StorageAccessFramework: {
    requestDirectoryPermissionsAsync: jest.fn(async () => mockSaf.picker),
    createFileAsync: jest.fn(async (parent: string) => {
      if (mockSaf.failCreate) throw new Error('boom');
      const uri = `${parent}/doc-${++mockSaf.counter}`;
      mockSaf.created.push(uri);
      return uri;
    }),
    writeAsStringAsync: jest.fn(async () => {
      if (mockSaf.failWrite) throw new Error('disk full');
    }),
    readDirectoryAsync: jest.fn(async () => []),
    deleteAsync: jest.fn(async () => {}),
  },
}));

const store = () => useAutoBackupStore.getState();
const FOLDER = 'content://tree/backups';
let os: { restore: () => void; replaceValue: (v: unknown) => void };
let alertSpy: jest.SpyInstance;

beforeEach(() => {
  sqlite.__reset();
  _resetDbForTests();
  new MMKV().clearAll();
  store().reset();
  Object.assign(mockSaf, {
    picker: { granted: true, directoryUri: 'content://tree/picked' },
    created: [], failCreate: false, failWrite: false, counter: 0,
  });
  os = jest.replaceProperty(Platform, 'OS', 'android') as unknown as typeof os;
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  os.restore();
  jest.restoreAllMocks();
});

const toggle = (ui: ReturnType<typeof render>) => ui.getByLabelText('Salva automaticamente');
const switchIsOn = (ui: ReturnType<typeof render>) => ui.UNSAFE_getAllByType(Switch)[0].props.value // the first switch is the backup one (speech auto-play comes later);
const alertTitles = () => alertSpy.mock.calls.map((c) => c[0]);

describe('Settings → Backup automatico', () => {
  it('shows the section with its defaults on Android', () => {
    const ui = render(<SettingsScreen />);
    expect(ui.getByText('Backup automatico')).toBeTruthy();
    expect(ui.getByText('Salva automaticamente')).toBeTruthy();
    expect(ui.getByText('Cartella di backup')).toBeTruthy();
    expect(ui.getAllByText('Non impostata').length).toBeGreaterThanOrEqual(1); // also used by the AI key row
    expect(ui.queryByText('Cartella scelta')).toBeNull();
    expect(ui.getByText('Esegui backup ora')).toBeTruthy();
    expect(ui.getByText('Ultimo backup')).toBeTruthy();
    expect(ui.getByText('Mai')).toBeTruthy();
    expect(switchIsOn(ui)).toBe(false);
  });

  it('is absent outside Android', () => {
    os.replaceValue('ios');
    const ui = render(<SettingsScreen />);
    expect(ui.queryByText('Backup automatico')).toBeNull();
    expect(ui.queryByText('Esegui backup ora')).toBeNull();
  });

  it('shows the saved folder and the last backup time', () => {
    store().setFolderUri(FOLDER);
    store().setLastRunAt('2026-10-08T12:30:00.000Z');
    const ui = render(<SettingsScreen />);
    expect(ui.getByText('Cartella scelta')).toBeTruthy();
    expect(ui.queryByText('Mai')).toBeNull();
    expect(ui.getByText(/2026/)).toBeTruthy();
  });

  describe('the switch', () => {
    it('with no folder opens the picker; cancelling leaves it off and writes nothing', async () => {
      mockSaf.picker = { granted: false };
      const ui = render(<SettingsScreen />);
      fireEvent(toggle(ui), 'valueChange', true);

      await waitFor(() => expect(store().folderUri).toBeNull());
      await new Promise((r) => setImmediate(r));
      expect(store().enabled).toBe(false);
      expect(mockSaf.created).toHaveLength(0);
      expect(alertTitles()).toEqual([]);
    });

    it('with a folder picked it turns on and writes a first backup straight away', async () => {
      const ui = render(<SettingsScreen />);
      fireEvent(toggle(ui), 'valueChange', true);

      await waitFor(() => expect(mockSaf.created).toHaveLength(1));
      expect(store()).toMatchObject({ enabled: true, folderUri: 'content://tree/picked' });
      expect(alertTitles()).toEqual([]); // success is silent here
    });

    it('tells the user when that first backup fails, but stays on', async () => {
      mockSaf.failWrite = true;
      const ui = render(<SettingsScreen />);
      fireEvent(toggle(ui), 'valueChange', true);

      await waitFor(() => expect(alertTitles()).toContain('Backup non riuscito'));
      expect(store().enabled).toBe(true);
    });

    it('turning it off stops automatic backups', () => {
      store().setFolderUri(FOLDER);
      store().setEnabled(true);
      const ui = render(<SettingsScreen />);
      expect(switchIsOn(ui)).toBe(true);
      fireEvent(toggle(ui), 'valueChange', false);
      expect(store().enabled).toBe(false);
    });
  });

  describe('"Esegui backup ora"', () => {
    it('writes straight away with a folder set, works with the switch off, and leaves the switch alone', async () => {
      store().setFolderUri(FOLDER);
      store().setError(true);
      const ui = render(<SettingsScreen />);
      fireEvent.press(ui.getByText('Esegui backup ora'));

      await waitFor(() => expect(alertTitles()).toContain('Backup salvato'));
      expect(mockSaf.created).toHaveLength(1);
      expect(store().enabled).toBe(false);
      expect(store().error).toBe(false);
      expect(store().lastRunAt).not.toBeNull();
    });

    it('with no folder opens the picker first and then writes', async () => {
      const ui = render(<SettingsScreen />);
      fireEvent.press(ui.getByText('Esegui backup ora'));

      await waitFor(() => expect(alertTitles()).toContain('Backup salvato'));
      expect(store().folderUri).toBe('content://tree/picked');
      expect(store().enabled).toBe(false);
    });

    it('with no folder and a cancelled picker writes nothing and shows no alert', async () => {
      mockSaf.picker = { granted: false };
      const ui = render(<SettingsScreen />);
      fireEvent.press(ui.getByText('Esegui backup ora'));

      await new Promise((r) => setImmediate(r));
      await new Promise((r) => setImmediate(r));
      expect(mockSaf.created).toHaveLength(0);
      expect(alertTitles()).toEqual([]);
    });

    it('a failure shows an alert and raises the error banner', async () => {
      store().setFolderUri(FOLDER);
      mockSaf.failWrite = true;
      const ui = render(<SettingsScreen />);
      fireEvent.press(ui.getByText('Esegui backup ora'));

      await waitFor(() => expect(alertTitles()).toContain('Backup non riuscito'));
      expect(store().error).toBe(true);
      expect(await ui.findByText('Scegli di nuovo la cartella')).toBeTruthy();
    });
  });

  describe('the folder row and the error banner', () => {
    it('tapping the folder row picks a new folder', async () => {
      store().setFolderUri(FOLDER);
      store().setFileUris(['old']);
      const ui = render(<SettingsScreen />);
      fireEvent.press(ui.getByText('Cartella di backup'));

      await waitFor(() => expect(store().folderUri).toBe('content://tree/picked'));
      expect(store().fileUris).toEqual([]); // fresh rotation list
    });

    it('shows a banner only when something failed, and its action fixes it', async () => {
      store().setFolderUri(FOLDER);
      store().setEnabled(true);
      const quiet = render(<SettingsScreen />);
      expect(quiet.queryByText('Scegli di nuovo la cartella')).toBeNull();
      quiet.unmount();

      store().setError(true);
      const ui = render(<SettingsScreen />);
      expect(ui.getByText(/Il backup automatico non funziona/)).toBeTruthy();
      fireEvent.press(ui.getByText('Scegli di nuovo la cartella'));

      await waitFor(() => expect(store().error).toBe(false));
      expect(store().folderUri).toBe('content://tree/picked');
      await waitFor(() => expect(mockSaf.created).toHaveLength(1)); // and it writes again
    });
  });

  describe('a folder that cannot be written, e.g. Google Drive (TASK-034)', () => {
    const UNUSABLE = 'Cartella non utilizzabile';

    it('the switch: alert, switch off, folder forgotten, no error banner', async () => {
      mockSaf.failCreate = true;
      const ui = render(<SettingsScreen />);
      fireEvent(toggle(ui), 'valueChange', true);

      await waitFor(() => expect(alertTitles()).toContain(UNUSABLE));
      expect(alertTitles()).not.toContain('Backup non riuscito');
      expect(store()).toMatchObject({ enabled: false, folderUri: null, error: false });
      expect(ui.queryByText('Scegli di nuovo la cartella')).toBeNull();
    });

    it('"Esegui backup ora": same alert and reset', async () => {
      store().setFolderUri(FOLDER);
      store().setEnabled(true);
      mockSaf.failCreate = true;
      const ui = render(<SettingsScreen />);
      fireEvent.press(ui.getByText('Esegui backup ora'));

      await waitFor(() => expect(alertTitles()).toContain(UNUSABLE));
      expect(store()).toMatchObject({ enabled: false, folderUri: null, error: false });
    });

    it('choosing a new unwritable folder while the switch is on: same alert and reset', async () => {
      store().setFolderUri(FOLDER);
      store().setEnabled(true);
      mockSaf.failCreate = true;
      const ui = render(<SettingsScreen />);
      fireEvent.press(ui.getByText('Cartella di backup'));

      await waitFor(() => expect(alertTitles()).toContain(UNUSABLE));
      expect(store()).toMatchObject({ enabled: false, folderUri: null, error: false });
    });

    it('choosing a folder with the switch off writes nothing and shows nothing', async () => {
      mockSaf.failCreate = true;
      const ui = render(<SettingsScreen />);
      fireEvent.press(ui.getByText('Cartella di backup'));

      await waitFor(() => expect(store().folderUri).toBe('content://tree/picked'));
      await new Promise((r) => setImmediate(r));
      expect(alertTitles()).toEqual([]);
    });

    it('the hint no longer says a Drive-synced folder works', () => {
      const ui = render(<SettingsScreen />);
      expect(ui.queryByText(/sincronizzata da Google Drive/)).toBeNull();
    });
  });
});
