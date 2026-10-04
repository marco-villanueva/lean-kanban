import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

function resolveDbPath(p: string): string {
  if (path.isAbsolute(p)) return p;
  return path.resolve(process.cwd(), p);
}

const finalPath = process.env.DB_PATH
  ? resolveDbPath(process.env.DB_PATH)
  : path.resolve(process.cwd(), "../../data/kanban.db");

fs.mkdirSync(path.dirname(finalPath), { recursive: true });

export const db = new DatabaseSync(finalPath);
db.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;`);

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS boards (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS columns (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#64748B',
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS issues (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      column_id TEXT NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_columns_board ON columns(board_id, position);
    CREATE INDEX IF NOT EXISTS idx_issues_column ON issues(column_id, position);
    CREATE INDEX IF NOT EXISTS idx_issues_board ON issues(board_id);
    CREATE INDEX IF NOT EXISTS idx_comments_issue ON comments(issue_id);
  `);

  // Minimal schema evolution without swallowing unrelated SQLite errors.
  const issueColumns = db.prepare("PRAGMA table_info(issues)").all() as Array<{ name: string }>;
  if (!issueColumns.some((column) => column.name === "color")) {
    db.exec(`ALTER TABLE issues ADD COLUMN color TEXT;`);
  }
}

/** Tiny transaction helper (node:sqlite has no db.transaction). */
export function transaction<T>(fn: () => T): T {
  db.exec("BEGIN");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (e) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* ignore rollback failure; preserve original error */
    }
    throw e;
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}
