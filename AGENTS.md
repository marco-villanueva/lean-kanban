# AGENTS.md

This file defines how AI coding agents, repository agents and product-operating agents should work with Lean Kanban.

Read this file before modifying the repository or operating board data.

## 1. Project purpose

Lean Kanban is a deliberately small local-first Kanban application with MCP support.

Primary architectural rule:

> Solve the current validated requirement with the simplest clear and maintainable implementation, while keeping future change inexpensive.

Do not optimize for hypothetical enterprise requirements.

## 2. Architecture in one minute

~~~text
Human
  |
  v
React + Vite
apps/web
  |
  | HTTP / JSON
  v
Express REST API
apps/api
  |
  v
SQLite


AI Agent
  |
  v
MCP stdio server
apps/mcp
  |
  | HTTP / JSON
  v
Same Express REST API
~~~

The REST API is the single product-behavior boundary.

The MCP server is a thin adapter.

The web UI is a client.

SQLite is persistence.

## 3. Mandatory reading by task

For any code change:

1. AGENTS.md
2. docs/architecture.md
3. docs/development.md
4. relevant feature source
5. relevant tests

For API work:

- docs/api-reference.md
- docs/data-model.md

For MCP work:

- docs/mcp.md
- apps/mcp/src/index.ts

For import/export work:

- docs/import-export.md
- examples/

For UI behavior:

- docs/user-guide.md

For release work:

- docs/testing.md
- docs/release-checklist.md

For setup failures:

- docs/troubleshooting.md

## 4. Core engineering rules

### 4.1 Keep the architecture Lean

Prefer:

- a function over a class hierarchy;
- a direct route over a command bus;
- explicit SQL over a repository abstraction;
- REST over GraphQL;
- SQLite over an external DB while current scope allows it;
- existing dependencies over new dependencies;
- native platform controls over UI packages when practical;
- one clear implementation over generic frameworks.

Do not add architectural layers because they are common in larger systems.

### 4.2 Do not design for hypothetical requirements

Do not add any of these unless the task explicitly requires them and there is a concrete current use case:

- auth;
- users;
- teams;
- organizations;
- roles;
- permissions;
- assignees;
- labels;
- priority;
- due dates;
- attachments;
- notifications;
- realtime collaboration;
- webhooks;
- queues;
- workers;
- Redis;
- PostgreSQL;
- GraphQL;
- microservices;
- event sourcing;
- CQRS;
- analytics;
- billing;
- multitenancy;
- plugin systems;
- mobile apps;
- offline sync;
- CRDTs.

### 4.3 Business behavior belongs in the API

If a behavior matters to both web and MCP:

1. implement or preserve it in apps/api;
2. use it from apps/web;
3. adapt it from apps/mcp.

Do not duplicate business rules in MCP.

Do not make MCP write SQLite directly.

### 4.4 Prefer local changes

Change the smallest number of files necessary.

Do not reformat or reorganize unrelated areas.

Do not rename modules without a reason tied to the current requirement.

### 4.5 Search before abstracting

Before creating a helper/component/schema:

1. find existing behavior;
2. reuse when appropriate;
3. create a shared abstraction only when repetition is real.

ColorPicker exists because color selection was repeated.

Do not create a design system because ColorPicker exists.

## 5. Repository structure

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

docs/
examples/
.github/workflows/
~~~

## 6. Development commands

Install:

~~~bash
pnpm install --frozen-lockfile
~~~

Run API:

~~~bash
pnpm dev:api
~~~

Run web:

~~~bash
pnpm dev:web
~~~

Run MCP:

~~~bash
pnpm dev:mcp
~~~

Run all:

~~~bash
pnpm dev
~~~

Quality gate:

~~~bash
pnpm check
~~~

Individual checks:

~~~bash
pnpm typecheck
pnpm test
pnpm build
~~~

Database:

~~~bash
pnpm db:migrate
pnpm db:seed
~~~

Compiled API:

~~~bash
pnpm start:api
~~~

Health:

~~~bash
curl http://127.0.0.1:3001/api/health
~~~

Expected:

~~~json
{"ok":true}
~~~

## 7. Required verification after code changes

