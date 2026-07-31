import React from 'react';
import { useAppStore } from '../../store/appStore';

const modeTitles: Record<string, string> = {
  learning: 'Learning',
  planning: 'Planning',
  focus: 'Focus',
  diary: 'Diary',
};

const TitleBar: React.FC = () => {
  const currentMode = useAppStore((s) => s.currentMode);
  const sessionUsage = useAppStore((s) => s.sessionUsage);

  return (
    <header className="no-select flex h-10 items-center justify-between border-b border-void-border bg-void-bg px-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xs font-medium uppercase tracking-widest text-void-secondary">
          {modeTitles[currentMode]}
        </h1>
      </div>

      <div className="flex items-center gap-3 text-xs text-void-secondary">
        <span title="Session token usage">
          {sessionUsage.tokens > 0 ? `${sessionUsage.tokens.toLocaleString()} tokens` : ''}
        </span>
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{
            backgroundColor: sessionUsage.tokens > 0 ? '#3B82F6' : 'rgba(255,255,255,0.2)',
          }}
          title={sessionUsage.tokens > 0 ? 'API Connected' : 'No API activity'}
        />
      </div>
    </header>
  );
};

export default TitleBar;
