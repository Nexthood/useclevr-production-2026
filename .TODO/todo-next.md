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
- T-778. Fix Railway test service deploy so test.useclevr.com serves the beta build instead of returning 404. (labels: deployment, ci-build)
- T-792. Fix Railway production deploy crash from missing next/dist/build/output/log.js in standalone output by restoring build directory at packaging time and adding runtime fallback shim. (labels: deployment, ci-build, stability)

## Label: monitoring

- T-793. Add container health recovery with automatic restart on unhandled application crashes and memory threshold breaches. (labels: monitoring, deployment, stability)
- T-794. Add graceful shutdown handling for database connections, background jobs, and AI trace flush on SIGTERM in production containers. (labels: monitoring, deployment, data)

## Label: mcp

- T-807. Configure DNS CNAME records: `mcp.useclevr.com` → Railway production hostname, `mcp-test.useclevr.com` → Railway test hostname; verify subdomain routing to `/api/mcp` endpoint. (labels: mcp, deployment, docs)
- T-808. Add FAQ seed data to Payload Faqs collection and wire MCP getFaqs tool to fall back to Payload content when no static FAQ cache is available. (labels: mcp, content, workflow)
- T-809. Test MCP token creation, authentication, scope enforcement, and audit logging end-to-end via the new /api/mcp/tokens endpoint. (labels: mcp, testing, security)

## Label: workflow

- T-703. Add pre-commit hooks for code quality and formatting checks. (labels: workflow, ci-build)
- T-801. Define and document the branch strategy for beta → main → dist release workflow including hotfix path and emergency rollback procedure. (labels: workflow, deployment, devops)
- T-802. Create a branch management guide documenting the deploy circulation loop, who pushes where, and how to unblock a failed publish. (labels: workflow, docs, deployment)
- T-803. Implement automated stale branch cleanup that deletes merged feature branches and warns about abandoned beta branches after 14 days. (labels: workflow, devops, deployment)

## Deferred

## Suggestions

## Suggestions
