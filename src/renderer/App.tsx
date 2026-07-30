import React, { useEffect } from 'react';
import { useAppStore } from './store/appStore';
import { useConfigStore } from './store/configStore';
import Sidebar from './components/layout/Sidebar';
import TitleBar from './components/layout/TitleBar';
import SettingsPanel from './components/settings/SettingsPanel';

// Lazy-loaded mode components (will be created in later phases)
import LearningMode from './modes/Learning/LearningMode';
import PlanningMode from './modes/Planning/PlanningMode';
import FocusMode from './modes/Focus/FocusMode';
import DiaryMode from './modes/Diary/DiaryMode';

const App: React.FC = () => {
  const currentMode = useAppStore((s) => s.currentMode);
  const setMode = useAppStore((s) => s.setMode);
  const isSettingsOpen = useAppStore((s) => s.isSettingsOpen);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const fetchConfigs = useConfigStore((s) => s.fetchConfigs);

  // Load initial data
  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  // Listen for keyboard shortcuts from main process
  useEffect(() => {
    const unsub = window.electronAPI.onShortcutMode((mode) => {
      setMode(mode);
    });
    return () => unsub();
  }, [setMode]);

  const renderMode = () => {
    switch (currentMode) {
      case 'learning':
        return <LearningMode />;
      case 'planning':
        return <PlanningMode />;
      case 'focus':
        return <FocusMode />;
      case 'diary':
        return <DiaryMode />;
      default:
        return (
          <div className="flex h-full items-center justify-center text-void-secondary">
            Select a mode from the sidebar
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-void-bg text-void-text">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <TitleBar />
        <main className="flex-1 overflow-hidden">
          <div className="mode-transition h-full">
            {renderMode()}
          </div>
        </main>
      </div>

      {/* Settings Modal */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
};

export default App;
