import { create } from 'zustand';
import { MMKV } from 'react-native-mmkv';
import { DailyWord } from '../types/domain';

const storage = new MMKV({ id: 'word-store' });

export type SaveState = 'idle' | 'saving' | 'saved';

interface WordState {
  word: DailyWord | null;
  saveState: SaveState;
  streakDays: number;
  isLoading: boolean;
  error: string | null;
  setWord: (word: DailyWord) => void;
  setSaveState: (state: SaveState) => void;
  setStreak: (days: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useWordStore = create<WordState>((set) => ({
  word:       null,
  saveState:  'idle',
  streakDays: storage.getNumber('streakDays') ?? 0,
  isLoading:  false,
  error:      null,

  setWord:      (word) => set({ word, error: null }),
  setSaveState: (saveState) => set({ saveState }),
  setStreak:    (days) => { storage.set('streakDays', days); set({ streakDays: days }); },
  setLoading:   (isLoading) => set({ isLoading }),
  setError:     (error) => set({ error, isLoading: false }),
}));
