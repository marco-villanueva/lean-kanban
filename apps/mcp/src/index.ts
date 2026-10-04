import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Thin adapter only: Agent -> MCP -> existing REST API -> SQLite.
const API = (process.env.API_BASE ?? "http://127.0.0.1:3001").replace(/\/$/, "");
const REQUEST_TIMEOUT_MS = 10_000;

function textResult(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof data === "string" ? data : JSON.stringify(data),
      },
    ],
  };
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API}${path}`, {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Lean Kanban API is not reachable at ${API}. Start the API first or configure API_BASE. ${reason}`,
    );
  }

  if (response.status === 204) return undefined as T;

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      (data as any)?.error?.message ?? `Lean Kanban API returned ${response.status}`,
    );
  }

  return data as T;
}

async function resolveBoard(idOrName: string): Promise<string> {
  const { boards } = await req<{ boards: any[] }>("/api/boards");

  const byId = boards.find((board) => board.id === idOrName);
  if (byId) return byId.id;

  const matches = boards.filter(
    (board) => board.name.toLowerCase() === idOrName.toLowerCase(),
  );

  if (matches.length === 1) return matches[0].id;
  if (matches.length > 1) {
    throw new Error(
      `Ambiguous board "${idOrName}": ${matches.length} boards match. Use the board id.`,
    );
  }

  throw new Error(`Board "${idOrName}" not found.`);
}

async function boardData(boardId: string) {
  return req<any>(`/api/boards/${boardId}`);
}

function resolveColumnFromData(full: any, idOrName: string): string {
  const byId = full.columns.find((column: any) => column.id === idOrName);
  if (byId) return byId.id;

  const matches = full.columns.filter(
    (column: any) => column.name.toLowerCase() === idOrName.toLowerCase(),
  );

  if (matches.length === 1) return matches[0].id;
  if (matches.length > 1) {
    throw new Error(`Ambiguous column "${idOrName}". Use the column id.`);
  }

  throw new Error(`Column "${idOrName}" not found in board.`);
}

async function resolveColumn(boardId: string, idOrName: string): Promise<string> {
  return resolveColumnFromData(await boardData(boardId), idOrName);
}

function resolveIssueFromData(full: any, idOrTitle: string): string {
  const byId = full.issues.find((issue: any) => issue.id === idOrTitle);
  if (byId) return byId.id;

  const matches = full.issues.filter(
    (issue: any) => issue.title.toLowerCase() === idOrTitle.toLowerCase(),
  );

  if (matches.length === 1) return matches[0].id;
  if (matches.length > 1) {
    throw new Error(
      `Ambiguous issue "${idOrTitle}": ${matches.length} issues match. Use the issue id.`,
    );
  }

  throw new Error(`Issue "${idOrTitle}" not found in board.`);
}

async function resolveIssue(boardId: string, idOrTitle: string): Promise<string> {
  return resolveIssueFromData(await boardData(boardId), idOrTitle);
}

const boardRef = z.string().min(1).describe("Board id or exact board name.");
const columnRef = z
  .string()
  .min(1)
  .describe("Column id or exact column name within the board.");
const issueRef = z
  .string()
  .min(1)
  .describe("Issue id or exact issue title. Use an id when titles are duplicated.");
const colorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .describe("Hexadecimal color in #RRGGBB format.");

const server = new McpServer({ name: "lean-kanban", version: "1.0.0" });

// Boards
server.registerTool(
  "list_boards",
  {
    description:
      "List all Lean Kanban boards. Use this before resolving an uncertain board name.",
    inputSchema: {},
  },
  async () => textResult(await req("/api/boards")),
);

server.registerTool(
  "get_board",
  {
    description:
      "Get board metadata, columns and issues. Comments are omitted by default to reduce token usage.",
    inputSchema: {
      board: boardRef,
      includeComments: z
        .boolean()
        .optional()
        .default(false)
        .describe("Include all comments only when they are needed."),
    },
  },
  async ({ board, includeComments }) => {
    const id = await resolveBoard(board);
    const full = await boardData(id);

    if (!includeComments) {
      return textResult({
        board: full.board,
        columns: full.columns,
        issues: full.issues,
      });
    }

    return textResult(full);
  },
);

server.registerTool(
  "create_board",
  {
    description: "Create a new board.",
    inputSchema: {
      name: z.string().min(1).max(120).describe("Board name."),
      description: z
        .string()
        .max(2000)
        .optional()
        .default("")
        .describe("Optional board description."),
    },
  },
  async ({ name, description }) =>
    textResult(
      await req("/api/boards", {
        method: "POST",
        body: JSON.stringify({ name, description }),
      }),
    ),
);

