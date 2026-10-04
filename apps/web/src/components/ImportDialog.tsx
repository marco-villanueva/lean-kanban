import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

// Import dialog (design.md §17): paste or upload JSON, preview, import as new board.
export default function ImportDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{ kind: string; name: string; columns: number; issues: number } | null>(null);
  const [pending, setPending] = useState(false);

  function parse(v: string) {
    setError("");
    setPreview(null);
    if (!v.trim()) return;
    try {
      const json = JSON.parse(v);
      if (json.format === "lean-kanban") {
        setPreview({ kind: "kanban", name: json.board?.name ?? "?", columns: json.columns?.length ?? 0, issues: json.issues?.length ?? 0 });
      } else if (json.name && Array.isArray(json.columns)) {
        const n = json.columns.reduce((a: number, c: any) => a + (c.issues?.length ?? 0), 0);
        setPreview({ kind: "simple", name: json.name, columns: json.columns.length, issues: n });
      } else {
        setError("Unknown format. Expected Kanban JSON or Simple JSON.");
      }
    } catch {
      setError("Invalid JSON.");
    }
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    const v = await f.text();
    setText(v);
    parse(v);
  }

  async function doImport() {
    setError("");
    setPending(true);
    try {
      const data = await api.importBoard(JSON.parse(text));
      await qc.invalidateQueries({ queryKey: ["boards"] });
      onClose();
      nav(`/boards/${data.boardId}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-label="Import board" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <strong>Import board</strong>
          <button className="icon-btn" onClick={onClose} aria-label="Close import">×</button>
        </div>
        <div className="row" style={{ margin: "8px 0" }}>
          <label className="btn">
            Upload JSON
            <input type="file" accept="application/json,.json" hidden
              onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          <span className="muted">or paste below</span>
        </div>
        <textarea className="textarea" rows={8} placeholder='{"name": "Product Board", "columns": [...]}'
          value={text} onChange={(e) => { setText(e.target.value); parse(e.target.value); }}
          aria-label="Import JSON" />
        {error && <div className="error" style={{ marginTop: 8 }}>{error}</div>}
        {preview && (
          <div className="card" style={{ marginTop: 8 }}>
            Preview: <strong>{preview.name}</strong> — {preview.columns} columns, {preview.issues} issues ({preview.kind})
            <div className="muted" style={{ marginTop: 4 }}>Full validation runs when you import.</div>
          </div>
        )}
        <div className="row" style={{ marginTop: 8, justifyContent: "flex-end" }}>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!text.trim() || !preview || pending} onClick={doImport}>
            Import as new board
          </button>
        </div>
      </div>
    </div>
  );
}
