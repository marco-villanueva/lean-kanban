import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import ImportDialog from "../components/ImportDialog";

export default function BoardsPage({ onNewBoard }: { onNewBoard: () => void }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const boards = useQuery({ queryKey: ["boards"], queryFn: api.listBoards });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteBoard(id),
    onSuccess: () => { setMenuFor(null); qc.invalidateQueries({ queryKey: ["boards"] }); },
  });

  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest?.(".menu-wrap")) setMenuFor(null);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const q = search.trim().toLowerCase();
  const list = (boards.data?.boards ?? []).filter((b) =>
    !q || b.name.toLowerCase().includes(q) || (b.description ?? "").toLowerCase().includes(q));

  return (
    <div className="page page--narrow">
      <div className="boards-head">
        <h1 className="boards-title">Boards</h1>
        <div className="row">
          <input
            className="input boards-search"
            placeholder="Search boards…"
            aria-label="Search boards"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="btn" onClick={() => setImportOpen(true)}>Import</button>
          <button className="btn primary" onClick={onNewBoard}>+ New board</button>
        </div>
      </div>

      {boards.isLoading && (
        <div className="grid-boards" aria-label="Loading boards">
          {[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 110 }} />)}
        </div>
      )}
      {boards.isError && (
        <div>
          <div className="error">Failed to load boards. Is the API running on :3001?</div>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn primary" onClick={() => boards.refetch()}>Try again</button>
          </div>
        </div>
      )}
      {boards.data && list.length === 0 && (
        <div className="card empty" style={{ marginTop: 16 }}>
          <p><strong>{q ? "No boards match." : "No boards yet."}</strong></p>
          {!q && (
            <>
              <p>Create your first board or import one.</p>
              <div className="row" style={{ justifyContent: "center" }}>
                <button className="btn primary" onClick={onNewBoard}>Create board</button>
                <button className="btn" onClick={() => setImportOpen(true)}>Import JSON</button>
              </div>
            </>
          )}
        </div>
      )}
      <div className="grid-boards" ref={menuRef}>
        {list.map((b) => (
          <article
            key={b.id}
            className="card board-card"
            onClick={() => nav(`/boards/${b.id}`)}
            onKeyDown={(e) => { if (e.key === "Enter") nav(`/boards/${b.id}`); }}
            tabIndex={0}
            role="link"
            aria-label={`Open ${b.name}`}
          >
            <div className="board-card-top">
              <strong className="board-card-name">{b.name}</strong>
              <div className="menu-wrap" onClick={(e) => e.stopPropagation()}>
                <button className="icon-btn" aria-label={`Actions for ${b.name}`}
                  aria-haspopup="menu" aria-expanded={menuFor === b.id}
                  onClick={() => setMenuFor(menuFor === b.id ? null : b.id)}>
                  ⋯
                </button>
                {menuFor === b.id && (
                  <div className="menu" role="menu">
                    <button className="menu-item" role="menuitem" onClick={() => { setMenuFor(null); nav(`/boards/${b.id}`); }}>Open</button>
                    <div className="menu-divider" />
                    <button className="menu-item danger" role="menuitem" onClick={() => {
                      if (confirm(`Delete "${b.name}" and all its issues?`)) remove.mutate(b.id);
                    }}>Delete</button>
                  </div>
                )}
              </div>
            </div>
            <div className="muted">{b.description || "—"}</div>
          </article>
        ))}
      </div>

      {importOpen && <ImportDialog onClose={() => setImportOpen(false)} />}
    </div>
  );
}
