import { create } from 'zustand';
import type { LearningModule } from '../../shared/types';

interface LearningState {
  modules: LearningModule[];
  activeModuleId: string | null;
  isLoading: boolean;

  fetchModules: () => Promise<void>;
  createModule: (name: string) => Promise<LearningModule | null>;
  deleteModule: (id: string) => Promise<void>;
  bindNoteFile: (moduleId: string, filePath: string) => Promise<void>;
  unbindNoteFile: (moduleId: string, filePath: string) => Promise<void>;
  setActiveModule: (id: string) => void;
}

export const useLearningStore = create<LearningState>((set, get) => ({
  modules: [],
  activeModuleId: null,
  isLoading: false,

  fetchModules: async () => {
    set({ isLoading: true });
    try {
      const modules = await window.electronAPI.getModules();
      const active = modules.length > 0 ? modules[0].id : null;
      set({ modules, activeModuleId: active, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  createModule: async (name) => {
    set({ isLoading: true });
    try {
      const mod = await window.electronAPI.createModule({ name });
      await get().fetchModules();
      return mod;
    } catch {
      set({ isLoading: false });
      return null;
    }
  },

  deleteModule: async (id) => {
    set({ isLoading: true });
    try {
      await window.electronAPI.deleteModule(id);
      await get().fetchModules();
    } catch {
      set({ isLoading: false });
    }
  },

  bindNoteFile: async (moduleId, filePath) => {
    await window.electronAPI.bindNoteFile(moduleId, filePath);
    await get().fetchModules();
  },

  unbindNoteFile: async (moduleId, filePath) => {
    await window.electronAPI.unbindNoteFile(moduleId, filePath);
    await get().fetchModules();
  },

  setActiveModule: (id) => set({ activeModuleId: id }),
}));
