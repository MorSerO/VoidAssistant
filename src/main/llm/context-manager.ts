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
    noteFiles?: string[];
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
      if (context?.noteFiles && context.noteFiles.length > 0) {
        prompt += `\n\nThe following note files are bound to the current learning module. You can read or propose edits to any of them using the read_file or propose_edit tools:\n${context.noteFiles.map(f => `- ${f}`).join('\n')}`;
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
  const messages = rows.map(row => {
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

  // Repair: fix corrupted message sequences so the API doesn't reject them.
  //
  // Repair 1: Filter out orphaned tool messages (tool_call_id doesn't match
  // any assistant's tool_calls). Do this FIRST so Repair 2's validation is
  // accurate after orphaned tools are removed.
  const validToolCallIds = new Set<string>();
  for (const msg of messages) {
    if (msg.role === 'assistant' && msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        validToolCallIds.add(tc.id);
      }
    }
  }
  const orphanedToolCount = messages.filter(
    m => m.role === 'tool' && m.tool_call_id && !validToolCallIds.has(m.tool_call_id)
  ).length;
  if (orphanedToolCount > 0) {
    console.warn(
      `[context] Repairing: filtering ${orphanedToolCount} orphaned tool messages, conversation ${conversationId}`
    );
  }
  let repaired = messages.filter(
    m => !(m.role === 'tool' && m.tool_call_id && !validToolCallIds.has(m.tool_call_id))
  );

  // Repair 2: Strip dangling tool_calls from assistant messages where the
  // following tool messages don't cover all tool_call_ids.
  for (let i = 0; i < repaired.length; i++) {
    const msg = repaired[i];
    if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
      const expectedIds = new Set(msg.tool_calls.map(tc => tc.id));
      for (let j = i + 1; j < repaired.length; j++) {
        const next = repaired[j];
        if (next.role !== 'tool') break;
        if (next.tool_call_id) expectedIds.delete(next.tool_call_id);
      }
      if (expectedIds.size > 0) {
        console.warn(
          `[context] Repairing: stripping ${expectedIds.size} dangling tool_calls from assistant, conversation ${conversationId}`
        );
        msg.tool_calls = undefined;
      }
    }
  }

  return repaired;
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
 *
 * Strategy: Keep both analyses. If the new one overlaps significantly with
 * the existing one, prioritize the newer, more detailed version.
 * Append a timestamp to track freshness.
 */
export function mergeCodeStyleSummary(existing: string | null, newAnalysis: string): string {
  const now = new Date().toISOString().split('T')[0];

  if (!existing || existing.trim() === '') {
    return `[Analyzed ${now}] ${newAnalysis.trim()}`;
  }

  // If the existing already contains very similar content, just update the date
  // Simple dedup: if Jaccard-ish overlap > 50%, prefer the newer
  const existingWords = new Set(existing.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const newWords = newAnalysis.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const overlap = newWords.filter(w => existingWords.has(w)).length;

  // If significant overlap (>40%), replace with the newer analysis
  // Otherwise, keep both separated by a divider
  if (newWords.length > 0 && overlap / newWords.length > 0.4) {
    return `[Analyzed ${now}] ${newAnalysis.trim()}`;
  }

  // Accumulate: newer first, then older
  return `[Analyzed ${now}] ${newAnalysis.trim()}\n\n---\n[Earlier] ${existing}`;
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
