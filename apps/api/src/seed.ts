import { db, migrate, nowIso } from "./db.js";

migrate();

const existing = db.prepare("SELECT COUNT(*) as n FROM boards").get() as any;
if ((existing.n as number) > 0) {
  console.log("Seed skipped: boards already exist. Delete data/kanban.db to reseed.");
  process.exit(0);
}

const now = nowIso();
const boardId = crypto.randomUUID();
db.prepare("INSERT INTO boards (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(
  boardId, "Demo Board", "Small seed to try the app. Delete me anytime.", now, now
);

const cols = [
  { name: "Backlog", color: "#64748B" },
  { name: "Todo", color: "#3B82F6" },
  { name: "Doing", color: "#F59E0B" },
  { name: "Done", color: "#10B981" },
];
const colIds: string[] = [];
cols.forEach((c, i) => {
  const id = crypto.randomUUID();
  colIds.push(id);
  db.prepare("INSERT INTO columns (id, board_id, name, color, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    id, boardId, c.name, c.color, i, now, now
  );
});

const issues: Array<[number, string, string]> = [
  [0, "Landing page copy", "Draft the hero copy for the landing page."],
  [0, "Collect 5 user interviews", "Ask about current workflow."],
  [1, "Create API", "Boards + columns + issues endpoints."],
  [1, "Design homepage", "Simple, clean, fast."],
  [2, "Implement drag & drop", "dnd-kit, persist position immediately."],
  [3, "Setup repo", "Monorepo with web + api + mcp."],
];

issues.forEach(([ci, title, desc], i) => {
  const id = crypto.randomUUID();
  db.prepare("INSERT INTO issues (id, board_id, column_id, title, description, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
    id, boardId, colIds[ci], title, desc, i % 2, now, now
  );
  if (i === 2) {
    db.prepare("INSERT INTO comments (id, issue_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(
      crypto.randomUUID(), id, "Start with mobile version.", now, now
    );
  }
});

console.log(`Seeded Demo Board (${boardId})`);
