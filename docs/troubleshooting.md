# Troubleshooting

This guide covers common setup, build, runtime, database, UI and MCP problems.

## pnpm install says no lockfile

Symptom:

~~~text
ERR_PNPM_NO_LOCKFILE
~~~

First verify repository state:

~~~bash
git status
git rev-parse --short HEAD
git pull --ff-only
ls -lh pnpm-lock.yaml
~~~

The public repository should contain pnpm-lock.yaml at the root.

Do not regenerate the lockfile until you know the file is genuinely absent from the branch.

## pnpm says lockfile is outdated

Symptom:

~~~text
ERR_PNPM_OUTDATED_LOCKFILE
~~~

Check:

~~~bash
git status
git pull --ff-only
pnpm install --frozen-lockfile
~~~

If package.json was intentionally changed, regenerate with the repository's expected pnpm version and review the lockfile diff carefully.

A suspicious lockfile that suddenly loses apps/api, apps/web or apps/mcp importers should not be committed.

## Verify lockfile importers

The lockfile should include importers for:

~~~text
.
apps/api
apps/web
apps/mcp
~~~

A package-manager bootstrap-only lockfile is not the application lockfile.

## API health fails

Check process:

~~~bash
pnpm dev:api
~~~

Then:

~~~bash
curl http://127.0.0.1:3001/api/health
~~~

Expected:

~~~json
{"ok":true}
~~~

If using a custom port:

~~~bash
PORT=4000 pnpm dev:api
curl http://127.0.0.1:4000/api/health
~~~

## Web opens but data fails

The Vite development proxy expects the API at:

~~~text
http://localhost:3001
~~~

If API is running on another port, update development configuration or return to port 3001.

Check browser network errors and terminal API logs.

## Database file not where expected

Default path is resolved from the API process working directory to:

~~~text
data/kanban.db
~~~

Override explicitly:

~~~bash
DB_PATH=/absolute/path/to/kanban.db pnpm dev:api
~~~

## Reset database

This destroys local data.

Stop API first.

~~~bash
rm -f data/kanban.db
rm -f data/kanban.db-wal
rm -f data/kanban.db-shm
pnpm db:migrate
~~~

## Migration error

Run:

~~~bash
pnpm db:migrate
~~~

The current migration:

- creates base tables/indexes;
- checks issues schema;
- adds issue color if missing.

Unexpected SQLite migration errors should not be ignored. Preserve the original DB before experimenting.

## Database locked

SQLite uses WAL mode.

If the process crashed, first stop every API process.

Check:

~~~bash
ps aux | grep node
~~~

Then restart API.

Do not delete WAL/SHM files while a process still owns the database.

## Cannot delete a column

A populated column returns:

~~~text
409 COLUMN_HAS_ISSUES
~~~

Choose:

~~~text
move issues to another column
~~~

or explicitly:

~~~text
delete issues too
~~~

This is intentional safety behavior.

## Drag-and-drop is disabled

If search or a column filter is active, DnD is deliberately disabled.

Clear:

- Search issues;
- Column filter.

Then reorder.

## DnD changes do not persist

Check:

1. API is running.
2. Browser request to PATCH /api/issues/:id/move succeeds.
3. No DnD error message is shown.
4. Refresh board and inspect persisted order.

If reproducing a bug, record:

- starting order;
- dragged item;
- target item/column;
- expected order;
- actual order.

## Import preview works but import fails

Preview is intentionally lightweight.

The API performs full validation.

Common failures:

- invalid #RRGGBB color;
- duplicate portable column IDs;
- duplicate portable issue IDs;
- issue references missing column;
- text exceeds limits;
- wrong Full JSON version.

See import-export.md.

## MCP server starts but tools fail

The MCP process does not own the database directly.

It needs REST API access.

Check:

~~~bash
curl http://127.0.0.1:3001/api/health
~~~

Then confirm MCP env:

~~~text
API_BASE=http://127.0.0.1:3001
~~~

## MCP says board is ambiguous

Duplicate exact board names exist.

Call list_boards and use the UUID.

Same rule applies to duplicate column names and issue titles.

## MCP issue title not found

When referencing an issue by title, supply the board context if the tool supports it.

Otherwise use the issue UUID returned by get_board/list_issues.

## MCP import fails

import_board expects an object in data.

Correct concept:

~~~text
data = {
  name: "Board",
  columns: []
}
~~~

Do not pass a JSON-encoded string.

## MCP move goes to wrong position

position is zero-based.

Omit position to append to the target column.

For precise reorder, inspect board state first and provide the intended index.

## MCP request times out

Timeout is 10 seconds.

For a local application, check:

- API process is responsive;
- API_BASE is correct;
- database is not blocked;
- another process is not holding unusual resources.

## Build fails only in web

Run:

~~~bash
pnpm --filter @lean-kanban/web build
~~~

This performs TypeScript and Vite build.

Check for:

- stale imports;
- renamed components;
- invalid React props;
- CSS does not affect TypeScript build, but missing TS files do.

## Build fails only in MCP

Run:

~~~bash
pnpm --filter @lean-kanban/mcp build
~~~

Common causes:

- SDK registration signature mismatch;
- Zod schema type mismatch;
- unsupported tool-result shape.

Keep MCP SDK changes isolated and typecheck immediately.

## Build fails only in API

Run:

~~~bash
pnpm --filter @lean-kanban/api build
~~~

Also run:

~~~bash
pnpm --filter @lean-kanban/api test
~~~

## Check everything

~~~bash
pnpm check
~~~

If this passes, TypeScript, integration tests and builds are all green locally.

## Git accidentally tracks generated files

Check:

~~~bash
git status --short
git ls-files | grep -E 'node_modules|\\.pnpm-store|\\.pnpm-global|\\.npm-cache|\\.db$|dist/'
~~~

Generated caches, DB files and build output should not be committed.

## Public deployment question

The current application is not designed for direct public deployment.

It has no authentication.

Do not solve deployment errors by binding API to 0.0.0.0 and exposing it publicly.

Add a real security design first.

## Still blocked

Collect:

~~~text
Node version
pnpm version
git commit SHA
exact command
full error
which workspace fails
whether pnpm check passes partially
~~~

Then isolate the smallest failing command before changing architecture or dependencies.
