import { Router } from "express";
import { z } from "zod";
import { db, nowIso } from "./db.js";

export const commentsRouter = Router();

function err(res: any, status: number, code: string, message: string) {
  return res.status(status).json({ error: { code, message } });
}

function rowToComment(r: any) {
  return { id: r.id, issueId: r.issue_id, content: r.content, createdAt: r.created_at, updatedAt: r.updated_at };
}

const bodySchema = z.object({ content: z.string().trim().min(1).max(4000) });

// POST /api/issues/:issueId/comments
commentsRouter.post("/issues/:issueId/comments", (req, res) => {
  const issue = db.prepare("SELECT * FROM issues WHERE id = ?").get(req.params.issueId) as any;
  if (!issue) return err(res, 404, "ISSUE_NOT_FOUND", "Issue not found");
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return err(res, 400, "INVALID_BODY", parsed.error.issues[0]?.message ?? "Invalid body");
  const id = crypto.randomUUID();
  const now = nowIso();
  db.prepare("INSERT INTO comments (id, issue_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(
    id, issue.id, parsed.data.content, now, now
  );
  const row = db.prepare("SELECT * FROM comments WHERE id = ?").get(id) as any;
  res.status(201).json({ comment: rowToComment(row) });
});

// GET /api/issues/:issueId/comments
commentsRouter.get("/issues/:issueId/comments", (req, res) => {
  const issue = db.prepare("SELECT * FROM issues WHERE id = ?").get(req.params.issueId) as any;
  if (!issue) return err(res, 404, "ISSUE_NOT_FOUND", "Issue not found");
  const rows = db.prepare("SELECT * FROM comments WHERE issue_id = ? ORDER BY created_at ASC").all(issue.id) as any[];
  res.json({ comments: rows.map(rowToComment) });
});

// PATCH /api/comments/:commentId
commentsRouter.patch("/comments/:commentId", (req, res) => {
  const c = db.prepare("SELECT * FROM comments WHERE id = ?").get(req.params.commentId) as any;
  if (!c) return err(res, 404, "COMMENT_NOT_FOUND", "Comment not found");
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return err(res, 400, "INVALID_BODY", parsed.error.issues[0]?.message ?? "Invalid body");
  const now = nowIso();
  db.prepare("UPDATE comments SET content = ?, updated_at = ? WHERE id = ?").run(parsed.data.content, now, c.id);
  const updated = db.prepare("SELECT * FROM comments WHERE id = ?").get(c.id) as any;
  res.json({ comment: rowToComment(updated) });
});

// DELETE /api/comments/:commentId
commentsRouter.delete("/comments/:commentId", (req, res) => {
  const c = db.prepare("SELECT * FROM comments WHERE id = ?").get(req.params.commentId) as any;
  if (!c) return err(res, 404, "COMMENT_NOT_FOUND", "Comment not found");
  db.prepare("DELETE FROM comments WHERE id = ?").run(c.id);
  res.status(204).send();
});
