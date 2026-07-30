import type { AppMode, Message, ToolDefinition } from '../../shared/types';
import { getMessagesByConversation, getModuleById } from '../storage/database';
import { getAllToolDefinitions } from '../tools/definitions';

/**
 * Build the system prompt for a given mode.
 */
export function buildSystemPrompt(
  mode: AppMode,
  context?: {
    codeStyleSummary?: string | null;
    diaryContent?: string;
    focusSession?: { purpose: string; duration: number; rating?: number; note?: string };
    recentFocusSessions?: Array<{ purpose: string; duration: number; rating?: number; timestamp: number }>;
  }
): string {
  switch (mode) {
    case 'learning': {
      let prompt = 'You are an AI study companion. Help the user understand notes, summarize key concepts, and propose edits to their markdown files only when asked. Use tools to read or suggest changes. Never edit files without explicit user confirmation.';
      if (context?.codeStyleSummary) {
        prompt += `\n\nYou are a C++ expert. The user's coding style summary: ${context.codeStyleSummary}. Mimic this style in any code you provide.`;
      }
      return prompt;
    }

    case 'planning':
      return 'You are a strategic planner. Help the user evaluate their plans, break down long-term goals into actionable steps, and suggest adjustments. You have access to their current plan data via tools. Always present modifications for review before applying. Be specific and practical in your suggestions.';

    case 'focus': {
      if (context?.focusSession && context?.recentFocusSessions) {
        const session = context.focusSession;
        const recent = context.recentFocusSessions
          .map(s => `- ${new Date(s.timestamp).toLocaleDateString()}: "${s.purpose}" (${Math.floor(s.duration / 60)}min, rated ${s.rating}/5)`)
          .join('\n');
        return `You are a supportive coach. The user has just completed a focus session:\n- Purpose: ${session.purpose}\n- Duration: ${Math.floor(session.duration / 60)} minutes\n- Rating: ${session.rating ?? 'N/A'}/5\n\nRecent focus history:\n${recent || 'No recent sessions.'}\n\nProvide a brief (2-4 sentences), empathetic response that encourages or gently advises based on their pattern. Be warm, personal, and specific.`;
      }
      return 'You are a supportive coach. Provide brief, empathetic responses that encourage the user.';
    }

    case 'diary':
      return 'You are a reflective diary companion. Engage in natural conversation with the user about their day, help them process their thoughts and feelings, summarize daily entries when asked, and recall past events when relevant. Be warm, understanding, and non-judgmental. Speak in a conversational, gentle tone.';

    default:
      return 'You are a helpful AI assistant.';
  }
}

/**
 * Load conversation messages from the database and format them for LLM API.
 */
export function loadConversationMessages(conversationId: string): Array<{
  role: string;
  content: string | null;
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
  name?: string;
}> {
  const rows = getMessagesByConversation(conversationId);
  return rows.map(row => {
    const msg: {
      role: string;
      content: string | null;
      tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
      tool_call_id?: string;
      name?: string;
    } = {
      role: row.role as string,
      content: row.content as string | null,
    };

    if (row.tool_calls) {
      msg.tool_calls = (JSON.parse(row.tool_calls as string) as Array<{
        id: string; type: 'function'; function: { name: string; arguments: string };
      }>).map(tc => ({
        id: tc.id,
        type: 'function' as const,
        function: tc.function,
      }));
    }

    if (row.tool_call_id) {
      msg.tool_call_id = row.tool_call_id as string;
    }
    if (row.tool_name) {
      msg.name = row.tool_name as string;
    }

    return msg;
  });
}

/**
 * Get the relevant tools for a given mode.
 */
export function getRelevantTools(mode: AppMode): ToolDefinition[] {
  const allTools = getAllToolDefinitions();
  switch (mode) {
    case 'learning':
      return allTools.filter(t => ['read_file', 'propose_edit'].includes(t.function.name));
    case 'planning':
      return allTools.filter(t => ['get_plans', 'update_plan'].includes(t.function.name));
    case 'diary':
    case 'focus':
      return []; // No function calling for these modes
    default:
      return [];
  }
}

/**
 * Merge a new code style analysis with an existing summary.
 * Simple strategy: append the new analysis with a separator.
 * A more sophisticated merge (using LLM) can be added later.
 */
export function mergeCodeStyleSummary(existing: string | null, newAnalysis: string): string {
  if (!existing) return newAnalysis;
  // Take the latest analysis; keep the old as context
  // In production, could use LLM to merge them
  return newAnalysis;
}

/**
 * Build a code style analysis prompt.
 */
export function buildStyleAnalysisPrompt(code: string): { system: string; user: string } {
  return {
    system: 'You are an expert C++ code style analyzer. Analyze the following code and describe the coding style concisely in one paragraph. Cover: indentation style, brace placement, naming conventions (camelCase, snake_case, PascalCase), comment style, whitespace usage, and any notable patterns. Be specific and concise.',
    user: `Analyze this C++ code:\n\n\`\`\`cpp\n${code}\n\`\`\``,
  };
}
