import React, { useRef, useEffect } from 'react';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import { useChatStore } from '../../store/chatStore';
import type { AppMode } from '../../../shared/types';

interface ChatPanelProps {
  mode: AppMode;
  moduleId?: string;
  placeholder?: string;
  header?: React.ReactNode;
  showConversationList?: boolean;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  mode,
  moduleId,
  placeholder = 'Type your message...',
  header,
  showConversationList = true,
}) => {
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const streamingContent = useChatStore((s) => s.streamingContent);
  const streamingReasoning = useChatStore((s) => s.streamingReasoning);
  const pendingToolCalls = useChatStore((s) => s.pendingToolCalls);
  const pendingToolResults = useChatStore((s) => s.pendingToolResults);
  const error = useChatStore((s) => s.error);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const cancelStream = useChatStore((s) => s.cancelStream);
  const fetchConversations = useChatStore((s) => s.fetchConversations);
  const loadConversation = useChatStore((s) => s.loadConversation);
  const startNewConversation = useChatStore((s) => s.startNewConversation);
  const deleteConversation = useChatStore((s) => s.deleteConversation);
  const currentConversationId = useChatStore((s) => s.currentConversationId);
  const conversations = useChatStore((s) => s.conversations);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Load conversations when the mode or module changes. Each mode (and each
  // learning module) keeps its own chat history: after fetching, load the most
  // recent conversation unless the active one already belongs to this mode; if
  // there are none yet, clear any leftover messages from the previous mode.
  // This only runs on mode/module switches, so a manual "+ New" or a
  // conversation switch is never overridden by an auto-load.
  useEffect(() => {
    let cancelled = false;
    fetchConversations(mode, moduleId).then(() => {
      if (cancelled) return;
      const state = useChatStore.getState();
      const belongs = state.conversations.some(c => c.id === state.currentConversationId);
      if (belongs) return;
      if (state.conversations.length > 0) {
        state.loadConversation(state.conversations[0].id);
      } else {
        state.startNewConversation();
      }
    });
    return () => { cancelled = true; };
  }, [mode, moduleId, fetchConversations]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamingContent]);

  const handleSend = (text: string) => {
    const message = text.trim();
    if (!message) return;
    sendMessage({
      mode,
      moduleId,
      conversationId: currentConversationId || undefined,
      message,
    });
  };

  const handleDeleteConversation = async (convId: string, convTitle: string) => {
    if (!window.confirm(`Delete conversation "${convTitle}"? This cannot be undone.`)) return;
    await deleteConversation(convId, mode, moduleId);
    // If the deleted conversation was the active one, move to the next
    // conversation or start fresh.
    if (convId === currentConversationId) {
      const state = useChatStore.getState();
      if (state.conversations.length > 0) {
        state.loadConversation(state.conversations[0].id);
      } else {
        state.startNewConversation();
      }
    }
  };

  return (
    <div className="flex h-full">
      {/* Conversation list — lets the user pick any chat and go back to it */}
      {showConversationList && (
        <div className="flex w-44 shrink-0 flex-col border-r border-void-border bg-void-surface">
          <div className="border-b border-void-border px-3 py-2">
            <h4 className="text-2xs font-medium uppercase tracking-wider text-void-muted">Conversations</h4>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {conversations.length === 0 && (
              <p className="px-3 py-2 text-2xs text-void-muted">No conversations yet</p>
            )}
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`group relative border-l-2 transition-colors ${
                  conv.id === currentConversationId
                    ? 'border-void-accent bg-void-accent/10'
                    : 'border-transparent hover:bg-void-border/10'
                }`}
              >
                <button
                  onClick={() => loadConversation(conv.id)}
                  className="block w-full px-3 py-2 pr-7 text-left"
                  title={conv.title}
                >
                  <div className={`truncate text-xs ${conv.id === currentConversationId ? 'text-void-text' : 'text-void-secondary'}`}>
                    {conv.title}
                  </div>
                  <div className="text-2xs text-void-muted">
                    {new Date(conv.updatedAt).toLocaleString()}
                  </div>
                </button>
                <button
                  onClick={() => handleDeleteConversation(conv.id, conv.title)}
                  title="Delete conversation"
                  className="absolute right-1.5 top-2 hidden h-5 w-5 items-center justify-center rounded text-void-muted hover:text-void-error group-hover:flex"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          <div className="border-t border-void-border p-2">
            <button
              onClick={startNewConversation}
              className="w-full rounded border border-void-accent/30 bg-void-accent/10 px-2 py-1.5 text-xs text-void-accent hover:bg-void-accent/25 transition-colors"
            >
              + New Conversation
            </button>
          </div>
        </div>
      )}

      {/* Chat area */}
      <div className="flex h-full min-w-0 flex-1 flex-col">
        {/* Header */}
        {header}

        {/* Messages */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-3">
          <MessageList
            messages={messages}
            streamingContent={streamingContent}
            streamingReasoning={streamingReasoning}
            isStreaming={isStreaming}
            pendingToolCalls={pendingToolCalls}
            pendingToolResults={pendingToolResults}
          />

          {/* Error */}
          {error && (
            <div className="mx-auto my-3 max-w-lg rounded border border-void-error/30 bg-void-error/5 px-4 py-2 text-xs text-void-error">
              {error}
              <button onClick={() => useChatStore.getState().setError(null)} className="ml-2 underline">
                Dismiss
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <ChatInput
          onSend={handleSend}
          onCancel={cancelStream}
          isStreaming={isStreaming}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
};

export default ChatPanel;
