# Development Guide

This document describes how to work on Lean Kanban without eroding its deliberately small architecture.

## Development philosophy

The repository follows a Lean engineering rule:

> Implement the simplest clear and maintainable solution for the requirement that exists now.

A change is not improved merely because it adds abstraction.

Prefer code that a new contributor can locate, read and modify quickly.

## Repository layout

~~~text
apps/api   REST API, SQLite and integration tests
apps/web   React SPA
apps/mcp   MCP adapter
docs       project documentation
examples   JSON interoperability fixtures
~~~

## Setup

~~~bash
pnpm install --frozen-lockfile
pnpm check
~~~

Run browser development:

~~~bash
pnpm dev:api
pnpm dev:web
~~~

Run all workspaces:

~~~bash
pnpm dev
~~~

## Root scripts

| Script | Purpose |
| --- | --- |
| pnpm dev | run workspace dev scripts in parallel |
| pnpm dev:api | API watcher |
| pnpm dev:web | Vite dev server |
| pnpm dev:mcp | MCP watcher |
| pnpm build | build workspaces |
| pnpm typecheck | TypeScript validation |
| pnpm test | tests where present |
| pnpm check | typecheck + tests + build |
| pnpm db:migrate | explicit DB migration |
| pnpm db:seed | seed demo data |
| pnpm start:api | run compiled API |

## Change workflow

Before changing code:

1. Read AGENTS.md.
2. Locate the smallest feature file involved.
3. Understand existing API behavior.
4. Check related tests and docs.
5. Avoid architecture changes unless required.

During implementation:

1. Keep the change local.
2. Reuse existing helpers before creating new ones.
3. Add validation at API boundaries.
4. Preserve REST as source of product behavior.
5. Keep MCP as an adapter.
6. Add tests for correctness-sensitive behavior.
7. Update documentation when contracts change.

Before commit:

~~~bash
pnpm check
~~~

## Backend conventions

Feature files:

~~~text
boards.ts
columns.ts
issues.ts
comments.ts
import-export.ts
~~~

Keep route behavior near the feature.

Small local helper functions are encouraged when they improve readability.

Avoid creating generic layers such as:

~~~text
controllers/
services/
repositories/
entities/
mappers/
commands/
handlers/
~~~

unless real size/complexity makes the current structure harder to change.

## SQL conventions

Current code uses explicit SQL.

Prefer:

- parameterized statements;
- visible queries;
- transactions for multi-step writes;
- indexes tied to real query patterns.

Do not introduce an ORM simply to remove SQL.

A future ORM would require a concrete benefit large enough to offset new abstractions and migration work.

## API validation

Use Zod at input boundaries.

Shared field rules belong in validation.ts when multiple features reuse them.

Do not create DTO classes.

Validation changes that affect import/export or MCP should be kept aligned across those boundaries.

## Error behavior

Expected errors should use:

~~~json
{
  "error": {
    "code": "...",
    "message": "..."
  }
}
~~~

Do not leak raw stack traces to normal API responses.

Unexpected errors may be logged server-side and returned as INTERNAL_ERROR.

## Frontend conventions

The frontend uses:

- React function components;
- hooks;
- TanStack Query;
- plain CSS;
- existing small reusable components.

Before adding a UI dependency, check whether:

- a native control works;
- a small local component is enough;
- the dependency solves a repeated current problem.

ColorPicker is an example of an abstraction justified by repeated behavior.

## Remote state

Prefer TanStack Query for API data.

After mutations, invalidate/refetch the relevant query.

Avoid building a second normalized client store unless current complexity requires it.

## Drag-and-drop

dnd-kit handles reorder/move behavior.

Any DnD change must test:

- first to last;
- last to first;
- middle moves;
- same-column reorder;
- cross-column move;
- column reorder;
- keyboard interaction;
- filtered view behavior.

Do not implement client-only optimistic ordering unless it is proven necessary. Current API refetch is intentionally simple and reliable.

## MCP development

MCP rules:

- no direct SQLite access;
- no duplicated board business logic;
- call REST endpoints;
- use schemas that are friendly to agents;
- add descriptions to tool arguments;
- reject ambiguity rather than guessing;
- preserve actionable errors;
- keep token usage reasonable.

If the REST API lacks an operation the MCP needs, first ask whether the API should support it for every client. Usually the answer should be implemented in API, then adapted in MCP.

## New dependencies

A dependency should solve a concrete problem better than a small amount of local code.

Before adding one, ask:

1. What current problem does it solve?
2. Can native platform APIs solve it?
3. Does the repository already contain a suitable dependency?
4. What maintenance/build/security cost does it add?
5. Will it still be useful after the current feature?

## New features

Do not automatically add adjacent features.

Example:

A request for issue color does not imply:

- labels;
- priority;
- issue type;
- themes;
- saved palettes.

Keep each product decision explicit.

## Schema changes

Current migration is intentionally small.

For simple additive changes:

- update schema creation;
- add a safe existence check;
- migrate existing DB;
- add tests.

If changes begin requiring ordered version history, data transformations or rollback reasoning, that is evidence to introduce a real migration system.

## Documentation changes

Update docs when changing:

- public setup;
- scripts;
- environment variables;
- endpoints;
- request/response contracts;
- MCP tools;
- JSON formats;
- security assumptions;
- data model;
- release process.

README should stay approachable.

Detailed behavior belongs in docs.

## Commit style

Prefer small logical commits.

Examples:

~~~text
fix: preserve issue order when moving columns
feat: add MCP issue color support
test: cover simple JSON round trip
docs: document MCP import contract
refactor: reuse color picker
~~~

Avoid commits that mix unrelated architecture, UI and documentation unless they are one atomic behavior change.

## Pull request checklist

Before opening a PR:

- pnpm install --frozen-lockfile succeeds;
- pnpm check succeeds;
- no local DB/cache files are tracked;
- changed behavior has tests where appropriate;
- docs match current behavior;
- no unnecessary dependencies were introduced;
- destructive behavior remains explicit;
- security assumptions did not silently change.

## Architecture escalation signals

Consider larger architecture only when there is evidence such as:

- multiple users editing concurrently;
- SQLite becomes an operational bottleneck;
- deployment requires remote persistence;
- API domain modules become hard to navigate;
- migrations become complex;
- MCP needs remote authentication;
- background jobs are real product requirements.

Architecture should evolve because current pressure exists, not because future scale is imaginable.
