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
  const pendingToolCalls = useChatStore((s) => s.pendingToolCalls);
  const pendingToolResults = useChatStore((s) => s.pendingToolResults);
  const error = useChatStore((s) => s.error);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const cancelStream = useChatStore((s) => s.cancelStream);
  const fetchConversations = useChatStore((s) => s.fetchConversations);
  const loadConversation = useChatStore((s) => s.loadConversation);
  const currentConversationId = useChatStore((s) => s.currentConversationId);
  const conversations = useChatStore((s) => s.conversations);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Load conversations on mount
  useEffect(() => {
    fetchConversations(mode, moduleId);
  }, [mode, moduleId, fetchConversations]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamingContent]);

  const handleSend = (text: string, codeSnippet?: string) => {
    sendMessage({
      mode,
      moduleId,
      conversationId: currentConversationId || undefined,
      message: text,
      codeSnippet,
    });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      {header}

      {/* Conversation selector */}
      {showConversationList && conversations.length > 0 && (
        <div className="flex gap-1 overflow-x-auto border-b border-void-border px-3 py-2 no-select">
          {conversations.slice(0, 10).map((conv) => (
            <button
              key={conv.id}
              onClick={() => loadConversation(conv.id)}
              className={`
                shrink-0 rounded px-3 py-1 text-xs transition-colors
                ${conv.id === currentConversationId
                  ? 'bg-void-accent/15 text-void-accent'
                  : 'text-void-secondary hover:text-void-text hover:bg-void-border/20'
                }
              `}
            >
              {conv.title.slice(0, 30)}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-3">
        <MessageList
          messages={messages}
          streamingContent={streamingContent}
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
        showCodeButton={mode === 'learning'}
      />
    </div>
  );
};

export default ChatPanel;
