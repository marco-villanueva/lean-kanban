# Testing and CI

Lean Kanban uses a small testing stack focused on product-critical behavior.

## Philosophy

Testing should protect important behavior without introducing more framework complexity than the application itself.

Current priority:

- integration tests around REST + SQLite;
- compile/type safety;
- production web build;
- manual visual smoke tests for UI behavior;
- MCP smoke tests for agent behavior.

The project does not currently target an arbitrary coverage percentage.

## Automated test stack

API tests use:

~~~text
node:test
tsx
native fetch
temporary SQLite database
~~~

No Jest, Vitest, Supertest, Cypress or Playwright dependency is currently required.

## Running tests

~~~bash
pnpm test
~~~

API workspace:

~~~bash
pnpm --filter @lean-kanban/api test
~~~

## Test isolation

The integration suite creates a temporary directory and sets DB_PATH before importing the application.

The Express app binds an ephemeral port.

Tests use fetch against the actual HTTP routes.

Between tests, domain tables are cleared.

This gives realistic route/database coverage without an external service.

## Covered workflows

Current tests cover important cases including:

- board create/update/delete;
- board validation;
- board column/issue counts;
- column create/recolor/reorder;
- safe non-empty column deletion;
- move issues while deleting a column;
- issue create/update/move/reorder;
- same-column reorder;
- cross-column move;
- search/filter endpoints;
- comments create/update/list/delete;
- Full Kanban JSON round trip;
- Simple JSON round trip;
- invalid colors;
- duplicate portable IDs;
- missing column references;
- oversized text;
- malformed JSON;
- invalid export format.

## Most important regression test

The ordering case:

~~~text
[A, B, C]
move A -> position 2
expected [B, C, A]
~~~

is intentionally tested because ordering bugs are easy to introduce in DnD-backed systems.

## Round-trip testing

Portable data tests follow:

~~~text
import/create
 -> export
 -> delete
 -> import
 -> semantic comparison
~~~

The comparison checks:

- board;
- columns;
- column order;
- colors;
- issues;
- issue order;
- descriptions;
- issue colors;
- comments.

Internal UUIDs are intentionally ignored.

## Typecheck

Run:

~~~bash
pnpm typecheck
~~~

This executes TypeScript validation across workspaces.

## Build

Run:

~~~bash
pnpm build
~~~

Expected workspaces:

~~~text
apps/api
apps/web
apps/mcp
~~~

Web build runs:

~~~text
tsc
vite build
~~~

## Full local gate

Use:

~~~bash
pnpm check
~~~

Equivalent conceptual sequence:

~~~text
typecheck
test
build
~~~

This is the command contributors should run before commit/PR.

## Continuous integration

Workflow:

~~~text
.github/workflows/ci.yml
~~~

CI triggers on:

- push;
- pull_request.

Steps:

1. Checkout.
2. Setup pnpm 12.8.1.
3. Setup Node from .node-version.
4. pnpm install --frozen-lockfile.
5. pnpm check.

Timeout:

~~~text
10 minutes
~~~

## Manual UI verification

Automated API tests do not prove visual correctness.

After meaningful UI changes, verify:

- Boards screen;
- New Board dialog;
- Import dialog;
- Board settings;
- Kanban;
- List view;
- Issue drawer;
- menus;
- search/filter;
- DnD;
- colors;
- empty/loading/error states.

Recommended viewports:

~~~text
1920
1366
1024
768
~~~

## Manual DnD matrix

Within one column:

~~~text
A -> B
A -> C
B -> A
B -> C
C -> A
C -> B
~~~

Across columns:

~~~text
issue -> first
issue -> middle
issue -> end
~~~

Columns:

~~~text
first -> last
last -> first
middle -> earlier
middle -> later
~~~

Also verify keyboard DnD after changes involving sensors or sortable components.

## MCP smoke test

MCP behavior is currently verified manually after meaningful tool changes.

Minimum smoke test:

1. create board;
2. create columns;
3. reorder columns;
4. create issues;
5. move issue;
6. recolor issue;
7. add comment;
8. export;
9. import;
10. delete temporary board.

Also test API unavailable behavior.

See mcp.md and release-checklist.md.

## Large-data smoke test

Use approximately:

~~~text
20 columns
100 issues
several comments
~~~

This is not a benchmark.

It exists to catch obvious:

- layout failures;
- pathological query behavior;
- unusable scrolling;
- accidental quadratic client behavior.

## When to add frontend automation

Do not add a browser-test framework only because the project is public.

Add one when repeated regressions show that manual verification is too expensive or unreliable.

Likely signals:

- complex modal focus behavior;
- DnD regressions recurring;
- multiple supported browsers;
- production deployment with release automation.

At that point, choose the smallest test surface that covers real failures.

## Release verification

Before tagging a release candidate, use:

~~~text
docs/release-checklist.md
~~~

The release checklist includes:

- clean install;
- automated gate;
- DB smoke test;
- UI flows;
- MCP flows;
- security checks;
- repository hygiene.
