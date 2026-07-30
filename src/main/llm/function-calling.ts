import type { ToolCallRequest, ToolCallResult, EditProposal, Plan } from '../../shared/types';
import { readFileContent, proposeFileEdit, confirmFileEdit, rejectFileEdit } from '../storage/file-manager';
import { getAllPlanRows, getPlanByIdRow, savePlanRow } from '../storage/database';
import { v4 as uuidv4 } from 'uuid';

export interface ToolExecutionContext {
  allowedPaths: string[];
  moduleId?: string;
}

/**
 * Execute a single tool call and return a result that can be fed back to the LLM.
 */
export async function executeToolCall(
  toolCall: ToolCallRequest,
  context: ToolExecutionContext
): Promise<ToolCallResult> {
  let content: string;

  try {
    switch (toolCall.name) {
      case 'read_file': {
        const args = JSON.parse(toolCall.arguments);
        content = handleReadFile(args.filePath, context.allowedPaths);
        break;
      }

      case 'propose_edit': {
        const args = JSON.parse(toolCall.arguments);
        content = handleProposeEdit(args.filePath, args.newContent, context.allowedPaths);
        break;
      }

      case 'get_plans': {
        content = handleGetPlans();
        break;
      }

      case 'update_plan': {
        const args = JSON.parse(toolCall.arguments);
        content = handleUpdatePlan(args.planId, args.updatedPlan);
        break;
      }

      default:
        content = JSON.stringify({ error: `Unknown tool: "${toolCall.name}". Available tools: read_file, propose_edit, get_plans, update_plan.` });
    }
  } catch (err: unknown) {
    content = JSON.stringify({ error: `Tool execution error: ${(err as Error).message}` });
  }

  return {
    toolCallId: toolCall.id,
    content,
  };
}

function handleReadFile(filePath: string, allowedPaths: string[]): string {
  if (!filePath) {
    return JSON.stringify({ error: 'filePath is required.' });
  }
  try {
    const fileContent = readFileContent(filePath, allowedPaths);
    return JSON.stringify({ filePath, content: fileContent });
  } catch (err: unknown) {
    return JSON.stringify({ error: (err as Error).message });
  }
}

function handleProposeEdit(filePath: string, newContent: string, allowedPaths: string[]): string {
  if (!filePath || newContent === undefined) {
    return JSON.stringify({ error: 'filePath and newContent are required.' });
  }
  try {
    const proposal = proposeFileEdit(filePath, newContent, allowedPaths);
    return JSON.stringify({
      editId: proposal.editId,
      filePath: proposal.filePath,
      diff: proposal.diff,
      needsConfirmation: true,
      message: 'Edit proposal created. The user must confirm before changes are applied.',
    });
  } catch (err: unknown) {
    return JSON.stringify({ error: (err as Error).message });
  }
}

function handleGetPlans(): string {
  try {
    const rows = getAllPlanRows();
    const plans: Plan[] = rows.map(row => ({
      id: row.id as string,
      type: row.type as Plan['type'],
      title: row.title as string,
      items: typeof row.items === 'string' ? JSON.parse(row.items) : (row.items || []),
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
    }));
    return JSON.stringify({ plans, count: plans.length });
  } catch (err: unknown) {
    return JSON.stringify({ error: (err as Error).message });
  }
}

function handleUpdatePlan(planId: string, updatedPlan: Record<string, unknown>): string {
  if (!planId || !updatedPlan) {
    return JSON.stringify({ error: 'planId and updatedPlan are required.' });
  }
  try {
    const existing = getPlanByIdRow(planId);
    if (!existing) {
      return JSON.stringify({ error: `Plan "${planId}" not found.` });
    }

    // Merge updates into existing plan
    const merged = {
      id: planId,
      type: (updatedPlan.type || existing.type) as string,
      title: (updatedPlan.title || existing.title) as string,
      items: updatedPlan.items || (typeof existing.items === 'string' ? JSON.parse(existing.items as string) : []),
      createdAt: existing.created_at as number,
      updatedAt: Date.now(),
    };

    savePlanRow(merged);

    return JSON.stringify({
      success: true,
      message: 'Plan updated successfully.',
      plan: merged,
    });
  } catch (err: unknown) {
    return JSON.stringify({ error: (err as Error).message });
  }
}

/**
 * Format a tool call result as a message that can be sent back to the LLM.
 */
export function toolResultToMessage(result: ToolCallResult): {
  role: 'tool';
  tool_call_id: string;
  content: string;
} {
  return {
    role: 'tool',
    tool_call_id: result.toolCallId,
    content: result.content,
  };
}
