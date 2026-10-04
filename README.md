# Lean Kanban

Deliberately simple Kanban: React + Express + SQLite + MCP. No auth, no users, no enterprise layers.

## Architecture

```text
React SPA (apps/web)
  │ HTTP / JSON
  ▼
Express API (apps/api)
  │ node:sqlite
  ▼
SQLite (data/kanban.db)

Agent
  ▼
MCP Server (apps/mcp, stdio) — tiny adapter over the same HTTP API
```

## Requirements

- Node 22+ (uses `node:sqlite`, no native builds)
- pnpm (repo includes `.pnpm-global/` bootstrap if your env blocks global installs)

## Install

```bash
./.pnpm-global/bin/pnpm install
```

## Run

```bash
./.pnpm-global/bin/pnpm dev
# api  : http://localhost:3001
# web  : http://localhost:5173 (proxies /api → :3001)
# mcp  : stdio (API_BASE=http://localhost:3001)
```

Or per app:

```bash
./.pnpm-global/bin/pnpm --filter @lean-kanban/api dev
./.pnpm-global/bin/pnpm --filter @lean-kanban/web dev
./.pnpm-global/bin/pnpm --filter @lean-kanban/mcp dev
```

## Database

SQLite file auto-created at `data/kanban.db` on API start (plain SQL in `apps/api/src/db.ts`, no ORM).

```bash
./.pnpm-global/bin/pnpm --filter @lean-kanban/api db:seed  # Demo Board
rm data/kanban.db*  # clean
```

## Import / Export

- Board page: Export Kanban JSON / Simple JSON (download + Copy JSON for agents).
- Home page: paste JSON → preview (name, #columns, #issues) → Import as new board.
- API:
  - `GET /api/boards/:id/export?format=kanban|simple`
  - `POST /api/boards/import`
- Full format: `{format:"lean-kanban", version:1, board, columns[], issues[]}` with portable ids.
- Simple format: `{name, description?, columns:[{name, color?, issues:[{title, description?, comments:[str]}]}]}`.

## MCP

Stdio server, no business logic (calls HTTP API). Name-or-id resolution for agents:

```bash
API_BASE=http://localhost:3001 ./.pnpm-global/bin/pnpm --filter @lean-kanban/mcp dev
```

Tools: `list_boards get_board create_board update_board delete_board create_column update_column delete_column reorder_columns list_issues get_issue create_issue update_issue move_issue delete_issue list_comments add_comment update_comment delete_comment export_board import_board`.

Example: `create_issue {board:"MVP", column:"Todo", title:"Implement settings page"}`.

## Useful commands

```bash
./.pnpm-global/bin/pnpm --filter @lean-kanban/api exec tsc --noEmit
./.pnpm-global/bin/pnpm --filter @lean-kanban/web exec tsc --noEmit
./.pnpm-global/bin/pnpm --filter @lean-kanban/mcp exec tsc --noEmit
./.pnpm-global/bin/pnpm --filter @lean-kanban/web exec vite build
curl -s http://localhost:3001/api/health
```
