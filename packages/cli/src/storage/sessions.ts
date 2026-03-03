/**
 * @free-cli/cli — SQLite Session Storage
 *
 * Persists conversation sessions to a local SQLite database.
 * Uses better-sqlite3 for synchronous, zero-config, file-based storage.
 *
 * Schema:
 *   sessions: id, title, created_at, updated_at, working_directory, config_json, status, total_tokens_json
 *   messages: id, session_id, role, content, tool_calls_json, tool_call_id, timestamp
 */

import Database from 'better-sqlite3';
import { getDataDir, generateId, now } from '@free-cli/core';
import type {
  Session,
  ConversationMessage,
  AgentConfig,
  AgentStatus,
  TokenUsage,
} from '@free-cli/core';
import { join } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';
import { logger } from '../utils/logger.js';

/** Lazy-initialized database instance */
let db: Database.Database | null = null;

/**
 * Get or create the SQLite database connection.
 * Creates the database file and tables if they don't exist.
 */
function getDb(): Database.Database {
  if (db) return db;

  const dataDir = getDataDir();
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = join(dataDir, 'sessions.db');
  logger.debug(`Opening sessions database: ${dbPath}`);

  db = new Database(dbPath);

  // Enable WAL mode for better concurrent performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'Untitled',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      working_directory TEXT NOT NULL,
      config_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'idle',
      total_tokens_json TEXT NOT NULL DEFAULT '{"promptTokens":0,"completionTokens":0,"totalTokens":0}'
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      tool_calls_json TEXT,
      tool_call_id TEXT,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at DESC);
  `);

  return db;
}

// ── Session CRUD ───────────────────────────────────────────────────

/**
 * Create a new session and return it.
 *
 * @param workingDirectory - The working directory for this session
 * @param model - The model to use (optional, for building a default config)
 */
export function createSession(workingDirectory?: string, model?: string): Session {
  const database = getDb();
  const config: AgentConfig = {
    maxIterations: 20,
    toolTimeout: 30_000,
    approvalMode: 'ask',
    model: model ?? 'llama-3.3-70b-versatile',
    contextWindowTokens: 100_000,
  };
  const session: Session = {
    id: generateId(),
    title: 'New Chat',
    createdAt: now(),
    updatedAt: now(),
    messages: [],
    workingDirectory: workingDirectory ?? process.cwd(),
    config,
    totalTokens: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    status: 'idle',
  };

  const stmt = database.prepare(`
    INSERT INTO sessions (id, title, created_at, updated_at, working_directory, config_json, status, total_tokens_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    session.id,
    session.title,
    session.createdAt,
    session.updatedAt,
    session.workingDirectory,
    JSON.stringify(session.config),
    session.status,
    JSON.stringify(session.totalTokens),
  );

  logger.debug(`Created session: ${session.id}`);
  return session;
}

/**
 * Get a session by ID, including all its messages.
 */
export function getSession(sessionId: string): Session | null {
  const database = getDb();

  const row = database
    .prepare('SELECT * FROM sessions WHERE id = ?')
    .get(sessionId) as SessionRow | undefined;
  if (!row) return null;

  const messages = getSessionMessages(sessionId);
  return rowToSession(row, messages);
}

/**
 * List recent sessions (most recent first).
 */
export function listSessions(limit = 20): Session[] {
  const database = getDb();

  const rows = database
    .prepare('SELECT * FROM sessions ORDER BY updated_at DESC LIMIT ?')
    .all(limit) as SessionRow[];

  return rows.map((row) => rowToSession(row, []));
}

/**
 * Update session metadata (title, status, tokens).
 */
export function updateSession(
  sessionId: string,
  updates: {
    title?: string;
    status?: AgentStatus;
    totalTokens?: TokenUsage;
  },
): void {
  const database = getDb();
  const parts: string[] = ['updated_at = ?'];
  const values: unknown[] = [now()];

  if (updates.title !== undefined) {
    parts.push('title = ?');
    values.push(updates.title);
  }
  if (updates.status !== undefined) {
    parts.push('status = ?');
    values.push(updates.status);
  }
  if (updates.totalTokens !== undefined) {
    parts.push('total_tokens_json = ?');
    values.push(JSON.stringify(updates.totalTokens));
  }

  values.push(sessionId);

  database
    .prepare(`UPDATE sessions SET ${parts.join(', ')} WHERE id = ?`)
    .run(...values);
}

/**
 * Delete a session and all its messages.
 */
export function deleteSession(sessionId: string): void {
  const database = getDb();
  database.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
  logger.debug(`Deleted session: ${sessionId}`);
}

/**
 * Delete all sessions.
 */
export function clearAllSessions(): void {
  const database = getDb();
  database.prepare('DELETE FROM sessions').run();
  logger.debug('Cleared all sessions');
}

// ── Message CRUD ───────────────────────────────────────────────────

/**
 * Add a message to a session.
 */
export function addMessage(sessionId: string, message: ConversationMessage): void {
  const database = getDb();

  const stmt = database.prepare(`
    INSERT INTO messages (id, session_id, role, content, tool_calls_json, tool_call_id, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    message.id,
    sessionId,
    message.role,
    message.content,
    message.toolCalls ? JSON.stringify(message.toolCalls) : null,
    message.toolCallId ?? null,
    message.timestamp,
  );

  // Update session timestamp
  database
    .prepare('UPDATE sessions SET updated_at = ? WHERE id = ?')
    .run(now(), sessionId);
}

/**
 * Get all messages for a session, ordered by timestamp.
 */
export function getSessionMessages(sessionId: string): ConversationMessage[] {
  const database = getDb();

  const rows = database
    .prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC')
    .all(sessionId) as MessageRow[];

  return rows.map(rowToMessage);
}

/**
 * Auto-generate a session title from the first user message.
 */
export function autoTitleSession(sessionId: string, firstUserMessage: string): void {
  // Truncate to first 80 chars, strip newlines
  const title = firstUserMessage
    .replace(/\n/g, ' ')
    .trim()
    .slice(0, 80)
    .trim();

  updateSession(sessionId, { title: title || 'New Chat' });
}

/**
 * Get session count.
 */
export function getSessionCount(): number {
  const database = getDb();
  const row = database.prepare('SELECT COUNT(*) as count FROM sessions').get() as { count: number };
  return row.count;
}

/**
 * Close the database connection (call on exit).
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    logger.debug('Database connection closed');
  }
}

// ── Internal helpers ───────────────────────────────────────────────

interface SessionRow {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
  working_directory: string;
  config_json: string;
  status: string;
  total_tokens_json: string;
}

interface MessageRow {
  id: string;
  session_id: string;
  role: string;
  content: string;
  tool_calls_json: string | null;
  tool_call_id: string | null;
  timestamp: number;
}

function rowToSession(row: SessionRow, messages: ConversationMessage[]): Session {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    messages,
    workingDirectory: row.working_directory,
    config: JSON.parse(row.config_json) as AgentConfig,
    totalTokens: JSON.parse(row.total_tokens_json) as TokenUsage,
    status: row.status as AgentStatus,
  };
}

function rowToMessage(row: MessageRow): ConversationMessage {
  return {
    id: row.id,
    role: row.role as ConversationMessage['role'],
    content: row.content,
    toolCalls: row.tool_calls_json ? JSON.parse(row.tool_calls_json) : undefined,
    toolCallId: row.tool_call_id ?? undefined,
    timestamp: row.timestamp,
  };
}
