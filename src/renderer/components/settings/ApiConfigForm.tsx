import React, { useState, useEffect } from 'react';
import { useConfigStore } from '../../store/configStore';
import Input, { Textarea } from '../common/Input';
import Button from '../common/Button';

interface ApiConfigFormProps {
  configId: string | null;
  onBack: () => void;
  onSaved: () => void;
}

const ApiConfigForm: React.FC<ApiConfigFormProps> = ({ configId, onBack, onSaved }) => {
  const configs = useConfigStore((s) => s.configs);
  const saveConfig = useConfigStore((s) => s.saveConfig);

  const existing = configId ? configs.find(c => c.id === configId) : null;

  const [name, setName] = useState(existing?.name || '');
  const [baseUrl, setBaseUrl] = useState(existing?.baseUrl || 'https://api.openai.com/v1');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(existing?.model || 'gpt-4o');
  const [temperature, setTemperature] = useState(existing?.temperature ?? 0.7);
  const [maxTokens, setMaxTokens] = useState(existing?.maxTokens ?? 4096);
  const [inputPrice, setInputPrice] = useState(existing?.pricing?.inputPrice ?? 0);
  const [outputPrice, setOutputPrice] = useState(existing?.pricing?.outputPrice ?? 0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim() || !baseUrl.trim() || !model.trim()) {
      setError('Name, Base URL, and Model are required.');
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      await saveConfig({
        id: configId || undefined,
        name: name.trim(),
        baseUrl: baseUrl.trim(),
        apiKey: apiKey || existing?.hasKey ? (apiKey || undefined) : undefined,
        model: model.trim(),
        temperature,
        maxTokens,
        pricing: { inputPrice, outputPrice },
        headers: {},
        isActive: existing?.isActive ?? false,
      });
      onSaved();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="text-void-secondary hover:text-void-text">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h3 className="text-sm font-medium text-void-text">
          {configId ? 'Edit Configuration' : 'Add Configuration'}
        </h3>
      </div>

      <div className="space-y-4">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Claude" />
        <Input label="Base URL" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" />
        <Input
          label="API Key"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={existing?.hasKey ? '(leave blank to keep existing key)' : 'sk-...'}
        />
        <Input label="Model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="gpt-4o" />

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-void-secondary">
              Temperature: {temperature}
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="accent-void-accent"
            />
          </div>
          <Input
            label="Max Tokens"
            type="number"
            min={1}
            max={128000}
            step={256}
            value={maxTokens}
            onChange={(e) => setMaxTokens(parseInt(e.target.value, 10) || 4096)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Input Price ($/1K tokens)"
            type="number"
            step="0.0001"
            value={inputPrice}
            onChange={(e) => setInputPrice(parseFloat(e.target.value) || 0)}
          />
          <Input
            label="Output Price ($/1K tokens)"
            type="number"
            step="0.0001"
            value={outputPrice}
            onChange={(e) => setOutputPrice(parseFloat(e.target.value) || 0)}
          />
        </div>

        {error && (
          <p className="text-xs text-void-error">{error}</p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onBack}>Cancel</Button>
          <Button onClick={handleSave} isLoading={isSaving}>Save Configuration</Button>
        </div>
      </div>
    </div>
  );
};

export default ApiConfigForm;
