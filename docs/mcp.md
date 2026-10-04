# MCP Integration

Lean Kanban exposes a Model Context Protocol server so AI agents can operate boards without bypassing the application API.

The MCP server lives in:

~~~text
apps/mcp/src/index.ts
~~~

## Design principle

MCP is an adapter, not a second backend.

~~~text
Agent
  |
  v
MCP tool
  |
  v
Lean Kanban REST API
  |
  v
SQLite
~~~

All board rules remain in the REST API.

Agents should prefer MCP for product operations because it provides:

- human-friendly name resolution;
- tool schemas;
- safer destructive operations;
- concise agent-facing behavior;
- consistent use of the product API.

## Prerequisites

The REST API must be running.

Build:

~~~bash
pnpm build
~~~

Start the API:

~~~bash
pnpm start:api
~~~

Verify:

~~~bash
curl http://127.0.0.1:3001/api/health
~~~

Expected:

~~~json
{"ok":true}
~~~

## MCP transport

Current transport:

~~~text
stdio
~~~

The MCP process is launched by the client.

Compiled entry point:

~~~text
apps/mcp/dist/index.js
~~~

Development command:

~~~bash
pnpm dev:mcp
~~~

Compiled command:

~~~bash
pnpm --filter @lean-kanban/mcp start
~~~

## Client configuration

Generic configuration:

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

A copyable file exists at:

~~~text
docs/mcp-client.example.json
~~~

Use an absolute path.

## API_BASE

Default:

~~~text
http://127.0.0.1:3001
~~~

Override when API runs elsewhere:

~~~text
API_BASE=http://127.0.0.1:4000
~~~

The MCP server removes a trailing slash if supplied.

## Timeout

Every MCP-to-API HTTP request has a 10-second timeout.

If the API cannot be reached, the tool returns an actionable error similar to:

~~~text
Lean Kanban API is not reachable at http://127.0.0.1:3001.
Start the API first or configure API_BASE.
~~~

## Reference resolution

### Boards

board arguments accept:

- internal board ID;
- exact board name, case-insensitive.

If multiple boards share that exact name, the tool refuses ambiguity and asks for an ID.

### Columns

column arguments accept:

- column ID;
- exact column name, case-insensitive, within the selected board.

Duplicate names require an ID.

### Issues

issue arguments accept:

- issue ID;
- exact issue title, case-insensitive, when a board is supplied.

Duplicate titles require an ID.

### Comments

Comment mutation tools use comment IDs.

There is currently no comment-title/name resolution.

## Tool reference

### list_boards

Purpose:

List all boards.

Arguments:

None.

Typical use:

~~~text
Use this first when the board name is uncertain or duplicate board names may exist.
~~~

### get_board

Purpose:

Return board metadata, columns and issues.

Arguments:

| Argument | Required | Meaning |
| --- | --- | --- |
| board | yes | Board ID or exact name |
| includeComments | no | Include all board comments |

Default:

~~~text
includeComments = false
~~~

Comments are omitted by default to reduce token usage.

Example agent intent:

~~~text
Show me the current structure of the MVP board.
~~~

### create_board

Arguments:

| Argument | Required | Rule |
| --- | --- | --- |
| name | yes | 1–120 |
| description | no | max 2000 |

Example:

~~~text
Create a board named "Website MVP" with description "Launch scope".
~~~

### update_board

Arguments:

- board;
- optional name;
- optional description.

Only supplied fields change.

### delete_board

Arguments:

- board;
- confirm: true.

This explicit confirmation is mandatory.

Example:

~~~text
Delete board "Temporary QA" permanently.
~~~

A capable agent should confirm user intent before calling the tool when deletion was not already explicit.

## Column tools

### create_column

Arguments:

- board;
- name;
- optional color.

New column is appended.

Color format:

~~~text
#RRGGBB
~~~

### update_column

Arguments:

- board;
- column;
- optional name;
- optional color.

### delete_column

Arguments:

- board;
- column;
- optional mode;
- optional targetColumn.

If the column contains issues, API semantics require:

~~~text
mode = move
targetColumn = another column
~~~

or:

~~~text
mode = delete
~~~

An agent should prefer moving issues unless the user explicitly requested their deletion.

### reorder_columns

Arguments:

- board;
- orderedColumns.

orderedColumns must contain every current column exactly once.

Names and IDs can be mixed if each resolves uniquely.

The MCP server fetches the board once and resolves all references from that snapshot.

Example:

~~~text
Reorder MVP to Backlog, Todo, Doing, Review, Done.
~~~

## Issue tools

### list_issues

Arguments:

- board;
- optional column;
- optional q.

q searches title and description.

Examples:

~~~text
List all issues in Doing.

Find issues mentioning authentication.
~~~

### get_issue

Arguments:

- issue;
- optional board.

If issue is a UUID, board is unnecessary.

If resolving by title, include board.

Returns the issue and comments.

### create_issue

Arguments:

