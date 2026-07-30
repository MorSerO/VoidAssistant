import React, { useEffect, useState } from 'react';
import ChatPanel from '../../components/chat/ChatPanel';
import { useLearningStore } from '../../store/learningStore';
import { useChatStore } from '../../store/chatStore';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import ConfirmDialog from '../../components/common/ConfirmDialog';

const LearningMode: React.FC = () => {
  const modules = useLearningStore((s) => s.modules);
  const activeModuleId = useLearningStore((s) => s.activeModuleId);
  const fetchModules = useLearningStore((s) => s.fetchModules);
  const createModule = useLearningStore((s) => s.createModule);
  const deleteModule = useLearningStore((s) => s.deleteModule);
  const setActiveModule = useLearningStore((s) => s.setActiveModule);
  const bindNoteFile = useLearningStore((s) => s.bindNoteFile);
  const unbindNoteFile = useLearningStore((s) => s.unbindNoteFile);
  const loadConversation = useChatStore((s) => s.loadConversation);

  const [newModuleName, setNewModuleName] = useState('');
  const [showNewModule, setShowNewModule] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  // Load conversation when module changes
  useEffect(() => {
    const mod = modules.find(m => m.id === activeModuleId);
    if (mod) {
      loadConversation(mod.conversationId);
    }
  }, [activeModuleId, modules, loadConversation]);

  const activeModule = modules.find(m => m.id === activeModuleId);

  const handleCreate = async () => {
    if (!newModuleName.trim()) return;
    const mod = await createModule(newModuleName.trim());
    setNewModuleName('');
    setShowNewModule(false);
    if (mod) setActiveModule(mod.id);
  };

  const handleBindFile = async () => {
    if (!activeModule) return;
    const filePath = await window.electronAPI.selectFile();
    if (filePath) {
      await bindNoteFile(activeModule.id, filePath);
    }
  };

  return (
    <div className="flex h-full">
      {/* Module Sidebar */}
      <div className="w-56 shrink-0 border-r border-void-border bg-void-surface flex flex-col">
        <div className="flex items-center justify-between px-3 py-3 border-b border-void-border">
          <h3 className="text-xs font-medium uppercase tracking-wider text-void-secondary">Modules</h3>
          <button
            onClick={() => setShowNewModule(!showNewModule)}
            className="text-void-secondary hover:text-void-text transition-colors"
            title="Add Module"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>

        {/* New module input */}
        {showNewModule && (
          <div className="px-3 py-2 border-b border-void-border">
            <input
              type="text"
              value={newModuleName}
              onChange={(e) => setNewModuleName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="Module name..."
              className="w-full rounded border border-void-border bg-void-bg px-2 py-1.5 text-xs text-void-text placeholder:text-void-border focus:border-void-accent focus:outline-none"
              autoFocus
            />
          </div>
        )}

        {/* Module list */}
        <div className="flex-1 overflow-y-auto py-1">
          {modules.map((mod) => (
            <div key={mod.id} className="group">
              <button
                onClick={() => setActiveModule(mod.id)}
                className={`
                  flex w-full items-center justify-between px-3 py-2 text-sm transition-colors
                  ${mod.id === activeModuleId
                    ? 'bg-void-accent/10 text-void-text border-l-2 border-void-accent'
                    : 'text-void-secondary hover:text-void-text hover:bg-void-border/10 border-l-2 border-transparent'
                  }
                `}
              >
                <span className="truncate">{mod.name}</span>
                <div className="flex items-center gap-1">
                  {mod.isDefault && <Badge variant="accent">C++</Badge>}
                  {!mod.isDefault && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTargetId(mod.id); }}
                      className="opacity-0 group-hover:opacity-100 text-void-secondary hover:text-void-error transition-all"
                      title="Delete module"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>
              </button>
            </div>
          ))}
        </div>

        {/* Note Files */}
        {activeModule && (
          <div className="border-t border-void-border p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-2xs font-medium uppercase tracking-wider text-void-border">Notes</h4>
              <Button size="sm" variant="ghost" onClick={handleBindFile}>
                Add
              </Button>
            </div>
            {activeModule.noteFiles.length === 0 ? (
              <p className="text-2xs text-void-border">No notes bound</p>
            ) : (
              <div className="space-y-1">
                {activeModule.noteFiles.map((file, i) => (
                  <div key={i} className="flex items-center justify-between rounded bg-void-bg px-2 py-1">
                    <span className="text-xs text-void-secondary truncate flex-1" title={file}>
                      {file.split(/[\\/]/).pop()}
                    </span>
                    <button
                      onClick={() => unbindNoteFile(activeModule.id, file)}
                      className="text-void-border hover:text-void-error ml-1"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Code style indicator for C++ */}
            {activeModule.isDefault && activeModule.codeStyleSummary && (
              <div className="mt-2 rounded border border-void-border bg-void-bg p-2">
                <p className="text-2xs text-void-border mb-1">Code Style Profile</p>
                <p className="text-2xs text-void-secondary line-clamp-3">{activeModule.codeStyleSummary}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chat Area */}
      <div className="flex-1">
        <ChatPanel
          mode="learning"
          moduleId={activeModuleId || undefined}
          placeholder={activeModule
            ? `Ask about ${activeModule.name}...`
            : 'Select a module to start...'
          }
          showConversationList={false}
        />
      </div>

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={async () => {
          if (deleteTargetId) {
            await deleteModule(deleteTargetId);
            setDeleteTargetId(null);
          }
        }}
        title="Delete Module"
        message="Are you sure you want to delete this learning module? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
};

export default LearningMode;
