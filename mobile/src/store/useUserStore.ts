import { create } from 'zustand';
import { MMKV } from 'react-native-mmkv';
import { setAppLocale } from '../i18n';
import { DEFAULT_NATIVE_LANGUAGE, coerceNativeLanguage, type NativeLanguage } from '../i18n/language';

const storage = new MMKV({ id: 'user-store' });

// The persisted language has to drive i18n from the first render, not only the store.
const initialLanguage = coerceNativeLanguage(storage.getString('nativeLanguage') ?? DEFAULT_NATIVE_LANGUAGE);
setAppLocale(initialLanguage);

interface UserState {
  /** True once local onboarding (level quiz + topics) has produced a profile. */
  hasProfile: boolean;
  /** True once the local DB is open, migrated and the profile has been checked. */
  bootReady: boolean;
  cefrLevel: string | null;
  nativeLanguage: NativeLanguage;
  setHasProfile: (v: boolean) => void;
  setBootReady: (v: boolean) => void;
  setCefrLevel: (level: string | null) => void;
  setNativeLanguage: (lang: NativeLanguage) => void;
  resetProfile: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  hasProfile: storage.getBoolean('hasProfile') ?? false,
  bootReady: false,
  cefrLevel: storage.getString('cefrLevel') ?? null,
  nativeLanguage: initialLanguage,

  setHasProfile: (v) => {
    storage.set('hasProfile', v);
    set({ hasProfile: v });
  },
  setBootReady: (v) => set({ bootReady: v }),
  setCefrLevel: (level) => {
    if (level) storage.set('cefrLevel', level);
    else storage.delete('cefrLevel');
    set({ cefrLevel: level });
  },
  setNativeLanguage: (lang) => {
    const safe = coerceNativeLanguage(lang);
    storage.set('nativeLanguage', safe);
    setAppLocale(safe);
    set({ nativeLanguage: safe });
  },
  resetProfile: () => {
    storage.delete('hasProfile');
    storage.delete('cefrLevel');
    storage.delete('nativeLanguage');
    setAppLocale(DEFAULT_NATIVE_LANGUAGE);
    set({ hasProfile: false, cefrLevel: null, nativeLanguage: DEFAULT_NATIVE_LANGUAGE });
  },
}));
