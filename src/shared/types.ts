// ============================================================
// Void AI Assistant - Shared Type Definitions
// All interfaces that cross the IPC boundary live here
// ============================================================

// === App Modes ===
export type AppMode = 'learning' | 'planning' | 'focus' | 'diary';

// === API Configuration ===
export interface ApiConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  pricing: {
    inputPrice: number;   // per 1000 tokens (USD)
    outputPrice: number;  // per 1000 tokens (USD)
  };
  headers: Record<string, string>;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

// Sent to renderer without the plaintext key
export type ApiConfigPublic = Omit<ApiConfig, 'apiKey'> & { hasKey: boolean };

// === Usage Tracking ===
export interface UsageData {
  id: string;
  configId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  timestamp: number;
  conversationId?: string;
}

export interface UsageSummary {
  todayTokens: number;
  todayCost: number;
  monthTokens: number;
  monthCost: number;
  sessionTokens: number;
  budgetLimit?: number;
  budgetExceeded: boolean;
}

// === Streaming ===
export interface StreamChunk {
  type: 'text' | 'tool_call' | 'tool_result' | 'done' | 'error';
  requestId: string;
  content?: string;
  toolCall?: ToolCallRequest;
  toolResult?: ToolCallResult;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  error?: string;
  finishReason?: string;
}

export interface ToolCallRequest {
  id: string;
  name: string;
  arguments: string; // JSON string
}

export interface ToolCallResult {
  toolCallId: string;
  content: string;
}

// === Chat & Conversations ===
export interface Message {
  id: string;
  conversationId: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  toolCalls?: ToolCallRequest[];
  toolCallId?: string;
  toolName?: string;
  codeSnippet?: string; // For C++ code style learning
  createdAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  mode: AppMode;
  moduleId?: string;
  createdAt: number;
  updatedAt: number;
}

// === Learning Mode ===
export interface LearningModule {
  id: string;
  name: string;
  noteFiles: string[];
  codeStyleSummary: string | null;
  conversationId: string;
  isDefault: boolean;
  createdAt: number;
}

// === Planning Mode ===
export interface PlanItem {
  id: string;
  content: string;
  completed: boolean;
  priority: 'high' | 'medium' | 'low';
  deadline?: number;
  aiNote?: string;
}

export interface Plan {
  id: string;
  type: 'long-term' | 'short-term' | 'today';
  title: string;
  items: PlanItem[];
  createdAt: number;
  updatedAt: number;
}

// === Focus Mode ===
export interface FocusSession {
  id: string;
  purpose: string;
  duration: number;
  targetDuration: number;
  type: 'count-up' | 'count-down';
  rating?: number;
  note?: string;
  timestamp: number;
}

// === File Operations ===
export interface EditProposal {
  editId: string;
  filePath: string;
  originalContent: string;
  newContent: string;
  diff: string;
}

// === Chat Send Parameters ===
export interface SendMessageParams {
  mode: AppMode;
  moduleId?: string;
  conversationId?: string;
  message: string;
  codeSnippet?: string;
}

// === Tool Definitions ===
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters?: Record<string, unknown>;
  };
}

// === IPC Channel Names ===
export const IpcChannels = {
  // Config
  CONFIG_GET_ALL: 'config:getAll',
  CONFIG_SAVE: 'config:save',
  CONFIG_DELETE: 'config:delete',
  CONFIG_ACTIVATE: 'config:activate',
  CONFIG_TEST: 'config:test',

  // Chat
  CHAT_SEND: 'chat:sendMessage',
  CHAT_CANCEL: 'chat:cancelStream',
  CHAT_STREAM_CHUNK: 'chat:streamChunk',
  CHAT_STREAM_DONE: 'chat:streamDone',

  // Conversations
  CONV_GET_ALL: 'conversation:getAll',
  CONV_GET_MESSAGES: 'conversation:getMessages',
  CONV_DELETE: 'conversation:delete',
  CONV_UPDATE_TITLE: 'conversation:updateTitle',

  // Modules
  MODULE_GET_ALL: 'module:getAll',
  MODULE_CREATE: 'module:create',
  MODULE_UPDATE: 'module:update',
  MODULE_DELETE: 'module:delete',
  MODULE_BIND_FILE: 'module:bindFile',
  MODULE_UNBIND_FILE: 'module:unbindFile',

  // Files
  FILE_READ: 'file:read',
  FILE_PROPOSE_EDIT: 'file:proposeEdit',
  FILE_CONFIRM_EDIT: 'file:confirmEdit',
  FILE_REJECT_EDIT: 'file:rejectEdit',

  // Plans
  PLAN_GET_ALL: 'plan:getAll',
  PLAN_GET_BY_ID: 'plan:getById',
  PLAN_SAVE: 'plan:save',
  PLAN_DELETE: 'plan:delete',

  // Focus
  FOCUS_GET_SESSIONS: 'focus:getSessions',
  FOCUS_GET_RECENT: 'focus:getRecent',
  FOCUS_LOG: 'focus:log',

  // Diary
  DIARY_GET_ENTRY: 'diary:getEntry',
  DIARY_LIST_ENTRIES: 'diary:listEntries',
  DIARY_APPEND: 'diary:appendEntry',
  DIARY_GET_RANGE: 'diary:getEntriesByDateRange',

  // Usage
  USAGE_GET_SUMMARY: 'usage:getSummary',
  USAGE_GET_HISTORY: 'usage:getHistory',
  USAGE_SET_BUDGET: 'usage:setBudget',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_GET_ALL: 'settings:getAll',

  // App
  APP_GET_VERSION: 'app:getVersion',
  DIALOG_SELECT_FILE: 'dialog:selectFile',
} as const;
