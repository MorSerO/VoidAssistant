import { create } from 'zustand';
import type { Conversation, Message, StreamChunk, SendMessageParams, AppMode } from '../../shared/types';

interface ChatState {
  conversations: Conversation[];
  currentConversationId: string | null;
  messages: Message[];
  isStreaming: boolean;
  streamingContent: string;
  pendingToolCalls: Array<{ id: string; name: string; arguments: string }>;
  pendingToolResults: Array<{ toolCallId: string; content: string }>;
  error: string | null;
  requestId: string | null;
  mode: AppMode | null;

  fetchConversations: (mode: AppMode, moduleId?: string) => Promise<void>;
  loadConversation: (id: string) => Promise<void>;
  sendMessage: (params: SendMessageParams) => Promise<void>;
  cancelStream: () => void;
  clearStreamingState: () => void;
  setError: (error: string | null) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  currentConversationId: null,
  messages: [],
  isStreaming: false,
  streamingContent: '',
  pendingToolCalls: [],
  pendingToolResults: [],
  error: null,
  requestId: null,
  mode: null,

  fetchConversations: async (mode, moduleId?) => {
    try {
      const conversations = await window.electronAPI.getConversations(mode, moduleId);
      set({ conversations, mode });
    } catch (err: unknown) {
      set({ error: (err as Error).message });
    }
  },

  loadConversation: async (id) => {
    try {
      const messages = await window.electronAPI.getMessages(id);
      set({ currentConversationId: id, messages, streamingContent: '', pendingToolCalls: [], pendingToolResults: [] });
    } catch (err: unknown) {
      set({ error: (err as Error).message });
    }
  },

  sendMessage: async (params) => {
    const state = get();
    if (state.isStreaming) return;

    // Optimistically add user message
    const userMsg: Message = {
      id: `temp_${Date.now()}`,
      conversationId: params.conversationId || '',
      role: 'user',
      content: params.message,
      createdAt: Date.now(),
    };

    set({
      isStreaming: true,
      streamingContent: '',
      pendingToolCalls: [],
      pendingToolResults: [],
      error: null,
      messages: [...state.messages, userMsg],
    });

    // Register stream listeners
    const unsubChunk = window.electronAPI.onStreamChunk((chunk: StreamChunk) => {
      if (chunk.type === 'text') {
        set(s => ({ streamingContent: s.streamingContent + (chunk.content || '') }));
      } else if (chunk.type === 'tool_call' && chunk.toolCall) {
        set(s => ({ pendingToolCalls: [...s.pendingToolCalls, chunk.toolCall!] }));
      } else if (chunk.type === 'tool_result' && chunk.toolResult) {
        set(s => ({ pendingToolResults: [...s.pendingToolResults, chunk.toolResult!] }));
      } else if (chunk.type === 'error') {
        set({ error: chunk.error || 'Stream error' });
      }
    });

    const unsubDone = window.electronAPI.onStreamDone((data: { requestId: string; conversationId: string }) => {
      const s = get();

      // Build final assistant message
      if (s.streamingContent) {
        const assistantMsg: Message = {
          id: `msg_${Date.now()}`,
          conversationId: data.conversationId,
          role: 'assistant',
          content: s.streamingContent,
          toolCalls: s.pendingToolCalls.length > 0 ? s.pendingToolCalls : undefined,
          createdAt: Date.now(),
        };
        set(state => ({
          messages: [...state.messages, assistantMsg],
        }));
      }

      // Add tool result messages
      if (s.pendingToolResults.length > 0) {
        const toolMsgs: Message[] = s.pendingToolResults.map(tr => ({
          id: `tool_${Date.now()}_${Math.random()}`,
          conversationId: data.conversationId,
          role: 'tool',
          content: tr.content,
          toolCallId: tr.toolCallId,
          createdAt: Date.now(),
        }));
        set(state => ({
          messages: [...state.messages, ...toolMsgs],
        }));
      }

      if (!params.conversationId && data.conversationId) {
        set({ currentConversationId: data.conversationId });
      }

      set({
        isStreaming: false,
        streamingContent: '',
        pendingToolCalls: [],
        pendingToolResults: [],
        requestId: null,
      });

      unsubChunk();
      unsubDone();
    });

    try {
      const result = await window.electronAPI.sendMessage(params);
      if (result.error) {
        set({ isStreaming: false, error: result.error });
        unsubChunk();
        unsubDone();
        return;
      }
      set({ requestId: result.requestId || null, currentConversationId: result.conversationId || state.currentConversationId });
    } catch (err: unknown) {
      set({ isStreaming: false, error: (err as Error).message });
      unsubChunk();
      unsubDone();
    }
  },

  cancelStream: () => {
    const { requestId } = get();
    if (requestId) {
      window.electronAPI.cancelStream(requestId);
    }
    set({ isStreaming: false, requestId: null });
  },

  clearStreamingState: () => {
    set({
      isStreaming: false,
      streamingContent: '',
      pendingToolCalls: [],
      pendingToolResults: [],
      error: null,
      requestId: null,
    });
  },

  setError: (error) => set({ error }),
}));
