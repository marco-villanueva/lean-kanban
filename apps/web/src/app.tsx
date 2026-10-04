import { useState } from "react";
import { Routes, Route, Link, NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import BoardsPage from "./pages/BoardsPage";
import BoardPage from "./pages/BoardPage";
import NewBoardDialog from "./components/NewBoardDialog";
import { api } from "./api";

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [newBoardOpen, setNewBoardOpen] = useState(false);
  return (
    <div className="appshell">
      <header className="topbar">
        <div className="row">
          <button
            className="icon-btn hamburger"
            aria-label="Toggle boards navigation"
            onClick={() => setSidebarOpen((v) => !v)}
          >
            ☰
          </button>
          <Link to="/" style={{ color: "inherit" }} aria-label="Lean Kanban home">
            <h1>▦ Lean Kanban</h1>
          </Link>
        </div>
      </header>
      <div className="shell-body">
        <div
          className={`sidebar-backdrop${sidebarOpen ? " open" : ""}`}
          onClick={() => setSidebarOpen(false)}
        />
        <Sidebar
          open={sidebarOpen}
          onNavigate={() => setSidebarOpen(false)}
          onNewBoard={() => { setSidebarOpen(false); setNewBoardOpen(true); }}
        />
        <main className="shell-main">
          <Routes>
            <Route path="/" element={<BoardsPage onNewBoard={() => setNewBoardOpen(true)} />} />
            <Route path="/boards/:boardId" element={<BoardPage />} />
          </Routes>
        </main>
      </div>
      {newBoardOpen && <NewBoardDialog onClose={() => setNewBoardOpen(false)} />}
    </div>
  );
}

function Sidebar({ open, onNavigate, onNewBoard }: { open: boolean; onNavigate: () => void; onNewBoard: () => void }) {
  const boards = useQuery({ queryKey: ["boards"], queryFn: api.listBoards });
  return (
    <nav className={`sidebar${open ? " open" : ""}`} aria-label="Boards">
      <div className="sidebar-section">Boards</div>
      <div className="sidebar-new">
        <button className="btn" onClick={onNewBoard}>+ New board</button>
      </div>
      {boards.isLoading && <div className="muted" style={{ padding: "4px 8px" }}>Loading…</div>}
      {(boards.data?.boards ?? []).map((b) => (
        <NavLink
          key={b.id}
          to={`/boards/${b.id}`}
          onClick={onNavigate}
          className={({ isActive }) => `board-link${isActive ? " active" : ""}`}
          title={b.name}
        >
          {b.name}
        </NavLink>
      ))}
      {boards.data && boards.data.boards.length === 0 && (
        <div className="muted" style={{ padding: "4px 8px" }}>No boards yet.</div>
      )}
    </nav>
  );
}
