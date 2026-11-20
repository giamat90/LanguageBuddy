import { create } from 'zustand';
import { MMKV } from 'react-native-mmkv';

/**
 * Speech preferences (TASK-040). A device preference, so it has its own MMKV store, is not part
 * of a backup file and is not in Android's cloud-backup allowlist. The key is unique across stores
 * because the jest MMKV mock shares one dictionary between ids.
 */
const storage = new MMKV({ id: 'speech-settings' });
const KEY_AUTOPLAY = 'speechAutoPlaySentence';

interface State {
  /** Read the exercise sentence aloud as soon as its answer is revealed. Off by default. */
  autoPlaySentence: boolean;
  setAutoPlaySentence: (v: boolean) => void;
}

export const useSpeechSettingsStore = create<State>((set) => ({
  autoPlaySentence: storage.getBoolean(KEY_AUTOPLAY) ?? false,
  setAutoPlaySentence: (autoPlaySentence) => {
    storage.set(KEY_AUTOPLAY, autoPlaySentence);
    set({ autoPlaySentence });
  },
}));
