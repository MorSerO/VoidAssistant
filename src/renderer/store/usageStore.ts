import { create } from 'zustand';
import type { UsageSummary } from '../../shared/types';

interface UsageState {
  summary: UsageSummary | null;
  history: Array<{ date: string; tokens: number; cost: number }>;
  isLoading: boolean;

  fetchSummary: () => Promise<void>;
  fetchHistory: (days?: number) => Promise<void>;
  setBudget: (tokens: number) => Promise<void>;
}

export const useUsageStore = create<UsageState>((set) => ({
  summary: null,
  history: [],
  isLoading: false,

  fetchSummary: async () => {
    set({ isLoading: true });
    try {
      const summary = await window.electronAPI.getUsageSummary();
      set({ summary, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchHistory: async (days) => {
    try {
      const history = await window.electronAPI.getUsageHistory(days);
      set({ history });
    } catch {
      // Non-critical
    }
  },

  setBudget: async (tokens) => {
    try {
      await window.electronAPI.setBudget(tokens);
    } catch {
      // Non-critical
    }
  },
}));
