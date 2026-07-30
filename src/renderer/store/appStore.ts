import { create } from 'zustand';
import type { AppMode, UsageSummary } from '../../shared/types';

interface AppState {
  currentMode: AppMode;
  sessionUsage: { tokens: number; cost: number };
  isSettingsOpen: boolean;
  isStreaming: boolean;

  setMode: (mode: AppMode) => void;
  setSessionUsage: (usage: { tokens: number; cost: number }) => void;
  setSettingsOpen: (open: boolean) => void;
  setIsStreaming: (streaming: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentMode: 'learning',
  sessionUsage: { tokens: 0, cost: 0 },
  isSettingsOpen: false,
  isStreaming: false,

  setMode: (mode) => set({ currentMode: mode }),
  setSessionUsage: (usage) => set({ sessionUsage: usage }),
  setSettingsOpen: (open) => set({ isSettingsOpen: open }),
  setIsStreaming: (streaming) => set({ isStreaming: streaming }),
}));
