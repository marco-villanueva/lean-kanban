import { Router } from "express";
import { z } from "zod";
import { db, nowIso } from "./db.js";

export const boardsRouter = Router();

const createBoardSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(2000).optional().default(""),
});

const updateBoardSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(2000).optional(),
});

function err(res: any, status: number, code: string, message: string) {
  return res.status(status).json({ error: { code, message } });
}

function rowToBoard(r: any) {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? "",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// GET /api/boards — list
boardsRouter.get("/", (_req, res) => {
  const rows = db.prepare("SELECT * FROM boards ORDER BY created_at DESC").all() as any[];
  res.json({ boards: rows.map(rowToBoard) });
});

// POST /api/boards — create (with 3 default columns if none given)
boardsRouter.post("/", (req, res) => {
  const parsed = createBoardSchema.safeParse(req.body);
  if (!parsed.success) return err(res, 400, "INVALID_BODY", parsed.error.issues[0]?.message ?? "Invalid body");
  const id = crypto.randomUUID();
  const now = nowIso();
  db.prepare("INSERT INTO boards (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(
    id, parsed.data.name, parsed.data.description ?? "", now, now
  );
  const row = db.prepare("SELECT * FROM boards WHERE id = ?").get(id) as any;
  res.status(201).json({ board: rowToBoard(row) });
});

// GET /api/boards/:boardId — full board (columns + issues + comments)
boardsRouter.get("/:boardId", (req, res) => {
  const board = db.prepare("SELECT * FROM boards WHERE id = ?").get(req.params.boardId) as any;
  if (!board) return err(res, 404, "BOARD_NOT_FOUND", "Board not found");
  const cols = db.prepare("SELECT * FROM columns WHERE board_id = ? ORDER BY position ASC").all(board.id) as any[];
  const issues = db.prepare("SELECT * FROM issues WHERE board_id = ? ORDER BY position ASC").all(board.id) as any[];
  const issueIds = issues.map((i) => i.id);
  let comments: any[] = [];
  if (issueIds.length > 0) {
    const placeholders = issueIds.map(() => "?").join(",");
    comments = db.prepare(`SELECT * FROM comments WHERE issue_id IN (${placeholders}) ORDER BY created_at ASC`).all(...issueIds) as any[];
  }
  res.json({
    board: rowToBoard(board),
    columns: cols.map((c) => ({
      id: c.id, boardId: c.board_id, name: c.name, color: c.color,
      position: c.position, createdAt: c.created_at, updatedAt: c.updated_at,
    })),
    issues: issues.map((i) => ({
      id: i.id, boardId: i.board_id, columnId: i.column_id, title: i.title,
      description: i.description ?? "", color: i.color ?? null, position: i.position,
      createdAt: i.created_at, updatedAt: i.updated_at,
    })),
    comments: comments.map((c) => ({
      id: c.id, issueId: c.issue_id, content: c.content,
      createdAt: c.created_at, updatedAt: c.updated_at,
    })),
  });
});

// PATCH /api/boards/:boardId
boardsRouter.patch("/:boardId", (req, res) => {
  const parsed = updateBoardSchema.safeParse(req.body);
  if (!parsed.success) return err(res, 400, "INVALID_BODY", parsed.error.issues[0]?.message ?? "Invalid body");
  const board = db.prepare("SELECT * FROM boards WHERE id = ?").get(req.params.boardId) as any;
  if (!board) return err(res, 404, "BOARD_NOT_FOUND", "Board not found");
  const name = parsed.data.name ?? board.name;
  const description = parsed.data.description ?? board.description;
  const now = nowIso();
  db.prepare("UPDATE boards SET name = ?, description = ?, updated_at = ? WHERE id = ?").run(name, description, now, board.id);
  const updated = db.prepare("SELECT * FROM boards WHERE id = ?").get(board.id) as any;
  res.json({ board: rowToBoard(updated) });
});

// DELETE /api/boards/:boardId
boardsRouter.delete("/:boardId", (req, res) => {
  const board = db.prepare("SELECT * FROM boards WHERE id = ?").get(req.params.boardId) as any;
  if (!board) return err(res, 404, "BOARD_NOT_FOUND", "Board not found");
  db.prepare("DELETE FROM boards WHERE id = ?").run(board.id);
  res.status(204).send();
});
