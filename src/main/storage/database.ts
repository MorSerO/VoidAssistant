import Database from 'better-sqlite3';
import path from 'path';
import { app } from '../electron-access';
import crypto from 'crypto';
const uuidv4 = (): string => crypto.randomUUID();

// Type alias for database rows
type DbRow = Record<string, unknown>;

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function initDatabase(): void {
  const dbPath = path.join(app.getPath('userData'), 'void-assistant.db');
  db = new Database(dbPath);

  // Performance pragmas
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Run migrations
  migrate(db);

  // Ensure default data exists
  ensureDefaultData(db);
}

function migrate(db: Database.Database): void {
  const schemaVersion = getSchemaVersion(db);

  if (schemaVersion < 1) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS api_configs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        base_url TEXT NOT NULL,
        encrypted_api_key TEXT,
        model TEXT NOT NULL,
        temperature REAL DEFAULT 0.7,
        max_tokens INTEGER DEFAULT 4096,
        input_price REAL DEFAULT 0,
        output_price REAL DEFAULT 0,
        headers TEXT DEFAULT '{}',
        is_active INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS api_usage (
        id TEXT PRIMARY KEY,
        config_id TEXT NOT NULL,
        model TEXT NOT NULL,
        input_tokens INTEGER DEFAULT 0,
        output_tokens INTEGER DEFAULT 0,
        timestamp INTEGER NOT NULL,
        conversation_id TEXT
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT DEFAULT 'New Chat',
        mode TEXT NOT NULL,
        module_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT,
        tool_calls TEXT,
        tool_call_id TEXT,
        tool_name TEXT,
        code_snippet TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS learning_modules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        note_files TEXT DEFAULT '[]',
        code_style_summary TEXT,
        conversation_id TEXT,
        is_default INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS plans (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        items TEXT DEFAULT '[]',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS focus_sessions (
        id TEXT PRIMARY KEY,
        purpose TEXT DEFAULT '',
        duration INTEGER DEFAULT 0,
        target_duration INTEGER DEFAULT 0,
        type TEXT DEFAULT 'count-up',
        rating INTEGER,
        note TEXT,
        timestamp INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_api_usage_timestamp ON api_usage(timestamp);
      CREATE INDEX IF NOT EXISTS idx_focus_sessions_timestamp ON focus_sessions(timestamp);
      CREATE INDEX IF NOT EXISTS idx_conversations_mode ON conversations(mode);
    `);

    setSchemaVersion(db, 1);
  }
}

function getSchemaVersion(db: Database.Database): number {
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'schema_version'").get() as DbRow | undefined;
    return row ? parseInt(row.value as string, 10) : 0;
  } catch {
    return 0;
  }
}

function setSchemaVersion(db: Database.Database, version: number): void {
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', ?)").run(String(version));
}

function ensureDefaultData(db: Database.Database): void {
  const existing = db.prepare("SELECT id FROM learning_modules WHERE is_default = 1").get();
  if (!existing) {
    const now = Date.now();
    const moduleId = uuidv4();
    const conversationId = uuidv4();

    db.prepare(`
      INSERT INTO conversations (id, title, mode, module_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(conversationId, 'C++ Learning', 'learning', moduleId, now, now);

    db.prepare(`
      INSERT INTO learning_modules (id, name, note_files, code_style_summary, conversation_id, is_default, created_at)
      VALUES (?, ?, '[]', NULL, ?, 1, ?)
    `).run(moduleId, 'C++', conversationId, now);
  }
}

// Helper to safely cast .all() and .get() results
function allRows(stmt: Database.Statement): DbRow[] {
  return stmt.all() as DbRow[];
}

function getRow(stmt: Database.Statement): DbRow | undefined {
  return stmt.get() as DbRow | undefined;
}

// ============================================================
// Query Helpers - Config
// ============================================================

export function getAllConfigs(): DbRow[] {
  return allRows(getDb().prepare("SELECT * FROM api_configs ORDER BY created_at DESC"));
}

export function getConfigById(id: string): DbRow | undefined {
  return getRow(getDb().prepare("SELECT * FROM api_configs WHERE id = ?").bind(id));
}

export function getActiveConfig(): DbRow | undefined {
  return getRow(getDb().prepare("SELECT * FROM api_configs WHERE is_active = 1 LIMIT 1"));
}

export function saveConfigRow(config: DbRow): void {
  getDb().prepare(`
    INSERT OR REPLACE INTO api_configs (id, name, base_url, encrypted_api_key, model, temperature, max_tokens, input_price, output_price, headers, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    config.id, config.name, config.base_url, config.encrypted_api_key, config.model,
    config.temperature, config.max_tokens, config.input_price, config.output_price,
    config.headers, config.is_active ? 1 : 0, config.created_at, config.updated_at
  );
}

export function deleteConfigRow(id: string): void {
  getDb().prepare("DELETE FROM api_configs WHERE id = ?").run(id);
}

export function deactivateAllConfigs(): void {
  getDb().prepare("UPDATE api_configs SET is_active = 0").run();
}

export function setConfigActive(id: string): void {
  deactivateAllConfigs();
  getDb().prepare("UPDATE api_configs SET is_active = 1 WHERE id = ?").run(id);
}

// ============================================================
// Query Helpers - Usage
// ============================================================

export function recordUsageRow(data: {
  id: string; configId: string; model: string;
  inputTokens: number; outputTokens: number; timestamp: number; conversationId?: string;
}): void {
  getDb().prepare(`
    INSERT INTO api_usage (id, config_id, model, input_tokens, output_tokens, timestamp, conversation_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(data.id, data.configId, data.model, data.inputTokens, data.outputTokens, data.timestamp, data.conversationId || null);
}

export function getUsageForPeriod(start: number, end: number): DbRow[] {
  return allRows(getDb().prepare(
    "SELECT * FROM api_usage WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp DESC"
  ).bind(start, end));
}

// ============================================================
// Query Helpers - Conversations
// ============================================================

export function createConversationRow(data: {
  id: string; title: string; mode: string; moduleId?: string; createdAt: number; updatedAt: number;
}): void {
  getDb().prepare(`
    INSERT INTO conversations (id, title, mode, module_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(data.id, data.title, data.mode, data.moduleId || null, data.createdAt, data.updatedAt);
}

export function getConversationsByMode(mode: string, moduleId?: string): DbRow[] {
  if (moduleId) {
    return allRows(getDb().prepare(
      "SELECT * FROM conversations WHERE mode = ? AND module_id = ? ORDER BY updated_at DESC"
    ).bind(mode, moduleId));
  }
  return allRows(getDb().prepare(
    "SELECT * FROM conversations WHERE mode = ? ORDER BY updated_at DESC"
  ).bind(mode));
}

export function getConversationById(id: string): DbRow | undefined {
  return getRow(getDb().prepare("SELECT * FROM conversations WHERE id = ?").bind(id));
}

export function updateConversationTitle(id: string, title: string): void {
  getDb().prepare("UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?").run(title, Date.now(), id);
}

export function touchConversation(id: string): void {
  getDb().prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(Date.now(), id);
}

export function deleteConversationRow(id: string): void {
  getDb().prepare("DELETE FROM conversations WHERE id = ?").run(id);
}

// ============================================================
// Query Helpers - Messages
// ============================================================

export function addMessageRow(data: {
  id: string; conversationId: string; role: string; content: string | null;
  toolCalls?: string; toolCallId?: string; toolName?: string;
  codeSnippet?: string; createdAt: number;
}): void {
  getDb().prepare(`
    INSERT INTO messages (id, conversation_id, role, content, tool_calls, tool_call_id, tool_name, code_snippet, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(data.id, data.conversationId, data.role, data.content, data.toolCalls || null,
    data.toolCallId || null, data.toolName || null, data.codeSnippet || null, data.createdAt);
}

export function getMessagesByConversation(conversationId: string): DbRow[] {
  return allRows(getDb().prepare(
    "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC"
  ).bind(conversationId));
}

// ============================================================
// Query Helpers - Learning Modules
// ============================================================

export function getAllModules(): DbRow[] {
  return allRows(getDb().prepare("SELECT * FROM learning_modules ORDER BY is_default DESC, created_at ASC"));
}

export function getModuleById(id: string): DbRow | undefined {
  return getRow(getDb().prepare("SELECT * FROM learning_modules WHERE id = ?").bind(id));
}

export function createModuleRow(data: {
  id: string; name: string; noteFiles: string; codeStyleSummary: string | null;
  conversationId: string; isDefault: boolean; createdAt: number;
}): void {
  getDb().prepare(`
    INSERT INTO learning_modules (id, name, note_files, code_style_summary, conversation_id, is_default, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(data.id, data.name, data.noteFiles, data.codeStyleSummary, data.conversationId, data.isDefault ? 1 : 0, data.createdAt);
}

export function updateModuleRow(id: string, data: { name?: string; noteFiles?: string; codeStyleSummary?: string | null; }): void {
  const sets: string[] = [];
  const values: unknown[] = [];
  if (data.name !== undefined) { sets.push('name = ?'); values.push(data.name); }
  if (data.noteFiles !== undefined) { sets.push('note_files = ?'); values.push(data.noteFiles); }
  if (data.codeStyleSummary !== undefined) { sets.push('code_style_summary = ?'); values.push(data.codeStyleSummary); }
  if (sets.length === 0) return;
  values.push(id);
  getDb().prepare(`UPDATE learning_modules SET ${sets.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteModuleRow(id: string): void {
  getDb().prepare("DELETE FROM learning_modules WHERE id = ? AND is_default = 0").run(id);
}

// ============================================================
// Query Helpers - Plans
// ============================================================

export function getAllPlanRows(): DbRow[] {
  return allRows(getDb().prepare("SELECT * FROM plans ORDER BY updated_at DESC"));
}

export function getPlanByIdRow(id: string): DbRow | undefined {
  return getRow(getDb().prepare("SELECT * FROM plans WHERE id = ?").bind(id));
}

export function savePlanRow(data: {
  id: string; type: string; title: string; items: string;
  createdAt: number; updatedAt: number;
}): void {
  getDb().prepare(`
    INSERT OR REPLACE INTO plans (id, type, title, items, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(data.id, data.type, data.title, data.items, data.createdAt, data.updatedAt);
}

export function deletePlanRow(id: string): void {
  getDb().prepare("DELETE FROM plans WHERE id = ?").run(id);
}

// ============================================================
// Query Helpers - Focus Sessions
// ============================================================

export function getFocusSessionsList(limit?: number): DbRow[] {
  const lim = limit || 50;
  return allRows(getDb().prepare(
    "SELECT * FROM focus_sessions ORDER BY timestamp DESC LIMIT ?"
  ).bind(lim));
}

export function getRecentFocusSessionsList(limit: number): DbRow[] {
  return allRows(getDb().prepare(
    "SELECT * FROM focus_sessions ORDER BY timestamp DESC LIMIT ?"
  ).bind(limit));
}

export function logFocusSessionRow(data: {
  id: string; purpose: string; duration: number; targetDuration: number;
  type: string; rating?: number; note?: string; timestamp: number;
}): void {
  getDb().prepare(`
    INSERT INTO focus_sessions (id, purpose, duration, target_duration, type, rating, note, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(data.id, data.purpose, data.duration, data.targetDuration, data.type, data.rating || null, data.note || null, data.timestamp);
}

// ============================================================
// Query Helpers - Settings
// ============================================================

export function getSettingRow(key: string): string | undefined {
  const row = getRow(getDb().prepare("SELECT value FROM settings WHERE key = ?").bind(key));
  return row?.value as string | undefined;
}

export function setSettingRow(key: string, value: string): void {
  getDb().prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, value);
}

export function getAllSettingRows(): Array<{ key: string; value: string }> {
  const rows = allRows(getDb().prepare("SELECT key, value FROM settings"));
  return rows as Array<{ key: string; value: string }>;
}
