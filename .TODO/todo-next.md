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
- T-808. Add FAQ seed data to Payload Faqs collection with 5 categories and 20 questions. (labels: mcp, content, faq)
- T-811. Add MCP token management UI in superadmin panel for creating and revoking service tokens. (labels: mcp, ui, security)
- T-812. Add FAQ seed data to Payload Faqs collection with category pages and public read access. (labels: mcp, content, workflow)

## Label: workflow

- T-703. Add pre-commit hooks for code quality and formatting checks. (labels: workflow, ci-build)
- T-801. Define and document the branch strategy for beta → main → dist release workflow including hotfix path and emergency rollback procedure. (labels: workflow, deployment, devops)
- T-814. Add README.md for dist branch explaining deployment structure and recovery procedures. (labels: deployment, docs, workflow)

## Deferred

## Suggestions

## Suggestions
