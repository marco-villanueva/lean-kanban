import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api, COLORS, type Column } from "../api";

// Board settings drawer (design.md §18). Same mutations as the old inline
// panel, only moved out of the main flow. No new features.
export default function BoardSettingsDrawer({ board, columns, onClose, onChanged }: {
  board: { id: string; name: string; description: string };
  columns: Column[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [name, setName] = useState(board.name);
  const [desc, setDesc] = useState(board.description ?? "");
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#64748B");
  const [delTarget, setDelTarget] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState("");
  const [newCol, setNewCol] = useState("");

  async function saveBoard() {
    setError("");
    setSaved("");
    try {
      await api.updateBoard(board.id, { name: name.trim() || board.name, description: desc });
      setSaved("Saved");
      onChanged();
    } catch (e: any) { setError(e.message); }
  }

  async function saveCol(id: string) {
    setError("");
    try {
      await api.updateColumn(id, { name: editName.trim() || undefined, color: editColor });
      setEditing(null);
      onChanged();
    } catch (e: any) { setError(e.message); }
  }

  async function delCol(id: string, mode: "delete" | "move") {
    setError("");
    try {
      await api.deleteColumn(id, mode, mode === "move" ? moveTo : undefined);
      setDelTarget(null);
      onChanged();
    } catch (e: any) { setError(e.message); }
  }

  async function addCol() {
    const t = newCol.trim();
    if (!t) return;
    setError("");
    try {
      await api.createColumn(board.id, t);
      setNewCol("");
      onChanged();
    } catch (e: any) { setError(e.message); }
  }

  async function removeBoard() {
    if (!confirm(`Delete "${board.name}" and all its issues?`)) return;
    await api.deleteBoard(board.id);
    await qc.invalidateQueries({ queryKey: ["boards"] });
    nav("/");
  }

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" role="dialog" aria-label="Board settings" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <strong>Board settings</strong>
          <button className="icon-btn" onClick={onClose} aria-label="Close settings">×</button>
        </div>
        {error && <div className="error">{error}</div>}
        {saved && <div className="menu-note">{saved}</div>}

        <div className="drawer-section">
          <div className="field-label">Name</div>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} aria-label="Board name" />
          <div className="field-label" style={{ marginTop: 8 }}>Description</div>
          <input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} aria-label="Board description" />
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn primary" onClick={saveBoard}>Save</button>
          </div>
        </div>

        <div className="drawer-section">
          <div className="field-label">Columns ({columns.length})</div>
          {columns.map((c) => (
            <div key={c.id}>
              {editing === c.id ? (
                <div className="col-rename" style={{ marginTop: 6 }}>
                  <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)}
                    placeholder={c.name} aria-label="Column name"
                    onKeyDown={(e) => { if (e.key === "Enter") saveCol(c.id); }} />
                  <div className="color-pick">
                    {COLORS.map((col) => (
                      <button key={col} style={{ background: col }} aria-label={`Color ${col}`}
                        className={editColor === col ? "sel" : ""} onClick={() => setEditColor(col)} />
                    ))}
                  </div>
                  <div className="row">
                    <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} aria-label="Custom color" />
                    <button className="btn primary" onClick={() => saveCol(c.id)}>Save</button>
                    <button className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="settings-row">
                  <span className="dot" style={{ background: c.color }} />
                  <span className="settings-name">{c.name}</span>
                  <button className="btn-ghost" onClick={() => { setEditing(c.id); setEditName(c.name); setEditColor(c.color); }}>Rename</button>
                  <button className="btn-ghost danger-text" onClick={() => {
                    setMoveTo(columns.find((x) => x.id !== c.id)?.id ?? "");
                    setDelTarget(c.id);
                  }}>Delete</button>
                </div>
              )}
              {delTarget === c.id && (
                <div className="col-confirm" role="dialog" aria-label="Delete column">
                  <span className="muted">Delete “{c.name}”?</span>
                  <select className="select" value={moveTo} onChange={(e) => setMoveTo(e.target.value)} aria-label="Move issues to">
                    {columns.filter((x) => x.id !== c.id).map((x) => <option key={x.id} value={x.id}>Move issues to {x.name}</option>)}
                  </select>
                  <div className="row">
                    <button className="btn primary" disabled={!moveTo} onClick={() => delCol(c.id, "move")}>Move issues</button>
                    <button className="btn danger" onClick={() => delCol(c.id, "delete")}>Delete issues too</button>
                    <button className="btn-ghost" onClick={() => setDelTarget(null)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          <div className="row" style={{ marginTop: 8 }}>
            <input className="input" placeholder="+ Add column" value={newCol}
              onChange={(e) => setNewCol(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addCol(); }} aria-label="New column name" />
            <button className="btn" disabled={!newCol.trim()} onClick={addCol}>Add</button>
          </div>
        </div>

        <div className="drawer-section">
          <div className="field-label">Danger zone</div>
          <button className="btn danger" onClick={removeBoard}>Delete board</button>
        </div>
      </aside>
    </div>
  );
}
