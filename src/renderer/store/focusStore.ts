import { create } from 'zustand';
import type { FocusSession } from '../../shared/types';
import { v4 as uuidv4 } from 'uuid';

type FocusPhase = 'idle' | 'setup' | 'running' | 'review' | 'feedback';

interface FocusState {
  phase: FocusPhase;
  purpose: string;
  duration: number;
  targetDuration: number;
  type: 'count-up' | 'count-down';
  elapsed: number;
  isPaused: boolean;
  rating: number;
  note: string;
  feedback: string;
  sessions: FocusSession[];
  isLoadingFeedback: boolean;

  setPhase: (phase: FocusPhase) => void;
  setPurpose: (purpose: string) => void;
  setTargetDuration: (mins: number) => void;
  setType: (type: 'count-up' | 'count-down') => void;
  startSession: () => void;
  pauseSession: () => void;
  resumeSession: () => void;
  tick: (elapsed: number) => void;
  endSession: () => void;
  setRating: (rating: number) => void;
  setNote: (note: string) => void;
  saveSession: () => Promise<void>;
  getAIFeedback: () => Promise<void>;
  reset: () => void;
  fetchSessions: () => Promise<void>;
}

export const useFocusStore = create<FocusState>((set, get) => ({
  phase: 'idle',
  purpose: '',
  duration: 0,
  targetDuration: 0,
  type: 'count-up',
  elapsed: 0,
  isPaused: false,
  rating: 0,
  note: '',
  feedback: '',
  sessions: [],
  isLoadingFeedback: false,

  setPhase: (phase) => set({ phase }),
  setPurpose: (purpose) => set({ purpose }),
  setTargetDuration: (mins) => set({ targetDuration: mins * 60 }),
  setType: (type) => set({ type }),

  startSession: () => {
    set({
      phase: 'running',
      elapsed: 0,
      isPaused: false,
    });
  },

  pauseSession: () => set({ isPaused: true }),
  resumeSession: () => set({ isPaused: false }),

  tick: (elapsed) => {
    set({ elapsed });
    const state = get();
    // Auto-end count-down when target reached
    if (state.type === 'count-down' && state.targetDuration > 0 && elapsed >= state.targetDuration) {
      set({ phase: 'review', duration: elapsed });
    }
  },

  endSession: () => {
    const state = get();
    set({ phase: 'review', duration: state.elapsed, isPaused: false });
  },

  setRating: (rating) => set({ rating }),
  setNote: (note) => set({ note }),

  saveSession: async () => {
    const state = get();
    const session: FocusSession = {
      id: uuidv4(),
      purpose: state.purpose,
      duration: state.duration,
      targetDuration: state.targetDuration,
      type: state.type,
      rating: state.rating,
      note: state.note,
      timestamp: Date.now(),
    };
    try {
      await window.electronAPI.logFocusSession(session);
    } catch {
      // Non-critical
    }
  },

  getAIFeedback: async () => {
    const state = get();
    // Feedback is generated via a special chat request handled by the LLM
    // For now, we build the prompt and stream the response through chat system
    set({ isLoadingFeedback: true, phase: 'feedback' });
    // This will be triggered by the FocusMode component using the chat API
  },

  reset: () => {
    set({
      phase: 'idle',
      purpose: '',
      duration: 0,
      targetDuration: 0,
      type: 'count-up',
      elapsed: 0,
      isPaused: false,
      rating: 0,
      note: '',
      feedback: '',
      isLoadingFeedback: false,
    });
  },

  fetchSessions: async () => {
    try {
      const sessions = await window.electronAPI.getFocusSessions(50);
      set({ sessions });
    } catch {
      // Non-critical
    }
  },
}));
