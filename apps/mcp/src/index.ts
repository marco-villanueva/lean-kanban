import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Tiny adapter: MCP -> existing HTTP API -> SQLite. No business logic here.
const API = process.env.API_BASE ?? "http://localhost:3001";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error?.message ?? `API ${res.status}`);
  return data as T;
}

async function resolveBoard(idOrName: string): Promise<string> {
  const { boards } = await req<{ boards: any[] }>("/api/boards");
  const byId = boards.find((b) => b.id === idOrName);
  if (byId) return byId.id;
  const matches = boards.filter((b) => b.name.toLowerCase() === idOrName.toLowerCase());
  if (matches.length === 1) return matches[0].id;
  if (matches.length > 1) throw new Error(`Ambiguous board "${idOrName}": ${matches.length} match. Use id.`);
  throw new Error(`Board "${idOrName}" not found.`);
}

async function boardData(boardId: string) {
  return req<any>(`/api/boards/${boardId}`);
}

async function resolveColumn(boardId: string, idOrName: string): Promise<string> {
  const full = await boardData(boardId);
  const byId = full.columns.find((c: any) => c.id === idOrName);
  if (byId) return byId.id;
  const matches = full.columns.filter((c: any) => c.name.toLowerCase() === idOrName.toLowerCase());
  if (matches.length === 1) return matches[0].id;
  if (matches.length > 1) throw new Error(`Ambiguous column "${idOrName}". Use id.`);
  throw new Error(`Column "${idOrName}" not found in board.`);
}

async function resolveIssue(boardId: string, idOrTitle: string): Promise<string> {
  const full = await boardData(boardId);
  const byId = full.issues.find((i: any) => i.id === idOrTitle);
  if (byId) return byId.id;
  const matches = full.issues.filter((i: any) => i.title.toLowerCase() === idOrTitle.toLowerCase());
  if (matches.length === 1) return matches[0].id;
  if (matches.length > 1) throw new Error(`Ambiguous issue "${idOrTitle}": ${matches.length} match. Use id.`);
  throw new Error(`Issue "${idOrTitle}" not found in board.`);
}

const server = new McpServer({ name: "lean-kanban", version: "1.0.0" });

// Boards
server.tool("list_boards", {}, async () => ({ content: [{ type: "text", text: JSON.stringify(await req("/api/boards")) }] }));
server.tool("get_board", { board: z.string() }, async ({ board }) => {
  const id = await resolveBoard(board);
  return { content: [{ type: "text", text: JSON.stringify(await boardData(id)) }] };
});
server.tool("create_board", { name: z.string(), description: z.string().optional().default("") }, async ({ name, description }) => {
  const data = await req("/api/boards", { method: "POST", body: JSON.stringify({ name, description }) });
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
});
server.tool("update_board", { board: z.string(), name: z.string().optional(), description: z.string().optional() }, async ({ board, name, description }) => {
  const id = await resolveBoard(board);
  const data = await req(`/api/boards/${id}`, { method: "PATCH", body: JSON.stringify({ name, description }) });
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
});
server.tool("delete_board", { board: z.string() }, async ({ board }) => {
  const id = await resolveBoard(board);
  await req(`/api/boards/${id}`, { method: "DELETE" });
  return { content: [{ type: "text", text: `Deleted ${id}` }] };
});

// Columns
server.tool("create_column", { board: z.string(), name: z.string(), color: z.string().optional() }, async ({ board, name, color }) => {
  const id = await resolveBoard(board);
  const data = await req(`/api/boards/${id}/columns`, { method: "POST", body: JSON.stringify({ name, color: color ?? "#64748B" }) });
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
});
server.tool("update_column", { board: z.string(), column: z.string(), name: z.string().optional(), color: z.string().optional() }, async ({ board, column, name, color }) => {
  const bid = await resolveBoard(board);
  const cid = await resolveColumn(bid, column);
  const data = await req(`/api/columns/${cid}`, { method: "PATCH", body: JSON.stringify({ name, color }) });
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
});
server.tool("delete_column", { board: z.string(), column: z.string(), mode: z.enum(["delete", "move"]).optional(), targetColumn: z.string().optional() }, async ({ board, column, mode, targetColumn }) => {
  const bid = await resolveBoard(board);
  const cid = await resolveColumn(bid, column);
  let q = "";
  if (mode) {
    const tid = mode === "move" && targetColumn ? await resolveColumn(bid, targetColumn) : "";
    q = `?mode=${mode}${tid ? `&targetColumnId=${tid}` : ""}`;
  }
  await req(`/api/columns/${cid}${q}`, { method: "DELETE" });
  return { content: [{ type: "text", text: `Deleted column ${cid}` }] };
});
server.tool("reorder_columns", { board: z.string(), orderedColumns: z.array(z.string()) }, async ({ board, orderedColumns }) => {
  const bid = await resolveBoard(board);
  const full = await boardData(bid);
  const ids = await Promise.all(orderedColumns.map((c) => resolveColumn(bid, c)));
  if (ids.length !== full.columns.length) throw new Error("orderedColumns must contain all columns");
  const data = await req(`/api/boards/${bid}/columns/reorder`, { method: "POST", body: JSON.stringify({ orderedIds: ids }) });
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
});

