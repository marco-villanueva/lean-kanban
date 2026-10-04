# Lean Kanban

A deliberately small Kanban board built to test Lean product engineering in practice.

- React + Vite SPA
- Express REST API
- SQLite through `node:sqlite`
- MCP adapter for AI agents
- Full and Simple JSON portability
- No auth, users, teams, queues, Redis, ORM, SSR or microservices

The project intentionally favors understandable code and cheap change over speculative architecture.

## Architecture

```text
Browser
  │
  ▼
React SPA (apps/web)
  │ HTTP / JSON
  ▼
Express API (apps/api)
  │
  ▼
SQLite (data/kanban.db)

Agent
  │ stdio
  ▼
MCP Server (apps/mcp)
  │ HTTP / JSON
  └──────────────► Express API
```

The MCP server is only an adapter. Business behavior stays in the REST API.

## Requirements

- Node.js 22+
- pnpm 12.8.1

The repository declares both in `.node-version` and `packageManager`.

## Quick start

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Development services:

- Web: http://localhost:5173
- API: http://127.0.0.1:3001
- Vite proxies `/api` to the API
- MCP uses stdio and calls `API_BASE`

For normal browser development you can run only web + API:

```bash
pnpm dev:api
pnpm dev:web
```

Health check:

```bash
curl http://127.0.0.1:3001/api/health
```

## Useful commands

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm check

pnpm db:migrate
pnpm db:seed
pnpm start:api
```

`pnpm check` is the local quality gate and runs typecheck, tests and build.

## Database

The default database is:

```text
data/kanban.db
```

It is created and migrated automatically when the API starts.

To use another database:

```bash
DB_PATH=/absolute/path/kanban.db pnpm dev:api
```

To reset local development data:

```bash
rm data/kanban.db*
pnpm db:migrate
```

## Core behavior

A board contains:

```text
Board
  ├── Columns
  │    └── Issues
  │         └── Comments
```

Supported UI flows include:

- create, edit and delete boards;
- configurable columns and colors;
- drag-and-drop column ordering;
- create, edit, color, reorder and move issues;
- issue descriptions and comments;
- Kanban and compact List views;
- search and column filter;
- Full JSON export/import;
- Simple JSON export/import.

Dragging is intentionally disabled while search or a column filter is active so filtered views cannot create ambiguous persisted ordering.

## Import / Export

### Full Kanban JSON

Intended for faithful backup and reconstruction.

```json
{
  "format": "lean-kanban",
  "version": 1,
  "board": {
    "name": "Product",
    "description": ""
  },
  "columns": [],
  "issues": []
}
```

It preserves:

- board metadata;
- column order and colors;
- issues;
- issue order and colors;
- descriptions;
- comments.

Example:

```text
examples/full-board.kanban.json
```

### Simple JSON

Intended for people, scripts and LLMs.

```json
{
  "name": "Product",
  "columns": [
    {
      "name": "Todo",
      "color": "#2563EB",
      "issues": [
        {
          "title": "Draft copy",
          "comments": ["Keep it short"]
        }
      ]
    }
  ]
}
```

Example:

```text
examples/simple-board.json
```

Invalid fixtures are also included for validation work.

## MCP

The MCP server uses stdio and talks to the existing REST API.

Build it first:

```bash
pnpm build
pnpm start:api
```

Generic MCP client configuration:

```json
{
  "mcpServers": {
    "lean-kanban": {
      "command": "node",
      "args": [
        "/ABSOLUTE/PATH/lean-kanban/apps/mcp/dist/index.js"
      ],
      "env": {
        "API_BASE": "http://127.0.0.1:3001"
      }
    }
  }
}
```

A copyable template is available at:

```text
docs/mcp-client.example.json
```

### MCP behavior

Tools accept ids and, where useful, exact names or titles.

Examples:

```text
Create a board "MVP".

Create columns Todo, Doing and Done.

Create an issue "Build landing page" in Todo.

Move "Build landing page" to Doing.

Set "Build landing page" to #CA8A04.

Add the comment "Waiting for copy review".

Export MVP as Simple JSON.
```

Important MCP details:

- `get_board` omits comments by default to reduce tokens;
- pass `includeComments: true` only when needed;
- `move_issue` appends to the target column when `position` is omitted;
- `import_board` accepts the JSON object directly in `data`;
- `delete_board` requires `confirm: true`;
- requests time out after 10 seconds;
- connection errors explain how to start or configure the API.

Current tools:

```text
list_boards
get_board
create_board
update_board
delete_board

create_column
update_column
delete_column
reorder_columns

list_issues
get_issue
create_issue
update_issue
move_issue
delete_issue

list_comments
add_comment
update_comment
delete_comment

export_board
import_board
```

## Testing

The API integration suite uses the Node.js test runner through `tsx`; no additional test framework is required.

Coverage focuses on product-critical behavior:

- board CRUD;
- column ordering and deletion;
- issue ordering and moves;
- comments;
- validation;
- Full JSON round-trip;
- Simple JSON round-trip;
- invalid imports.

Run:

```bash
pnpm test
```

## CI

GitHub Actions runs on pushes and pull requests:

```text
install --frozen-lockfile
typecheck
test
build
```

Workflow:

```text
.github/workflows/ci.yml
```

## Security model

Lean Kanban currently has **no authentication or authorization**.

The API binds to `127.0.0.1` by default. Keep it local unless authentication and an explicit deployment security model are added.

Do not expose the current API directly to the public Internet or an untrusted network.

See `SECURITY.md`.

## Production status

The current target is a local single-user application and agent tool.

The web and API remain separately built:

```bash
pnpm build
pnpm start:api
pnpm --filter @lean-kanban/web preview
```

Serving the SPA from Express is intentionally deferred until there is a concrete deployment requirement.

## Project structure

```text
apps/
├── api/
├── web/
└── mcp/

examples/
docs/
.github/workflows/
```

The project should remain understandable by browsing these directories directly. New architectural layers should be added only when real product pressure justifies them.
