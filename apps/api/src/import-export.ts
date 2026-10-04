import { Router } from "express";
import { z } from "zod";
import { db, nowIso, transaction } from "./db.js";
import {
  boardDescriptionSchema,
  boardNameSchema,
  columnNameSchema,
  commentContentSchema,
  hexColorSchema,
  issueDescriptionSchema,
  issueTitleSchema,
} from "./validation.js";

export const importExportRouter = Router();

function err(res: any, status: number, code: string, message: string) {
  return res.status(status).json({ error: { code, message } });
}

const portableIdSchema = z.string().min(1).max(200);
const exportFormatSchema = z.enum(["kanban", "simple"]);

// ---- Full format (lean-kanban v1) ----
const fullSchema = z.object({
  format: z.literal("lean-kanban"),
  version: z.literal(1),
  board: z.object({
    name: boardNameSchema,
    description: boardDescriptionSchema.optional().default(""),
  }),
  columns: z.array(
    z.object({
      id: portableIdSchema,
      name: columnNameSchema,
      color: hexColorSchema,
      position: z.number().int().min(0),
    })
  ),
  issues: z.array(
    z.object({
      id: portableIdSchema,
      columnId: portableIdSchema,
      title: issueTitleSchema,
      description: issueDescriptionSchema.optional().default(""),
      color: hexColorSchema.nullable().optional().default(null),
      position: z.number().int().min(0),
      comments: z
        .array(z.object({ content: commentContentSchema }))
        .optional()
        .default([]),
    })
  ),
});

// ---- Simple format ----
const simpleSchema = z.object({
  name: boardNameSchema,
  description: boardDescriptionSchema.optional().default(""),
  columns: z.array(
    z.object({
      name: columnNameSchema,
      color: hexColorSchema.optional(),
      issues: z
        .array(
          z.object({
            title: issueTitleSchema,
            description: issueDescriptionSchema.optional().default(""),
            color: hexColorSchema.nullable().optional().default(null),
            comments: z.array(commentContentSchema).optional().default([]),
          })
        )
        .optional()
        .default([]),
    })
  ),
});

const DEFAULT_COLORS = [
  "#64748B",
  "#2563EB",
  "#0891B2",
  "#16A34A",
  "#CA8A04",
  "#EA580C",
  "#DC2626",
  "#DB2777",
  "#7C3AED",
];

function badColor(value: unknown): boolean {
  return (
    value !== undefined &&
    value !== null &&
    (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value))
  );
}

function hasDuplicates(values: string[]): boolean {
  return new Set(values).size !== values.length;
}

function buildFull(boardId: string) {
  const board = db.prepare("SELECT * FROM boards WHERE id = ?").get(boardId) as any;
  if (!board) return null;

  const cols = db
    .prepare("SELECT * FROM columns WHERE board_id = ? ORDER BY position ASC")
    .all(boardId) as any[];
  const issues = db
    .prepare("SELECT * FROM issues WHERE board_id = ? ORDER BY position ASC")
    .all(boardId) as any[];

  const colIdMap = new Map<string, string>();
  cols.forEach((c, i) => colIdMap.set(c.id, `col-${i}-${slug(c.name)}`));

  const issueRows = issues.map((iss, i) => {
    const comments = db
      .prepare("SELECT * FROM comments WHERE issue_id = ? ORDER BY created_at ASC")
      .all(iss.id) as any[];

    return {
      id: `issue-${i}-${slug(iss.title).slice(0, 24)}`,
      columnId: colIdMap.get(iss.column_id),
      title: iss.title,
      description: iss.description ?? "",
      color: iss.color ?? null,
      position: iss.position,
      comments: comments.map((c) => ({ content: c.content })),
    };
  });

  return {
    format: "lean-kanban",
    version: 1,
    board: {
      name: board.name,
      description: board.description ?? "",
    },
    columns: cols.map((c) => ({
      id: colIdMap.get(c.id),
      name: c.name,
      color: c.color,
      position: c.position,
    })),
    issues: issueRows,
  };
}

