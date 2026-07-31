import type { AppMode, SendMessageParams, StreamChunk, Conversation, Message, LearningModule, Plan, FocusSession, UsageSummary, EditProposal } from '../../shared/types';

interface ElectronAPI {
  getConfigs(): Promise<Array<{
    id: string; name: string; baseUrl: string; model: string;
    temperature: number; maxTokens: number;
    pricing: { inputPrice: number; outputPrice: number };
    headers: Record<string, string>;
    isActive: boolean; hasKey: boolean;
    createdAt: number; updatedAt: number;
  }>>;
  saveConfig(config: Record<string, unknown> & { id?: string }): Promise<void>;
  deleteConfig(id: string): Promise<void>;
  activateConfig(id: string): Promise<void>;
  testConnection(id: string): Promise<{ ok: boolean; error?: string }>;

  sendMessage(params: SendMessageParams): Promise<{ requestId?: string; conversationId?: string; error?: string }>;
  cancelStream(requestId: string): void;
  onStreamChunk(callback: (chunk: StreamChunk) => void): () => void;
  onStreamDone(callback: (data: { requestId: string; conversationId: string }) => void): () => void;
  onShortcutMode(callback: (mode: AppMode) => void): () => void;

  getConversations(mode: AppMode, moduleId?: string): Promise<Conversation[]>;
  getMessages(conversationId: string): Promise<Message[]>;
  deleteConversation(id: string): Promise<void>;
  updateConversationTitle(id: string, title: string): Promise<void>;

  getModules(): Promise<LearningModule[]>;
  createModule(data: { name: string }): Promise<LearningModule>;
  updateModule(id: string, data: { name?: string; noteFiles?: string[] }): Promise<void>;
  deleteModule(id: string): Promise<void>;
  bindNoteFile(moduleId: string, filePath: string): Promise<void>;
  unbindNoteFile(moduleId: string, filePath: string): Promise<void>;

  readFile(path: string, moduleId: string): Promise<string>;
  proposeEdit(path: string, newContent: string, moduleId: string): Promise<EditProposal>;
  confirmEdit(editId: string): Promise<void>;
  rejectEdit(editId: string): Promise<void>;

  getPlans(): Promise<Plan[]>;
  getPlan(id: string): Promise<Plan | null>;
  savePlan(plan: Plan): Promise<void>;
  deletePlan(id: string): Promise<void>;

  getFocusSessions(limit?: number): Promise<FocusSession[]>;
  getRecentFocusSessions(): Promise<FocusSession[]>;
  logFocusSession(session: FocusSession): Promise<void>;

  getDiaryEntry(date?: string): Promise<string | null>;
  listDiaryEntries(): Promise<Array<{ date: string; preview: string }>>;
  appendToDiary(content: string): Promise<void>;
  getDiaryByDateRange(start: string, end: string): Promise<Record<string, string>>;

  getUsageSummary(): Promise<UsageSummary>;
  getUsageHistory(days?: number): Promise<Array<{ date: string; tokens: number; cost: number }>>;
  setBudget(tokens: number): Promise<void>;

  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
  getAllSettings(): Promise<Record<string, string>>;

  getVersion(): Promise<string>;
  selectFile(): Promise<string | null>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
