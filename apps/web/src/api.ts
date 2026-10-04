export interface Board { id: string; name: string; description: string; createdAt: string; updatedAt: string }
export interface Column { id: string; boardId: string; name: string; color: string; position: number; createdAt: string; updatedAt: string }
export interface Issue { id: string; boardId: string; columnId: string; title: string; description: string; color: string | null; position: number; createdAt: string; updatedAt: string }
export interface Comment { id: string; issueId: string; content: string; createdAt: string; updatedAt: string }

export interface FullBoard { board: Board; columns: Column[]; issues: Issue[]; comments: Comment[] }

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error?.message ?? `Request failed: ${res.status}`);
  return data as T;
}

export const api = {
  listBoards: () => req<{ boards: Board[] }>("/api/boards"),
  createBoard: (name: string, description = "") =>
    req<{ board: Board }>("/api/boards", { method: "POST", body: JSON.stringify({ name, description }) }),
  getBoard: (id: string) => req<FullBoard>(`/api/boards/${id}`),
  updateBoard: (id: string, patch: { name?: string; description?: string }) =>
    req<{ board: Board }>(`/api/boards/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteBoard: (id: string) => req<void>(`/api/boards/${id}`, { method: "DELETE" }),

  createColumn: (boardId: string, name: string, color = "#64748B") =>
    req<{ column: Column }>(`/api/boards/${boardId}/columns`, { method: "POST", body: JSON.stringify({ name, color }) }),
  updateColumn: (id: string, patch: { name?: string; color?: string }) =>
    req<{ column: Column }>(`/api/columns/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteColumn: (id: string, mode?: "delete" | "move", targetColumnId?: string) => {
    const q = mode ? `?mode=${mode}${targetColumnId ? `&targetColumnId=${targetColumnId}` : ""}` : "";
    return req<void>(`/api/columns/${id}${q}`, { method: "DELETE" });
  },
  reorderColumns: (boardId: string, orderedIds: string[]) =>
    req<{ columns: Column[] }>(`/api/boards/${boardId}/columns/reorder`, { method: "POST", body: JSON.stringify({ orderedIds }) }),

  createIssue: (boardId: string, columnId: string, title: string, description = "", color: string | null = null) =>
    req<{ issue: Issue }>(`/api/boards/${boardId}/issues`, { method: "POST", body: JSON.stringify({ columnId, title, description, color }) }),
  getIssue: (id: string) => req<{ issue: Issue; comments: Comment[] }>(`/api/issues/${id}`),
  updateIssue: (id: string, patch: { title?: string; description?: string; color?: string | null }) =>
    req<{ issue: Issue }>(`/api/issues/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  moveIssue: (id: string, columnId: string, position: number) =>
    req<{ issue: Issue }>(`/api/issues/${id}/move`, { method: "PATCH", body: JSON.stringify({ columnId, position }) }),
  deleteIssue: (id: string) => req<void>(`/api/issues/${id}`, { method: "DELETE" }),

  addComment: (issueId: string, content: string) =>
    req<{ comment: Comment }>(`/api/issues/${issueId}/comments`, { method: "POST", body: JSON.stringify({ content }) }),
  updateComment: (id: string, content: string) =>
    req<{ comment: Comment }>(`/api/comments/${id}`, { method: "PATCH", body: JSON.stringify({ content }) }),
  deleteComment: (id: string) => req<void>(`/api/comments/${id}`, { method: "DELETE" }),

  exportBoard: async (boardId: string, format: "kanban" | "simple") => {
    const res = await fetch(`/api/boards/${boardId}/export?format=${format}`);
    if (!res.ok) throw new Error("Export failed");
    return res.json();
  },
  importBoard: (json: unknown) =>
    req<{ boardId: string }>(`/api/boards/import`, { method: "POST", body: JSON.stringify(json) }),
};

export const DEFAULT_COLUMN_COLOR = "#64748B";

// Shared palette for columns + issues (auditv1 §3).
export const COLORS = ["#64748B", "#2563EB", "#0891B2", "#16A34A", "#CA8A04", "#EA580C", "#DC2626", "#DB2777", "#7C3AED"];

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
