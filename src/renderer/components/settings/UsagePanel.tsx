import React, { useState, useEffect } from 'react';
import { useUsageStore } from '../../store/usageStore';
import Input from '../common/Input';
import Button from '../common/Button';

const UsagePanel: React.FC = () => {
  const summary = useUsageStore((s) => s.summary);
  const history = useUsageStore((s) => s.history);
  const fetchSummary = useUsageStore((s) => s.fetchSummary);
  const fetchHistory = useUsageStore((s) => s.fetchHistory);
  const setBudget = useUsageStore((s) => s.setBudget);
  const [budgetInput, setBudgetInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchSummary();
    fetchHistory(30);
  }, [fetchSummary, fetchHistory]);

  useEffect(() => {
    if (summary?.budgetLimit) {
      setBudgetInput(String(summary.budgetLimit));
    }
  }, [summary?.budgetLimit]);

  const handleSetBudget = async () => {
    setIsSaving(true);
    const tokens = parseInt(budgetInput, 10) || 0;
    await setBudget(tokens);
    await fetchSummary();
    setIsSaving(false);
  };

  const formatCost = (cost: number) => `$${cost.toFixed(4)}`;
  const formatTokens = (n: number) => n.toLocaleString();

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded border border-void-border bg-void-bg p-3 text-center">
          <div className="text-xs text-void-secondary mb-1">Session</div>
          <div className="text-lg font-mono text-void-text">
            {formatTokens(summary?.sessionTokens || 0)}
          </div>
          <div className="text-2xs text-void-muted">tokens</div>
        </div>
        <div className="rounded border border-void-border bg-void-bg p-3 text-center">
          <div className="text-xs text-void-secondary mb-1">Today</div>
          <div className="text-lg font-mono text-void-text">
            {formatTokens(summary?.todayTokens || 0)}
          </div>
          <div className="text-2xs text-void-muted">
            {formatCost(summary?.todayCost || 0)}
          </div>
        </div>
        <div className="rounded border border-void-border bg-void-bg p-3 text-center">
          <div className="text-xs text-void-secondary mb-1">This Month</div>
          <div className={`text-lg font-mono ${summary?.budgetExceeded ? 'text-void-error' : 'text-void-text'}`}>
            {formatTokens(summary?.monthTokens || 0)}
          </div>
          <div className="text-2xs text-void-muted">
            {formatCost(summary?.monthCost || 0)}
          </div>
        </div>
      </div>

      {/* Budget */}
      <div className="rounded border border-void-border bg-void-surface p-4">
        <h4 className="text-sm font-medium text-void-text mb-3">Monthly Budget</h4>
        <div className="flex items-end gap-3">
          <Input
            label="Token Limit"
            type="number"
            min={0}
            max={1000000000}
            step={100000}
            value={budgetInput}
            onChange={(e) => setBudgetInput(e.target.value)}
            placeholder="e.g. 1000000"
          />
          <Button size="sm" onClick={handleSetBudget} isLoading={isSaving}>
            Save
          </Button>
        </div>
        {summary?.budgetExceeded && (
          <div className="mt-3 px-3 py-2 rounded bg-void-error/10 text-xs text-void-error">
            Monthly budget exceeded! New requests will be blocked until the limit is increased or the month resets.
          </div>
        )}
        {summary?.budgetLimit && !summary?.budgetExceeded && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-void-secondary mb-1">
              <span>Usage</span>
              <span>{Math.round((summary.monthTokens / summary.budgetLimit) * 100)}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-void-border">
              <div
                className={`h-full rounded-full transition-all ${
                  (summary.monthTokens / summary.budgetLimit) > 0.9 ? 'bg-void-error' :
                  (summary.monthTokens / summary.budgetLimit) > 0.7 ? 'bg-void-warning' : 'bg-void-accent'
                }`}
                style={{ width: `${Math.min(100, (summary.monthTokens / summary.budgetLimit) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* History Chart (simple bars) */}
      {history.length > 0 && (
        <div className="rounded border border-void-border bg-void-surface p-4">
          <h4 className="text-sm font-medium text-void-text mb-3">Daily Usage (last 30 days)</h4>
          <div className="flex items-end gap-0.5 h-24">
            {history.map((day) => {
              const maxTokens = Math.max(...history.map(h => h.tokens), 1);
              const height = Math.max(2, (day.tokens / maxTokens) * 100);
              return (
                <div
                  key={day.date}
                  className="flex-1 rounded-t-sm bg-void-accent/60 hover:bg-void-accent transition-colors"
                  style={{ height: `${height}%` }}
                  title={`${day.date}: ${day.tokens.toLocaleString()} tokens (${day.cost.toFixed(4)})`}
                />
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-2xs text-void-muted">
            <span>{history[0]?.date}</span>
            <span>{history[history.length - 1]?.date}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsagePanel;
