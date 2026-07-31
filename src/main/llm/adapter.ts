import type { ApiConfig, StreamChunk, ToolDefinition } from '../../shared/types';

export interface ChatRequest {
  systemPrompt: string;
  messages: Array<{
    role: string;
    content: string | null;
    tool_calls?: Array<{
      id: string;
      type: 'function';
      function: { name: string; arguments: string };
    }>;
    tool_call_id?: string;
    name?: string;
  }>;
  tools?: ToolDefinition[];
}

/**
 * Detects if a model supports function calling by sending a lightweight
 * test request. Results are cached per config ID in the settings table.
 *
 * Since this requires an active config, we perform detection lazily:
 * if a request with tools returns an error about unsupported tools,
 * we mark tools as unsupported and retry without them.
 */
let toolsSupportCache = new Map<string, boolean>();

export function setToolsSupported(configId: string, supported: boolean): void {
  toolsSupportCache.set(configId, supported);
}

export function areToolsSupported(configId: string): boolean | undefined {
  return toolsSupportCache.get(configId);
}

/**
 * Core streaming LLM adapter.
 *
 * Constructs an OpenAI-compatible POST request to /v1/chat/completions
 * with `stream: true`, then yields StreamChunks as the SSE stream is parsed.
 *
 * Supports:
 * - Text delta chunks (yielded as `type: 'text'`)
 * - Tool call accumulation (yielded as `type: 'tool_call'` after stream ends)
 * - Usage extraction from the final chunk
 * - Abort via AbortSignal
 */
