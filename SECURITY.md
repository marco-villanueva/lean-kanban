# Security

Lean Kanban is currently designed for local, single-user use.

## Current model

- No authentication.
- No authorization.
- No users, roles, teams or organizations.
- API defaults to `127.0.0.1`.
- MCP uses local stdio and calls the REST API.
- SQLite data is stored locally.

## Do not expose the API publicly

Do not bind the current API to `0.0.0.0` or expose it to an untrusted network unless you first add an explicit authentication and authorization model.

Anyone who can reach the API can currently read, create, change and delete board data.

## Sensitive data

Do not store secrets, passwords, private keys, access tokens or highly sensitive information in boards.

## Reporting

For this personal project, report security issues privately to the repository owner rather than opening an issue containing exploit details.
