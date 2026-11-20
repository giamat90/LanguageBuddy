import { create } from 'zustand';
import { VaultItem } from '../types/domain';

interface VaultState {
  items: VaultItem[];
  page: number;
  total: number;
  isLoading: boolean;
  error: string | null;
  appendItems: (items: VaultItem[], total: number) => void;
  nextPage: () => void;
  setLoading: (v: boolean) => void;
  setError: (e: string) => void;
  reset: () => void;
}

export const useVaultStore = create<VaultState>((set) => ({
  items: [], page: 1, total: 0, isLoading: false, error: null,
  appendItems: (items, total) => set((s) => ({ items: [...s.items, ...items], total })),
  nextPage: () => set((s) => ({ page: s.page + 1 })),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  reset: () => set({ items: [], page: 1, total: 0, isLoading: false, error: null }),
}));