// Issues
server.tool("list_issues", { board: z.string(), column: z.string().optional(), q: z.string().optional() }, async ({ board, column, q }) => {
  const bid = await resolveBoard(board);
  let path = `/api/boards/${bid}/issues`;
  const params = new URLSearchParams();
  if (column) params.set("columnId", await resolveColumn(bid, column));
  if (q) params.set("q", q);
  if ([...params].length) path += `?${params}`;
  return { content: [{ type: "text", text: JSON.stringify(await req(path)) }] };
});
server.tool("get_issue", { issue: z.string(), board: z.string().optional() }, async ({ issue, board }) => {
  let id = issue;
  if (board) id = await resolveIssue(await resolveBoard(board), issue);
  return { content: [{ type: "text", text: JSON.stringify(await req(`/api/issues/${id}`)) }] };
});
server.tool("create_issue", { board: z.string(), column: z.string(), title: z.string(), description: z.string().optional().default(""), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() }, async ({ board, column, title, description, color }) => {
  const bid = await resolveBoard(board);
  const cid = await resolveColumn(bid, column);
  const data = await req(`/api/boards/${bid}/issues`, { method: "POST", body: JSON.stringify({ columnId: cid, title, description, color: color ?? null }) });
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
});
server.tool("update_issue", { board: z.string().optional(), issue: z.string(), title: z.string().optional(), description: z.string().optional(), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional() }, async ({ board, issue, title, description, color }) => {
  let id = issue;
  if (board) id = await resolveIssue(await resolveBoard(board), issue);
  const data = await req(`/api/issues/${id}`, { method: "PATCH", body: JSON.stringify({ title, description, color }) });
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
});
server.tool("move_issue", { board: z.string(), issue: z.string(), column: z.string(), position: z.number().int().min(0).optional().default(0) }, async ({ board, issue, column, position }) => {
  const bid = await resolveBoard(board);
  const iid = await resolveIssue(bid, issue);
  const cid = await resolveColumn(bid, column);
  const data = await req(`/api/issues/${iid}/move`, { method: "PATCH", body: JSON.stringify({ columnId: cid, position }) });
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
});
server.tool("delete_issue", { board: z.string().optional(), issue: z.string() }, async ({ board, issue }) => {
  let id = issue;
  if (board) id = await resolveIssue(await resolveBoard(board), issue);
  await req(`/api/issues/${id}`, { method: "DELETE" });
  return { content: [{ type: "text", text: `Deleted ${id}` }] };
});

// Comments
server.tool("list_comments", { board: z.string().optional(), issue: z.string() }, async ({ board, issue }) => {
  let id = issue;
  if (board) id = await resolveIssue(await resolveBoard(board), issue);
  return { content: [{ type: "text", text: JSON.stringify(await req(`/api/issues/${id}/comments`)) }] };
});
server.tool("add_comment", { board: z.string().optional(), issue: z.string(), content: z.string() }, async ({ board, issue, content }) => {
  let id = issue;
  if (board) id = await resolveIssue(await resolveBoard(board), issue);
  const data = await req(`/api/issues/${id}/comments`, { method: "POST", body: JSON.stringify({ content }) });
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
});
server.tool("update_comment", { comment: z.string(), content: z.string() }, async ({ comment, content }) => {
  const data = await req(`/api/comments/${comment}`, { method: "PATCH", body: JSON.stringify({ content }) });
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
});
server.tool("delete_comment", { comment: z.string() }, async ({ comment }) => {
  await req(`/api/comments/${comment}`, { method: "DELETE" });
  return { content: [{ type: "text", text: `Deleted ${comment}` }] };
});

// Import/export
server.tool("export_board", { board: z.string(), format: z.enum(["kanban", "simple"]).optional().default("kanban") }, async ({ board, format }) => {
  const id = await resolveBoard(board);
  return { content: [{ type: "text", text: JSON.stringify(await req(`/api/boards/${id}/export?format=${format}`)) }] };
});
server.tool("import_board", { json: z.string() }, async ({ json }) => {
  const data = await req("/api/boards/import", { method: "POST", body: json });
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
