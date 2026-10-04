import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api, type Column } from "../api";
import ColorPicker from "./ColorPicker";

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

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

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
    const value = newCol.trim();
    if (!value) return;
    setError("");
    try {
      await api.createColumn(board.id, value);
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
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Board settings" onClick={(e) => e.stopPropagation()}>
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
          {columns.map((column) => (
            <div key={column.id}>
              {editing === column.id ? (
                <div className="col-rename" style={{ marginTop: 6 }}>
                  <input
                    className="input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder={column.name}
                    aria-label="Column name"
                    onKeyDown={(e) => { if (e.key === "Enter") saveCol(column.id); }}
                  />
                  <ColorPicker
                    value={editColor}
                    label="Column color"
                    onChange={(next) => setEditColor(next ?? "#64748B")}
                  />
                  <div className="row">
                    <button className="btn primary" onClick={() => saveCol(column.id)}>Save</button>
                    <button className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="settings-row">
                  <span className="dot" style={{ background: column.color }} />
                  <span className="settings-name">{column.name}</span>
                  <button className="btn-ghost" onClick={() => {
                    setEditing(column.id);
                    setEditName(column.name);
                    setEditColor(column.color);
                  }}>Edit</button>
                  <button className="btn-ghost danger-text" onClick={() => {
                    setMoveTo(columns.find((item) => item.id !== column.id)?.id ?? "");
                    setDelTarget(column.id);
                  }}>Delete</button>
                </div>
              )}

              {delTarget === column.id && (
                <div className="col-confirm" role="dialog" aria-label="Delete column">
                  <span className="muted">Delete “{column.name}”?</span>
                  <select className="select" value={moveTo} onChange={(e) => setMoveTo(e.target.value)} aria-label="Move issues to">
                    {columns.filter((item) => item.id !== column.id).map((item) => (
                      <option key={item.id} value={item.id}>Move issues to {item.name}</option>
                    ))}
                  </select>
                  <div className="row">
                    <button className="btn primary" disabled={!moveTo} onClick={() => delCol(column.id, "move")}>Move issues</button>
                    <button className="btn danger" onClick={() => delCol(column.id, "delete")}>Delete issues too</button>
                    <button className="btn-ghost" onClick={() => setDelTarget(null)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}

          <div className="row" style={{ marginTop: 8 }}>
            <input
              className="input"
              placeholder="+ Add column"
              value={newCol}
              onChange={(e) => setNewCol(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addCol(); }}
              aria-label="New column name"
            />
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
