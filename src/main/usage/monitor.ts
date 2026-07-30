import { v4 as uuidv4 } from 'uuid';
import { recordUsageRow, getUsageForPeriod, getSettingRow, getActiveConfig } from '../storage/database';
import type { UsageSummary } from '../../shared/types';

// Session token counter (in-memory, resets on app restart)
let sessionTokens = 0;

/**
 * Record usage after each API call completes.
 */
export function recordUsage(data: {
  configId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  conversationId?: string;
}): void {
  const totalTokens = data.inputTokens + data.outputTokens;
  sessionTokens += totalTokens;

  recordUsageRow({
    id: uuidv4(),
    configId: data.configId,
    model: data.model,
    inputTokens: data.inputTokens,
    outputTokens: data.outputTokens,
    timestamp: Date.now(),
    conversationId: data.conversationId,
  });
}

/**
 * Get current usage summary.
 */
export function getUsageSummary(): UsageSummary {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const todayRecords = getUsageForPeriod(todayStart, now.getTime());
  const monthRecords = getUsageForPeriod(monthStart, now.getTime());

  const todayTokens = todayRecords.reduce(
    (sum, r) => sum + (r.input_tokens as number) + (r.output_tokens as number), 0
  );
  const monthTokens = monthRecords.reduce(
    (sum, r) => sum + (r.input_tokens as number) + (r.output_tokens as number), 0
  );

  // Get pricing from active config
  const activeConfig = getActiveConfig();
  const inputPrice = (activeConfig?.input_price as number) || 0;
  const outputPrice = (activeConfig?.output_price as number) || 0;

  const todayCost = todayRecords.reduce(
    (sum, r) => sum +
      ((r.input_tokens as number) / 1000) * inputPrice +
      ((r.output_tokens as number) / 1000) * outputPrice,
    0
  );
  const monthCost = monthRecords.reduce(
    (sum, r) => sum +
      ((r.input_tokens as number) / 1000) * inputPrice +
      ((r.output_tokens as number) / 1000) * outputPrice,
    0
  );

  const budgetLimit = parseInt(getSettingRow('monthly_budget_tokens') || '0', 10);

  return {
    todayTokens,
    todayCost: Math.round(todayCost * 10000) / 10000,
    monthTokens,
    monthCost: Math.round(monthCost * 10000) / 10000,
    sessionTokens,
    budgetLimit: budgetLimit > 0 ? budgetLimit : undefined,
    budgetExceeded: budgetLimit > 0 && monthTokens >= budgetLimit,
  };
}

/**
 * Get detailed usage history.
 */
export function getUsageHistory(days: number = 30): Array<{
  date: string;
  tokens: number;
  cost: number;
}> {
  const now = Date.now();
  const start = now - days * 24 * 60 * 60 * 1000;
  const records = getUsageForPeriod(start, now);

  const activeConfig = getActiveConfig();
  const inputPrice = (activeConfig?.input_price as number) || 0;
  const outputPrice = (activeConfig?.output_price as number) || 0;

  // Group by date
  const byDate = new Map<string, { tokens: number; cost: number }>();
  for (const r of records) {
    const date = new Date(r.timestamp as number).toISOString().split('T')[0];
    const entry = byDate.get(date) || { tokens: 0, cost: 0 };
    entry.tokens += (r.input_tokens as number) + (r.output_tokens as number);
    entry.cost +=
      ((r.input_tokens as number) / 1000) * inputPrice +
      ((r.output_tokens as number) / 1000) * outputPrice;
    byDate.set(date, entry);
  }

  return Array.from(byDate.entries())
    .map(([date, data]) => ({
      date,
      tokens: data.tokens,
      cost: Math.round(data.cost * 10000) / 10000,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Check if usage is within budget.
 */
export function checkBudget(): { allowed: boolean; reason?: string } {
  const summary = getUsageSummary();
  if (summary.budgetExceeded) {
    return {
      allowed: false,
      reason: `Monthly token budget of ${summary.budgetLimit?.toLocaleString()} exceeded. Current: ${summary.monthTokens.toLocaleString()} tokens. Increase your limit in Settings or wait until next month.`,
    };
  }
  return { allowed: true };
}

/**
 * Reset the session counter.
 */
export function resetSession(): void {
  sessionTokens = 0;
}