function buildSimple(boardId: string) {
  const board = db.prepare("SELECT * FROM boards WHERE id = ?").get(boardId) as any;
  if (!board) return null;

  const cols = db
    .prepare("SELECT * FROM columns WHERE board_id = ? ORDER BY position ASC")
    .all(boardId) as any[];

  return {
    name: board.name,
    description: board.description ?? "",
    columns: cols.map((c) => {
      const issues = db
        .prepare("SELECT * FROM issues WHERE column_id = ? ORDER BY position ASC")
        .all(c.id) as any[];

      return {
        name: c.name,
        color: c.color,
        issues: issues.map((iss) => {
          const comments = db
            .prepare("SELECT content FROM comments WHERE issue_id = ? ORDER BY created_at ASC")
            .all(iss.id) as any[];

          return {
            title: iss.title,
            description: iss.description ?? "",
            ...(iss.color ? { color: iss.color } : {}),
            comments: comments.map((x) => x.content),
          };
        }),
      };
    }),
  };
}

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "item"
  );
}

// GET /api/boards/:boardId/export?format=kanban|simple
importExportRouter.get("/boards/:boardId/export", (req, res) => {
  const parsedFormat = exportFormatSchema.safeParse(req.query.format ?? "kanban");
  if (!parsedFormat.success) {
    return err(res, 400, "INVALID_FORMAT", 'format must be "kanban" or "simple"');
  }

  const board = db.prepare("SELECT * FROM boards WHERE id = ?").get(req.params.boardId) as any;
  if (!board) return err(res, 404, "BOARD_NOT_FOUND", "Board not found");

  if (parsedFormat.data === "simple") return res.json(buildSimple(board.id));
  return res.json(buildFull(board.id));
});

