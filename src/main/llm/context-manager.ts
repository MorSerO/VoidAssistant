import type { AppMode, Message, ToolDefinition } from '../../shared/types';
import { getMessagesByConversation, getModuleById } from '../storage/database';
import { getAllToolDefinitions } from '../tools/definitions';

/**
 * Build the system prompt for a given mode.
 */
export function buildSystemPrompt(
  mode: AppMode,
  context?: {
    noteFiles?: string[];
    diaryContent?: string;
    focusSession?: { purpose: string; duration: number; rating?: number; note?: string };
    recentFocusSessions?: Array<{ purpose: string; duration: number; rating?: number; timestamp: number }>;
  }
): string {
  switch (mode) {
    case 'learning': {
      let prompt = 'You are an AI study companion. Help the user understand notes, summarize key concepts, and propose edits to their markdown files only when asked. Use tools to read or suggest changes. Never edit files without explicit user confirmation.';
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
  // Repair 1: Strip dangling tool_calls from assistant messages where the
  // following tool messages don't cover all tool_call_ids (e.g. the process
  // died after the assistant message was saved but before tool results were).
  // This runs BEFORE the orphan filter: an assistant message whose tool_calls
  // have no following tool results turns every matching tool message into an
  // orphan, and either leftover alone makes the API reject the request with 400.
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
      const expectedIds = new Set(msg.tool_calls.map(tc => tc.id));
      for (let j = i + 1; j < messages.length; j++) {
        const next = messages[j];
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

  // Repair 2: Filter out orphaned tool messages (tool_call_id doesn't match
  // any remaining assistant's tool_calls). A tool message without a preceding
  // assistant(tool_calls) makes OpenAI-compatible APIs reject the whole
  // request with HTTP 400.
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

  // Trim: keep the conversation within a safe context budget so requests
  // aren't rejected with "maximum context length exceeded" (HTTP 400 on many
  // providers). Tool results (e.g. a whole file read via read_file) can be
  // huge; without trimming, the history grows until it overflows the model.
  const MAX_MESSAGE_CHARS = 16000; // cap for any single message (e.g. read_file results)
  const MAX_TOTAL_CHARS = 48000;   // total conversation budget (~12k-48k tokens depending on language)
  const MIN_KEEP_MESSAGES = 6;     // always keep the most recent exchange(s)

  // 1. Cap oversized single messages
  for (const msg of repaired) {
    if (typeof msg.content === 'string' && msg.content.length > MAX_MESSAGE_CHARS) {
      console.warn(
        `[context] Truncating oversized message (${msg.content.length} chars), conversation ${conversationId}`
      );
      msg.content = `${msg.content.slice(0, MAX_MESSAGE_CHARS)}\n\n...[truncated; original was ${msg.content.length} chars]`;
    }
  }

  // 2. Drop the oldest messages until the total fits the budget
  let totalChars = 0;
  for (const msg of repaired) {
    totalChars += typeof msg.content === 'string' ? msg.content.length : 0;
  }
  let dropCount = 0;
  while (dropCount < repaired.length - MIN_KEEP_MESSAGES && totalChars > MAX_TOTAL_CHARS) {
    totalChars -= typeof repaired[dropCount].content === 'string'
      ? (repaired[dropCount].content as string).length
      : 0;
    dropCount++;
  }
  if (dropCount > 0) {
    console.warn(
      `[context] Dropping ${dropCount} oldest messages (${totalChars} chars remain), conversation ${conversationId}`
    );
    let trimmed = repaired.slice(dropCount);
    // Never start with a tool message: its assistant(tool_calls) was dropped
    // with the prefix, and a leading tool message alone causes a 400.
    while (trimmed.length > 0 && trimmed[0].role === 'tool') {
      trimmed.shift();
    }
    repaired = trimmed;
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

