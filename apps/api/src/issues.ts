import { Router } from "express";
import { z } from "zod";
import { db, nowIso, transaction } from "./db.js";
import {
  hexColorSchema,
  issueDescriptionSchema,
  issueTitleSchema,
} from "./validation.js";

export const issuesRouter = Router();

function err(res: any, status: number, code: string, message: string) {
  return res.status(status).json({ error: { code, message } });
}

function rowToIssue(r: any) {
  return {
    id: r.id,
    boardId: r.board_id,
    columnId: r.column_id,
    title: r.title,
    description: r.description ?? "",
    color: r.color ?? null,
    position: r.position,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const colorSchema = hexColorSchema.nullable().optional();

const createSchema = z.object({
  columnId: z.string().min(1),
  title: issueTitleSchema,
  description: issueDescriptionSchema.optional().default(""),
  color: colorSchema,
});

const updateSchema = z.object({
  title: issueTitleSchema.optional(),
  description: issueDescriptionSchema.optional(),
  color: colorSchema,
});

const moveSchema = z.object({
  columnId: z.string().min(1),
  position: z.number().int().min(0),
});

// POST /api/boards/:boardId/issues
issuesRouter.post("/boards/:boardId/issues", (req, res) => {
  const board = db.prepare("SELECT * FROM boards WHERE id = ?").get(req.params.boardId) as any;
  if (!board) return err(res, 404, "BOARD_NOT_FOUND", "Board not found");

  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return err(res, 400, "INVALID_BODY", parsed.error.issues[0]?.message ?? "Invalid body");
  }

  const col = db
    .prepare("SELECT * FROM columns WHERE id = ? AND board_id = ?")
    .get(parsed.data.columnId, board.id) as any;
  if (!col) return err(res, 404, "COLUMN_NOT_FOUND", "Column not found in this board");

  const max = db
    .prepare("SELECT COALESCE(MAX(position), -1) as m FROM issues WHERE column_id = ?")
    .get(col.id) as any;

  const id = crypto.randomUUID();
  const now = nowIso();

  db.prepare(
    "INSERT INTO issues (id, board_id, column_id, title, description, color, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(
    id,
    board.id,
    col.id,
    parsed.data.title,
    parsed.data.description ?? "",
    parsed.data.color ?? null,
    (max.m as number) + 1,
    now,
    now
  );

  const row = db.prepare("SELECT * FROM issues WHERE id = ?").get(id) as any;
  res.status(201).json({ issue: rowToIssue(row) });
});

// GET /api/issues/:issueId (with comments)
issuesRouter.get("/issues/:issueId", (req, res) => {
  const issue = db.prepare("SELECT * FROM issues WHERE id = ?").get(req.params.issueId) as any;
  if (!issue) return err(res, 404, "ISSUE_NOT_FOUND", "Issue not found");

  const comments = db
    .prepare("SELECT * FROM comments WHERE issue_id = ? ORDER BY created_at ASC")
    .all(issue.id) as any[];

  res.json({
    issue: rowToIssue(issue),
    comments: comments.map((c) => ({
      id: c.id,
      issueId: c.issue_id,
      content: c.content,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    })),
  });
});

// GET /api/boards/:boardId/issues?columnId=&q=
issuesRouter.get("/boards/:boardId/issues", (req, res) => {
  const board = db.prepare("SELECT * FROM boards WHERE id = ?").get(req.params.boardId) as any;
  if (!board) return err(res, 404, "BOARD_NOT_FOUND", "Board not found");

  const columnId = req.query.columnId as string | undefined;
  const q = (req.query.q as string | undefined)?.toLowerCase();

  let rows = db
    .prepare("SELECT * FROM issues WHERE board_id = ? ORDER BY updated_at DESC")
    .all(board.id) as any[];

  if (columnId) rows = rows.filter((r) => r.column_id === columnId);
  if (q) {
    rows = rows.filter((r) =>
      (r.title + " " + (r.description ?? "")).toLowerCase().includes(q)
    );
  }

  res.json({ issues: rows.map(rowToIssue) });
});

// PATCH /api/issues/:issueId
issuesRouter.patch("/issues/:issueId", (req, res) => {
  const issue = db.prepare("SELECT * FROM issues WHERE id = ?").get(req.params.issueId) as any;
  if (!issue) return err(res, 404, "ISSUE_NOT_FOUND", "Issue not found");

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return err(res, 400, "INVALID_BODY", parsed.error.issues[0]?.message ?? "Invalid body");
  }

  const now = nowIso();
  db.prepare(
    "UPDATE issues SET title = ?, description = ?, color = ?, updated_at = ? WHERE id = ?"
  ).run(
    parsed.data.title ?? issue.title,
    parsed.data.description ?? issue.description,
    parsed.data.color === undefined ? issue.color : parsed.data.color,
    now,
    issue.id
  );

  const updated = db.prepare("SELECT * FROM issues WHERE id = ?").get(issue.id) as any;
  res.json({ issue: rowToIssue(updated) });
});