Do not claim completion without running the relevant verification when the execution environment allows it.

Minimum for most code changes:

~~~bash
pnpm typecheck
pnpm test
pnpm build
~~~

Preferred:

~~~bash
pnpm check
~~~

If you cannot run commands, say exactly what was not executed.

Never claim tests/build passed based only on static code inspection.

## 8. API coding rules

### 8.1 Validation

Validate request boundaries with Zod.

Shared field constraints belong in:

~~~text
apps/api/src/validation.ts
~~~

Current constraints:

~~~text
Board name          1..120
Board description   <= 2000
Column name         1..80
Issue title         1..200
Issue description   <= 8000
Comment             1..4000
Color               #RRGGBB
~~~

Keep API, import/export and MCP constraints aligned.

### 8.2 Errors

Expected JSON shape:

~~~json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Useful message"
  }
}
~~~

Do not expose stack traces through normal responses.

### 8.3 SQL

Use parameterized SQL.

Use transactions for multi-step changes.

Do not introduce an ORM without a concrete requirement.

### 8.4 Ordering

Columns and issues use integer positions.

Do not introduce:

- fractional indexes;
- LexoRank;
- CRDT ordering;
- distributed sequence IDs.

unless actual concurrency requirements demand them.

### 8.5 Column deletion

A non-empty column requires explicit behavior:

~~~text
move issues
or
delete issues
~~~

Never silently delete populated columns through a new route/tool.

## 9. Database rules

Default DB:

~~~text
data/kanban.db
~~~

Environment override:

~~~text
DB_PATH
~~~

SQLite settings:

~~~text
journal_mode = WAL
foreign_keys = ON
~~~

Normal application code must not manually edit the database outside the API.

Direct SQL against the DB is acceptable only for:

- migration development;
- diagnostics;
- tests;
- recovery explicitly requested by the user.

If diagnosing data, prefer read-only inspection before mutation.

## 10. Frontend rules

Frontend stack:

- React;
- TypeScript;
- Vite;
- TanStack Query;
- dnd-kit;
- plain CSS.

### 10.1 Remote state

Use TanStack Query for API-backed state.

After mutations, invalidate/refetch the relevant query.

Avoid introducing another global state framework unless a current problem requires it.

### 10.2 UI dependencies

Before adding a UI library, ask whether:

- native HTML solves it;
- current components solve it;
- a tiny local component solves it.

### 10.3 Accessibility

Preserve:

- keyboard access;
- visible focus;
- aria-label on icon-only controls;
- aria-modal on dialogs/drawers;
- Escape close behavior where implemented;
- acceptable color contrast.

Do not encode status using color alone.

### 10.4 Responsive behavior

Desktop is primary.

Preserve usable behavior around:

~~~text
1920
1366
1024
768
~~~

Kanban should remain horizontally scrollable.

Do not redesign the interaction model for mobile without an explicit requirement.

## 11. Drag-and-drop rules

dnd-kit drives DnD.

Any DnD change should reason through:

Same column:

~~~text
A -> B
A -> C
B -> A
B -> C
C -> A
C -> B
~~~

Cross-column:

~~~text
to first
to middle
to end
~~~

Column reorder:

~~~text
first -> last
last -> first
middle -> earlier
middle -> later
~~~

Search/filter rule:

> DnD remains disabled while search or a column filter is active.

Do not remove this behavior unless you also implement an unambiguous persisted ordering model for filtered views.

Keyboard DnD should remain supported.

## 12. Import/export rules

There are two public formats:

~~~text
Full Kanban JSON
Simple JSON
~~~

Read docs/import-export.md before changes.

### 12.1 Full JSON

Current version:

~~~text
format = lean-kanban
version = 1
~~~

Portable IDs are not SQLite UUIDs.

Import generates new internal UUIDs.

### 12.2 Simple JSON

Optimized for:

- humans;
- scripts;
- LLMs.

Array order represents column/issue order.

### 12.3 Import behavior

Import always creates a new board.

Do not silently change this to merge/overwrite.

### 12.4 Backward compatibility

Do not reinterpret version 1 destructively.

If a breaking format change becomes necessary, introduce explicit version handling.

