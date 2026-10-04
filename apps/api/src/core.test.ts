import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

const testDir = mkdtempSync(join(tmpdir(), "lean-kanban-test-"));
process.env.DB_PATH = join(testDir, "kanban.db");

const { app } = await import("./app.js");
const { db } = await import("./db.js");

const server = await new Promise<Server>((resolve) => {
  const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
});
const address = server.address() as AddressInfo;
const baseUrl = `http://127.0.0.1:${address.port}`;

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  db.close();
  rmSync(testDir, { recursive: true, force: true });
});

beforeEach(() => {
  db.exec(`
    DELETE FROM comments;
    DELETE FROM issues;
    DELETE FROM columns;
    DELETE FROM boards;
  `);
});

type JsonResponse = {
  status: number;
  body: any;
};

async function request(path: string, init: RequestInit = {}): Promise<JsonResponse> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : undefined,
  };
}

async function createBoard(name = "Test Board") {
  const response = await request("/api/boards", {
    method: "POST",
    body: JSON.stringify({ name, description: "Test description" }),
  });
  assert.equal(response.status, 201);
  return response.body.board;
}

async function createColumn(boardId: string, name: string, color = "#64748B") {
  const response = await request(`/api/boards/${boardId}/columns`, {
    method: "POST",
    body: JSON.stringify({ name, color }),
  });
  assert.equal(response.status, 201);
  return response.body.column;
}

async function createIssue(boardId: string, columnId: string, title: string, color: string | null = null) {
  const response = await request(`/api/boards/${boardId}/issues`, {
    method: "POST",
    body: JSON.stringify({ columnId, title, description: `Description for ${title}`, color }),
  });
  assert.equal(response.status, 201);
  return response.body.issue;
}

test("board CRUD and validation", async () => {
  const invalid = await request("/api/boards", {
    method: "POST",
    body: JSON.stringify({ name: "   " }),
  });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error.code, "INVALID_BODY");

  const board = await createBoard("  Product  ");
  assert.equal(board.name, "Product");

  const updated = await request(`/api/boards/${board.id}`, {
    method: "PATCH",
    body: JSON.stringify({ name: "Product v2", description: "Updated" }),
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.board.name, "Product v2");

  const removed = await request(`/api/boards/${board.id}`, { method: "DELETE" });
  assert.equal(removed.status, 204);

  const missing = await request(`/api/boards/${board.id}`);
  assert.equal(missing.status, 404);
});

test("columns can be recolored, reordered, and deleted by moving issues", async () => {
  const board = await createBoard();
  const todo = await createColumn(board.id, "Todo", "#2563EB");
  const doing = await createColumn(board.id, "Doing", "#CA8A04");
  const done = await createColumn(board.id, "Done", "#16A34A");

  const recolor = await request(`/api/columns/${doing.id}`, {
    method: "PATCH",
    body: JSON.stringify({ color: "#DC2626" }),
  });
  assert.equal(recolor.status, 200);
  assert.equal(recolor.body.column.color, "#DC2626");

  const reorder = await request(`/api/boards/${board.id}/columns/reorder`, {
    method: "POST",
    body: JSON.stringify({ orderedIds: [done.id, todo.id, doing.id] }),
  });
  assert.equal(reorder.status, 200);
  assert.deepEqual(reorder.body.columns.map((column: any) => column.id), [done.id, todo.id, doing.id]);

  const issue = await createIssue(board.id, todo.id, "Move me");
  const protectedDelete = await request(`/api/columns/${todo.id}`, { method: "DELETE" });
  assert.equal(protectedDelete.status, 409);
  assert.equal(protectedDelete.body.error.code, "COLUMN_HAS_ISSUES");

  const movedDelete = await request(
    `/api/columns/${todo.id}?mode=move&targetColumnId=${doing.id}`,
    { method: "DELETE" },
  );
  assert.equal(movedDelete.status, 204);

  const full = await request(`/api/boards/${board.id}`);
  assert.equal(full.status, 200);
  assert.equal(full.body.issues.find((item: any) => item.id === issue.id).columnId, doing.id);
  assert.deepEqual(full.body.columns.map((column: any) => column.position), [0, 1]);
});

