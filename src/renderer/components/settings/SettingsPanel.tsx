import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import ApiConfigList from './ApiConfigList';
import ApiConfigForm from './ApiConfigForm';
import UsagePanel from './UsagePanel';
import { useConfigStore } from '../../store/configStore';
import { useUsageStore } from '../../store/usageStore';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'configs' | 'usage' | 'general';

const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<Tab>('configs');
  const [showForm, setShowForm] = useState(false);
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null);
  const fetchConfigs = useConfigStore((s) => s.fetchConfigs);
  const fetchSummary = useUsageStore((s) => s.fetchSummary);

  useEffect(() => {
    if (isOpen) {
      fetchConfigs();
      fetchSummary();
    }
  }, [isOpen, fetchConfigs, fetchSummary]);

  const handleEdit = (id: string) => {
    setEditingConfigId(id);
    setShowForm(true);
  };

  const handleAdd = () => {
    setEditingConfigId(null);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingConfigId(null);
  };

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'configs', label: 'API Configs' },
    { id: 'usage', label: 'Usage & Budget' },
    { id: 'general', label: 'General' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings" width="max-w-2xl">
      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-void-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-[1px]
              ${activeTab === tab.id
                ? 'border-void-accent text-void-text'
                : 'border-transparent text-void-secondary hover:text-void-text'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'configs' && !showForm && (
        <ApiConfigList onAdd={handleAdd} onEdit={handleEdit} />
      )}
      {activeTab === 'configs' && showForm && (
        <ApiConfigForm
          configId={editingConfigId}
          onBack={handleFormClose}
          onSaved={handleFormClose}
        />
      )}
      {activeTab === 'usage' && <UsagePanel />}
      {activeTab === 'general' && (
        <div className="text-sm text-void-secondary">
          <p className="mb-4">Void AI Assistant v1.0.0</p>
          <p className="mb-2">Keyboard shortcuts:</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li><kbd className="px-1.5 py-0.5 text-2xs bg-void-surface border border-void-border rounded">Ctrl+1</kbd> Learning Mode</li>
            <li><kbd className="px-1.5 py-0.5 text-2xs bg-void-surface border border-void-border rounded">Ctrl+2</kbd> Planning Mode</li>
            <li><kbd className="px-1.5 py-0.5 text-2xs bg-void-surface border border-void-border rounded">Ctrl+3</kbd> Focus Mode</li>
            <li><kbd className="px-1.5 py-0.5 text-2xs bg-void-surface border border-void-border rounded">Ctrl+4</kbd> Diary Mode</li>
            <li><kbd className="px-1.5 py-0.5 text-2xs bg-void-surface border border-void-border rounded">Esc</kbd> Exit focus timer / Close modals</li>
          </ul>
        </div>
      )}
    </Modal>
  );
};

export default SettingsPanel;