## 13. MCP rules for coding agents

MCP source:

~~~text
apps/mcp/src/index.ts
~~~

Transport:

~~~text
stdio
~~~

Default REST target:

~~~text
http://127.0.0.1:3001
~~~

Environment:

~~~text
API_BASE
~~~

Request timeout:

~~~text
10 seconds
~~~

### 13.1 MCP must remain thin

Every tool should normally:

1. validate agent-facing input;
2. resolve friendly references;
3. call REST API;
4. return result.

Do not:

- query SQLite directly;
- reproduce reorder SQL;
- implement hidden alternate validation;
- add domain behavior only agents can access unless intentionally required.

### 13.2 Name resolution

Boards:

~~~text
ID or exact name
~~~

Columns:

~~~text
ID or exact name within board
~~~

Issues:

~~~text
ID or exact title when board context exists
~~~

When ambiguous:

> fail and request/use an ID.

Never guess which duplicate entity the user meant.

### 13.3 Token efficiency

get_board defaults to:

~~~text
includeComments = false
~~~

Keep it that way unless requirements change.

Prefer get_issue or list_comments for comment-focused work.

### 13.4 Destructive MCP operations

Particularly sensitive:

- delete_board;
- delete_column mode=delete;
- delete_issue;
- delete_comment.

delete_board requires:

~~~text
confirm: true
~~~

Do not remove this guard.

## 14. How product-operating agents should use Lean Kanban

If your task is to operate the user's Kanban rather than change code, prefer MCP.

### 14.1 Inspect first when context is uncertain

Use:

~~~text
list_boards
get_board
~~~

before mutating a board you have not inspected.

### 14.2 Use exact names when unique

Example:

~~~text
board = "MVP"
column = "Doing"
issue = "Build login"
~~~

If ambiguity occurs, switch to IDs.

### 14.3 Create board workflow

Recommended sequence:

~~~text
create_board
create_column
create_column
create_column
get_board
~~~

### 14.4 Create many issues

Get board once to verify columns.

Then call create_issue for each item.

Refetch once after the batch if verification is needed.

Avoid unnecessary repeated board fetches.

### 14.5 Move issue

If user says:

~~~text
Move X to Doing
~~~

call move_issue without position.

This appends to Doing.

If exact placement is requested, provide zero-based position.

### 14.6 Colors

Column and issue color:

~~~text
#RRGGBB
~~~

Issue color can be reset to:

~~~text
null
~~~

Do not interpret colors as priority unless the user explicitly defines that convention.

### 14.7 Comments

Comments are plain text and have no authors.

Do not invent author/user metadata.

### 14.8 Deleting a populated column

If user says only:

~~~text
Delete Backlog
~~~

and it contains issues, determine whether issues should:

- move;
- be deleted.

Do not assume deletion of issue content.

### 14.9 Back up before large destructive changes

Use:

~~~text
export_board format=kanban
~~~

before major destructive restructuring when rollback could matter.

### 14.10 Import

Use:

~~~text
import_board
data = object
~~~

Do not pass serialized JSON inside data.

## 15. MCP tool inventory

Boards:

~~~text
list_boards
get_board
create_board
update_board
delete_board
~~~

Columns:

~~~text
create_column
update_column
delete_column
reorder_columns
~~~

Issues:

~~~text
list_issues
get_issue
create_issue
update_issue
move_issue
delete_issue
~~~

Comments:

~~~text
list_comments
add_comment
update_comment
delete_comment
~~~

Portability:

~~~text
export_board
import_board
~~~

See docs/mcp.md for full argument semantics.

## 16. Agent examples

### Create a project board

User:

~~~text
Create a board called Website Launch with Backlog, Todo, Doing and Done.
~~~

Agent:

1. create_board.
2. create four columns.
3. optionally set useful colors only if requested.
4. get_board to verify.

### Add a task

User:

~~~text
Add "Fix mobile navbar" to Todo in Website Launch.
~~~

Agent:

1. create_issue using board and column exact names.
2. return concise confirmation.

No need to fetch all comments or export the board.

### Reorganize columns

User:

~~~text
Put Doing before Todo.
~~~

Agent:

