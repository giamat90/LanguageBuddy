import { create } from 'zustand';
import { MMKV } from 'react-native-mmkv';
import { coercePinyinMode, type PinyinMode } from '../lib/reading/visibility';

/**
 * Reading preferences (TASK-074). A device preference like the speech one: its own MMKV store, not
 * part of a backup file and not in Android's cloud-backup allowlist. The key is unique across
 * stores because the jest MMKV mock shares one dictionary between ids.
 */
const storage = new MMKV({ id: 'reading-settings' });
const KEY_PINYIN_MODE = 'readingPinyinMode';

interface State {
  pinyinMode: PinyinMode;
  setPinyinMode: (mode: PinyinMode) => void;
}

export const useReadingSettingsStore = create<State>((set) => ({
  pinyinMode: coercePinyinMode(storage.getString(KEY_PINYIN_MODE)),
  setPinyinMode: (pinyinMode) => {
    storage.set(KEY_PINYIN_MODE, pinyinMode);
    set({ pinyinMode });
  },
}));
