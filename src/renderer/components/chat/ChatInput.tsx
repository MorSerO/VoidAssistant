import React, { useState, useRef, useEffect } from 'react';

interface ChatInputProps {
  onSend: (text: string, codeSnippet?: string) => void;
  onCancel: () => void;
  isStreaming: boolean;
  placeholder?: string;
  showCodeButton?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  onCancel,
  isStreaming,
  placeholder = 'Type your message...',
  showCodeButton = false,
}) => {
  const [text, setText] = useState('');
  const [showCodeField, setShowCodeField] = useState(false);
  const [codeSnippet, setCodeSnippet] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    }
  }, [text]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed, showCodeField ? codeSnippet : undefined);
    setText('');
    setCodeSnippet('');
    setShowCodeField(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-void-border bg-void-bg p-3">
      {/* Code snippet field (for C++ module) */}
      {showCodeField && (
        <div className="mb-2 rounded border border-void-accent/30 bg-void-accent/5 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-void-accent">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
              <span className="text-xs font-medium text-void-accent">C++ Code Style Analysis</span>
            </div>
            <button
              onClick={() => setShowCodeField(false)}
              className="text-xs text-void-secondary hover:text-void-text transition-colors"
            >
              ✕ Remove
            </button>
          </div>
          <p className="text-2xs text-void-muted mb-2">
            Paste your C++ code below. The AI will analyze your coding style (indentation, naming, braces, etc.) and learn to match it in future responses.
          </p>
          <textarea
            value={codeSnippet}
            onChange={(e) => setCodeSnippet(e.target.value)}
            placeholder="// Paste your C++ code here..."
            className="w-full resize-none rounded border border-void-border bg-void-surface px-3 py-2 text-xs font-mono text-void-text placeholder:text-void-muted focus:border-void-accent focus:outline-none"
            rows={6}
          />
        </div>
      )}

      <div className="flex items-end gap-2">
        {showCodeButton && !showCodeField && (
          <button
            onClick={() => setShowCodeField(true)}
            title="Attach C++ code for style analysis"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded text-void-accent hover:text-white hover:bg-void-accent/30 transition-colors border border-void-accent/30"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </button>
        )}

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          className="flex-1 resize-none rounded border border-void-border bg-void-surface px-3 py-2 text-sm text-void-text placeholder:text-void-muted focus:border-void-accent focus:outline-none"
          disabled={isStreaming}
        />

        {isStreaming ? (
          <button
            onClick={onCancel}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-void-error/20 text-void-error hover:bg-void-error/30 transition-colors"
            title="Stop generating"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <rect x="4" y="4" width="16" height="16" rx="1" />
            </svg>
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!text.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-void-accent text-white hover:bg-blue-600 disabled:opacity-30 transition-all"
            title="Send message"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default ChatInput;
