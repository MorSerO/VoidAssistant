import { contextBridge, ipcRenderer } from 'electron';
import type {
  AppMode, SendMessageParams, StreamChunk, ApiConfig,
  Conversation, Message, LearningModule, Plan, FocusSession,
  UsageSummary, UsageData, EditProposal,
} from '../shared/types';
import { IpcChannels } from '../shared/types';

/**
 * The full electronAPI exposed to the renderer via contextBridge.
 * Every method is a thin wrapper around ipcRenderer.invoke or .on.
 * No raw ipcRenderer is ever exposed to the renderer.
 */
const electronAPI = {
  // === Config ===
  getConfigs: (): Promise<Array<{
    id: string; name: string; baseUrl: string; model: string;
    temperature: number; maxTokens: number;
    pricing: { inputPrice: number; outputPrice: number };
    headers: Record<string, string>;
    isActive: boolean; hasKey: boolean;
    createdAt: number; updatedAt: number;
  }>> => ipcRenderer.invoke(IpcChannels.CONFIG_GET_ALL),

  saveConfig: (config: Partial<ApiConfig> & { id?: string }): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.CONFIG_SAVE, config),

  deleteConfig: (id: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.CONFIG_DELETE, id),

  activateConfig: (id: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.CONFIG_ACTIVATE, id),

  testConnection: (id: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke(IpcChannels.CONFIG_TEST, id),

  // === Chat (streaming) ===
  sendMessage: (params: SendMessageParams): Promise<{ requestId?: string; conversationId?: string; error?: string }> =>
    ipcRenderer.invoke(IpcChannels.CHAT_SEND, params),

  cancelStream: (requestId: string): void => {
    ipcRenderer.send(IpcChannels.CHAT_CANCEL, requestId);
  },

  onStreamChunk: (callback: (chunk: StreamChunk) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, chunk: StreamChunk) => callback(chunk);
    ipcRenderer.on(IpcChannels.CHAT_STREAM_CHUNK, handler);
    return () => ipcRenderer.removeListener(IpcChannels.CHAT_STREAM_CHUNK, handler);
  },

  onStreamDone: (callback: (data: { requestId: string; conversationId: string }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { requestId: string; conversationId: string }) => callback(data);
    ipcRenderer.on(IpcChannels.CHAT_STREAM_DONE, handler);
    return () => ipcRenderer.removeListener(IpcChannels.CHAT_STREAM_DONE, handler);
  },

  onShortcutMode: (callback: (mode: AppMode) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, mode: AppMode) => callback(mode);
    ipcRenderer.on('shortcut:mode', handler);
    return () => ipcRenderer.removeListener('shortcut:mode', handler);
  },

  onStyleSummaryUpdated: (callback: (data: { moduleId: string; codeStyleSummary: string }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { moduleId: string; codeStyleSummary: string }) => callback(data);
    ipcRenderer.on(IpcChannels.STYLE_SUMMARY_UPDATED, handler);
    return () => ipcRenderer.removeListener(IpcChannels.STYLE_SUMMARY_UPDATED, handler);
  },

  // === Conversations ===
  getConversations: (mode: AppMode, moduleId?: string): Promise<Conversation[]> =>
    ipcRenderer.invoke(IpcChannels.CONV_GET_ALL, mode, moduleId),

  getMessages: (conversationId: string): Promise<Message[]> =>
    ipcRenderer.invoke(IpcChannels.CONV_GET_MESSAGES, conversationId),

  deleteConversation: (id: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.CONV_DELETE, id),

  updateConversationTitle: (id: string, title: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.CONV_UPDATE_TITLE, id, title),

  // === Modules ===
  getModules: (): Promise<LearningModule[]> =>
    ipcRenderer.invoke(IpcChannels.MODULE_GET_ALL),

  createModule: (data: { name: string }): Promise<LearningModule> =>
    ipcRenderer.invoke(IpcChannels.MODULE_CREATE, data),

  updateModule: (id: string, data: { name?: string; noteFiles?: string[]; codeStyleSummary?: string | null }): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.MODULE_UPDATE, id, data),

  deleteModule: (id: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.MODULE_DELETE, id),

  bindNoteFile: (moduleId: string, filePath: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.MODULE_BIND_FILE, moduleId, filePath),

  unbindNoteFile: (moduleId: string, filePath: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.MODULE_UNBIND_FILE, moduleId, filePath),

  // === Files ===
  readFile: (path: string, moduleId: string): Promise<string> =>
    ipcRenderer.invoke(IpcChannels.FILE_READ, path, moduleId),

  proposeEdit: (path: string, newContent: string, moduleId: string): Promise<EditProposal> =>
    ipcRenderer.invoke(IpcChannels.FILE_PROPOSE_EDIT, path, newContent, moduleId),

  confirmEdit: (editId: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.FILE_CONFIRM_EDIT, editId),

  rejectEdit: (editId: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.FILE_REJECT_EDIT, editId),

  // === Plans ===
  getPlans: (): Promise<Plan[]> =>
    ipcRenderer.invoke(IpcChannels.PLAN_GET_ALL),

  getPlan: (id: string): Promise<Plan | null> =>
    ipcRenderer.invoke(IpcChannels.PLAN_GET_BY_ID, id),

  savePlan: (plan: Plan): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.PLAN_SAVE, plan),

  deletePlan: (id: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.PLAN_DELETE, id),

  // === Focus ===
  getFocusSessions: (limit?: number): Promise<FocusSession[]> =>
    ipcRenderer.invoke(IpcChannels.FOCUS_GET_SESSIONS, limit),

  getRecentFocusSessions: (): Promise<FocusSession[]> =>
    ipcRenderer.invoke(IpcChannels.FOCUS_GET_RECENT),

  logFocusSession: (session: FocusSession): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.FOCUS_LOG, session),

  // === Diary ===
  getDiaryEntry: (date?: string): Promise<string | null> =>
    ipcRenderer.invoke(IpcChannels.DIARY_GET_ENTRY, date),

  listDiaryEntries: (): Promise<Array<{ date: string; preview: string }>> =>
    ipcRenderer.invoke(IpcChannels.DIARY_LIST_ENTRIES),

  appendToDiary: (content: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.DIARY_APPEND, content),

  getDiaryByDateRange: (start: string, end: string): Promise<Record<string, string>> =>
    ipcRenderer.invoke(IpcChannels.DIARY_GET_RANGE, start, end),

  // === Usage ===
  getUsageSummary: (): Promise<UsageSummary> =>
    ipcRenderer.invoke(IpcChannels.USAGE_GET_SUMMARY),

  getUsageHistory: (days?: number): Promise<Array<{ date: string; tokens: number; cost: number }>> =>
    ipcRenderer.invoke(IpcChannels.USAGE_GET_HISTORY, days),

  setBudget: (tokens: number): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.USAGE_SET_BUDGET, tokens),

  // === Settings ===
  getSetting: (key: string): Promise<string | null> =>
    ipcRenderer.invoke(IpcChannels.SETTINGS_GET, key),

  setSetting: (key: string, value: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.SETTINGS_SET, key, value),

  getAllSettings: (): Promise<Record<string, string>> =>
    ipcRenderer.invoke(IpcChannels.SETTINGS_GET_ALL),

  // === App ===
  getVersion: (): Promise<string> =>
    ipcRenderer.invoke('app:getVersion'),

  selectFile: (): Promise<string | null> =>
    ipcRenderer.invoke(IpcChannels.DIALOG_SELECT_FILE),
};

// Expose the API object to the renderer process
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Export the type for renderer-side usage
export type ElectronAPI = typeof electronAPI;
