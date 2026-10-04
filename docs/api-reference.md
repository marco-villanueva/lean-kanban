# REST API Reference

Base URL in local development:

~~~text
http://127.0.0.1:3001
~~~

All application endpoints are under /api.

Requests and responses use JSON unless the response is 204 No Content.

## Health

### GET /api/health

Response:

~~~json
{
  "ok": true
}
~~~

## Error envelope

Expected errors use:

~~~json
{
  "error": {
    "code": "INVALID_BODY",
    "message": "..."
  }
}
~~~

Invalid JSON produces HTTP 400 with code INVALID_JSON.

Unknown routes produce HTTP 404 with code NOT_FOUND.

Unexpected errors produce HTTP 500 with code INTERNAL_ERROR.

## Boards

### GET /api/boards

Lists boards ordered newest first.

Response:

~~~json
{
  "boards": [
    {
      "id": "uuid",
      "name": "MVP",
      "description": "",
      "createdAt": "2026-10-03T00:00:00.000Z",
      "updatedAt": "2026-10-03T00:00:00.000Z",
      "columnCount": 3,
      "issueCount": 12
    }
  ]
}
~~~

### POST /api/boards

Body:

~~~json
{
  "name": "MVP",
  "description": "First validation board"
}
~~~

Rules:

- name required;
- name max 120;
- description max 2000.

Success: 201.

### GET /api/boards/:boardId

Returns complete board state:

~~~json
{
  "board": {},
  "columns": [],
  "issues": [],
  "comments": []
}
~~~

Columns are ordered by position.

Issues are returned with persisted position.

Comments are ordered by created_at.

### PATCH /api/boards/:boardId

Body may contain:

~~~json
{
  "name": "New name",
  "description": "New description"
}
~~~

Success: 200.

### DELETE /api/boards/:boardId

Deletes board and cascading content.

Success: 204.

## Columns

### POST /api/boards/:boardId/columns

Body:

~~~json
{
  "name": "Doing",
  "color": "#CA8A04"
}
~~~

color defaults to #64748B if omitted by normal API clients.

New columns append to the board.

Success: 201.

### PATCH /api/columns/:columnId

Body:

~~~json
{
  "name": "In Progress",
  "color": "#2563EB"
}
~~~

Fields are optional.

Success: 200.

### DELETE /api/columns/:columnId

If the column is empty:

~~~http
DELETE /api/columns/:columnId
~~~

Success: 204.

If issues exist and no mode is supplied:

~~~text
409 COLUMN_HAS_ISSUES
~~~

Delete issues with the column:

~~~http
DELETE /api/columns/:columnId?mode=delete
~~~

Move issues then delete:

~~~http
DELETE /api/columns/:columnId?mode=move&targetColumnId=:target
~~~

Target column must belong to the same board.

### POST /api/boards/:boardId/columns/reorder

Body:

~~~json
{
  "orderedIds": [
    "column-uuid-3",
    "column-uuid-1",
    "column-uuid-2"
  ]
}
~~~

orderedIds must contain exactly all columns of the board once.

Response contains reordered columns.

## Issues

### POST /api/boards/:boardId/issues

Body:

~~~json
{
  "columnId": "column-uuid",
  "title": "Draft landing page",
  "description": "Optional detail",
  "color": "#7C3AED"
}
~~~

color may be null.

Rules:

- title required;
- title max 200;
- description max 8000;
- color null or #RRGGBB.

New issues append to the target column.

Success: 201.

### GET /api/issues/:issueId

Returns issue and its comments:

~~~json
{
  "issue": {},
  "comments": []
}
~~~

### GET /api/boards/:boardId/issues

Optional query parameters:

~~~text
columnId
q
~~~

Examples:

~~~http
GET /api/boards/:boardId/issues?columnId=:columnId
~~~

~~~http
GET /api/boards/:boardId/issues?q=landing
~~~

~~~http
GET /api/boards/:boardId/issues?columnId=:columnId&q=landing
~~~

q performs case-insensitive title/description matching.

### PATCH /api/issues/:issueId

Body may contain:

~~~json
{
  "title": "Updated title",
  "description": "Updated detail",
  "color": null
}
~~~

Passing color null clears explicit issue color.

### PATCH /api/issues/:issueId/move

Body:

~~~json
{
  "columnId": "target-column-uuid",
  "position": 2
}
~~~

position is zero-based.

The target column must belong to the same board.

The server clamps an oversized position to the end.

The operation renumbers relevant positions transactionally.

### DELETE /api/issues/:issueId

Deletes issue and comments.

Success: 204.

## Comments

### POST /api/issues/:issueId/comments

Body:

~~~json
{
  "content": "Waiting for copy review"
}
~~~

Rules:

- content required after trim;
- max 4000.

Success: 201.

### GET /api/issues/:issueId/comments

Returns:

~~~json
{
  "comments": []
}
~~~

### PATCH /api/comments/:commentId

Body:

~~~json
{
  "content": "Edited comment"
}
~~~

### DELETE /api/comments/:commentId

Success: 204.

## Export

### GET /api/boards/:boardId/export?format=kanban

Returns Full Kanban JSON.

### GET /api/boards/:boardId/export?format=simple

Returns Simple JSON.

Allowed format values:

~~~text
kanban
simple
~~~

Any other value returns:

~~~text
400 INVALID_FORMAT
~~~

## Import

### POST /api/boards/import

Body is either:

- Full Kanban JSON;
- Simple JSON.

Import always creates a new board.

Success: 201.

Example result:

~~~json
{
  "boardId": "new-internal-uuid",
  "imported": true
}
~~~

Full format also returns imported board metadata.

See import-export.md for exact schemas and validation behavior.

## Important status codes

| Code | Meaning |
| --- | --- |
| 200 | Read/update success |
| 201 | Created |
| 204 | Successful deletion |
| 400 | Invalid input/import/format |
| 404 | Entity not found |
| 409 | Operation requires explicit conflict decision |
| 500 | Unexpected server failure |

## CORS

The API currently enables CORS globally for local development.

CORS does not authenticate callers.

The application has no authorization layer and should remain bound to loopback unless a security model is added.

## Direct API usage

Example:

~~~bash
curl -X POST http://127.0.0.1:3001/api/boards \
  -H 'Content-Type: application/json' \
  -d '{"name":"MVP","description":"Demo"}'
~~~

The MCP server should normally be preferred for AI-agent operations because it adds convenient name resolution and safer tool contracts.