export async function* streamChat(
  config: ApiConfig,
  request: ChatRequest,
  signal?: AbortSignal
): AsyncGenerator<StreamChunk> {
  // Normalize base URL (strip trailing /chat/completions if present)
  const baseUrl = config.baseUrl.replace(/\/chat\/completions\/?$/i, '').replace(/\/+$/, '');
  const url = `${baseUrl}/chat/completions`;
  const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Build messages array
  const messages: Array<Record<string, unknown>> = [
    { role: 'system', content: request.systemPrompt },
    ...request.messages.map(msg => {
      const m: Record<string, unknown> = { role: msg.role };
      if (msg.content !== null && msg.content !== undefined) {
        m.content = msg.content;
      }
      if (msg.tool_calls) {
        m.tool_calls = msg.tool_calls;
      }
      if (msg.tool_call_id) {
        m.tool_call_id = msg.tool_call_id;
      }
      if (msg.name) {
        m.name = msg.name;
      }
      return m;
    }),
  ];

  // Build request body
  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    temperature: config.temperature ?? 0.7,
    max_tokens: config.maxTokens ?? 4096,
    stream: true,
    stream_options: { include_usage: true },
  };

  // Only include tools if supported and provided
  if (request.tools && request.tools.length > 0) {
    const supported = toolsSupportCache.get(config.id);
    if (supported !== false) {
      body.tools = request.tools;
    }
  }

  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.apiKey}`,
    ...config.headers,
  };

  console.log('[adapter] >>> REQUEST to', url, 'model:', config.model);
  console.log('[adapter] >>> messages:', JSON.stringify(messages.slice(-4), null, 2));
  console.log('[adapter] >>> hasTools:', !!body.tools, 'toolsCount:', Array.isArray(body.tools) ? body.tools.length : 0);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      yield { type: 'done', requestId, finishReason: 'cancelled' };
      return;
    }
    yield { type: 'error', requestId, error: `Network error: ${(err as Error).message}` };
    return;
  }

  if (!response.ok) {
    let errorBody = '';
    try {
      errorBody = await response.text();
    } catch { /* ignore */ }

    // Detect if this is a tools-unsupported error (not a message format error)
    // Only retry without tools if: the model truly doesn't support them AND
    // the current request messages don't already contain tool calls from prior rounds.
    const isToolsUnsupportedError =
      response.status === 400 &&
      errorBody.includes('tool') &&
      !errorBody.includes('tool_calls') &&
      !errorBody.includes('role') &&
      request.tools?.length;
    const hasExistingToolMessages = request.messages.some(
      m => m.role === 'tool' || m.tool_calls || m.tool_call_id
    );

    if (isToolsUnsupportedError) {
      toolsSupportCache.set(config.id, false);
      if (!hasExistingToolMessages) {
        // Simple case: no tool refs in messages, just strip tools and retry
        const { tools, ...restRequest } = request;
        yield* streamChat(config, restRequest, signal);
        return;
      }
      // Messages already contain tool refs from prior rounds — strip them
      const cleanedMessages = request.messages.map(m => ({
        role: m.role,
        content: m.content,
      })) as ChatRequest['messages'];
      const { tools: _t, ...restRequest } = request;
      yield* streamChat(config, { ...restRequest, messages: cleanedMessages }, signal);
      return;
    }

    // Log any tool-format errors clearly (indicates a message construction bug)
    if (response.status === 400 && (errorBody.includes('tool_calls') || errorBody.includes('role'))) {
      console.error('[adapter] Tool message format error:', errorBody.slice(0, 500));
      console.error('[adapter] Messages sent:', JSON.stringify(request.messages.map(m => ({
        role: m.role,
        hasContent: !!m.content,
        hasToolCalls: !!m.tool_calls,
        toolCallId: m.tool_call_id,
      }))));
    }

    if (response.status === 401) {
      yield { type: 'error', requestId, error: 'Authentication failed. Check your API key.' };
    } else if (response.status === 429) {
      yield { type: 'error', requestId, error: 'Rate limited. Please wait and try again.' };
    } else if (response.status >= 500) {
      yield { type: 'error', requestId, error: `Server error (${response.status}). The API may be down.` };
    } else {
      yield { type: 'error', requestId, error: `API error (${response.status}): ${errorBody.slice(0, 300)}` };
    }
    return;
  }

  // Parse SSE stream
  const reader = response.body?.getReader();
  if (!reader) {
    yield { type: 'error', requestId, error: 'No response body received.' };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let accumulatedContent = '';
  const accumulatedToolCalls = new Map<number, { id: string; name: string; arguments: string }>();
  let usage: { inputTokens: number; outputTokens: number } | undefined;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;

        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;
          const finishReason = parsed.choices?.[0]?.finish_reason;

          // Reasoning content (DeepSeek-R1, o1, etc.) — emitted as a separate
          // chunk type so the UI can render it as a collapsible gray block and
          // so it is never persisted into the conversation history.
          if (delta?.reasoning_content) {
            yield {
              type: 'reasoning',
              requestId,
              content: delta.reasoning_content,
            };
          }

          // Text delta
          if (delta?.content) {
            accumulatedContent += delta.content;
            yield {
              type: 'text',
              requestId,
              content: delta.content,
            };
          }

          // Tool call delta
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              if (!accumulatedToolCalls.has(idx)) {
                accumulatedToolCalls.set(idx, { id: tc.id ?? '', name: '', arguments: '' });
              }
              const existing = accumulatedToolCalls.get(idx)!;
              if (tc.id) existing.id = tc.id;
              if (tc.function?.name) existing.name = tc.function.name;
              if (tc.function?.arguments) existing.arguments += tc.function.arguments;
            }
          }

          // Usage (may appear in any chunk with stream_options.include_usage)
          if (parsed.usage) {
            usage = {
              inputTokens: parsed.usage.prompt_tokens || 0,
              outputTokens: parsed.usage.completion_tokens || 0,
            };
          }
        } catch {
          // Skip malformed JSON lines (some providers have quirks)
        }
      }
    }

    // Process buffer remainder
    if (buffer.trim()) {
      const trimmed = buffer.trim();
      if (trimmed.startsWith('data:') && trimmed.slice(5).trim() !== '[DONE]') {
        try {
          const parsed = JSON.parse(trimmed.slice(5).trim());
          if (parsed.usage) {
            usage = {
              inputTokens: parsed.usage.prompt_tokens || 0,
              outputTokens: parsed.usage.completion_tokens || 0,
            };
          }
        } catch { /* ignore */ }
      }
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      yield { type: 'done', requestId, finishReason: 'cancelled' };
      return;
    }
    yield { type: 'error', requestId, error: `Stream error: ${(err as Error).message}` };
    return;
  }

  // After stream ends, yield accumulated tool calls
  for (const tc of accumulatedToolCalls.values()) {
    if (tc.name) {
      yield {
        type: 'tool_call',
        requestId,
        toolCall: {
          id: tc.id,
          name: tc.name,
          arguments: tc.arguments,
        },
      };
    }
  }

  // Final done event
  yield {
    type: 'done',
    requestId,
    content: accumulatedContent,
    usage,
    finishReason: 'stop',
  };
}

/**
 * Send a simple non-streaming request (for testing connections).
 */
export async function testConnection(config: ApiConfig): Promise<{ ok: boolean; error?: string }> {
  const baseUrl = config.baseUrl.replace(/\/chat\/completions\/?$/i, '').replace(/\/+$/, '');
  const url = `${baseUrl}/chat/completions`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        ...config.headers,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 1,
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      return { ok: true };
    }

    const errorBody = await response.text().catch(() => '');
    if (response.status === 401) {
      return { ok: false, error: 'Authentication failed. Check your API key.' };
    }
    return { ok: false, error: `HTTP ${response.status}: ${errorBody.slice(0, 200)}` };
  } catch (err: unknown) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: 'Connection timed out after 15 seconds.' };
    }
    return { ok: false, error: `Connection failed: ${(err as Error).message}` };
  }
}

