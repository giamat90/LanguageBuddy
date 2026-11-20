import { renderHook, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as Speech from 'expo-speech';
import { useSpeech } from '../src/hooks/useSpeech';

const mock = Speech as unknown as {
  __last(): { text: string; opts: any } | null;
  __finish(): void; __fail(): void; __reset(): void; stop: jest.Mock;
};

describe('useSpeech', () => {
  let alertSpy: jest.SpyInstance;
  let errSpy: jest.SpyInstance;
  beforeEach(() => {
    mock.__reset();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { alertSpy.mockRestore(); errSpy.mockRestore(); });

  it('toggle starts speaking and marks the id; finishing clears it', () => {
    const { result } = renderHook(() => useSpeech());
    act(() => result.current.toggle('1', 'der Tisch'));
    expect(result.current.speakingId).toBe('1');
    expect(mock.__last()!.text).toBe('der Tisch');
    act(() => mock.__finish());
    expect(result.current.speakingId).toBeNull();
  });

  it('toggling the same id stops it', () => {
    const { result } = renderHook(() => useSpeech());
    act(() => result.current.toggle('1', 'der Tisch'));
    act(() => result.current.toggle('1', 'der Tisch'));
    expect(result.current.speakingId).toBeNull();
    expect(mock.__last()).toBeNull();
  });

  it('a second word replaces the first and the late onStopped of the first does not clear it', () => {
    const { result } = renderHook(() => useSpeech());
    act(() => result.current.toggle('1', 'der Tisch'));
    const firstStopped = mock.__last()!.opts.onStopped;
    act(() => result.current.toggle('2', 'die Tür'));
    // Android fires the old utterance's onStopped after the new speak().
    act(() => firstStopped());
    expect(result.current.speakingId).toBe('2');
    expect(mock.__last()!.text).toBe('die Tür');
  });

  it('on error: clears state, logs, shows one generic alert only', () => {
    const { result } = renderHook(() => useSpeech());
    act(() => result.current.toggle('1', 'der Tisch'));
    act(() => mock.__fail());
    expect(result.current.speakingId).toBeNull();
    expect(errSpy).toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(alertSpy.mock.calls[0])).not.toMatch(/engine down/);
    act(() => result.current.toggle('1', 'der Tisch'));
    act(() => mock.__fail());
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('stops speech on unmount', () => {
    const { result, unmount } = renderHook(() => useSpeech());
    act(() => result.current.toggle('1', 'der Tisch'));
    mock.stop.mockClear();
    unmount();
    expect(mock.stop).toHaveBeenCalled();
  });
});
