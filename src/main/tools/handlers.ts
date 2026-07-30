// Re-export tool execution functions from function-calling for use by IPC handlers.
// The actual implementation is in llm/function-calling.ts since it's tightly coupled
// with the LLM response processing loop.

export { executeToolCall, toolResultToMessage } from '../llm/function-calling';
export type { ToolExecutionContext } from '../llm/function-calling';
