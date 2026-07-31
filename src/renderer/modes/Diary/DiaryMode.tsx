import React, { useEffect, useState } from 'react';
import { useDiaryStore } from '../../store/diaryStore';
import { useChatStore } from '../../store/chatStore';
import ChatPanel from '../../components/chat/ChatPanel';

const DiaryMode: React.FC = () => {
  const currentDate = useDiaryStore((s) => s.currentDate);
  const entryContent = useDiaryStore((s) => s.entryContent);
  const entries = useDiaryStore((s) => s.entries);
  const isLoading = useDiaryStore((s) => s.isLoading);
  const fetchEntry = useDiaryStore((s) => s.fetchEntry);
  const listEntries = useDiaryStore((s) => s.listEntries);
  const setCurrentDate = useDiaryStore((s) => s.setCurrentDate);
  const loadConversation = useChatStore((s) => s.loadConversation);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    fetchEntry(today);
    listEntries();
  }, []);

  const handleDateClick = (date: string) => {
    setCurrentDate(date);
    fetchEntry(date);
  };

  return (
    <div className="flex h-full">
      {/* Diary Sidebar */}
      <div className="w-56 shrink-0 border-r border-void-border bg-void-surface flex flex-col">
        <div className="px-3 py-3 border-b border-void-border">
          <h3 className="text-xs font-medium uppercase tracking-wider text-void-secondary">Diary</h3>
        </div>

        {/* Date list */}
        <div className="flex-1 overflow-y-auto py-1">
          <button
            onClick={() => handleDateClick(today)}
            className={`
              w-full px-3 py-2 text-left text-sm transition-colors border-l-2
              ${currentDate === today
                ? 'bg-void-accent/10 text-void-text border-void-accent'
                : 'border-transparent text-void-secondary hover:text-void-text hover:bg-void-border/10'
              }
            `}
          >
            <div className="font-medium">Today</div>
            <div className="text-2xs text-void-muted">{today}</div>
          </button>

          <div className="border-t border-void-border my-1" />

          {entries.map((entry) => (
            <button
              key={entry.date}
              onClick={() => handleDateClick(entry.date)}
              className={`
                w-full px-3 py-2 text-left transition-colors border-l-2
                ${currentDate === entry.date
                  ? 'bg-void-accent/10 text-void-text border-void-accent'
                  : 'border-transparent text-void-secondary hover:text-void-text hover:bg-void-border/10'
                }
              `}
            >
              <div className="text-xs">{entry.date}</div>
              <div className="text-2xs text-void-muted truncate">{entry.preview}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col">
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-void-secondary">
              <span className="inline-block w-2 h-2 rounded-full bg-void-accent animate-pulse" />
              Loading...
            </div>
          </div>
        ) : (
          <>
            {/* Entry preview */}
            {entryContent && (
              <div className="shrink-0 border-b border-void-border bg-void-bg px-4 py-3 max-h-32 overflow-y-auto">
                <pre className="text-xs text-void-secondary whitespace-pre-wrap font-sans">
                  {entryContent.slice(0, 500)}
                  {entryContent.length > 500 && '...'}
                </pre>
              </div>
            )}

            {/* Chat with diary companion */}
            <div className="flex-1">
              <ChatPanel
                mode="diary"
                placeholder={`What's on your mind today?`}
                showConversationList={false}
                header={
                  <div className="flex items-center justify-between px-4 py-2 border-b border-void-border">
                    <div>
                      <span className="text-xs text-void-secondary">
                        {currentDate === today ? 'Today' : currentDate}
                      </span>
                    </div>
                    <span className="text-2xs text-void-muted">
                      Diary Companion
                    </span>
                  </div>
                }
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DiaryMode;
