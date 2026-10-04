# Lean Kanban

![CI](https://github.com/marco-villanueva/lean-kanban/actions/workflows/ci.yml/badge.svg)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22-339933)
![pnpm](https://img.shields.io/badge/pnpm-12.8.1-F69220)

Lean Kanban is a small, local-first Kanban application designed around a Lean product-engineering philosophy: solve the current problem clearly, keep the architecture easy to understand, and add complexity only when real use justifies it.

The application combines a traditional browser UI with a Model Context Protocol (MCP) server so humans and AI agents can work with the same boards through the same underlying REST API.

## Why this project exists

Lean Kanban intentionally explores a simple idea:

> Build the smallest clear and maintainable system that solves the current problem, while keeping future change inexpensive.

The repository avoids speculative infrastructure and enterprise abstractions. The current system is a modular but intentionally small monorepo:

~~~text
Human
  |
  v
React + Vite SPA
  |
  | HTTP / JSON
  v
Express REST API
  |
  v
SQLite

AI Agent
  |
  v
MCP server over stdio
  |
  | HTTP / JSON
  v
Same Express REST API
~~~

The MCP server does not contain business logic. It is an adapter over the same API used by the web application.

## Main features

- Create, edit, search and delete boards.
- Create any number of Kanban columns.
- Rename and recolor columns.
- Drag-and-drop column ordering.
- Create, edit, move, reorder and delete issues.
- Optional issue colors.
- Issue descriptions and comments.
- Kanban and compact List views.
- Search issues by title and description.
- Filter by column.
- Full-fidelity Kanban JSON export and import.
- Simpler JSON format intended for people, scripts and LLMs.
- MCP server for agent-driven board operations.
- SQLite persistence with no external database service.
- Integration tests using the Node.js test runner.
- GitHub Actions CI for install, typecheck, tests and build.

## Stack

| Area | Technology |
| --- | --- |
| Frontend | React 18, TypeScript, Vite |
| Data fetching | TanStack Query |
| Drag and drop | dnd-kit |
| Backend | Node.js 22+, Express, TypeScript |
| Validation | Zod |
| Database | SQLite through node:sqlite |
| Agent integration | Model Context Protocol |
| Package manager | pnpm |
| Testing | node:test through tsx |
| CI | GitHub Actions |

## Requirements

- Node.js 22 or newer.
- pnpm 12.8.1.

The repository includes a .node-version file and declares the package manager version in package.json.

## Quick start

Clone the repository and install dependencies:

~~~bash
git clone https://github.com/marco-villanueva/lean-kanban.git
cd lean-kanban
pnpm install --frozen-lockfile
~~~

Start all development workspaces:

~~~bash
pnpm dev
~~~

For normal browser development you can run only API and web:

~~~bash
pnpm dev:api
pnpm dev:web
~~~

Default development endpoints:

| Service | Address |
| --- | --- |
| Web | http://localhost:5173 |
| API | http://127.0.0.1:3001 |
| Health | http://127.0.0.1:3001/api/health |
| MCP | stdio process |

The Vite development server proxies /api requests to the local API.

## Database

The default SQLite database is created automatically at:

~~~text
data/kanban.db
~~~

Run migrations explicitly:

~~~bash
pnpm db:migrate
~~~

Seed a demo board:

~~~bash
pnpm db:seed
~~~

Override the database path:

~~~bash
DB_PATH=/absolute/path/to/kanban.db pnpm dev:api
~~~

The API enables SQLite foreign keys and WAL mode.

## Quality gate

The main local verification command is:

~~~bash
pnpm check
~~~

It runs:

~~~text
typecheck
test
build
~~~

Individual commands are also available:

~~~bash
pnpm typecheck
pnpm test
pnpm build
~~~

CI runs the same quality gate on pushes and pull requests.

## Using the application

The browser UI supports:

1. Create or import a board.
2. Add and configure columns.
3. Create issues inside columns.
4. Drag issues or columns to reorder them.
5. Open an issue to edit its title, description, status, color and comments.
6. Switch between Kanban and List views.
7. Search and filter issues.
8. Export a board as Full Kanban JSON or Simple JSON.

When search or a column filter is active, drag-and-drop reordering is intentionally disabled. This avoids persisting ambiguous positions from a filtered view.

See docs/user-guide.md for the complete user guide.

## MCP for AI agents

Lean Kanban includes an MCP server in apps/mcp.

Build the repository and start the API:

~~~bash
pnpm build
pnpm start:api
~~~

A generic MCP client configuration looks like:

~~~json
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
~~~

A copyable template is available in docs/mcp-client.example.json.

Example agent requests:

~~~text
Create a board called MVP.

Create columns Todo, Doing and Done.

Add an issue called "Draft landing page" to Todo.

Move "Draft landing page" to Doing.

Set that issue color to #CA8A04.

Add the comment "Waiting for copy review".

Export MVP as Simple JSON.
~~~

Important MCP behavior:

- Board, column and issue references can usually be IDs or exact names/titles.
- get_board omits comments by default to reduce token usage.
- get_board can include comments with includeComments: true.
- move_issue appends to the target column if position is omitted.
- import_board accepts an object directly through its data argument.
- delete_board requires confirm: true.
- MCP HTTP calls time out after 10 seconds.
- If the API is unavailable, the MCP server returns an actionable connection error.

See docs/mcp.md for the complete tool reference and recommended agent workflows.

## Import and export

Lean Kanban supports two formats.

### Full Kanban JSON

Designed for faithful backup and reconstruction.

It preserves:

- board name and description;
- columns;
- column colors and ordering;
- issues;
- issue descriptions, colors and ordering;
- comments.

Example:

~~~text
examples/full-board.kanban.json
~~~

### Simple JSON

Designed for interoperability with humans, scripts and LLMs.

Example:

~~~text
examples/simple-board.json
~~~

See docs/import-export.md for the schemas, validation rules and examples.

## Documentation

Complete project documentation lives in docs/.

Start here:

- docs/README.md — documentation index.
- docs/getting-started.md — installation and first run.
- docs/user-guide.md — complete browser UI guide.
- docs/architecture.md — architecture and design decisions.
- docs/data-model.md — SQLite schema and domain model.
- docs/api-reference.md — REST API reference.
- docs/mcp.md — MCP configuration, tools and agent workflows.
- docs/import-export.md — portable JSON formats.
- docs/development.md — repository development guide.
- docs/testing.md — test strategy and CI.
- docs/troubleshooting.md — common problems and recovery steps.
- docs/release-checklist.md — release-candidate verification.
- SECURITY.md — current security model.
- AGENTS.md — instructions for coding and product agents.

## Repository structure

~~~text
lean-kanban/
├── apps/
│   ├── api/          Express REST API and SQLite access
│   ├── web/          React + Vite application
│   └── mcp/          MCP adapter over the REST API
├── docs/             Project documentation
├── examples/         Valid and invalid JSON examples
├── data/             Local SQLite data, ignored by Git
├── .github/
│   └── workflows/    CI
├── AGENTS.md          Agent instructions
├── SECURITY.md        Security notes
└── README.md
~~~

## Security

Lean Kanban currently has no authentication or authorization.

The API binds to 127.0.0.1 by default and is intended for local use. Do not expose the current API to the public Internet or an untrusted network.

Anyone who can reach the API can read, create, modify and delete board data.

See SECURITY.md for details.

## Project principles

The project intentionally prefers:

- REST over GraphQL.
- SQLite over an external database until scaling pressure exists.
- A single API over microservices.
- Explicit feature code over generic framework layers.
- Managed complexity over speculative abstractions.
- A small dependency set.
- Real tests around important workflows instead of arbitrary coverage targets.
- MCP as an adapter over the product API rather than a second domain implementation.

Features currently outside scope include auth, organizations, teams, assignees, priorities, labels, due dates, attachments, realtime collaboration, notifications, analytics, billing, PostgreSQL and remote MCP hosting.

They should be added only when a concrete requirement justifies them.

## Contributing

Issues and pull requests are welcome.

Before submitting a change:

~~~bash
pnpm install --frozen-lockfile
pnpm check
~~~

Keep changes small, preserve the Lean architecture, and avoid introducing dependencies or architectural layers unless they solve a current requirement.

See docs/development.md and AGENTS.md before larger changes.

## License

Lean Kanban is released under the MIT License.

See LICENSE for the full text.

Copyright © 2026 Marco Villanueva.