server.registerTool(
  "update_board",
  {
    description: "Update a board name and/or description.",
    inputSchema: {
      board: boardRef,
      name: z.string().min(1).max(120).optional(),
      description: z.string().max(2000).optional(),
    },
  },
  async ({ board, name, description }) => {
    const id = await resolveBoard(board);
    return textResult(
      await req(`/api/boards/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name, description }),
      }),
    );
  },
);

server.registerTool(
  "delete_board",
  {
    description:
      "Permanently delete a board and everything inside it. This action cannot be undone.",
    inputSchema: {
      board: boardRef,
      confirm: z.literal(true).describe("Must be true to confirm permanent deletion."),
    },
  },
  async ({ board }) => {
    const id = await resolveBoard(board);
    await req(`/api/boards/${id}`, { method: "DELETE" });
    return textResult(`Deleted board ${id}`);
  },
);

// Columns
server.registerTool(
  "create_column",
  {
    description: "Create a column at the end of a board.",
    inputSchema: {
      board: boardRef,
      name: z.string().min(1).max(80).describe("Column name."),
      color: colorSchema.optional().describe("Optional column color."),
    },
  },
  async ({ board, name, color }) => {
    const id = await resolveBoard(board);
    return textResult(
      await req(`/api/boards/${id}/columns`, {
        method: "POST",
        body: JSON.stringify({ name, color: color ?? "#64748B" }),
      }),
    );
  },
);

server.registerTool(
  "update_column",
  {
    description: "Rename and/or recolor an existing column.",
    inputSchema: {
      board: boardRef,
      column: columnRef,
      name: z.string().min(1).max(80).optional(),
      color: colorSchema.optional(),
    },
  },
  async ({ board, column, name, color }) => {
    const boardId = await resolveBoard(board);
    const columnId = await resolveColumn(boardId, column);
    return textResult(
      await req(`/api/columns/${columnId}`, {
        method: "PATCH",
        body: JSON.stringify({ name, color }),
      }),
    );
  },
);

server.registerTool(
  "delete_column",
  {
    description:
      "Delete a column. If it contains issues, choose whether to delete them or move them to another column.",
    inputSchema: {
      board: boardRef,
      column: columnRef,
      mode: z
        .enum(["delete", "move"])
        .optional()
        .describe("Required when the column contains issues."),
      targetColumn: columnRef
        .optional()
        .describe('Destination column when mode is "move".'),
    },
  },
  async ({ board, column, mode, targetColumn }) => {
    const boardId = await resolveBoard(board);
    const columnId = await resolveColumn(boardId, column);

    let query = "";
    if (mode) {
      const targetId =
        mode === "move" && targetColumn
          ? await resolveColumn(boardId, targetColumn)
          : "";
      query = `?mode=${mode}${targetId ? `&targetColumnId=${targetId}` : ""}`;
    }

    await req(`/api/columns/${columnId}${query}`, { method: "DELETE" });
    return textResult(`Deleted column ${columnId}`);
  },
);

server.registerTool(
  "reorder_columns",
  {
    description: "Set the complete left-to-right order of every column in a board.",
    inputSchema: {
      board: boardRef,
      orderedColumns: z
        .array(z.string().min(1))
        .min(1)
        .describe("All column ids or exact names in the desired final order."),
    },
  },
  async ({ board, orderedColumns }) => {
    const boardId = await resolveBoard(board);
    const full = await boardData(boardId);
    const ids = orderedColumns.map((column) =>
      resolveColumnFromData(full, column),
    );

    if (ids.length !== full.columns.length || new Set(ids).size !== ids.length) {
      throw new Error("orderedColumns must contain every column exactly once.");
    }

    return textResult(
      await req(`/api/boards/${boardId}/columns/reorder`, {
        method: "POST",
        body: JSON.stringify({ orderedIds: ids }),
      }),
    );
  },
);

// Issues
server.registerTool(
  "list_issues",
  {
    description:
      "List issues in a board, optionally filtering by column and/or a text query.",
    inputSchema: {
      board: boardRef,
      column: columnRef.optional(),
      q: z
        .string()
        .optional()
        .describe("Case-insensitive search over issue title and description."),
    },
  },
  async ({ board, column, q }) => {
    const boardId = await resolveBoard(board);
    let path = `/api/boards/${boardId}/issues`;
    const params = new URLSearchParams();

    if (column) params.set("columnId", await resolveColumn(boardId, column));
    if (q) params.set("q", q);
    if ([...params].length) path += `?${params}`;

    return textResult(await req(path));
  },
);

server.registerTool(
  "get_issue",
  {
    description:
      "Get one issue and its comments. Provide board when resolving by exact title instead of id.",
    inputSchema: {
      issue: issueRef,
      board: boardRef.optional(),
    },
  },
  async ({ issue, board }) => {
    const id = board
      ? await resolveIssue(await resolveBoard(board), issue)
      : issue;
    return textResult(await req(`/api/issues/${id}`));
  },
);

server.registerTool(
  "create_issue",
  {
    description: "Create an issue at the end of a column.",
    inputSchema: {
      board: boardRef,
      column: columnRef,
      title: z.string().min(1).max(200),
      description: z.string().max(8000).optional().default(""),
      color: colorSchema.optional(),
    },
  },
  async ({ board, column, title, description, color }) => {
    const boardId = await resolveBoard(board);
    const columnId = await resolveColumn(boardId, column);

    return textResult(
      await req(`/api/boards/${boardId}/issues`, {
        method: "POST",
        body: JSON.stringify({
          columnId,
          title,
          description,
          color: color ?? null,
        }),
      }),
    );
  },
);

server.registerTool(
  "update_issue",
  {
    description:
      "Update issue title, description and/or visual color. Pass color null to remove the issue color.",
    inputSchema: {
      board: boardRef.optional(),
      issue: issueRef,
      title: z.string().min(1).max(200).optional(),
      description: z.string().max(8000).optional(),
      color: colorSchema.nullable().optional(),
    },
  },
  async ({ board, issue, title, description, color }) => {
    const id = board
      ? await resolveIssue(await resolveBoard(board), issue)
      : issue;

    return textResult(
      await req(`/api/issues/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ title, description, color }),
      }),
    );
  },
);

