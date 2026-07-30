import { create } from 'zustand';

interface DiaryEntry {
  date: string;
  preview: string;
}

interface DiaryState {
  currentDate: string;
  entryContent: string | null;
  entries: DiaryEntry[];
  conversationId: string | null;
  isLoading: boolean;
  isReadOnly: boolean;

  fetchEntry: (date?: string) => Promise<void>;
  listEntries: () => Promise<void>;
  appendContent: (content: string) => Promise<void>;
  setCurrentDate: (date: string) => void;
  fetchFromAppend: (content: string) => Promise<void>;
}

export const useDiaryStore = create<DiaryState>((set, get) => ({
  currentDate: new Date().toISOString().split('T')[0],
  entryContent: null,
  entries: [],
  conversationId: null,
  isLoading: false,
  isReadOnly: false,

  fetchEntry: async (date?) => {
    const d = date || get().currentDate;
    set({ isLoading: true, isReadOnly: false });
    try {
      const content = await window.electronAPI.getDiaryEntry(d);
      // If no entry exists for this date and it's not today, it could be missing
      if (!content && d !== new Date().toISOString().split('T')[0]) {
        set({ entryContent: null, currentDate: d, isLoading: false, isReadOnly: true });
        return;
      }
      // getOrCreateDiaryEntry handles creation on main process
      const result = content || `# ${d}\n\n*Journal entry created*\n\n`;
      set({ entryContent: result, currentDate: d, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  listEntries: async () => {
    try {
      const entries = await window.electronAPI.listDiaryEntries();
      set({ entries });
    } catch {
      // Non-critical
    }
  },

  appendContent: async (content) => {
    await window.electronAPI.appendToDiary(content);
    // Refresh the entry
    await get().fetchEntry();
  },

  setCurrentDate: (date) => set({ currentDate: date }),

  fetchFromAppend: async (content) => {
    await get().appendContent(content);
  },
}));