1. get_board.
2. build complete final column order.
3. reorder_columns with every column exactly once.
4. verify if needed.

### Remove issue color

User:

~~~text
Clear the color on "Fix mobile navbar".
~~~

Agent:

~~~text
update_issue color=null
~~~

### Export for another agent

User:

~~~text
Give me this board in a compact JSON form for another LLM.
~~~

Prefer:

~~~text
export_board format=simple
~~~

unless faithful portable references/positions are required.

## 17. Security rules

Current application has:

~~~text
NO AUTHENTICATION
NO AUTHORIZATION
~~~

Default API bind:

~~~text
127.0.0.1
~~~

Never change the default to 0.0.0.0 merely to make setup easier.

Never document the current API as safe for public exposure.

Do not add secrets to:

- source;
- examples;
- docs;
- committed .env files.

.env is ignored.

.env.example may contain only safe placeholders/defaults.

## 18. Lockfile and dependency safety

The canonical lockfile is:

~~~text
pnpm-lock.yaml
~~~

It should represent:

~~~text
root
apps/api
apps/web
apps/mcp
~~~

Do not commit a package-manager bootstrap lockfile that replaces application workspace importers.

Use:

~~~bash
pnpm install --frozen-lockfile
~~~

for normal installation.

If changing dependencies intentionally:

1. use pnpm version declared by packageManager;
2. regenerate lockfile normally;
3. inspect lockfile diff;
4. run pnpm check.

## 19. Files that must not be committed

Do not commit:

~~~text
node_modules/
dist/
data/*.db
*.db-wal
*.db-shm
.env
.npm-cache/
.pnpm-cache/
.pnpm-store/
.pnpm-global/
coverage/
*.log
~~~

Check git status before finalizing.

## 20. Tests required by change type

### API contract change

Add/update integration test.

### Ordering change

Add a precise before/after ordering test.

### Import/export change

Add round-trip or validation test.

### Data-model change

Test migration and API behavior.

### MCP change

Typecheck/build MCP and perform a smoke test where tool execution is available.

### UI-only visual change

At minimum:

- typecheck;
- build;
- manual visual verification if browser access exists.

Do not invent successful browser verification if browser access was unavailable.

## 21. Documentation requirements

When changing behavior, update the corresponding docs in the same task.

Mapping:

~~~text
setup/scripts        -> docs/getting-started.md
UI behavior          -> docs/user-guide.md
architecture         -> docs/architecture.md
DB/schema            -> docs/data-model.md
REST                  -> docs/api-reference.md
MCP                   -> docs/mcp.md
JSON formats          -> docs/import-export.md
developer workflow   -> docs/development.md
tests/CI              -> docs/testing.md
operational issue    -> docs/troubleshooting.md
public overview      -> README.md
security             -> SECURITY.md
agent rules          -> AGENTS.md
~~~

README should stay readable to a first-time visitor.

Detailed contracts belong in docs.

## 22. Completion report for coding agents

At the end of a coding task, report:

1. what changed;
2. important files;
3. migrations or contract changes;
4. tests/typecheck/build executed;
5. anything not verified;
6. intentional omissions.

Do not bury failures.

If a command failed, show the relevant failure and stop claiming the batch is complete.

## 23. Release rules

Do not create a release tag merely because implementation code is finished.

Before release:

1. run pnpm install --frozen-lockfile;
2. run pnpm check;
3. follow docs/release-checklist.md;
4. run UI smoke test;
5. run MCP smoke test;
6. confirm security assumptions;
7. ensure documentation matches behavior.

## 24. Decision rule when uncertain

When multiple technical solutions are viable, choose the one with:

1. fewer conceptual pieces;
2. fewer new dependencies;
3. smaller change surface;
4. clearer data flow;
5. easier deletion/replacement;
6. sufficient quality for current requirements.

Ask:

> What is the simplest clear and maintainable solution to the current problem?

Then implement that.

## 25. Final invariant

Lean Kanban should continue to look deliberately understandable.

A contributor or agent should be able to browse:

~~~text
apps/web
apps/api
apps/mcp
~~~

and understand almost the entire system without first learning a custom architecture framework.
