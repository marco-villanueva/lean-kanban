# Lean Kanban Documentation

This directory contains the full technical and operational documentation for Lean Kanban.

## Start here

If you are new to the project, read in this order:

1. getting-started.md
2. user-guide.md
3. architecture.md
4. mcp.md

If you are contributing code, continue with:

5. data-model.md
6. api-reference.md
7. development.md
8. testing.md

For data portability and operations:

9. import-export.md
10. troubleshooting.md
11. release-checklist.md

Agents should also read the repository-level AGENTS.md before changing code or operating boards.

## Documentation map

| Document | Purpose |
| --- | --- |
| getting-started.md | Install, run, configure and verify the project |
| user-guide.md | Complete browser UI usage |
| architecture.md | System architecture, boundaries and Lean design decisions |
| data-model.md | Domain objects, SQLite schema, relationships and ordering |
| api-reference.md | REST API endpoints, request bodies, responses and errors |
| mcp.md | MCP setup, tools, semantics and agent workflows |
| import-export.md | Full and Simple JSON formats and validation |
| development.md | Repository structure, coding conventions and change workflow |
| testing.md | Integration tests, CI and release verification |
| troubleshooting.md | Common setup, runtime, DnD, MCP and data problems |
| release-checklist.md | Manual and automated release-candidate gate |
| mcp-client.example.json | Copyable generic MCP client configuration |

Additional repository-level files:

| File | Purpose |
| --- | --- |
| README.md | Public project overview and quick start |
| AGENTS.md | Instructions for coding agents and product agents |
| SECURITY.md | Security model and disclosure guidance |
| LICENSE | MIT license |

## Current scope

Lean Kanban is local-first and single-user.

Current capabilities include boards, columns, issues, comments, configurable colors, ordering, Kanban/List views, JSON portability and MCP integration.

The project intentionally does not yet include users, authentication, teams, remote sync, realtime collaboration, notifications, labels, priorities, due dates, attachments, analytics or billing.

## Documentation rule

Documentation should describe behavior that exists in the repository today.

When behavior changes, update the relevant documentation in the same change. Avoid documenting speculative features as if they already exist.
