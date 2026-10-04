# Architecture

Lean Kanban is intentionally designed as a small local-first application with one source of business behavior: the Express REST API.

## Architectural goals

The architecture optimizes for:

- low conceptual overhead;
- easy local development;
- cheap changes;
- explicit data flow;
- minimal infrastructure;
- useful AI-agent integration without duplicating domain logic.

The project deliberately does not optimize for hypothetical enterprise scale.

## System overview

~~~text
                         +----------------------+
                         |      Human user      |
                         +----------+-----------+
                                    |
                                    v
                         +----------------------+
                         | React + Vite SPA     |
                         | apps/web             |
                         +----------+-----------+
                                    |
                              HTTP / JSON
                                    |
                                    v
+------------------+      +----------------------+      +------------------+
| AI Agent / LLM   | ---> | MCP server          | ---> | Express REST API |
+------------------+ stdio| apps/mcp             | HTTP | apps/api         |
                           +----------------------+      +--------+---------+
                                                                 |
                                                                 v
                                                        +------------------+
                                                        | SQLite           |
                                                        | node:sqlite      |
                                                        +------------------+
~~~

Both browser and agent operations converge on the same API.

## Monorepo layout

~~~text
apps/
├── api/
│   ├── app.ts
│   ├── server.ts
│   ├── db.ts
│   ├── validation.ts
│   ├── boards.ts
│   ├── columns.ts
│   ├── issues.ts
│   ├── comments.ts
│   ├── import-export.ts
│   ├── migrate.ts
│   ├── seed.ts
│   └── core.test.ts
├── web/
│   ├── api.ts
│   ├── app.tsx
│   ├── pages/
│   └── components/
└── mcp/
    └── src/index.ts
~~~

## Frontend

The frontend is a React 18 SPA built with Vite.

Responsibilities:

- presentation;
- interaction state;
- drag-and-drop;
- local search/filter presentation;
- calls to the REST API;
- query invalidation and refetching through TanStack Query.

The frontend does not access SQLite and does not implement a second domain layer.

### React Query

TanStack Query owns remote-data fetching and cache invalidation.

Important query identities include:

~~~text
["boards"]
["board", boardId]
["issue", issueId]
~~~

Mutations typically invalidate the smallest relevant query after success.

### Drag-and-drop

dnd-kit handles:

- issue reorder;
- issue moves between columns;
- column reorder;
- keyboard drag support.

The REST API remains authoritative for persisted position values.

When a search or column filter is active, DnD is disabled to avoid ambiguous ordering against a partial view.

## REST API

Express is the central application boundary.

Responsibilities:

- validate input;
- resolve domain constraints;
- mutate SQLite;
- renumber ordering where required;
- enforce safe column deletion behavior;
- import/export;
- provide consistent HTTP responses.

There is intentionally no controller/service/repository class hierarchy.

Files are grouped by domain feature because the codebase is still small enough that additional indirection would reduce clarity.

## Application bootstrap

apps/api/src/app.ts:

- runs migration;
- creates Express;
- enables CORS;
- configures JSON body parsing;
- installs request logging;
- registers health and feature routers;
- handles 404;
- handles invalid JSON and unexpected errors.

apps/api/src/server.ts:

- reads HOST and PORT;
- starts the HTTP listener.

The split lets tests import the Express app without automatically binding a fixed port.

## SQLite

SQLite is accessed directly through node:sqlite.

Reasons:

- zero external service;
- one local file;
- sufficient concurrency for current single-user scope;
- SQL remains visible;
- no ORM abstraction needed.

Configuration:

~~~text
PRAGMA journal_mode = WAL
PRAGMA foreign_keys = ON
~~~

Default database:

~~~text
data/kanban.db
~~~

The path can be overridden with DB_PATH.

## Transactions

The database module provides a deliberately small transaction helper:

~~~text
BEGIN
  operation
COMMIT
~~~

On failure:

~~~text
ROLLBACK
rethrow original error
~~~

Transactions are used for multi-row operations such as:

- moving/deleting columns;
- issue reorder;
- imports.

## Schema evolution

