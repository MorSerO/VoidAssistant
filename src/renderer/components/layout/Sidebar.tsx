import React from 'react';
import { useAppStore } from '../../store/appStore';
import type { AppMode } from '../../../shared/types';

const modeIcons: Record<AppMode, { label: string; icon: React.ReactNode }> = {
  learning: {
    label: 'Learning',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <line x1="8" y1="7" x2="16" y2="7" />
        <line x1="8" y1="11" x2="14" y2="11" />
      </svg>
    ),
  },
  planning: {
    label: 'Planning',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="9" y1="14" x2="15" y2="14" />
      </svg>
    ),
  },
  focus: {
    label: 'Focus',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  diary: {
    label: 'Diary',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
};

const modes: AppMode[] = ['learning', 'planning', 'focus', 'diary'];

const Sidebar: React.FC = () => {
  const currentMode = useAppStore((s) => s.currentMode);
  const setMode = useAppStore((s) => s.setMode);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);

  return (
    <aside className="no-select flex h-full w-16 flex-col items-center border-r border-void-border bg-void-surface py-4">
      {/* Mode Icons */}
      <nav className="flex flex-1 flex-col items-center gap-1">
        {modes.map((mode) => {
          const isActive = currentMode === mode;
          const { label, icon } = modeIcons[mode];
          return (
            <button
              key={mode}
              onClick={() => setMode(mode)}
              title={label}
              className={`
                flex h-12 w-12 items-center justify-center rounded transition-all duration-150
                ${isActive
                  ? 'bg-void-accent/15 text-void-accent shadow-[inset_0_0_0_1px_rgba(59,130,246,0.3)]'
                  : 'text-void-secondary hover:bg-void-border/30 hover:text-void-text'
                }
              `}
            >
              {icon}
            </button>
          );
        })}
      </nav>

      {/* Bottom: Settings + Usage */}
      <div className="flex flex-col items-center gap-2">
        <button
          onClick={() => setSettingsOpen(true)}
          title="Settings"
          className="flex h-10 w-10 items-center justify-center rounded text-void-secondary transition-all hover:bg-void-border/30 hover:text-void-text"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
