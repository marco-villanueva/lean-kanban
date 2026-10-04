# Import and Export

Lean Kanban treats JSON portability as a first-class product feature.

Import/export is not a raw SQLite backup. It represents semantic board content independently from one database instance.

## Goals

Portable formats should support:

- backup;
- reconstruction;
- moving boards between local installations;
- human inspection;
- AI-agent generation;
- scripts and transformations.

## Two formats

Lean Kanban supports:

1. Full Kanban JSON.
2. Simple JSON.

## Full Kanban JSON

Identifier:

~~~json
{
  "format": "lean-kanban",
  "version": 1
}
~~~

This format is intended for faithful reconstruction.

### Shape

~~~json
{
  "format": "lean-kanban",
  "version": 1,
  "board": {
    "name": "Product Launch",
    "description": "Launch work"
  },
  "columns": [
    {
      "id": "todo",
      "name": "Todo",
      "color": "#2563EB",
      "position": 0
    }
  ],
  "issues": [
    {
      "id": "draft-copy",
      "columnId": "todo",
      "title": "Draft copy",
      "description": "First version",
      "color": "#7C3AED",
      "position": 0,
      "comments": [
        {
          "content": "Keep it short"
        }
      ]
    }
  ]
}
~~~

### Required structural rules

Top level:

- format must equal lean-kanban.
- version must equal 1.
- board required.
- columns required.
- issues required.

Board:

- name required;
- description optional.

Column:

- portable id required;
- id max 200;
- name required;
- color required;
- position integer >= 0.

Issue:

- portable id required;
- columnId required;
- title required;
- description optional;
- color optional/null;
- position integer >= 0;
- comments optional.

Comment:

- content required.

### Referential rules

Within one Full JSON document:

- column IDs must be unique;
- issue IDs must be unique;
- every issue.columnId must reference an existing exported column.

### Position handling

Columns are sorted by exported position during import and then renumbered sequentially.

Issues are grouped by column, sorted by exported position, then renumbered sequentially.

The importer does not require gaps or duplicate numeric positions to map directly to SQLite.

### Portable IDs

Export does not expose internal SQLite UUIDs as the contract.

It generates readable portable IDs based on order and slugged names/titles.

Example:

~~~text
col-0-todo
issue-0-draft-landing-page
~~~

Import generates new internal UUIDs.

Therefore Full JSON is a semantic backup, not an identity-preserving database clone.

## Simple JSON

Simple JSON is designed for:

- humans;
- LLMs;
- scripts;
- hand-written imports;
- lower-token agent exchanges.

### Shape

~~~json
{
  "name": "Product Launch",
  "description": "Launch work",
  "columns": [
    {
      "name": "Todo",
      "color": "#2563EB",
      "issues": [
        {
          "title": "Draft copy",
          "description": "First version",
          "color": "#7C3AED",
          "comments": [
            "Keep it short"
          ]
        }
      ]
    }
  ]
}
~~~

### Ordering

Array order defines:

- column order;
- issue order inside each column.

No explicit position field is required.

### Optional fields

Board:

- description optional.

Column:

- color optional;
- issues optional.

Issue:

- description optional;
- color optional/null;
- comments optional.

If a Simple JSON column does not specify a color, import assigns colors from the built-in palette in sequence.

If an issue has no color, it is imported with no explicit issue color.

## Shared validation limits

| Data | Limit |
| --- | --- |
| Board name | 120 |
| Board description | 2000 |
| Column name | 80 |
| Portable ID | 200 |
| Issue title | 200 |
| Issue description | 8000 |
| Comment content | 4000 |
| Color | #RRGGBB |

## Export semantics

Full export preserves:

- board metadata;
- column names/colors/order;
- issue title/description/color/order;
- comment content.

Simple export preserves the same user-visible content but uses array nesting instead of portable references.

Not preserved in either portable format:

- internal UUIDs;
- original created_at;
- original updated_at;
- comment IDs.

These values are regenerated on import.

## Import semantics

Every import creates a new board.

Import does not:

- merge into an existing board;
- overwrite a board;
- preserve internal UUIDs;
- deduplicate against existing board names.

Duplicate board names are therefore possible.

## UI import

The Boards page Import action supports:

- uploaded JSON file;
- pasted JSON.

The dialog performs a lightweight preview.

Authoritative validation occurs at the API.

A preview is not proof that import will succeed.

## API import

~~~http
POST /api/boards/import
Content-Type: application/json
~~~

Body is the JSON object itself.

## MCP import

The MCP tool accepts an object directly:

~~~text
import_board
  data: { ... }
~~~

Do not serialize the object to a JSON string before passing data.

## Examples

Valid:

~~~text
examples/full-board.kanban.json
examples/simple-board.json
~~~

Intentionally invalid:

~~~text
examples/invalid-column-reference.kanban.json
examples/invalid-color.simple.json
~~~

These are useful for testing validation behavior.

## Backup recommendation

For a board you may need to restore exactly in semantic terms, export Full Kanban JSON.

For sharing with an LLM or manually editing a board definition, Simple JSON is often easier.

## Round-trip test

The integration suite verifies the core pattern:

~~~text
create/import board
 -> export
 -> delete board
 -> import export
 -> compare semantic content
~~~

Comparison intentionally ignores internal UUIDs.

## Versioning

Current Full format:

~~~text
version: 1
~~~

There is no multi-version migration framework yet.

If a future schema change cannot remain backward compatible, add explicit version parsing and conversion rather than silently reinterpreting version 1.
