import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

export default function NewBoardDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit() {
    const value = name.trim();
    if (!value) return;

    setError("");
    setPending(true);
    try {
      const data = await api.createBoard(value, description);
      await qc.invalidateQueries({ queryKey: ["boards"] });
      onClose();
      nav(`/boards/${data.board.id}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Create board" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <strong>Create board</strong>
          <button className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>
        {error && <div className="error">{error}</div>}

        <div className="field-label" style={{ marginTop: 8 }}>Name</div>
        <input
          className="input"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          aria-label="Board name"
        />

        <div className="field-label" style={{ marginTop: 8 }}>Description</div>
        <input
          className="input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          aria-label="Board description"
        />

        <div className="row" style={{ marginTop: 12, justifyContent: "flex-end" }}>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!name.trim() || pending} onClick={submit}>Create</button>
        </div>
      </div>
    </div>
  );
}
