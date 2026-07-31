import React from 'react';
import type { Message } from '../../../shared/types';
import MessageBubble from './MessageBubble';

interface MessageListProps {
  messages: Message[];
  streamingContent: string;
  streamingReasoning: string;
  isStreaming: boolean;
  pendingToolCalls: Array<{ id: string; name: string; arguments: string }>;
  pendingToolResults: Array<{ toolCallId: string; content: string }>;
}

const MessageList: React.FC<MessageListProps> = ({
  messages,
  streamingContent,
  streamingReasoning,
  isStreaming,
  pendingToolCalls,
  pendingToolResults,
}) => {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {messages.length === 0 && !isStreaming && (
        <div className="py-16 text-center">
          <p className="text-sm text-void-secondary">Start a conversation</p>
          <p className="mt-1 text-xs text-void-muted">Send a message to begin</p>
        </div>
      )}

      {messages.map((msg, idx) => (
        <MessageBubble key={msg.id} message={msg} isLast={idx === messages.length - 1} />
      ))}

      {/* Model reasoning (thinking) — gray, high transparency, collapsible */}
      {isStreaming && streamingReasoning && (
        <div className="flex gap-3 opacity-60">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-void-border/30">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-void-muted">
              <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1 rounded-lg border border-void-border/40 bg-void-surface/40 px-4 py-3">
            <details open>
              <summary className="cursor-pointer select-none text-xs text-void-muted hover:text-void-secondary transition-colors">
                Thinking…
              </summary>
              <div className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-void-muted font-mono">
                {streamingReasoning}
              </div>
            </details>
          </div>
        </div>
      )}

      {/* Tool call indicators */}
      {pendingToolCalls.map((tc) => {
        const result = pendingToolResults.find(r => r.toolCallId === tc.id);
        return (
          <div key={tc.id} className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-void-border/30">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="16 3 21 3 21 8" />
                <line x1="4" y1="20" x2="21" y2="3" />
                <polyline points="21 16 21 21 16 21" />
                <line x1="15" y1="15" x2="21" y2="21" />
                <line x1="4" y1="4" x2="9" y2="9" />
              </svg>
            </div>
            <div className="rounded-lg border border-void-border bg-void-surface/50 px-3 py-2">
              <p className="text-xs text-void-accent">
                {result ? `Completed: ${tc.name}` : `Running: ${tc.name}`}
              </p>
              {result && (
                <details className="mt-1">
                  <summary className="text-2xs text-void-secondary cursor-pointer">Show result</summary>
                  <pre className="mt-1 max-h-32 overflow-y-auto text-2xs text-void-text whitespace-pre-wrap font-mono">
                    {result.content}
                  </pre>
                </details>
              )}
            </div>
          </div>
        );
      })}

      {/* Streaming text */}
      {isStreaming && streamingContent && (
        <MessageBubble
          message={{
            id: 'streaming',
            conversationId: '',
            role: 'assistant',
            content: streamingContent,
            createdAt: Date.now(),
          }}
          isStreaming
        />
      )}

      {/* Streaming empty (waiting for first token) */}
      {isStreaming && !streamingContent && pendingToolCalls.length === 0 && (
        <div className="flex gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-void-border/30">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-void-accent animate-pulse" />
          </div>
          <div className="flex items-center gap-1 px-3 py-2 text-xs text-void-secondary">
            <span>Thinking</span>
            <span className="animate-pulse">...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageList;