// POST /api/boards/import — detect format, validate, preview-friendly errors, create new board
importExportRouter.post("/boards/import", (req, res) => {
  const body = req.body;

  if (!body || typeof body !== "object") {
    return err(
      res,
      400,
      "INVALID_IMPORT",
      "Invalid import file: expected a JSON object."
    );
  }

  const isFull = (body as any).format === "lean-kanban";

  if (isFull) {
    const rawColumns = Array.isArray((body as any).columns) ? (body as any).columns : [];
    const rawIssues = Array.isArray((body as any).issues) ? (body as any).issues : [];

    for (const c of rawColumns) {
      if (badColor(c?.color)) {
        return err(
          res,
          400,
          "INVALID_IMPORT",
          `Invalid column color "${c.color}".\n\nExpected format: #RRGGBB`
        );
      }
    }

    for (const i of rawIssues) {
      if (badColor(i?.color)) {
        return err(
          res,
          400,
          "INVALID_IMPORT",
          `Invalid issue color "${i.color}".\n\nExpected format: #RRGGBB`
        );
      }
    }

    const parsed = fullSchema.safeParse(body);
    if (!parsed.success) {
      return err(
        res,
        400,
        "INVALID_IMPORT",
        `Invalid Kanban JSON: ${parsed.error.issues[0]?.path.join(".")}: ${parsed.error.issues[0]?.message}`
      );
    }

    const columnIds = parsed.data.columns.map((c) => c.id);
    if (hasDuplicates(columnIds)) {
      return err(res, 400, "INVALID_IMPORT", "Column ids must be unique.");
    }

    const issueIds = parsed.data.issues.map((issue) => issue.id);
    if (hasDuplicates(issueIds)) {
      return err(res, 400, "INVALID_IMPORT", "Issue ids must be unique.");
    }

    const colIds = new Set(columnIds);
    for (const iss of parsed.data.issues) {
      if (!colIds.has(iss.columnId)) {
        return err(
          res,
          400,
          "INVALID_IMPORT",
          `Invalid import file.\nIssue "${iss.title}" references column "${iss.columnId}", but that column does not exist.`
        );
      }
    }

    const boardId = crypto.randomUUID();
    const now = nowIso();

    transaction(() => {
      db.prepare(
        "INSERT INTO boards (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
      ).run(
        boardId,
        parsed.data.board.name,
        parsed.data.board.description ?? "",
        now,
        now
      );

      const internalColId = new Map<string, string>();
      const sortedCols = [...parsed.data.columns].sort(
        (a, b) => a.position - b.position
      );

      sortedCols.forEach((c, idx) => {
        const newId = crypto.randomUUID();
        internalColId.set(c.id, newId);
        db.prepare(
          "INSERT INTO columns (id, board_id, name, color, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).run(newId, boardId, c.name, c.color, idx, now, now);
      });

      const byCol = new Map<string, typeof parsed.data.issues>();
      for (const iss of parsed.data.issues) {
        const key = iss.columnId;
        if (!byCol.has(key)) byCol.set(key, []);
        byCol.get(key)!.push(iss);
      }

      for (const [, list] of byCol) {
        list.sort((a, b) => a.position - b.position);
        list.forEach((iss, idx) => {
          const issueId = crypto.randomUUID();

          db.prepare(
            "INSERT INTO issues (id, board_id, column_id, title, description, color, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
          ).run(
            issueId,
            boardId,
            internalColId.get(iss.columnId)!,
            iss.title,
            iss.description ?? "",
            iss.color ?? null,
            idx,
            now,
            now
          );

          for (const cm of iss.comments ?? []) {
            db.prepare(
              "INSERT INTO comments (id, issue_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
            ).run(crypto.randomUUID(), issueId, cm.content, now, now);
          }
        });
      }
    });

    const full = buildFull(boardId);
    return res.status(201).json({
      boardId,
      board: full?.board,
      imported: true,
    });
  }

  const rawColumns = Array.isArray((body as any).columns) ? (body as any).columns : [];

  for (const c of rawColumns) {
    if (badColor(c?.color)) {
      return err(
        res,
        400,
        "INVALID_IMPORT",
        `Invalid column color "${c.color}".\n\nExpected format: #RRGGBB`
      );
    }

    const rawIssues = Array.isArray(c?.issues) ? c.issues : [];
    for (const i of rawIssues) {
      if (badColor(i?.color)) {
        return err(
          res,
          400,
          "INVALID_IMPORT",
          `Invalid issue color "${i.color}".\n\nExpected format: #RRGGBB`
        );
      }
    }
  }

  const parsed = simpleSchema.safeParse(body);
  if (!parsed.success) {
    return err(
      res,
      400,
      "INVALID_IMPORT",
      `Invalid import file: expected Kanban JSON (format: lean-kanban) or Simple JSON ({name, columns}). Detail: ${parsed.error.issues[0]?.path.join(".")}: ${parsed.error.issues[0]?.message}`
    );
  }

  const boardId = crypto.randomUUID();
  const now = nowIso();

  transaction(() => {
    db.prepare(
      "INSERT INTO boards (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
    ).run(
      boardId,
      parsed.data.name,
      parsed.data.description ?? "",
      now,
      now
    );

    parsed.data.columns.forEach((c, ci) => {
      const colId = crypto.randomUUID();
      db.prepare(
        "INSERT INTO columns (id, board_id, name, color, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(
        colId,
        boardId,
        c.name,
        c.color ?? DEFAULT_COLORS[ci % DEFAULT_COLORS.length],
        ci,
        now,
        now
      );

      (c.issues ?? []).forEach((iss, ii) => {
        const issueId = crypto.randomUUID();
        db.prepare(
          "INSERT INTO issues (id, board_id, column_id, title, description, color, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).run(
          issueId,
          boardId,
          colId,
          iss.title,
          iss.description ?? "",
          iss.color ?? null,
          ii,
          now,
          now
        );

        for (const content of iss.comments ?? []) {
          db.prepare(
            "INSERT INTO comments (id, issue_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
          ).run(crypto.randomUUID(), issueId, content, now, now);
        }
      });
    });
  });

  return res.status(201).json({ boardId, imported: true });
});
