import { BrowserWindow, ipcMain, dialog } from './electron-access';
import type { BrowserWindow as BrowserWindowType } from 'electron';
import crypto from 'crypto';
const uuidv4 = (): string => crypto.randomUUID();
import type { ApiConfig, AppMode, SendMessageParams, StreamChunk, Plan, FocusSession, LearningModule } from '../shared/types';
import { IpcChannels } from '../shared/types';
import {
  getAllConfigs, getConfigById, saveConfigRow, deleteConfigRow, setConfigActive, getActiveConfig,
  createConversationRow, getConversationsByMode, getConversationById,
  updateConversationTitle, touchConversation, deleteConversationRow,
  addMessageRow, getMessagesByConversation,
  getAllModules, getModuleById, createModuleRow, updateModuleRow, deleteModuleRow,
  getAllPlanRows, getPlanByIdRow, savePlanRow, deletePlanRow,
  getFocusSessionsList, getRecentFocusSessionsList, logFocusSessionRow,
  getSettingRow, setSettingRow, getAllSettingRows,
} from './storage/database';
import { hydrateConfigForUse, prepareConfigForStorage, sanitizeConfigForRenderer } from './storage/key-store';
import { streamChat, testConnection } from './llm/adapter';
import { buildSystemPrompt, loadConversationMessages, getRelevantTools } from './llm/context-manager';
import { executeToolCall, toolResultToMessage } from './tools/handlers';
import { recordUsage, getUsageSummary, getUsageHistory, checkBudget } from './usage/monitor';
import {
  readFileContent, proposeFileEdit, confirmFileEdit, rejectFileEdit,
  getOrCreateDiaryEntry, readDiaryEntry, appendToDiaryEntry,
  listDiaryEntriesList, getDiaryEntriesByDateRangeList,
} from './storage/file-manager';

// Track active streaming requests
const activeStreams = new Map<string, AbortController>();

