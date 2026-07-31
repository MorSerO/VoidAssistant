import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message } from '../../../shared/types';

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
  isLast?: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isStreaming = false, isLast = false }) => {
  const isUser = message.role === 'user';
  const isTool = message.role === 'tool';
  const isSystem = message.role === 'system';

  if (isTool) {
    return (
      <div className="flex justify-center">
        <div className="rounded border border-void-border bg-void-surface/30 px-3 py-1.5 max-w-lg">
          <details>
            <summary className="text-xs text-void-secondary cursor-pointer">
              Tool: {message.toolName || message.toolCallId}
            </summary>
            <pre className="mt-1 max-h-32 overflow-y-auto text-2xs text-void-text whitespace-pre-wrap font-mono">
              {message.content}
            </pre>
          </details>
        </div>
      </div>
    );
  }

  if (isSystem) return null;

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
        isUser ? 'bg-void-accent/20' : 'bg-void-border/30'
      }`}>
        {isUser ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-void-accent">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-void-secondary">
            <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" />
            <path d="M12 6v6l4 2" />
          </svg>
        )}
      </div>

      {/* Content */}
      <div className={`flex-1 min-w-0 ${isUser ? 'flex justify-end' : ''}`}>
        <div className={`inline-block max-w-[85%] rounded-lg px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-void-accent/10 text-void-text border border-void-accent/20'
            : 'bg-void-surface text-void-text border border-void-border'
        }`}>
          {message.content && (
            <div className="max-w-none break-words message-content">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  pre({ children }) {
                    return (
                      <pre className="bg-[#0A0A0A] border border-void-border rounded p-3 my-2 overflow-x-auto">
                        {children}
                      </pre>
                    );
                  },
                  code({ className, children, ...props }) {
                    const isInline = !className;
                    if (isInline) {
                      return (
                        <code className="bg-[#0A0A0A] px-1.5 py-0.5 rounded text-xs font-mono text-void-accent" {...props}>
                          {children}
                        </code>
                      );
                    }
                    // Fenced code block
                    const lang = className ? className.replace('language-', '') : '';
                    return (
                      <div>
                        {lang && (
                          <div className="text-2xs text-void-muted px-1 pb-0.5 uppercase tracking-wider">
                            {lang}
                          </div>
                        )}
                        <code className="text-xs font-mono text-void-text block" {...props}>
                          {children}
                        </code>
                      </div>
                    );
                  },
                  p({ children }) {
                    return <p className="mb-2 last:mb-0 text-void-text">{children}</p>;
                  },
                  h1({ children }) {
                    return <h1 className="text-lg font-medium text-void-text my-3">{children}</h1>;
                  },
                  h2({ children }) {
                    return <h2 className="text-base font-medium text-void-text my-2">{children}</h2>;
                  },
                  h3({ children }) {
                    return <h3 className="text-sm font-medium text-void-text my-2">{children}</h3>;
                  },
                  ul({ children }) {
                    return <ul className="list-disc list-inside mb-2 text-void-text">{children}</ul>;
                  },
                  ol({ children }) {
                    return <ol className="list-decimal list-inside mb-2 text-void-text">{children}</ol>;
                  },
                  li({ children }) {
                    return <li className="mb-0.5 text-void-text">{children}</li>;
                  },
                  blockquote({ children }) {
                    return (
                      <blockquote className="border-l-2 border-void-accent/50 pl-3 my-2 text-void-secondary italic">
                        {children}
                      </blockquote>
                    );
                  },
                  a({ href, children }) {
                    return (
                      <a href={href} className="text-void-accent hover:underline" target="_blank" rel="noopener noreferrer">
                        {children}
                      </a>
                    );
                  },
                  table({ children }) {
                    return (
                      <div className="overflow-x-auto my-2">
                        <table className="w-full border-collapse text-xs">{children}</table>
                      </div>
                    );
                  },
                  th({ children }) {
                    return <th className="border border-void-border bg-void-surface px-3 py-1.5 text-left text-void-secondary font-medium">{children}</th>;
                  },
                  td({ children }) {
                    return <td className="border border-void-border px-3 py-1.5 text-void-text">{children}</td>;
                  },
                  hr() {
                    return <hr className="border-void-border my-3" />;
                  },
                  strong({ children }) {
                    return <strong className="font-medium text-void-text">{children}</strong>;
                  },
                  em({ children }) {
                    return <em className="italic text-void-text">{children}</em>;
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}

          {/* Code snippet (if user attached one) */}
          {message.codeSnippet && (
            <div className="mt-2 rounded border border-void-border bg-[#0A0A0A] p-2">
              <div className="text-2xs text-void-muted mb-1 uppercase tracking-wider">Attached Code</div>
              <pre className="text-xs font-mono text-void-text whitespace-pre-wrap overflow-x-auto max-h-48">
                {message.codeSnippet}
              </pre>
            </div>
          )}

          {/* Streaming cursor */}
          {isStreaming && (
            <span className="inline-block w-1.5 h-4 bg-void-accent ml-0.5 animate-pulse align-text-bottom" />
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
