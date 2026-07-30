import { create } from 'zustand';
import type { Plan, PlanItem } from '../../shared/types';
import { v4 as uuidv4 } from 'uuid';

interface PlanningState {
  plans: Plan[];
  activePlanId: string | null;
  activeType: 'long-term' | 'short-term' | 'today';
  isLoading: boolean;
  isChatOpen: boolean;

  fetchPlans: () => Promise<void>;
  savePlan: (plan: Plan) => Promise<void>;
  deletePlan: (id: string) => Promise<void>;
  createPlan: (type: Plan['type'], title: string) => Promise<void>;
  addItem: (planId: string, content: string) => Promise<void>;
  toggleItem: (planId: string, itemId: string) => Promise<void>;
  updateItem: (planId: string, itemId: string, updates: Partial<PlanItem>) => Promise<void>;
  deleteItem: (planId: string, itemId: string) => Promise<void>;
  setActivePlan: (id: string | null) => void;
  setActiveType: (type: 'long-term' | 'short-term' | 'today') => void;
  setChatOpen: (open: boolean) => void;
}

export const usePlanningStore = create<PlanningState>((set, get) => ({
  plans: [],
  activePlanId: null,
  activeType: 'today',
  isLoading: false,
  isChatOpen: false,

  fetchPlans: async () => {
    set({ isLoading: true });
    try {
      const plans = await window.electronAPI.getPlans();
      set({ plans, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  savePlan: async (plan) => {
    await window.electronAPI.savePlan(plan);
    await get().fetchPlans();
  },

  deletePlan: async (id) => {
    await window.electronAPI.deletePlan(id);
    const state = get();
    if (state.activePlanId === id) {
      set({ activePlanId: null });
    }
    await get().fetchPlans();
  },

  createPlan: async (type, title) => {
    const plan: Plan = {
      id: uuidv4(),
      type,
      title,
      items: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await get().savePlan(plan);
    set({ activePlanId: plan.id });
  },

  addItem: async (planId, content) => {
    const plan = get().plans.find(p => p.id === planId);
    if (!plan) return;
    const updated = {
      ...plan,
      items: [...plan.items, { id: uuidv4(), content, completed: false, priority: 'medium' as const }],
      updatedAt: Date.now(),
    };
    await get().savePlan(updated);
  },

  toggleItem: async (planId, itemId) => {
    const plan = get().plans.find(p => p.id === planId);
    if (!plan) return;
    const updated = {
      ...plan,
      items: plan.items.map(item =>
        item.id === itemId ? { ...item, completed: !item.completed } : item
      ),
      updatedAt: Date.now(),
    };
    await get().savePlan(updated);
  },

  updateItem: async (planId, itemId, updates) => {
    const plan = get().plans.find(p => p.id === planId);
    if (!plan) return;
    const updated = {
      ...plan,
      items: plan.items.map(item =>
        item.id === itemId ? { ...item, ...updates } : item
      ),
      updatedAt: Date.now(),
    };
    await get().savePlan(updated);
  },

  deleteItem: async (planId, itemId) => {
    const plan = get().plans.find(p => p.id === planId);
    if (!plan) return;
    const updated = {
      ...plan,
      items: plan.items.filter(item => item.id !== itemId),
      updatedAt: Date.now(),
    };
    await get().savePlan(updated);
  },

  setActivePlan: (id) => set({ activePlanId: id }),
  setActiveType: (type) => set({ activeType: type, activePlanId: null }),
  setChatOpen: (open) => set({ isChatOpen: open }),
}));