// PATCH /api/issues/:issueId/move
issuesRouter.patch("/issues/:issueId/move", (req, res) => {
  const issue = db.prepare("SELECT * FROM issues WHERE id = ?").get(req.params.issueId) as any;
  if (!issue) return err(res, 404, "ISSUE_NOT_FOUND", "Issue not found");

  const parsed = moveSchema.safeParse(req.body);
  if (!parsed.success) {
    return err(res, 400, "INVALID_BODY", parsed.error.issues[0]?.message ?? "Invalid body");
  }

  const target = db
    .prepare("SELECT * FROM columns WHERE id = ? AND board_id = ?")
    .get(parsed.data.columnId, issue.board_id) as any;
  if (!target) {
    return err(res, 404, "COLUMN_NOT_FOUND", "Target column not found in same board");
  }

  const now = nowIso();

  transaction(() => {
    const oldList = db
      .prepare("SELECT id FROM issues WHERE column_id = ? AND id != ? ORDER BY position ASC")
      .all(issue.column_id, issue.id) as any[];

    oldList.forEach((r, idx) => {
      db.prepare("UPDATE issues SET position = ? WHERE id = ?").run(idx, r.id);
    });

    const newList = db
      .prepare("SELECT id FROM issues WHERE column_id = ? AND id != ? ORDER BY position ASC")
      .all(target.id, issue.id) as any[];

    const pos = Math.min(parsed.data.position, newList.length);
    newList.splice(pos, 0, { id: issue.id });

    newList.forEach((r, idx) => {
      if (r.id === issue.id) {
        db.prepare(
          "UPDATE issues SET column_id = ?, position = ?, updated_at = ? WHERE id = ?"
        ).run(target.id, idx, now, issue.id);
      } else {
        db.prepare("UPDATE issues SET position = ? WHERE id = ?").run(idx, r.id);
      }
    });
  });

  const updated = db.prepare("SELECT * FROM issues WHERE id = ?").get(issue.id) as any;
  res.json({ issue: rowToIssue(updated) });
});

// DELETE /api/issues/:issueId
issuesRouter.delete("/issues/:issueId", (req, res) => {
  const issue = db.prepare("SELECT * FROM issues WHERE id = ?").get(req.params.issueId) as any;
  if (!issue) return err(res, 404, "ISSUE_NOT_FOUND", "Issue not found");

  transaction(() => {
    db.prepare("DELETE FROM issues WHERE id = ?").run(issue.id);
    const rest = db
      .prepare("SELECT id FROM issues WHERE column_id = ? ORDER BY position ASC")
      .all(issue.column_id) as any[];

    rest.forEach((r, idx) => {
      db.prepare("UPDATE issues SET position = ? WHERE id = ?").run(idx, r.id);
    });
  });

  res.status(204).send();
});
