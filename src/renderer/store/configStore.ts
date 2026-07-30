import { create } from 'zustand';
import type { ApiConfig } from '../../shared/types';

type ApiConfigPublic = {
  id: string; name: string; baseUrl: string; model: string;
  temperature: number; maxTokens: number;
  pricing: { inputPrice: number; outputPrice: number };
  headers: Record<string, string>;
  isActive: boolean; hasKey: boolean;
  createdAt: number; updatedAt: number;
};

interface ConfigState {
  configs: ApiConfigPublic[];
  activeConfigId: string | null;
  isLoading: boolean;
  error: string | null;

  fetchConfigs: () => Promise<void>;
  saveConfig: (config: Partial<ApiConfig> & { id?: string }) => Promise<void>;
  deleteConfig: (id: string) => Promise<void>;
  activateConfig: (id: string) => Promise<void>;
  testConnection: (id: string) => Promise<{ ok: boolean; error?: string }>;
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  configs: [],
  activeConfigId: null,
  isLoading: false,
  error: null,

  fetchConfigs: async () => {
    set({ isLoading: true, error: null });
    try {
      const configs = await window.electronAPI.getConfigs();
      const active = configs.find(c => c.isActive);
      set({ configs, activeConfigId: active?.id || null, isLoading: false });
    } catch (err: unknown) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  saveConfig: async (config) => {
    set({ isLoading: true, error: null });
    try {
      await window.electronAPI.saveConfig(config);
      await get().fetchConfigs();
    } catch (err: unknown) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  deleteConfig: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await window.electronAPI.deleteConfig(id);
      await get().fetchConfigs();
    } catch (err: unknown) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  activateConfig: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await window.electronAPI.activateConfig(id);
      await get().fetchConfigs();
    } catch (err: unknown) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  testConnection: async (id) => {
    try {
      return await window.electronAPI.testConnection(id);
    } catch (err: unknown) {
      return { ok: false, error: (err as Error).message };
    }
  },
}));