test("issues reorder in one column, move across columns, and can be searched", async () => {
  const board = await createBoard();
  const todo = await createColumn(board.id, "Todo");
  const done = await createColumn(board.id, "Done");

  const a = await createIssue(board.id, todo.id, "Alpha");
  const b = await createIssue(board.id, todo.id, "Beta");
  const c = await createIssue(board.id, todo.id, "Gamma");

  const moveWithin = await request(`/api/issues/${a.id}/move`, {
    method: "PATCH",
    body: JSON.stringify({ columnId: todo.id, position: 2 }),
  });
  assert.equal(moveWithin.status, 200);

  let full = await request(`/api/boards/${board.id}`);
  assert.deepEqual(
    full.body.issues
      .filter((issue: any) => issue.columnId === todo.id)
      .sort((left: any, right: any) => left.position - right.position)
      .map((issue: any) => issue.title),
    ["Beta", "Gamma", "Alpha"],
  );

  const moveAcross = await request(`/api/issues/${c.id}/move`, {
    method: "PATCH",
    body: JSON.stringify({ columnId: done.id, position: 0 }),
  });
  assert.equal(moveAcross.status, 200);

  full = await request(`/api/boards/${board.id}`);
  assert.equal(full.body.issues.find((issue: any) => issue.id === c.id).columnId, done.id);

  const search = await request(`/api/boards/${board.id}/issues?q=beta`);
  assert.equal(search.status, 200);
  assert.deepEqual(search.body.issues.map((issue: any) => issue.id), [b.id]);

  const byColumn = await request(`/api/boards/${board.id}/issues?columnId=${done.id}`);
  assert.equal(byColumn.status, 200);
  assert.deepEqual(byColumn.body.issues.map((issue: any) => issue.id), [c.id]);
});