| Argument | Required | Rule |
| --- | --- | --- |
| board | yes | board ID/name |
| column | yes | column ID/name |
| title | yes | max 200 |
| description | no | max 8000 |
| color | no | #RRGGBB |

New issue appends to the target column.

### update_issue

Arguments:

- optional board;
- issue;
- optional title;
- optional description;
- optional color.

To clear issue color:

~~~text
color = null
~~~

### move_issue

Arguments:

- board;
- issue;
- column;
- optional position.

position is zero-based.

If position is omitted, MCP calculates the end of the target column and appends the issue.

Examples:

~~~text
Move "Draft copy" to Doing.

Move "Draft copy" to position 0 in Review.
~~~

### delete_issue

Arguments:

- optional board;
- issue.

Deletes issue and its comments.

This is destructive.

## Comment tools

### list_comments

Arguments:

- optional board;
- issue.

### add_comment

Arguments:

- optional board;
- issue;
- content.

Content max 4000.

### update_comment

Arguments:

- comment ID;
- content.

### delete_comment

Arguments:

- comment ID.

This is destructive.

## Portability tools

### export_board

Arguments:

- board;
- optional format.

Formats:

~~~text
kanban
simple
~~~

Default:

~~~text
kanban
~~~

### import_board

Arguments:

~~~text
data
~~~

data is a JSON object.

Correct:

~~~json
{
  "data": {
    "name": "Imported",
    "columns": []
  }
}
~~~

Incorrect:

~~~json
{
  "data": "{\"name\":\"Imported\",\"columns\":[]}"
}
~~~

Do not double-serialize the JSON object.

Import creates a new board.

## Recommended agent patterns

### Pattern: inspect before mutate

For a board operation with uncertain state:

1. list_boards if board identity is uncertain.
2. get_board.
3. decide mutation.
4. call the smallest mutation tool.
5. get_board again when verification matters.

### Pattern: bulk issue creation

For ten issues in one board:

1. get_board once.
2. confirm column names.
3. call create_issue repeatedly.
4. get_board once at the end.

Avoid fetching the board before every issue unless the state may have changed externally.

### Pattern: safe workflow reorganization

1. get_board.
2. identify complete column set.
3. reorder_columns with every column.
4. get_board to verify.

### Pattern: deleting a populated column

1. get_board.
2. inspect affected issues.
3. ask for intent if not clear.
4. call delete_column with mode=move where possible.
5. verify.

### Pattern: backup before destructive work

1. export_board with format=kanban.
2. perform destructive changes.
3. retain/exported JSON if rollback may be required.

## Natural-language examples

An MCP-capable agent should be able to fulfill requests such as:

~~~text
Create a board called Personal Projects with Todo, Doing, Blocked and Done.

Add five issues to Todo from this list.

Move everything containing "docs" into Doing.

Color Blocked red.

Mark these two issues yellow.

Add "Waiting on API decision" as a comment on the auth issue.

Show me all issues in Doing.

Export this board as Simple JSON.

Create a new board from this JSON object.
~~~

## Tool-selection guidance

Use MCP instead of direct REST when:

- operating boards as an agent;
- user refers to names rather than UUIDs;
- safer destructive behavior is useful;
- tool schemas improve reliability.

Use REST directly when:

- testing the API;
- developing the web client;
- writing integration tests;
- diagnosing an API-specific behavior.

Do not edit SQLite directly for normal product operations.

## Token efficiency

get_board intentionally omits comments by default.

Prefer:

~~~text
get_board(includeComments=false)
~~~

for structural planning.

Use:

~~~text
get_issue
list_comments
get_board(includeComments=true)
~~~

only when comment content is needed.

Simple JSON is usually more token-efficient than Full Kanban JSON for agent-generated boards.

## Destructive-operation policy for agents

Before destructive calls, agents should distinguish between:

- user explicitly requested deletion;
- deletion is merely one possible way to accomplish the request.

If deletion is not explicit, prefer non-destructive behavior or ask for confirmation.

Especially sensitive:

- delete_board;
- delete_column with mode=delete;
- delete_issue;
- delete_comment.

## Failure modes

### API not reachable

Start:

~~~bash
pnpm start:api
~~~

or configure API_BASE.

### Ambiguous board/column/issue

Use the UUID returned by list_boards/get_board.

### Validation failure

Inspect tool arguments against:

- field limits;
- color format;
- target column;
- complete reorder list.

### Timeout

A request taking more than 10 seconds aborts.

On a local SQLite application, repeated timeouts usually indicate a blocked or unreachable API rather than expected load.

## MCP smoke test

Recommended after MCP changes:

1. list_boards.
2. create_board.
3. create three columns.
4. reorder columns.
5. create issues.
6. recolor one column.
7. recolor and clear an issue.
8. move issue without position and verify append.
9. add/edit a comment.
10. get_board without comments.
11. get_board with comments.
12. export Simple JSON.
13. import through data object.
14. delete temporary board with confirm true.

See release-checklist.md.
