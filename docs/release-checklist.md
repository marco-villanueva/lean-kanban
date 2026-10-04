# Release Candidate Checklist — v0.1.0

This checklist closes the first Lean Kanban implementation cycle.

Do not add product features while running this checklist. Fix only regressions, correctness problems, accessibility defects, or documentation gaps.

## Automated gate

From a clean checkout:

```bash
pnpm install --frozen-lockfile
pnpm check
```

Expected:

```text
typecheck PASS
tests     PASS
build     PASS
```

Also verify:

```bash
pnpm db:migrate
pnpm start:api
curl http://127.0.0.1:3001/api/health
```

Expected:

```json
{"ok":true}
```

## Clean database smoke test

```bash
rm -f data/kanban.db data/kanban.db-wal data/kanban.db-shm
pnpm db:migrate
pnpm dev:api
pnpm dev:web
```

Then verify manually:

- create a board;
- edit board name and description;
- create at least five columns;
- recolor columns with presets and a custom color;
- reorder columns;
- create at least ten issues;
- edit issue title and description;
- set, change and remove issue colors;
- reorder issues within the same column;
- move issues between columns;
- add, edit and delete comments;
- search in Kanban;
- filter by column;
- confirm drag/reorder is disabled while filters are active;
- switch between Kanban and List;
- open the same issue from both views;
- export Full Kanban JSON;
- export Simple JSON;
- delete the board;
- import the Full JSON;
- confirm board structure, colors, issue order and comments were restored.

## Destructive flows

Verify:

- deleting a non-empty column requires an explicit decision;
- moving issues while deleting a column preserves them;
- deleting issues also deletes their comments;
- deleting a board requires confirmation in the UI;
- MCP `delete_board` requires `confirm: true`.

## Error flows

Verify:

- API unavailable while the web app is open;
- MCP called while the API is unavailable;
- malformed JSON import;
- invalid color import;
- duplicate portable ids;
- issue referencing a missing column;
- empty required fields;
- text over configured limits.

MCP connection failure should explain the configured API endpoint and how to start the API.

## MCP smoke test

With the API running and the MCP client configured:

1. List boards.
2. Create board `MCP RC`.
3. Create `Todo`, `Doing`, and `Done`.
4. Reorder the columns.
5. Create at least five issues.
6. Set a column color.
7. Set and remove an issue color.
8. Move an issue without specifying `position`; it should append.
9. Add and edit a comment.
10. Call `get_board` without comments.
11. Call `get_board` with `includeComments: true`.
12. Export Simple JSON.
13. Import a board by passing the JSON object directly to `import_board.data`.
14. Delete the temporary board using `confirm: true`.

## Viewports

Check at approximately:

```text
1920px
1366px
1024px
768px
```

Verify:

- sidebar remains usable;
- board keeps horizontal scrolling;
- toolbar does not overlap;
- drawer remains usable;
- dialogs remain inside viewport;
- menus do not render off-screen.

## Large local dataset smoke test

Use one board with approximately:

- 20 columns;
- 100 issues;
- comments on several issues.

This is not a benchmark. It only checks for obvious query, layout, scrolling or rendering problems.

## Security check

Confirm the API still defaults to:

```text
127.0.0.1
```

Do not publish or bind to an untrusted network. There is no authentication or authorization.

## Repository check

Verify:

- no `.npm-cache`, `.pnpm-store`, `.pnpm-global`, database files or secrets are tracked;
- `pnpm-lock.yaml` contains root, API, web and MCP importers;
- examples import successfully;
- README commands match actual package scripts;
- CI workflow uses `pnpm install --frozen-lockfile` and `pnpm check`.

## Release decision

Create the `v0.1.0` tag only after:

- automated gate is green;
- manual UI smoke test is green;
- MCP smoke test is green;
- no P0/P1 regression remains.

If any check fails, fix the smallest underlying problem and rerun the relevant section.

## Deliberately deferred

These are not release blockers:

- auth;
- users;
- teams;
- labels;
- priority;
- due dates;
- attachments;
- notifications;
- realtime;
- analytics;
- reports;
- PostgreSQL;
- remote MCP;
- dark mode.

## License

The repository currently has no license decision recorded. Choose and add a LICENSE before treating the public repository as reusable open-source software.
