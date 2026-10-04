import { Router } from "express";
import { z } from "zod";
import { db, nowIso, transaction } from "./db.js";
import { columnNameSchema, hexColorSchema } from "./validation.js";

export const columnsRouter = Router();

function err(res: any, status: number, code: string, message: string) {
  return res.status(status).json({ error: { code, message } });
}

function rowToColumn(r: any) {
  return {
    id: r.id,
    boardId: r.board_id,
    name: r.name,
    color: r.color,
    position: r.position,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const createSchema = z.object({
  name: columnNameSchema,
  color: hexColorSchema.optional().default("#64748B"),
});

const updateSchema = z.object({
  name: columnNameSchema.optional(),
  color: hexColorSchema.optional(),
});

const reorderSchema = z.object({
  orderedIds: z.array(z.string()).min(1),
});

// POST /api/boards/:boardId/columns
columnsRouter.post("/boards/:boardId/columns", (req, res) => {
  const board = db.prepare("SELECT * FROM boards WHERE id = ?").get(req.params.boardId) as any;
  if (!board) return err(res, 404, "BOARD_NOT_FOUND", "Board not found");

  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return err(res, 400, "INVALID_BODY", parsed.error.issues[0]?.message ?? "Invalid body");
  }

  const max = db
    .prepare("SELECT COALESCE(MAX(position), -1) as m FROM columns WHERE board_id = ?")
    .get(board.id) as any;
  const id = crypto.randomUUID();
  const now = nowIso();

  db.prepare(
    "INSERT INTO columns (id, board_id, name, color, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(id, board.id, parsed.data.name, parsed.data.color, (max.m as number) + 1, now, now);

  const row = db.prepare("SELECT * FROM columns WHERE id = ?").get(id) as any;
  res.status(201).json({ column: rowToColumn(row) });
});

// PATCH /api/columns/:columnId
columnsRouter.patch("/columns/:columnId", (req, res) => {
  const col = db.prepare("SELECT * FROM columns WHERE id = ?").get(req.params.columnId) as any;
  if (!col) return err(res, 404, "COLUMN_NOT_FOUND", "Column not found");

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return err(res, 400, "INVALID_BODY", parsed.error.issues[0]?.message ?? "Invalid body");
  }

  const now = nowIso();
  db.prepare("UPDATE columns SET name = ?, color = ?, updated_at = ? WHERE id = ?").run(
    parsed.data.name ?? col.name,
    parsed.data.color ?? col.color,
    now,
    col.id
  );

  const updated = db.prepare("SELECT * FROM columns WHERE id = ?").get(col.id) as any;
  res.json({ column: rowToColumn(updated) });
});

// DELETE /api/columns/:columnId?mode=delete|move&targetColumnId=...
// Explicit decision: if column has issues, require mode.
columnsRouter.delete("/columns/:columnId", (req, res) => {
  const col = db.prepare("SELECT * FROM columns WHERE id = ?").get(req.params.columnId) as any;
  if (!col) return err(res, 404, "COLUMN_NOT_FOUND", "Column not found");

  const count = db.prepare("SELECT COUNT(*) as n FROM issues WHERE column_id = ?").get(col.id) as any;
  const mode = (req.query.mode as string) ?? "";

  if ((count.n as number) > 0 && mode !== "delete" && mode !== "move") {
    return err(
      res,
      409,
      "COLUMN_HAS_ISSUES",
      `Column has ${count.n} issue(s). Pass ?mode=delete to delete them or ?mode=move&targetColumnId=... to move them.`
    );
  }

  if (mode === "move") {
    const targetId = req.query.targetColumnId as string;
    if (!targetId) {
      return err(res, 400, "MISSING_TARGET", "targetColumnId is required when mode=move");
    }

    const target = db
      .prepare("SELECT * FROM columns WHERE id = ? AND board_id = ?")
      .get(targetId, col.board_id) as any;
    if (!target) {
      return err(res, 404, "TARGET_COLUMN_NOT_FOUND", "Target column not found in same board");
    }
    if (target.id === col.id) {
      return err(res, 400, "INVALID_TARGET", "Cannot move issues to the same column");
    }

    const max = db
      .prepare("SELECT COALESCE(MAX(position), -1) as m FROM issues WHERE column_id = ?")
      .get(target.id) as any;
    let pos = (max.m as number) + 1;
    const moving = db
      .prepare("SELECT * FROM issues WHERE column_id = ? ORDER BY position ASC")
      .all(col.id) as any[];
    const now = nowIso();

    transaction(() => {
      for (const issue of moving) {
        db.prepare(
          "UPDATE issues SET column_id = ?, position = ?, updated_at = ? WHERE id = ?"
        ).run(target.id, pos++, now, issue.id);
      }
      db.prepare("DELETE FROM columns WHERE id = ?").run(col.id);
      renumberColumns(col.board_id);
    });

    return res.status(204).send();
  }

  transaction(() => {
    db.prepare("DELETE FROM columns WHERE id = ?").run(col.id);
    renumberColumns(col.board_id);
  });

  res.status(204).send();
});

// POST /api/boards/:boardId/columns/reorder
columnsRouter.post("/boards/:boardId/columns/reorder", (req, res) => {
  const board = db.prepare("SELECT * FROM boards WHERE id = ?").get(req.params.boardId) as any;
  if (!board) return err(res, 404, "BOARD_NOT_FOUND", "Board not found");

  const parsed = reorderSchema.safeParse(req.body);
  if (!parsed.success) {
    return err(res, 400, "INVALID_BODY", parsed.error.issues[0]?.message ?? "Invalid body");
  }

  const existing = db.prepare("SELECT id FROM columns WHERE board_id = ?").all(board.id) as any[];
  const existingIds = new Set(existing.map((c) => c.id));

  if (
    parsed.data.orderedIds.length !== existing.length ||
    !parsed.data.orderedIds.every((id) => existingIds.has(id))
  ) {
    return err(
      res,
      400,
      "INVALID_ORDER",
      "orderedIds must contain exactly all column ids of the board"
    );
  }

  const now = nowIso();
  transaction(() => {
    parsed.data.orderedIds.forEach((id, idx) => {
      db.prepare("UPDATE columns SET position = ?, updated_at = ? WHERE id = ?").run(
        idx,
        now,
        id
      );
    });
  });

  const cols = db
    .prepare("SELECT * FROM columns WHERE board_id = ? ORDER BY position ASC")
    .all(board.id) as any[];
  res.json({ columns: cols.map(rowToColumn) });
});

function renumberColumns(boardId: string) {
  const cols = db
    .prepare("SELECT id FROM columns WHERE board_id = ? ORDER BY position ASC")
    .all(boardId) as any[];

  cols.forEach((c, idx) => {
    db.prepare("UPDATE columns SET position = ? WHERE id = ?").run(idx, c.id);
  });
}