test("comments support create, update, list, and delete", async () => {
  const board = await createBoard();
  const column = await createColumn(board.id, "Todo");
  const issue = await createIssue(board.id, column.id, "Commented issue");

  const created = await request(`/api/issues/${issue.id}/comments`, {
    method: "POST",
    body: JSON.stringify({ content: "First comment" }),
  });
  assert.equal(created.status, 201);

  const commentId = created.body.comment.id;
  const updated = await request(`/api/comments/${commentId}`, {
    method: "PATCH",
    body: JSON.stringify({ content: "Edited comment" }),
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.comment.content, "Edited comment");

  const listed = await request(`/api/issues/${issue.id}/comments`);
  assert.equal(listed.status, 200);
  assert.deepEqual(listed.body.comments.map((comment: any) => comment.content), ["Edited comment"]);

  const removed = await request(`/api/comments/${commentId}`, { method: "DELETE" });
  assert.equal(removed.status, 204);
});

test("full Kanban JSON survives export, delete, and import round-trip", async () => {
  const source = {
    format: "lean-kanban",
    version: 1,
    board: { name: "Round Trip", description: "Full format" },
    columns: [
      { id: "todo", name: "Todo", color: "#2563EB", position: 0 },
      { id: "doing", name: "Doing", color: "#CA8A04", position: 1 },
    ],
    issues: [
      {
        id: "alpha",
        columnId: "todo",
        title: "Alpha",
        description: "Alpha description",
        color: "#7C3AED",
        position: 0,
        comments: [{ content: "Alpha comment" }],
      },
      {
        id: "beta",
        columnId: "doing",
        title: "Beta",
        description: "",
        color: null,
        position: 0,
        comments: [],
      },
    ],
  };

  const imported = await request("/api/boards/import", {
    method: "POST",
    body: JSON.stringify(source),
  });
  assert.equal(imported.status, 201);

  const exported = await request(`/api/boards/${imported.body.boardId}/export?format=kanban`);
  assert.equal(exported.status, 200);

  const removed = await request(`/api/boards/${imported.body.boardId}`, { method: "DELETE" });
  assert.equal(removed.status, 204);

  const reimported = await request("/api/boards/import", {
    method: "POST",
    body: JSON.stringify(exported.body),
  });
  assert.equal(reimported.status, 201);

  const full = await request(`/api/boards/${reimported.body.boardId}`);
  assert.equal(full.body.board.name, "Round Trip");
  assert.deepEqual(full.body.columns.map((column: any) => [column.name, column.color, column.position]), [
    ["Todo", "#2563EB", 0],
    ["Doing", "#CA8A04", 1],
  ]);
  assert.deepEqual(
    full.body.issues
      .sort((left: any, right: any) => left.title.localeCompare(right.title))
      .map((issue: any) => [issue.title, issue.description, issue.color, issue.position]),
    [
      ["Alpha", "Alpha description", "#7C3AED", 0],
      ["Beta", "", null, 0],
    ],
  );
  assert.deepEqual(full.body.comments.map((comment: any) => comment.content), ["Alpha comment"]);
});

test("Simple JSON survives export and import with supported fields", async () => {
  const source = {
    name: "Simple Round Trip",
    description: "Simple format",
    columns: [
      {
        name: "Todo",
        color: "#2563EB",
        issues: [
          {
            title: "Alpha",
            description: "A",
            color: "#DB2777",
            comments: ["One", "Two"],
          },
        ],
      },
      { name: "Done", color: "#16A34A", issues: [] },
    ],
  };

  const imported = await request("/api/boards/import", {
    method: "POST",
    body: JSON.stringify(source),
  });
  assert.equal(imported.status, 201);

  const exported = await request(`/api/boards/${imported.body.boardId}/export?format=simple`);
  assert.equal(exported.status, 200);
  assert.deepEqual(exported.body, source);

  const reimported = await request("/api/boards/import", {
    method: "POST",
    body: JSON.stringify(exported.body),
  });
  assert.equal(reimported.status, 201);
});

test("import rejects invalid colors, duplicate ids, missing references, and oversized values", async () => {
  const invalidColor = await request("/api/boards/import", {
    method: "POST",
    body: JSON.stringify({
      name: "Bad Color",
      columns: [{ name: "Todo", color: "blue", issues: [] }],
    }),
  });
  assert.equal(invalidColor.status, 400);

  const duplicateColumns = await request("/api/boards/import", {
    method: "POST",
    body: JSON.stringify({
      format: "lean-kanban",
      version: 1,
      board: { name: "Duplicates" },
      columns: [
        { id: "todo", name: "Todo", color: "#2563EB", position: 0 },
        { id: "todo", name: "Todo 2", color: "#16A34A", position: 1 },
      ],
      issues: [],
    }),
  });
  assert.equal(duplicateColumns.status, 400);
  assert.match(duplicateColumns.body.error.message, /unique/i);

  const missingReference = await request("/api/boards/import", {
    method: "POST",
    body: JSON.stringify({
      format: "lean-kanban",
      version: 1,
      board: { name: "Missing Reference" },
      columns: [{ id: "todo", name: "Todo", color: "#2563EB", position: 0 }],
      issues: [{
        id: "broken",
        columnId: "missing",
        title: "Broken",
        position: 0,
        comments: [],
      }],
    }),
  });
  assert.equal(missingReference.status, 400);
  assert.match(missingReference.body.error.message, /does not exist/i);

  const oversizedTitle = await request("/api/boards/import", {
    method: "POST",
    body: JSON.stringify({
      name: "Too Long",
      columns: [{
        name: "Todo",
        issues: [{ title: "x".repeat(201), comments: [] }],
      }],
    }),
  });
  assert.equal(oversizedTitle.status, 400);
});

test("invalid JSON and invalid export format return structured 400 errors", async () => {
  const invalidJson = await fetch(`${baseUrl}/api/boards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{not-json",
  });
  assert.equal(invalidJson.status, 400);
  const invalidJsonBody = await invalidJson.json() as any;
  assert.equal(invalidJsonBody.error.code, "INVALID_JSON");

  const board = await createBoard();
  const invalidFormat = await request(`/api/boards/${board.id}/export?format=xml`);
  assert.equal(invalidFormat.status, 400);
  assert.equal(invalidFormat.body.error.code, "INVALID_FORMAT");
});