export function registerAllHandlers(mainWindow: BrowserWindowType): void {
  // ============================================================
  // Config Handlers
  // ============================================================

  ipcMain.handle(IpcChannels.CONFIG_GET_ALL, () => {
    const rows = getAllConfigs();
    return rows.map(row => {
      const config = hydrateConfigForUse(row);
      return sanitizeConfigForRenderer(config);
    });
  });

  ipcMain.handle(IpcChannels.CONFIG_SAVE, (_event, configData: Partial<ApiConfig> & { id?: string }) => {
    const now = Date.now();
    const isNew = !configData.id;
    const config: ApiConfig = {
      id: configData.id || uuidv4(),
      name: configData.name || 'Untitled',
      baseUrl: configData.baseUrl || '',
      apiKey: configData.apiKey || '',
      model: configData.model || '',
      temperature: configData.temperature ?? 0.7,
      maxTokens: Math.min(128000, Math.max(1, configData.maxTokens ?? 4096)),
      pricing: configData.pricing || { inputPrice: 0, outputPrice: 0 },
      headers: configData.headers || {},
      isActive: configData.isActive ?? false,
      createdAt: isNew ? now : (configData.createdAt || now),
      updatedAt: now,
    };

    if (config.isActive) {
      setConfigActive(config.id);
    }

    const row = prepareConfigForStorage(config);
    saveConfigRow(row);
  });

  ipcMain.handle(IpcChannels.CONFIG_DELETE, (_event, id: string) => {
    deleteConfigRow(id);
  });

  ipcMain.handle(IpcChannels.CONFIG_ACTIVATE, (_event, id: string) => {
    setConfigActive(id);
  });

  ipcMain.handle(IpcChannels.CONFIG_TEST, async (_event, id: string) => {
    const row = getConfigById(id);
    if (!row) {
      return { ok: false, error: 'Configuration not found.' };
    }
    const config = hydrateConfigForUse(row);
    return await testConnection(config);
  });

  // ============================================================
  // Chat Handler (streaming)
  // ============================================================

  ipcMain.handle(IpcChannels.CHAT_SEND, async (_event, params: SendMessageParams) => {
    const activeRow = getActiveConfig();
    if (!activeRow) {
      return { error: 'No active API configuration. Please add and activate an API config in Settings.' };
    }

    const config = hydrateConfigForUse(activeRow);

    // Budget check
    const budget = checkBudget();
    if (!budget.allowed) {
      return { error: budget.reason };
    }

    const requestId = uuidv4();

    // Create or get conversation
    let conversationId = params.conversationId;
    if (!conversationId) {
      if (params.moduleId) {
        // Learning mode: no conversationId means "start a new conversation"
        // for this module — each module can have multiple conversations.
        conversationId = uuidv4();
        const title = params.message.slice(0, 50) + (params.message.length > 50 ? '...' : '');
        createConversationRow({
          id: conversationId,
          title,
          mode: params.mode,
          moduleId: params.moduleId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      } else {
        // Diary/planning/focus: reuse this mode's existing conversation so
        // each mode keeps its own continuous chat history instead of
        // appending to whatever conversation was last active elsewhere.
        const existing = getConversationsByMode(params.mode, undefined)[0];
        if (existing) {
          conversationId = existing.id as string;
          touchConversation(conversationId);
        } else {
          conversationId = uuidv4();
          const title = params.message.slice(0, 50) + (params.message.length > 50 ? '...' : '');
          createConversationRow({
            id: conversationId,
            title,
            mode: params.mode,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        }
      }
    } else {
      touchConversation(conversationId);
    }

    // Save user message
    const userMsgId = uuidv4();
    addMessageRow({
      id: userMsgId,
      conversationId,
      role: 'user',
      content: params.message,
      createdAt: Date.now(),
    });

    // Build context
    let allowedPaths: string[] = [];

    if (params.mode === 'learning' && params.moduleId) {
      const mod = getModuleById(params.moduleId);
      if (mod) {
        allowedPaths = mod.note_files ? JSON.parse(mod.note_files as string) : [];
      }
    }

    const conversationMessages = loadConversationMessages(conversationId);
    console.log('[ipc] loaded', conversationMessages.length, 'msgs from DB for conversation', conversationId);
    const systemPrompt = buildSystemPrompt(params.mode, { noteFiles: allowedPaths });
    const tools = getRelevantTools(params.mode);

    // Start streaming (runs in background)
    const controller = new AbortController();
    activeStreams.set(requestId, controller);

    // Fire-and-forget the streaming
    (async () => {
      try {
        let assistantContent = '';
        let toolCallMessages: Array<{ role: string; content: string | null; tool_calls?: unknown[]; tool_call_id?: string; name?: string }> = [];

        // Main conversation loop (supports tool call roundtrips)
        let currentMessages = conversationMessages;
        let maxRounds = 5;

        while (maxRounds-- > 0) {
          console.log('[ipc] === Round', 5 - maxRounds, '=== currentMessages.length:', currentMessages.length);
          if (currentMessages.length > 1) {
            console.log('[ipc] last 3 msgs:', JSON.stringify(currentMessages.slice(-3).map(m => ({
              role: m.role,
              hasContent: !!m.content,
              toolCallIds: m.tool_calls?.map((tc: unknown) => (tc as {id: string}).id),
              toolCallId: (m as {tool_call_id?: string}).tool_call_id,
              name: (m as {name?: string}).name,
            }))));
          }
          const chunks = streamChat(config, {
            systemPrompt,
            messages: currentMessages,
            tools,
          }, controller.signal);

          let roundContent = '';
          const toolCalls: Array<{ id: string; name: string; arguments: string }> = [];
          let roundUsage: { inputTokens: number; outputTokens: number } | undefined;

          for await (const chunk of chunks) {
            if (chunk.type === 'text') {
              roundContent += chunk.content || '';
              mainWindow.webContents.send(IpcChannels.CHAT_STREAM_CHUNK, {
                ...chunk,
                requestId,
              });
            } else if (chunk.type === 'reasoning') {
              // Forward to the renderer for display, but do NOT persist it:
              // reasoning is ephemeral and would bloat the saved history.
              mainWindow.webContents.send(IpcChannels.CHAT_STREAM_CHUNK, {
                ...chunk,
                requestId,
              });
            } else if (chunk.type === 'tool_call' && chunk.toolCall) {
              toolCalls.push(chunk.toolCall);
              mainWindow.webContents.send(IpcChannels.CHAT_STREAM_CHUNK, {
                ...chunk,
                requestId,
              });
            } else if (chunk.type === 'error') {
              mainWindow.webContents.send(IpcChannels.CHAT_STREAM_CHUNK, {
                ...chunk,
                requestId,
              });
              // Save partial content as assistant message
              if (roundContent) {
                addMessageRow({
                  id: uuidv4(),
                  conversationId,
                  role: 'assistant',
                  content: roundContent,
                  createdAt: Date.now(),
                });
              }
              activeStreams.delete(requestId);
              mainWindow.webContents.send(IpcChannels.CHAT_STREAM_DONE, { requestId, conversationId });
              return;
            } else if (chunk.type === 'done') {
              roundUsage = chunk.usage;
              break;
            }
          }

          assistantContent += roundContent;

          console.log('[ipc] round done. toolCalls.length:', toolCalls.length, 'roundContent.length:', roundContent.length);

          // If no tool calls, we're done
          if (toolCalls.length === 0) {
            // Save assistant message. tool_calls must NOT be attached here:
            // they were already persisted on the intermediate assistant
            // message(s), each followed by its tool results. Duplicating them
            // on the final message would corrupt the assistant → tool sequence
            // when the conversation is reloaded, causing a 400 from the API.
            if (assistantContent) {
              addMessageRow({
                id: uuidv4(),
                conversationId,
                role: 'assistant',
                content: assistantContent,
                createdAt: Date.now(),
              });
            }

            // Record usage
            if (roundUsage) {
              recordUsage({
                configId: config.id,
                model: config.model,
                inputTokens: roundUsage.inputTokens,
                outputTokens: roundUsage.outputTokens,
                conversationId,
              });
            }

            break; // Exit the while loop
          }

          // Save intermediate assistant message (with tool_calls) to DB
          const roundToolCallDefs = toolCalls.map(tc => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.name, arguments: tc.arguments },
          }));

          // Save the assistant message with tool_calls BEFORE executing tools.
          // The API strictly requires assistant(tool_calls) to precede its tool
          // messages; persisting them in that order keeps the DB sequence
          // replayable on the next request. If the process dies during tool
          // execution, the repair logic in context-manager.ts strips the
          // dangling tool_calls on reload.
          if (roundContent || toolCalls.length > 0) {
            addMessageRow({
              id: uuidv4(),
              conversationId,
              role: 'assistant',
              content: roundContent || null,
              toolCalls: JSON.stringify(roundToolCallDefs),
              createdAt: Date.now(),
            });
          }

          for (const tc of toolCalls) {
            const result = await executeToolCall(tc, { allowedPaths, moduleId: params.moduleId });

            // Save tool message to DB
            addMessageRow({
              id: uuidv4(),
              conversationId,
              role: 'tool',
              content: result.content,
              toolCallId: result.toolCallId,
              toolName: tc.name,
              createdAt: Date.now(),
            });

            // Send tool result to renderer
            mainWindow.webContents.send(IpcChannels.CHAT_STREAM_CHUNK, {
              type: 'tool_result',
              requestId,
              toolResult: result,
            });

            // Add to messages for next round
            toolCallMessages.push({
              role: 'tool',
              content: result.content,
              tool_call_id: result.toolCallId,
              name: tc.name,
            });
          }

          // Add assistant message with tool calls for next round
          if (roundContent || toolCalls.length > 0) {
            const assistantMsg: {
              role: string;
              content: string | null;
              tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
            } = {
              role: 'assistant',
              content: roundContent || null,
              tool_calls: toolCalls.map(tc => ({
                id: tc.id,
                type: 'function' as const,
                function: { name: tc.name, arguments: tc.arguments },
              })),
            };

            currentMessages = [
              ...currentMessages,
              assistantMsg,
              ...toolCallMessages.map(tm => ({
                role: tm.role,
                content: tm.content,
                tool_call_id: tm.tool_call_id,
                name: tm.name,
              })),
            ];
            console.log('[ipc] currentMessages updated, now length:', currentMessages.length);
            toolCallMessages = [];
          }
        }

        // Update conversation timestamp
        touchConversation(conversationId);

        activeStreams.delete(requestId);
        mainWindow.webContents.send(IpcChannels.CHAT_STREAM_DONE, {
          requestId,
          conversationId,
          usage: undefined, // Usage is recorded above
        });
      } catch (err: unknown) {
        activeStreams.delete(requestId);
        mainWindow.webContents.send(IpcChannels.CHAT_STREAM_CHUNK, {
          type: 'error',
          requestId,
          error: (err as Error).message || 'Unknown streaming error.',
        });
        mainWindow.webContents.send(IpcChannels.CHAT_STREAM_DONE, { requestId, conversationId });
      }
    })();

    return { requestId, conversationId };
  });

  ipcMain.on(IpcChannels.CHAT_CANCEL, (_event, requestId: string) => {
    const controller = activeStreams.get(requestId);
    if (controller) {
      controller.abort();
      activeStreams.delete(requestId);
    }
  });

  // ============================================================
  // Conversation Handlers
  // ============================================================

  ipcMain.handle(IpcChannels.CONV_GET_ALL, (_event, mode: AppMode, moduleId?: string) => {
    const rows = getConversationsByMode(mode, moduleId);
    return rows.map(row => ({
      id: row.id as string,
      title: row.title as string,
      mode: row.mode as AppMode,
      moduleId: row.module_id as string | undefined,
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
    }));
  });

  ipcMain.handle(IpcChannels.CONV_GET_MESSAGES, (_event, conversationId: string) => {
    const rows = getMessagesByConversation(conversationId);
    return rows.map(row => ({
      id: row.id as string,
      conversationId: row.conversation_id as string,
      role: row.role as string,
      content: row.content as string | null,
      toolCalls: row.tool_calls ? JSON.parse(row.tool_calls as string) : undefined,
      toolCallId: row.tool_call_id as string | undefined,
      toolName: row.tool_name as string | undefined,
      createdAt: row.created_at as number,
    }));
  });

  ipcMain.handle(IpcChannels.CONV_DELETE, (_event, id: string) => {
    deleteConversationRow(id);
  });

  ipcMain.handle(IpcChannels.CONV_UPDATE_TITLE, (_event, id: string, title: string) => {
    updateConversationTitle(id, title);
  });

  // ============================================================
  // Learning Module Handlers
  // ============================================================

  ipcMain.handle(IpcChannels.MODULE_GET_ALL, () => {
    const rows = getAllModules();
    return rows.map(row => ({
      id: row.id as string,
      name: row.name as string,
      noteFiles: row.note_files ? JSON.parse(row.note_files as string) : [],
      conversationId: row.conversation_id as string,
      createdAt: row.created_at as number,
    }));
  });

  ipcMain.handle(IpcChannels.MODULE_CREATE, (_event, data: { name: string }) => {
    const now = Date.now();
    const moduleId = uuidv4();
    const conversationId = uuidv4();

    createConversationRow({
      id: conversationId,
      title: `${data.name} Learning`,
      mode: 'learning',
      moduleId,
      createdAt: now,
      updatedAt: now,
    });

    createModuleRow({
      id: moduleId,
      name: data.name,
      noteFiles: '[]',
      conversationId,
      createdAt: now,
    });

    return {
      id: moduleId,
      name: data.name,
      noteFiles: [],
      conversationId,
      createdAt: now,
    };
  });

  ipcMain.handle(IpcChannels.MODULE_UPDATE, (_event, id: string, data: { name?: string; noteFiles?: string[] }) => {
    updateModuleRow(id, {
      name: data.name,
      noteFiles: data.noteFiles ? JSON.stringify(data.noteFiles) : undefined,
    });
  });

  ipcMain.handle(IpcChannels.MODULE_DELETE, (_event, id: string) => {
    deleteModuleRow(id);
  });

  ipcMain.handle(IpcChannels.MODULE_BIND_FILE, (_event, moduleId: string, filePath: string) => {
    const mod = getModuleById(moduleId);
    if (!mod) return;
    const files: string[] = mod.note_files ? JSON.parse(mod.note_files as string) : [];
    if (!files.includes(filePath)) {
      files.push(filePath);
      updateModuleRow(moduleId, { noteFiles: JSON.stringify(files) });
    }
  });

  ipcMain.handle(IpcChannels.MODULE_UNBIND_FILE, (_event, moduleId: string, filePath: string) => {
    const mod = getModuleById(moduleId);
    if (!mod) return;
    const files: string[] = mod.note_files ? JSON.parse(mod.note_files as string) : [];
    updateModuleRow(moduleId, { noteFiles: JSON.stringify(files.filter(f => f !== filePath)) });
  });

  // ============================================================
  // File Handlers
  // ============================================================

  ipcMain.handle(IpcChannels.FILE_READ, (_event, filePath: string, moduleId: string) => {
    const mod = getModuleById(moduleId);
    if (!mod) throw new Error('Module not found.');
    const allowedPaths: string[] = mod.note_files ? JSON.parse(mod.note_files as string) : [];
    return readFileContent(filePath, allowedPaths);
  });

  ipcMain.handle(IpcChannels.FILE_PROPOSE_EDIT, (_event, filePath: string, newContent: string, moduleId: string) => {
    const mod = getModuleById(moduleId);
    if (!mod) throw new Error('Module not found.');
    const allowedPaths: string[] = mod.note_files ? JSON.parse(mod.note_files as string) : [];
    return proposeFileEdit(filePath, newContent, allowedPaths);
  });

  ipcMain.handle(IpcChannels.FILE_CONFIRM_EDIT, (_event, editId: string) => {
    confirmFileEdit(editId);
  });

  ipcMain.handle(IpcChannels.FILE_REJECT_EDIT, (_event, editId: string) => {
    rejectFileEdit(editId);
  });

  // ============================================================
  // Plan Handlers
  // ============================================================

  ipcMain.handle(IpcChannels.PLAN_GET_ALL, () => {
    const rows = getAllPlanRows();
    return rows.map(row => ({
      id: row.id as string,
      type: row.type as Plan['type'],
      title: row.title as string,
      items: typeof row.items === 'string' ? JSON.parse(row.items as string) : [],
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
    }));
  });

  ipcMain.handle(IpcChannels.PLAN_GET_BY_ID, (_event, id: string) => {
    const row = getPlanByIdRow(id);
    if (!row) return null;
    return {
      id: row.id as string,
      type: row.type as Plan['type'],
      title: row.title as string,
      items: typeof row.items === 'string' ? JSON.parse(row.items as string) : [],
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
    };
  });

  ipcMain.handle(IpcChannels.PLAN_SAVE, (_event, plan: Plan) => {
    const now = Date.now();
    savePlanRow({
      id: plan.id,
      type: plan.type,
      title: plan.title,
      items: JSON.stringify(plan.items),
      createdAt: plan.createdAt || now,
      updatedAt: now,
    });
  });

  ipcMain.handle(IpcChannels.PLAN_DELETE, (_event, id: string) => {
    deletePlanRow(id);
  });

  // ============================================================
  // Focus Handlers
  // ============================================================

  ipcMain.handle(IpcChannels.FOCUS_GET_SESSIONS, (_event, limit?: number) => {
    const rows = getFocusSessionsList(limit);
    return rows.map(row => ({
      id: row.id as string,
      purpose: row.purpose as string,
      duration: row.duration as number,
      targetDuration: row.target_duration as number,
      type: row.type as 'count-up' | 'count-down',
      rating: row.rating as number | undefined,
      note: row.note as string | undefined,
      timestamp: row.timestamp as number,
    }));
  });

  ipcMain.handle(IpcChannels.FOCUS_GET_RECENT, () => {
    const rows = getRecentFocusSessionsList(7);
    return rows.map(row => ({
      id: row.id as string,
      purpose: row.purpose as string,
      duration: row.duration as number,
      targetDuration: row.target_duration as number,
      type: row.type as 'count-up' | 'count-down',
      rating: row.rating as number | undefined,
      note: row.note as string | undefined,
      timestamp: row.timestamp as number,
    }));
  });

  ipcMain.handle(IpcChannels.FOCUS_LOG, (_event, session: FocusSession) => {
    logFocusSessionRow({
      id: session.id || uuidv4(),
      purpose: session.purpose,
      duration: session.duration,
      targetDuration: session.targetDuration,
      type: session.type,
      rating: session.rating,
      note: session.note,
      timestamp: session.timestamp || Date.now(),
    });
  });

  // ============================================================
  // Diary Handlers
  // ============================================================

  ipcMain.handle(IpcChannels.DIARY_GET_ENTRY, (_event, date?: string) => {
    const d = date || new Date().toISOString().split('T')[0];
    return readDiaryEntry(d);
  });

  ipcMain.handle(IpcChannels.DIARY_LIST_ENTRIES, () => {
    return listDiaryEntriesList();
  });

  ipcMain.handle(IpcChannels.DIARY_APPEND, (_event, content: string) => {
    appendToDiaryEntry(content);
  });

  ipcMain.handle(IpcChannels.DIARY_GET_RANGE, (_event, start: string, end: string) => {
    return getDiaryEntriesByDateRangeList(start, end);
  });

  // ============================================================
  // Usage Handlers
  // ============================================================

  ipcMain.handle(IpcChannels.USAGE_GET_SUMMARY, () => {
    return getUsageSummary();
  });

  ipcMain.handle(IpcChannels.USAGE_GET_HISTORY, (_event, days?: number) => {
    return getUsageHistory(days);
  });

  ipcMain.handle(IpcChannels.USAGE_SET_BUDGET, (_event, tokens: number) => {
    setSettingRow('monthly_budget_tokens', String(tokens));
  });

  // ============================================================
  // Settings Handlers
  // ============================================================

  ipcMain.handle(IpcChannels.SETTINGS_GET, (_event, key: string) => {
    return getSettingRow(key) ?? null;
  });

  ipcMain.handle(IpcChannels.SETTINGS_SET, (_event, key: string, value: string) => {
    setSettingRow(key, value);
  });

  ipcMain.handle(IpcChannels.SETTINGS_GET_ALL, () => {
    const rows = getAllSettingRows();
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  });

  // ============================================================
  // App Handlers
  // ============================================================

  ipcMain.handle(IpcChannels.DIALOG_SELECT_FILE, async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    });
    return result.canceled ? null : result.filePaths[0];
  });
}
