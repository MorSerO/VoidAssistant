// One-off verification of the message-repair + trim logic in src/main/llm/context-manager.ts
// Replicates the exact post-fix logic and runs it against representative DB sequences.

function loadConversationMessages(messages) {
  // === Copy of post-fix logic from context-manager.ts ===

  // Repair 1: Strip dangling tool_calls (no following tool messages cover them)
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
        msg.tool_calls = undefined;
      }
    }
  }

  // Repair 2: Filter orphaned tool messages
  const validToolCallIds = new Set();
  for (const msg of messages) {
    if (msg.role === 'assistant' && msg.tool_calls) {
      for (const tc of msg.tool_calls) validToolCallIds.add(tc.id);
    }
  }
  let repaired = messages.filter(
    m => !(m.role === 'tool' && m.tool_call_id && !validToolCallIds.has(m.tool_call_id))
  );

  // Trim
  const MAX_MESSAGE_CHARS = 16000;
  const MAX_TOTAL_CHARS = 48000;
  const MIN_KEEP_MESSAGES = 6;

  for (const msg of repaired) {
    if (typeof msg.content === 'string' && msg.content.length > MAX_MESSAGE_CHARS) {
      msg.content = `${msg.content.slice(0, MAX_MESSAGE_CHARS)}\n\n...[truncated; original was ${msg.content.length} chars]`;
    }
  }

  let totalChars = 0;
  for (const msg of repaired) totalChars += typeof msg.content === 'string' ? msg.content.length : 0;
  let dropCount = 0;
  while (dropCount < repaired.length - MIN_KEEP_MESSAGES && totalChars > MAX_TOTAL_CHARS) {
    totalChars -= typeof repaired[dropCount].content === 'string' ? repaired[dropCount].content.length : 0;
    dropCount++;
  }
  if (dropCount > 0) {
    let trimmed = repaired.slice(dropCount);
    while (trimmed.length > 0 && trimmed[0].role === 'tool') trimmed.shift();
    repaired = trimmed;
  }

  return repaired;
}

// Validate the output sequence is API-legal: every 'tool' message must be preceded
// by an assistant message whose tool_calls contain its tool_call_id.
function assertValidSequence(seq, label) {
  const recentAssistantCalls = new Map(); // toolCallId -> exists
  for (const m of seq) {
    if (m.role === 'assistant' && m.tool_calls) {
      recentAssistantCalls.clear();
      for (const tc of m.tool_calls) recentAssistantCalls.set(tc.id, true);
    } else if (m.role === 'tool') {
      if (!recentAssistantCalls.has(m.tool_call_id)) {
        throw new Error(`${label}: TOOL MESSAGE "${m.tool_call_id}" WITHOUT PRECEDING tool_calls — API would reject with 400`);
      }
    } else {
      recentAssistantCalls.clear();
    }
  }
  console.log(`PASS: ${label} (${seq.length} msgs)`);
}

const t = (id) => ({ role: 'tool', content: `result-${id}`, tool_call_id: id });
const aWith = (id, content = null) => ({ role: 'assistant', content, tool_calls: [{ id, type: 'function', function: { name: 'read_file', arguments: '{}' } }] });
const aPlain = (content) => ({ role: 'assistant', content });
const u = (content) => ({ role: 'user', content });

// Scenario 1: OLD corrupted DB order (tools saved before assistant — the pre-fix bug).
// After repair, tool messages must be filtered so the sequence stays valid.
assertValidSequence(loadConversationMessages([u('hi'), t('tc1'), t('tc2'), aWith('tc1'), aWith('tc2'), aPlain('answer')]), 'S1 old corrupted order');

// Scenario 2: NEW correct order (assistant(tool_calls) first, then tools) — must be untouched.
assertValidSequence(loadConversationMessages([u('hi'), aWith('tc1'), t('tc1'), aPlain('answer')]), 'S2 new correct order');

// Scenario 3: Multi-round tool use in new order — untouched.
assertValidSequence(loadConversationMessages([
  u('hi'), aWith('tc1'), t('tc1'), aWith('tc2'), t('tc2'), aPlain('done'),
]), 'S3 multi-round correct order');

// Scenario 4: Dangling assistant (interrupted before tool results) — tool_calls stripped, no tools left.
assertValidSequence(loadConversationMessages([u('hi'), aWith('tc1'), aPlain('answer')]), 'S4 dangling tool_calls');

// Scenario 5: Huge read_file result — per-message truncation, sequence still valid.
const bigTool = { role: 'tool', content: 'x'.repeat(50000), tool_call_id: 'tc1' };
const out5 = loadConversationMessages([u('hi'), aWith('tc1'), bigTool, aPlain('ok')]);
assertValidSequence(out5, 'S5 oversized tool content');
if (out5[2].content.length > 16100 || !out5[2].content.includes('truncated')) {
  throw new Error('S5: truncation marker missing or size not capped');
}
console.log(`  (tool content capped to ${out5[2].content.length} chars)`);

// Scenario 6: Total context overflow — oldest messages dropped, and the surviving
// prefix never starts with a tool message.
const many = [u('hi')];
for (let i = 0; i < 30; i++) {
  many.push(aWith(`t${i}`), t(`t${i}`), aPlain(`reply ${i} — `.repeat(300)));
}
const out6 = loadConversationMessages(many);
assertValidSequence(out6, 'S6 context overflow trim');
if (out6.length >= 90) throw new Error('S6: no trimming happened');
console.log(`  (dropped ${many.length - out6.length} oldest messages, ${out6.length} remain)`);

console.log('\nAll repair/trim scenarios pass.');