The current migration strategy is intentionally minimal.

Base tables are created with CREATE TABLE IF NOT EXISTS.

The issue color column is detected through PRAGMA table_info and added only when missing.

This is appropriate for the current early project stage.

If schema evolution becomes frequent or requires irreversible transformations, introduce ordered migration files then. Do not add a migration framework before that pressure exists.

## Validation

Zod schemas live in apps/api/src/validation.ts for constraints reused across multiple routes.

Current limits:

| Field | Rule |
| --- | --- |
| Board name | 1–120 after trim |
| Board description | up to 2000 |
| Column name | 1–80 after trim |
| Color | #RRGGBB |
| Issue title | 1–200 after trim |
| Issue description | up to 8000 |
| Comment | 1–4000 after trim |

Import/export adds portable-ID and structural validation.

## MCP architecture

The MCP server is intentionally an adapter.

~~~text
Agent command
   |
   v
MCP tool schema
   |
   v
Resolve board / column / issue reference
   |
   v
Call REST endpoint
   |
   v
Return API result
~~~

It must not become an independent implementation of board rules.

Examples:

- create_issue calls POST /api/boards/:boardId/issues;
- move_issue calls PATCH /api/issues/:issueId/move;
- import_board calls POST /api/boards/import.

This keeps human UI and agents consistent.

## Name resolution in MCP

For convenience, agents may reference:

- board by UUID or exact name;
- column by UUID or exact name within a board;
- issue by UUID or exact title within a board.

If an exact name/title is ambiguous, MCP asks the caller to use the ID.

This convenience belongs in the adapter because REST remains ID-oriented.

## Import/export boundary

Portable JSON is a product feature, not a database dump.

Full Kanban JSON represents semantic board content while intentionally replacing internal UUIDs with portable IDs.

This means exports are:

- movable;
- readable;
- reconstructable;
- decoupled from a specific SQLite instance.

See import-export.md.

## Security boundary

There is currently no authentication or authorization.

The default API host is:

~~~text
127.0.0.1
~~~

This is a deliberate local-only safety boundary.

CORS is enabled in the Express application because browser development currently uses a separate Vite origin. This must not be mistaken for an authorization mechanism.

Do not expose the API publicly in its current form.

## Error model

Expected API errors use:

~~~json
{
  "error": {
    "code": "SOME_CODE",
    "message": "Human-readable detail"
  }
}
~~~

Examples:

~~~text
BOARD_NOT_FOUND
COLUMN_NOT_FOUND
COLUMN_HAS_ISSUES
ISSUE_NOT_FOUND
COMMENT_NOT_FOUND
INVALID_BODY
INVALID_IMPORT
INVALID_FORMAT
INVALID_JSON
NOT_FOUND
INTERNAL_ERROR
~~~

## Ordering model

Columns and issues use integer positions.

Columns:

~~~text
0, 1, 2, 3...
~~~

Issues are positioned within a column.

Operations renumber positions when needed.

This avoids fractional ranking, CRDTs, distributed ordering IDs and similar complexity that the current local product does not need.

## Architectural principles

### Prefer explicit code

A short route with visible SQL is preferred to a chain such as:

~~~text
controller
 -> command
 -> handler
 -> service
 -> repository interface
 -> repository
 -> mapper
 -> entity
~~~

unless actual complexity justifies those boundaries.

### One current source of truth

Business behavior belongs in the API.

The web and MCP layers adapt to it.

### Localized complexity

A complicated operation can have a dedicated helper without forcing every feature to adopt the same pattern.

### Boring technology

Use stable, understandable technology when it solves the problem.

### Evidence before extraction

A component should be split into a new service only when operational or domain pressure makes the extraction cheaper than staying together.

## Deliberately absent architecture

Current design does not include:

- microservices;
- event bus;
- message broker;
- workers;
- Redis;
- distributed cache;
- GraphQL;
- ORM;
- CQRS;
- event sourcing;
- realtime synchronization;
- multitenancy;
- plugin architecture;
- cloud deployment abstraction.

These are not prohibited forever. They require a concrete reason before introduction.