server.registerTool(
  "move_issue",
  {
    description:
      "Move an issue to another column or reorder it. If position is omitted, append it to the end of the target column.",
    inputSchema: {
      board: boardRef,
      issue: issueRef,
      column: columnRef,
      position: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Zero-based target position. Omit to append at the end."),
    },
  },
  async ({ board, issue, column, position }) => {
    const boardId = await resolveBoard(board);
    const full = await boardData(boardId);
    const issueId = resolveIssueFromData(full, issue);
    const columnId = resolveColumnFromData(full, column);
    const targetPosition =
      position ??
      full.issues.filter((item: any) => item.columnId === columnId).length;

    return textResult(
      await req(`/api/issues/${issueId}/move`, {
        method: "PATCH",
        body: JSON.stringify({ columnId, position: targetPosition }),
      }),
    );
  },
);

server.registerTool(
  "delete_issue",
  {
    description: "Permanently delete an issue and its comments.",
    inputSchema: {
      board: boardRef.optional(),
      issue: issueRef,
    },
  },
  async ({ board, issue }) => {
    const id = board
      ? await resolveIssue(await resolveBoard(board), issue)
      : issue;
    await req(`/api/issues/${id}`, { method: "DELETE" });
    return textResult(`Deleted issue ${id}`);
  },
);

// Comments
server.registerTool(
  "list_comments",
  {
    description: "List comments for an issue.",
    inputSchema: {
      board: boardRef.optional(),
      issue: issueRef,
    },
  },
  async ({ board, issue }) => {
    const id = board
      ? await resolveIssue(await resolveBoard(board), issue)
      : issue;
    return textResult(await req(`/api/issues/${id}/comments`));
  },
);

server.registerTool(
  "add_comment",
  {
    description: "Add a plain-text comment to an issue.",
    inputSchema: {
      board: boardRef.optional(),
      issue: issueRef,
      content: z.string().min(1).max(4000),
    },
  },
  async ({ board, issue, content }) => {
    const id = board
      ? await resolveIssue(await resolveBoard(board), issue)
      : issue;

    return textResult(
      await req(`/api/issues/${id}/comments`, {
        method: "POST",
        body: JSON.stringify({ content }),
      }),
    );
  },
);

server.registerTool(
  "update_comment",
  {
    description: "Edit a comment using its comment id.",
    inputSchema: {
      comment: z.string().min(1).describe("Comment id."),
      content: z.string().min(1).max(4000),
    },
  },
  async ({ comment, content }) =>
    textResult(
      await req(`/api/comments/${comment}`, {
        method: "PATCH",
        body: JSON.stringify({ content }),
      }),
    ),
);

server.registerTool(
  "delete_comment",
  {
    description: "Permanently delete a comment using its comment id.",
    inputSchema: {
      comment: z.string().min(1).describe("Comment id."),
    },
  },
  async ({ comment }) => {
    await req(`/api/comments/${comment}`, { method: "DELETE" });
    return textResult(`Deleted comment ${comment}`);
  },
);

// Import / export
server.registerTool(
  "export_board",
  {
    description: "Export a board as portable full Kanban JSON or compact Simple JSON.",
    inputSchema: {
      board: boardRef,
      format: z.enum(["kanban", "simple"]).optional().default("kanban"),
    },
  },
  async ({ board, format }) => {
    const id = await resolveBoard(board);
    return textResult(
      await req(`/api/boards/${id}/export?format=${format}`),
    );
  },
);

server.registerTool(
  "import_board",
  {
    description:
      "Create a new board from a Full Kanban JSON or Simple JSON object. Pass the object directly, not a serialized JSON string.",
    inputSchema: {
      data: z
        .record(z.unknown())
        .describe("Full Kanban JSON or Simple JSON object."),
    },
  },
  async ({ data }) =>
    textResult(
      await req("/api/boards/import", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    ),
);

const transport = new StdioServerTransport();
await server.connect(transport);
