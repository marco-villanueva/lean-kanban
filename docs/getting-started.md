# Getting Started

This guide takes a clean checkout of Lean Kanban to a working browser UI, REST API and optional MCP server.

## Prerequisites

Required:

- Node.js 22 or newer.
- pnpm 12.8.1.
- Git.

Check versions:

~~~bash
node --version
pnpm --version
git --version
~~~

The repository contains:

~~~text
.node-version
package.json -> packageManager
~~~

These define the expected Node and pnpm versions.

## Clone

~~~bash
git clone https://github.com/marco-villanueva/lean-kanban.git
cd lean-kanban
~~~

## Install dependencies

Use the committed lockfile:

~~~bash
pnpm install --frozen-lockfile
~~~

Using frozen-lockfile is important because it verifies that package.json and pnpm-lock.yaml agree.

If the command reports an outdated or missing lockfile, do not immediately regenerate it. First check that your branch is current:

~~~bash
git status
git pull --ff-only
ls -lh pnpm-lock.yaml
~~~

## First verification

Run the full quality gate:

~~~bash
pnpm check
~~~

This runs:

~~~text
pnpm typecheck
pnpm test
pnpm build
~~~

## Database

The API uses SQLite through Node.js node:sqlite.

Default file:

~~~text
data/kanban.db
~~~

The data directory and database files are ignored by Git.

Run migration explicitly:

~~~bash
pnpm db:migrate
~~~

Expected output:

~~~text
Database migrated
~~~

Seed a demo board if desired:

~~~bash
pnpm db:seed
~~~

## Run development mode

Option A, all workspaces:

~~~bash
pnpm dev
~~~

Option B, browser development only:

Terminal 1:

~~~bash
pnpm dev:api
~~~

Terminal 2:

~~~bash
pnpm dev:web
~~~

Defaults:

~~~text
Web     http://localhost:5173
API     http://127.0.0.1:3001
Health  http://127.0.0.1:3001/api/health
~~~

Check API health:

~~~bash
curl http://127.0.0.1:3001/api/health
~~~

Expected:

~~~json
{"ok":true}
~~~

## Development proxy

The Vite server proxies browser requests beginning with /api to:

~~~text
http://localhost:3001
~~~

This keeps frontend API calls relative, for example:

~~~text
/api/boards
~~~

## Environment variables

A sample file is provided in .env.example.

Supported server variables:

| Variable | Default | Meaning |
| --- | --- | --- |
| HOST | 127.0.0.1 | API bind address |
| PORT | 3001 | API port |
| DB_PATH | data/kanban.db through project-relative resolution | SQLite file |
| API_BASE | http://127.0.0.1:3001 | MCP target API |

Examples:

~~~bash
PORT=4000 pnpm dev:api
~~~

~~~bash
DB_PATH=/tmp/lean-kanban.db pnpm dev:api
~~~

~~~bash
API_BASE=http://127.0.0.1:4000 pnpm dev:mcp
~~~

## Production-style local build

Build all workspaces:

~~~bash
pnpm build
~~~

Start compiled API:

~~~bash
pnpm start:api
~~~

Preview the compiled web application:

~~~bash
pnpm --filter @lean-kanban/web preview
~~~

The project currently keeps web and API serving separate. Express does not serve the Vite dist directory.

## MCP setup

Build first:

~~~bash
pnpm build
pnpm start:api
~~~

Configure your MCP client to launch:

~~~text
node /absolute/path/lean-kanban/apps/mcp/dist/index.js
~~~

with:

~~~text
API_BASE=http://127.0.0.1:3001
~~~

See mcp.md and mcp-client.example.json.

## Reset local data

Stop the API first, then:

~~~bash
rm -f data/kanban.db
rm -f data/kanban.db-wal
rm -f data/kanban.db-shm
pnpm db:migrate
~~~

This permanently deletes local board data.

## Expected first-use flow

1. Open http://localhost:5173.
2. Click New board in the sidebar.
3. Give the board a name and optional description.
4. Add columns.
5. Create issues.
6. Drag issues between columns.
7. Open an issue to add description, color or comments.
8. Try List view.
9. Export the board.
10. Optionally connect an MCP client and operate the same board through an agent.

## Next reading

- user-guide.md for UI behavior.
- mcp.md for agent integration.
- development.md for code changes.
- troubleshooting.md if setup does not work.
