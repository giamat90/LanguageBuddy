import { renderHook, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useStartLearning } from '../src/hooks/useStartLearning';
import * as wordService from '../src/services/wordService';
import type { CatalogEntry } from '../src/lib/catalog';
import { t } from '../src/i18n';

jest.mock('../src/services/wordService');
const startLearning = wordService.startLearning as jest.Mock;

const entry: CatalogEntry = {
  key: 'A1:Apfel', word: 'Apfel', article: 'der', level: 'A1',
  translationIt: 'mela', translationEn: 'apple', status: 'todo', savedId: null,
};

let alertSpy: jest.SpyInstance;
let errSpy: jest.SpyInstance;
const buttons = () => alertSpy.mock.calls[alertSpy.mock.calls.length - 1][2] as { text: string; onPress?: () => void }[];
const options = () => alertSpy.mock.calls[alertSpy.mock.calls.length - 1][3] as { onDismiss?: () => void } | undefined;

beforeEach(() => {
  jest.clearAllMocks();
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  startLearning.mockResolvedValue({ added: true, id: 'v1' });
});
afterEach(() => { alertSpy.mockRestore(); errSpy.mockRestore(); });

describe('useStartLearning', () => {
  it('asks first, naming the word with its article', () => {
    const { result } = renderHook(() => useStartLearning(jest.fn()));
    act(() => result.current.start(entry));
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy.mock.calls[0][0]).toBe(t('catalog_start_title'));
    expect(alertSpy.mock.calls[0][1]).toContain('der Apfel');
    expect(startLearning).not.toHaveBeenCalled();
  });

  it('Cancel does nothing and releases the guard', () => {
    const { result } = renderHook(() => useStartLearning(jest.fn()));
    act(() => result.current.start(entry));
    act(() => buttons().find((b) => b.text === t('common_cancel'))!.onPress?.());
    expect(startLearning).not.toHaveBeenCalled();
    act(() => result.current.start(entry));
    expect(alertSpy).toHaveBeenCalledTimes(2);
  });

  it('Confirm saves, then reloads the list', async () => {
    const onChanged = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useStartLearning(onChanged));
    act(() => result.current.start(entry));
    await act(async () => { await buttons().find((b) => b.text === t('catalog_start_confirm'))!.onPress!(); });
    expect(startLearning).toHaveBeenCalledWith('A1', 'Apfel');
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(startLearning.mock.invocationCallOrder[0]).toBeLessThan(onChanged.mock.invocationCallOrder[0]);
  });

  it('ignores a second tap while the confirmation is open or saving, works again after', async () => {
    const { result } = renderHook(() => useStartLearning(jest.fn().mockResolvedValue(undefined)));
    act(() => result.current.start(entry));
    act(() => result.current.start(entry));
    expect(alertSpy).toHaveBeenCalledTimes(1);
    await act(async () => { await buttons().find((b) => b.text === t('catalog_start_confirm'))!.onPress!(); });
    act(() => result.current.start(entry));
    expect(alertSpy).toHaveBeenCalledTimes(2);
  });

  it('dismissing the alert (back button) releases the guard', () => {
    const { result } = renderHook(() => useStartLearning(jest.fn()));
    act(() => result.current.start(entry));
    act(() => options()!.onDismiss!());
    act(() => result.current.start(entry));
    expect(alertSpy).toHaveBeenCalledTimes(2);
  });

  it('a failure shows a generic alert, logs the cause, and releases the guard', async () => {
    startLearning.mockRejectedValueOnce(new Error('SQLITE_CORRUPT secret'));
    const { result } = renderHook(() => useStartLearning(jest.fn()));
    act(() => result.current.start(entry));
    await act(async () => { await buttons().find((b) => b.text === t('catalog_start_confirm'))!.onPress!(); });
    const last = alertSpy.mock.calls[alertSpy.mock.calls.length - 1];
    expect(last[0]).toBe(t('catalog_start_error_title'));
    expect(JSON.stringify(last)).not.toMatch(/SQLITE_CORRUPT|secret/);
    expect(errSpy).toHaveBeenCalled();
    act(() => result.current.start(entry));
    expect(alertSpy.mock.calls.length).toBeGreaterThan(2);
  });
});
