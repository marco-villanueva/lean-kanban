import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { api, DEFAULT_COLUMN_COLOR, downloadJson, type Column, type Issue } from "../api";
import IssueDrawer from "../components/IssueDrawer";
import BoardSettingsDrawer from "../components/BoardSettingsDrawer";
import ColorPicker from "../components/ColorPicker";

export default function BoardPage() {
  const { boardId = "" } = useParams();
  const qc = useQueryClient();
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [activeIssue, setActiveIssue] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterCol, setFilterCol] = useState("");
  const [dragging, setDragging] = useState<{ issue?: Issue } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dndError, setDndError] = useState("");

  const board = useQuery({ queryKey: ["board", boardId], queryFn: () => api.getBoard(boardId) });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const invalidate = () => qc.invalidateQueries({ queryKey: ["board", boardId] });
  const dndDisabled = Boolean(search.trim() || filterCol);

  const moveIssue = useMutation({
    mutationFn: ({ id, columnId, position }: { id: string; columnId: string; position: number }) =>
      api.moveIssue(id, columnId, position),
    onSuccess: () => { setDndError(""); invalidate(); },
    onError: (e: Error) => setDndError(e.message),
  });
  const reorderCols = useMutation({
    mutationFn: (ids: string[]) => api.reorderColumns(boardId, ids),
    onSuccess: () => { setDndError(""); invalidate(); },
    onError: (e: Error) => setDndError(e.message),
  });

  const cols = useMemo(() => [...(board.data?.columns ?? [])].sort((a, b) => a.position - b.position), [board.data]);
  const commentCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of board.data?.comments ?? []) m.set(c.issueId, (m.get(c.issueId) ?? 0) + 1);
    return m;
  }, [board.data]);
  const dragActive = dragging !== null;
  const issuesByCol = useMemo(() => {
    const m = new Map<string, Issue[]>();
    for (const c of cols) m.set(c.id, []);
    for (const i of board.data?.issues ?? []) {
      if (!m.has(i.columnId)) m.set(i.columnId, []);
      m.get(i.columnId)!.push(i);
    }
    for (const [, list] of m) list.sort((a, b) => a.position - b.position);
    return m;
  }, [cols, board.data]);

  function onDragStart(e: DragStartEvent) {
    if (dndDisabled) return;
    const kind = e.active.data.current?.kind;
    if (kind === "issue") setDragging({ issue: e.active.data.current?.issue });
    else setDragging({});
  }

  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    if (dndDisabled) return;

    const { active, over } = e;
    if (!over) return;

    const aKind = active.data.current?.kind;
    const overKind = over.data.current?.kind;

    if (aKind === "column") {
      const from = cols.findIndex((c) => c.id === active.id);
      const targetColumnId = overKind === "column"
        ? String(over.id)
        : overKind === "issue"
          ? (over.data.current?.issue as Issue | undefined)?.columnId
          : undefined;
      const to = targetColumnId ? cols.findIndex((c) => c.id === targetColumnId) : -1;

      if (from < 0 || to < 0 || from === to) return;

      const ids = cols.map((c) => c.id);
      const [moved] = ids.splice(from, 1);
      ids.splice(to, 0, moved);
      reorderCols.mutate(ids);
      return;
    }

    const issue: Issue | undefined = active.data.current?.issue;
    if (!issue) return;

    let targetColId: string;
    let targetIndex: number;

    if (overKind === "column") {
      targetColId = String(over.id);
      targetIndex = (issuesByCol.get(targetColId) ?? []).length;
    } else if (overKind === "issue") {
      const overIssue: Issue | undefined = over.data.current?.issue;
      if (!overIssue) return;

      targetColId = overIssue.columnId;
      const list = [...(issuesByCol.get(targetColId) ?? [])].sort((a, b) => a.position - b.position);
      const overIndex = list.findIndex((i) => i.id === overIssue.id);
      if (overIndex < 0) return;
      targetIndex = overIndex;
    } else {
      return;
    }

    if (issue.columnId === targetColId) {
      const list = issuesByCol.get(targetColId) ?? [];
      const from = list.findIndex((i) => i.id === issue.id);
      if (from === targetIndex) return;
    }

    moveIssue.mutate({ id: issue.id, columnId: targetColId, position: targetIndex });
  }

  if (board.isLoading) return (
    <div className="board-page" aria-label="Loading board">
      <div className="skeleton" style={{ width: 220, height: 20, margin: "8px 0" }} />
      <div className="skeleton" style={{ width: 320, height: 14, marginBottom: 12 }} />
      <div className="skel-board">
        {[0, 1, 2].map((c) => (
          <div key={c} className="skel-col">
            <div className="skeleton" style={{ height: 18 }} />
            <div className="skeleton" style={{ height: 64 }} />
            <div className="skeleton" style={{ height: 64 }} />
          </div>
        ))}
      </div>
    </div>
  );
  if (board.isError || !board.data) return (
    <div className="page">
      <div className="error">Board not found or could not be loaded.</div>
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn primary" onClick={() => board.refetch()}>Try again</button>
        <Link to="/">← Back to boards</Link>
      </div>
    </div>
  );

  const b = board.data.board;
  const normalizedSearch = search.trim().toLowerCase();
  const filtered = (board.data.issues ?? []).filter((i) => {
    if (filterCol && i.columnId !== filterCol) return false;
    if (normalizedSearch && !(i.title + " " + (i.description ?? "")).toLowerCase().includes(normalizedSearch)) return false;
    return true;
  });
  const visibleCols = filterCol ? cols.filter((c) => c.id === filterCol) : cols;
  const visibleIssuesByCol = new Map<string, Issue[]>();
  for (const c of visibleCols) visibleIssuesByCol.set(c.id, []);
  for (const issue of filtered) {
    if (visibleIssuesByCol.has(issue.columnId)) visibleIssuesByCol.get(issue.columnId)!.push(issue);
  }
  for (const list of visibleIssuesByCol.values()) list.sort((a, b) => a.position - b.position);

  const colName = (id: string) => cols.find((c) => c.id === id)?.name ?? "?";
  const colColor = (id: string) => cols.find((c) => c.id === id)?.color ?? "#64748B";

  return (
    <div className="board-page">
      <div className="board-header">
        <div className="breadcrumb">
          <Link to="/">Boards</Link>
          <span aria-hidden="true"> / </span>
          <span>{b.name}</span>
        </div>
        <div className="board-title-row">
          <h1 className="board-title">{b.name}</h1>
          <BoardMenu boardId={boardId} boardName={b.name}
            onOpenSettings={() => setSettingsOpen(true)} />
        </div>
        {b.description && <div className="board-desc">{b.description}</div>}
      </div>

      <div className="board-toolbar">
        <input
          className="input board-search"
          placeholder="Search issues"
          aria-label="Search issues"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="select board-filter"
          value={filterCol}
          onChange={(e) => setFilterCol(e.target.value)}
          aria-label="Filter by column"
        >
          <option value="">All columns</option>
          {cols.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="toolbar-spacer" />
        <CreateIssueButton boardId={boardId} columns={cols} onCreated={invalidate} />
        <div className="tabs" role="tablist" aria-label="Board view">
          <button role="tab" aria-selected={view === "kanban"} className={view === "kanban" ? "active" : ""} onClick={() => setView("kanban")}>Kanban</button>
          <button role="tab" aria-selected={view === "list" ? true : false} className={view === "list" ? "active" : ""} onClick={() => setView("list")}>List</button>
        </div>
      </div>

      {dndError && <div className="error" style={{ marginBottom: 8 }}>{dndError}</div>}
      {view === "kanban" && dndDisabled && (
        <div className="muted" style={{ marginBottom: 8 }}>
          Clear search and column filters to drag and reorder.
        </div>
      )}

      {view === "list" && (
        <div className="list-wrap">
          <table className="table table-compact">
            <thead><tr><th>Issue</th><th>Status</th><th>Comments</th><th>Updated</th></tr></thead>
            <tbody>
              {filtered.map((i) => (
                <tr key={i.id} className="list-row" tabIndex={0}
                  onClick={() => setActiveIssue(i.id)}
                  onKeyDown={(e) => { if (e.key === "Enter") setActiveIssue(i.id); }}>
                  <td>
                    <div className="list-title">
                      {i.color && <span className="dot" style={{ background: i.color }} aria-hidden="true" />}
                      {i.title}
                    </div>
                    {i.description && <div className="muted">{i.description.slice(0, 80)}</div>}
                  </td>
                  <td>
                    <span className="status-badge">
                      <span className="dot" style={{ background: colColor(i.columnId) }} aria-hidden="true" />
                      {colName(i.columnId)}
                    </span>
                  </td>
                  <td className="muted">{commentCounts.get(i.id) ?? 0}</td>
                  <td className="muted">{new Date(i.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="empty">No issues yet. Create your first issue.</div>}
        </div>
      )}

      {view === "kanban" && (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <SortableContext items={visibleCols.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
            <div className="kanban">
              {visibleCols.map((c) => (
                <KanbanColumn key={c.id} column={c} issues={visibleIssuesByCol.get(c.id) ?? []}
                  commentCounts={commentCounts} selectedId={activeIssue} dragActive={dragActive}
                  allColumns={cols} dndDisabled={dndDisabled}
                  onOpen={setActiveIssue} onChanged={invalidate} />
              ))}
              {!filterCol && <AddColumn boardId={boardId} onChanged={invalidate} />}
            </div>
          </SortableContext>
          <DragOverlay>
            {dragging?.issue ? <div className="issue"><h4>{dragging.issue.title}</h4></div> : null}
          </DragOverlay>
        </DndContext>
      )}

      {settingsOpen && (
        <BoardSettingsDrawer
          board={{ id: boardId, name: b.name, description: b.description ?? "" }}
          columns={cols}
          onClose={() => { setSettingsOpen(false); invalidate(); }}
          onChanged={invalidate}
        />
      )}
      {activeIssue && (
        <IssueDrawer
          issueId={activeIssue}
          columns={cols}
          onClose={() => { setActiveIssue(null); invalidate(); }}
          onChanged={invalidate}
        />
      )}
    </div>
  );
}

function KanbanColumn({ column, issues, commentCounts, selectedId, dragActive, allColumns, dndDisabled, onOpen, onChanged }: {
  column: Column; issues: Issue[]; commentCounts: Map<string, number>; selectedId: string | null;
  dragActive: boolean; allColumns: Column[]; dndDisabled: boolean;
  onOpen: (id: string) => void; onChanged: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: column.id,
    data: { kind: "column" },
    disabled: dndDisabled,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const { setNodeRef: setDropRef, isOver } = useDroppableColumn(column.id, dndDisabled);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(column.name);
  const [color, setColor] = useState(column.color);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [moveTo, setMoveTo] = useState("");
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const menuRef = useCloseOnOutside(menuOpen, () => setMenuOpen(false));

  async function saveRename() {
    setError("");
    try {
      await api.updateColumn(column.id, { name: name.trim() || undefined, color });
      setRenaming(false);
      onChanged();
    } catch (e: any) { setError(e.message); }
  }

  async function del(mode: "delete" | "move") {
    setError("");
    try {
      await api.deleteColumn(column.id, mode, mode === "move" ? moveTo : undefined);
      setConfirmingDelete(false);
      onChanged();
    } catch (e: any) { setError(e.message); }
  }

  async function addIssue() {
    const t = draft.trim();
    if (!t) return;
    setError("");
    try {
      await api.createIssue(column.boardId, column.id, t);
      setDraft("");
      setComposing(false);
      onChanged();
    } catch (e: any) { setError(e.message); }
  }

  return (
    <div ref={setNodeRef} style={style} className={`column${isOver ? " drop-target" : ""}`}>
      <div className="column-top" style={{ background: column.color }} aria-hidden="true" />
      {renaming ? (
        <div className="col-rename">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} aria-label="Column name"
            onKeyDown={(e) => { if (e.key === "Enter") saveRename(); if (e.key === "Escape") setRenaming(false); }} />
          <ColorPicker
            value={color}
            defaultColor={DEFAULT_COLUMN_COLOR}
            label="Column color"
            onChange={(next) => setColor(next ?? DEFAULT_COLUMN_COLOR)}
          />
          <div className="row">
            <button className="btn primary" onClick={saveRename}>Save</button>
            <button className="btn-ghost" onClick={() => setRenaming(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <header {...attributes} {...listeners} style={{ cursor: "grab" }}>
          <span className="dot" style={{ background: column.color }} />
          <span className="col-title" title={column.name}>{column.name}</span>
          <span className="col-count">{issues.length}</span>
          <div className="menu-wrap" ref={menuRef}>
            <button className="icon-btn col-menu" aria-label={`Column ${column.name} actions`}
              aria-haspopup="menu" aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              onPointerDown={(e) => e.stopPropagation()}>
              ⋯
            </button>
            {menuOpen && (
              <div className="menu" role="menu">
                <button className="menu-item" role="menuitem" onClick={() => { setName(column.name); setColor(column.color); setRenaming(true); setMenuOpen(false); }}>Edit column</button>
                <div className="menu-divider" />
                <button className="menu-item danger" role="menuitem" onClick={() => {
                  setMenuOpen(false);
                  setMoveTo(allColumns.find((c) => c.id !== column.id)?.id ?? "");
                  setConfirmingDelete(true);
                }}>Delete column</button>
              </div>
            )}
          </div>
        </header>
      )}
      {error && <div className="error" style={{ marginBottom: 8 }}>{error}</div>}
      {confirmingDelete && (
        <div className="col-confirm" role="dialog" aria-label="Delete column">
          {issues.length > 0 ? (
            <>
              <div className="muted">Column has {issues.length} issue(s).</div>
              <select className="select" value={moveTo} onChange={(e) => setMoveTo(e.target.value)} aria-label="Move issues to">
                {allColumns.filter((c) => c.id !== column.id).map((c) => <option key={c.id} value={c.id}>Move to {c.name}</option>)}
              </select>
              <div className="row">
                <button className="btn primary" disabled={!moveTo} onClick={() => del("move")}>Move</button>
                <button className="btn danger" onClick={() => del("delete")}>Delete all</button>
                <button className="btn-ghost" onClick={() => setConfirmingDelete(false)}>Cancel</button>
              </div>
            </>
          ) : (
            <div className="row">
              <span className="muted">Delete this column?</span>
              <button className="btn danger" onClick={() => del("delete")}>Delete</button>
              <button className="btn-ghost" onClick={() => setConfirmingDelete(false)}>Cancel</button>
            </div>
          )}
        </div>
      )}
      <div ref={setDropRef} className="col-cards">
        <SortableContext items={issues.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {issues.map((i) => (
            <KanbanCard key={i.id} issue={i} comments={commentCounts.get(i.id) ?? 0}
              selected={selectedId === i.id} dndDisabled={dndDisabled} onOpen={onOpen} />
          ))}
        </SortableContext>
        {issues.length === 0 && dragActive && <div className="drop-hint">Drop here</div>}
        {issues.length === 0 && !dragActive && <div className="col-empty">No issues</div>}
      </div>
      {composing ? (
        <div className="add-form">
          <input className="input" autoFocus placeholder="Issue title" value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addIssue(); if (e.key === "Escape") setComposing(false); }} />
          <div className="row">
            <button className="btn primary" disabled={!draft.trim()} onClick={addIssue}>Create</button>
            <button className="btn-ghost" onClick={() => setComposing(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="add-ghost" onClick={() => setComposing(true)}>+ Create issue</button>
      )}
    </div>
  );
}

function AddColumn({ boardId, onChanged }: { boardId: string; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  async function submit() {
    const t = name.trim();
    if (!t) return;
    try {
      await api.createColumn(boardId, t);
      setName("");
      setOpen(false);
      onChanged();
    } catch (e: any) { setError(e.message); }
  }
  if (!open) return <button className="column-add-ghost" onClick={() => setOpen(true)}>+ Add column</button>;
  return (
    <div className="column column-add">
      <input className="input" autoFocus placeholder="Column name" value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") setOpen(false); }} />
      {error && <div className="error">{error}</div>}
      <div className="row">
        <button className="btn primary" disabled={!name.trim()} onClick={submit}>Add</button>
        <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}

import { useDroppable } from "@dnd-kit/core";
function useDroppableColumn(id: string, disabled = false) {
  return useDroppable({ id, data: { kind: "column" }, disabled });
}

function KanbanCard({ issue, comments, selected, dndDisabled, onOpen }: {
  issue: Issue; comments: number; selected: boolean; dndDisabled: boolean; onOpen: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: issue.id,
    data: { kind: "issue", issue },
    disabled: dndDisabled,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    borderLeftColor: issue.color ?? "transparent",
  };
  return (
    <div
      ref={setNodeRef} style={style} {...attributes} {...listeners}
      className={`issue issue-colored${isDragging ? " dragging" : ""}${selected ? " selected" : ""}`}
      onClick={() => onOpen(issue.id)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(issue.id); } }}
      role="button" tabIndex={0} aria-label={issue.title}
    >
      <h4>{issue.title}</h4>
      {issue.description && <p>{issue.description}</p>}
      <div className="card-meta">
        <span className="card-id">#{issue.id.slice(0, 4)}</span>
        {comments > 0 && <span aria-label={`${comments} comments`}>💬 {comments}</span>}
        <span className="card-date">{new Date(issue.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
      </div>
    </div>
  );
}

function useCloseOnOutside(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  return ref;
}

function BoardMenu({ boardId, boardName, onOpenSettings }: {
  boardId: string; boardName: string; onOpenSettings: () => void;
}) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const ref = useCloseOnOutside(open, () => setOpen(false));

  async function exp(format: "kanban" | "simple", download: boolean) {
    setMsg("");
    try {
      const data = await api.exportBoard(boardId, format);
      if (download) downloadJson(`${boardName}.${format === "kanban" ? "kanban.json" : "json"}`, data);
      else {
        await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        setMsg("Copied");
        setTimeout(() => setOpen(false), 600);
        return;
      }
    } catch (e: any) {
      setMsg(e.message);
      return;
    }
    setOpen(false);
  }

  async function remove() {
    if (!confirm(`Delete "${boardName}" and all its issues?`)) return;
    await api.deleteBoard(boardId);
    await qc.invalidateQueries({ queryKey: ["boards"] });
    nav("/");
  }

  function gotoSettings() {
    setOpen(false);
    onOpenSettings();
  }

  return (
    <div className="menu-wrap" ref={ref}>
      <button
        className="icon-btn"
        aria-label="Board actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => { setMsg(""); setOpen((v) => !v); }}
      >
        •••
      </button>
      {open && (
        <div className="menu" role="menu">
          <button className="menu-item" role="menuitem" onClick={gotoSettings}>Board settings</button>
          <div className="menu-divider" />
          <button className="menu-item" role="menuitem" onClick={() => exp("kanban", true)}>Export Kanban JSON</button>
          <button className="menu-item" role="menuitem" onClick={() => exp("simple", true)}>Export Simple JSON</button>
          <button className="menu-item" role="menuitem" onClick={() => exp("kanban", false)}>Copy JSON</button>
          <div className="menu-divider" />
          <button className="menu-item danger" role="menuitem" onClick={remove}>Delete board</button>
          {msg && <div className="menu-note">{msg}</div>}
        </div>
      )}
    </div>
  );
}

function CreateIssueButton({ boardId, columns, onCreated }: { boardId: string; columns: Column[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [columnId, setColumnId] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const ref = useCloseOnOutside(open, () => setOpen(false));

  async function submit() {
    const t = title.trim();
    const col = columnId || columns[0]?.id;
    if (!t || !col) return;

    setError("");
    try {
      await api.createIssue(boardId, col, t);
      setTitle("");
      setOpen(false);
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create issue.");
    }
  }

  return (
    <div className="menu-wrap" ref={ref}>
      <button className="btn primary" aria-haspopup="dialog" aria-expanded={open} onClick={() => { setError(""); setColumnId(columns[0]?.id ?? ""); setOpen((v) => !v); }}>
        + Create
      </button>
      {open && (
        <div className="popover" role="dialog" aria-label="Create issue">
          <select className="select" value={columnId} onChange={(e) => setColumnId(e.target.value)} aria-label="Column">
            {columns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {error && <div className="error">{error}</div>}
          <input
            className="input"
            autoFocus
            placeholder="Issue title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") setOpen(false);
            }}
          />
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn primary" disabled={!title.trim() || !columns.length} onClick={submit}>Create</button>
          </div>
        </div>
      )}
    </div>
  );
}
