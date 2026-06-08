# Active TODO Queue

This file is the only active queue. Add confirmed implementation work here before it starts.

Get the T-number from `.TODO/config.json` before adding new tasks. Keep task numbers stable when
moving work between states.

## Links

- [TODO-next.md](todo-next.md)
- [TODO-done.md](todo-done.md)
- [TODO-ignore.md](todo-ignore.md)
- [TODO-future.md](todo-future.md)
- [.TODO/config.json](config.json)

## Label: deployment

- T-776. Fix Payload CMS seed crash during next build by wrapping onInit cms_users query with graceful table-existence check, so static page generation succeeds on fresh databases. (labels: deployment, content, ci-build)

## Label: monitoring

- T-793. Add container health recovery with automatic restart on unhandled application crashes and memory threshold breaches. (labels: monitoring, deployment, stability)
- T-794. Add graceful shutdown handling for database connections, background jobs, and AI trace flush on SIGTERM in production containers. (labels: monitoring, deployment, data)

## Label: mcp

- T-807. Configure DNS CNAME records: `mcp.useclevr.com` → Railway production hostname, `mcp-test.useclevr.com` → Railway test hostname; verify subdomain routing to `/api/mcp` endpoint. (labels: mcp, deployment, docs)
- T-808. Add five starter FAQ categories with 20 questions to the Payload Faqs collection and make the MCP FAQ tool use that content when the static FAQ cache is unavailable. (labels: mcp, content, workflow)
- T-809. Test MCP token creation, authentication, scope enforcement, and audit logging end-to-end via the new /api/mcp/tokens endpoint. (labels: mcp, testing, security)
- T-812. Add MCP token management UI in superadmin panel for creating and revoking service tokens. (labels: mcp, ui, security)

## Label: workflow

- T-703. Add pre-commit hooks for code quality and formatting checks. (labels: workflow, ci-build)
- T-801. Define and document the branch strategy for beta → main → dist release workflow including hotfix path and emergency rollback procedure. (labels: workflow, deployment, devops)
- T-815. Add MCP token management UI in superadmin panel for creating and revoking service tokens. (labels: mcp, ui, security)
- T-814. Add five starter FAQ categories with 20 questions to the Payload Faqs collection and wire MCP FAQ tool to use that content. (labels: mcp, content, workflow)

## Deferred

## Suggestions

## Suggestions
