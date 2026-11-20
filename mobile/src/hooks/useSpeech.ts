import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { t } from '../i18n';
import { speakGerman, stopSpeaking } from '../lib/speech';

// Shared by every hook instance: with auto-play on, each exercise card mounts a new instance and a
// missing German voice must not raise the same alert on every card.
let alertedThisSession = false;
export function _resetSpeechAlertForTests() {
  alertedThisSession = false;
}

/** Which item (if any) is being read aloud. Starting another one replaces it. */
export function useSpeech() {
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const currentRef = useRef<string | null>(null);

  const set = (id: string | null) => {
    currentRef.current = id;
    setSpeakingId(id);
  };

  // Callbacks only clear the state if their own utterance is still the current one:
  // Android reports onStopped of the old utterance after the new speak().
  const clearIfCurrent = (id: string) => {
    if (currentRef.current === id) set(null);
  };

  const toggle = useCallback((id: string, text: string) => {
    if (currentRef.current === id) {
      set(null);
      stopSpeaking();
      return;
    }
    set(id);
    speakGerman(text, {
      onDone: () => clearIfCurrent(id),
      onStopped: () => clearIfCurrent(id),
      onError: (e) => {
        console.error('[Speech] failed:', e);
        clearIfCurrent(id);
        if (!alertedThisSession) {
          alertedThisSession = true;
          Alert.alert(t('speech_unavailable_title'), t('speech_unavailable_body'));
        }
      },
    });
  }, []);

  const stop = useCallback(() => {
    set(null);
    stopSpeaking();
  }, []);

  useEffect(() => () => stopSpeaking(), []);

  return { speakingId, toggle, stop };
}
