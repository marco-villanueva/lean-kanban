# User Guide

This document describes the browser application from the perspective of a human user.

## Application model

Lean Kanban has four visible domain objects:

~~~text
Board
  -> Column
      -> Issue
          -> Comment
~~~

A board is an independent Kanban workspace.

A column represents a workflow state or any grouping you choose.

An issue is the main unit of work.

Comments are plain-text notes attached to an issue.

## Boards screen

The Boards screen is the application home.

It provides:

- local board search;
- Import action;
- board cards;
- board counts;
- board context menus.

The persistent New board action is in the sidebar.

When there are no boards, the empty state also offers Create board and Import JSON.

### Search boards

Search matches:

- board name;
- board description.

Search is local to the current list.

### Board cards

Each card shows:

- name;
- description;
- number of columns;
- number of issues.

Open the board by clicking the card or pressing Enter while the card is focused.

The context menu contains destructive board actions.

## Create a board

Click New board.

Fields:

- Name, required.
- Description, optional.

The dialog can be closed by:

- Cancel;
- close button;
- Escape;
- clicking the backdrop.

After creation, the application navigates directly to the new board.

## Board page

A board page contains:

- breadcrumb;
- board title and description;
- board action menu;
- search;
- column filter;
- Create issue action;
- Kanban/List switch;
- columns and issues.

## Board settings

Open the board action menu and choose Board settings.

Settings include:

- board name;
- board description;
- columns;
- column color;
- add column;
- delete column;
- delete board.

### Column colors

Columns support:

- shared preset palette;
- native custom color picker;
- reset to the default color.

The color is used as a visual identifier in the column header and status indicators.

### Deleting a column

If a column contains issues, the application requires an explicit decision.

You can:

- move issues to another column and delete the column;
- delete the column and its issues.

Deleting issues also cascades their comments.

## Kanban view

Kanban view displays one vertical lane per visible column.

Columns can be reordered horizontally.

Issues can be reordered inside a column and moved between columns.

Issue position is persisted in SQLite.

### Drag-and-drop and filters

When search text or a column filter is active, drag-and-drop reordering is intentionally disabled.

Filtered lists do not expose the complete persisted ordering. Disabling DnD prevents an ambiguous filtered reorder from silently changing data.

Clear search and filters before reordering.

### Keyboard drag-and-drop

The application configures dnd-kit keyboard support in addition to pointer dragging.

## Create an issue

You can create issues from:

- the board toolbar;
- the bottom of a column.

Minimum requirement:

- title.

Toolbar creation also lets you choose the destination column.

A new issue is appended to the end of the target column.

## Issue card

A Kanban issue card shows:

- title;
- optional description preview;
- short visual fragment of its UUID;
- comment count when comments exist;
- updated date;
- optional colored left accent.

The short UUID fragment is a display convenience only. The real issue ID remains the full UUID.

## Issue drawer

Click an issue in Kanban or List view.

The drawer supports:

- title editing;
- description editing;
- status/column change;
- issue color;
- comments;
- deletion.

Escape closes the drawer when a comment is not actively being edited.

### Status

Status maps directly to the issue column.

Changing status moves the issue to the end of the selected column.

The status UI uses the column color as a small dot.

### Issue color

Issue color is optional and independent of the column color.

Choices:

- no color;
- preset palette;
- custom native color picker.

In Kanban, issue color is shown as a thin left accent.

In List view, issue color is shown subtly rather than filling the whole row.

### Description

Description is plain text and optional.

An issue without a description shows an Add a description action.

### Comments

Comments are plain text.

You can:

- add;
- edit;
- delete.

There are intentionally no comment authors because the product currently has no user system.

## List view

List view is a compact table representation of the same board data.

It shows:

- issue;
- status;
- comments;
- updated date.

Click or keyboard-activate a row to open the same Issue Drawer.

Switching views does not change the underlying board data.

## Search issues

Search matches issue:

- title;
- description.

The comparison is case-insensitive.

Search affects both Kanban and List views.

## Filter by column

The column filter limits the visible issues and, in Kanban, limits visible columns to the selected column.

Select All columns to return to the full board.

## Export

The board menu supports:

- Export Kanban JSON.
- Export Simple JSON.
- Copy JSON.

Full Kanban JSON is intended as a faithful portable backup.

Simple JSON is optimized for interoperability.

See import-export.md.

## Import

Import is a board-level creation action on the Boards screen.

Import always creates a new board.

It does not merge into the board you are currently viewing.

Sources:

- upload a JSON file;
- paste JSON into the dialog.

The dialog performs a lightweight structural preview.

The API performs authoritative validation when Import is submitted.

## Error states

The UI includes explicit states for:

- loading boards;
- loading a board;
- missing/unavailable board;
- API request errors;
- invalid import data;
- failed issue creation;
- failed DnD persistence.

If the entire UI cannot reach the API, verify that pnpm dev:api is running.

## Responsive behavior

Desktop is the primary target.

At narrower widths:

- the sidebar gets smaller;
- on mobile widths the sidebar becomes an overlay;
- the toolbar can scroll horizontally;
- the issue/settings drawer becomes full-width.

The Kanban remains horizontally scrollable rather than collapsing columns into a different interaction model.

## Destructive operations

Destructive operations currently use explicit menus and/or browser confirmation.

Before deleting a board, export it if recovery may be needed.

SQLite does not provide an application-level undo history.

## Recommended workflow

A practical minimal flow is:

1. Create a board for one project.
2. Start with three to five columns.
3. Add issues only when they represent actual work or notes you want to track.
4. Use descriptions for context.
5. Use comments for incremental notes.
6. Use colors sparingly as visual cues.
7. Export before large destructive reorganizations.
8. Let agents operate the same board through MCP when that saves manual work.
