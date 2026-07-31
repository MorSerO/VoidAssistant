import React, { useState } from 'react';
import { useConfigStore } from '../../store/configStore';
import Button from '../common/Button';
import Badge from '../common/Badge';
import ConfirmDialog from '../common/ConfirmDialog';

interface ApiConfigListProps {
  onAdd: () => void;
  onEdit: (id: string) => void;
}

const ApiConfigList: React.FC<ApiConfigListProps> = ({ onAdd, onEdit }) => {
  const configs = useConfigStore((s) => s.configs);
  const deleteConfig = useConfigStore((s) => s.deleteConfig);
  const activateConfig = useConfigStore((s) => s.activateConfig);
  const testConnection = useConfigStore((s) => s.testConnection);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; error?: string }>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleTest = async (id: string) => {
    setTestingId(id);
    const result = await testConnection(id);
    setTestResults((prev) => ({ ...prev, [id]: result }));
    setTestingId(null);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteConfig(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-void-text">API Configurations</h3>
        <Button size="sm" onClick={onAdd}>Add Config</Button>
      </div>

      {configs.length === 0 ? (
        <div className="py-12 text-center text-void-secondary">
          <p className="mb-2 text-sm">No API configurations yet</p>
          <p className="text-xs">Add your first API config to start using Void AI Assistant</p>
        </div>
      ) : (
        <div className="space-y-3">
          {configs.map((config) => (
            <div
              key={config.id}
              className={`rounded border p-4 transition-colors ${
                config.isActive
                  ? 'border-void-accent/50 bg-void-accent/5'
                  : 'border-void-border bg-void-surface hover:bg-void-border/10'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-medium text-void-text truncate">{config.name}</h4>
                    {config.isActive && <Badge variant="accent">Active</Badge>}
                  </div>
                  <p className="text-xs text-void-secondary truncate">{config.model}</p>
                  <p className="text-xs text-void-muted truncate">{config.baseUrl}</p>
                </div>

                <div className="flex items-center gap-1 ml-3">
                  {!config.isActive && (
                    <Button variant="ghost" size="sm" onClick={() => activateConfig(config.id)}>
                      Activate
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => handleTest(config.id)} isLoading={testingId === config.id}>
                    Test
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onEdit(config.id)}>
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteId(config.id)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </Button>
                </div>
              </div>

              {/* Test Result */}
              {testResults[config.id] && (
                <div className={`mt-2 text-xs px-2 py-1 rounded ${
                  testResults[config.id].ok
                    ? 'bg-void-success/10 text-void-success'
                    : 'bg-void-error/10 text-void-error'
                }`}>
                  {testResults[config.id].ok ? 'Connection successful' : testResults[config.id].error}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Configuration"
        message="Are you sure you want to delete this API configuration? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
};

export default ApiConfigList;
