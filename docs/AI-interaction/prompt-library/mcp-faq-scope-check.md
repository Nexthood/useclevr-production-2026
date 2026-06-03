# MCP And FAQ Scope Check Prompt

Use this prompt when changing MCP tools, FAQ content, help chat, dashboard search, or public support links.

```text
Review MCP and FAQ scope before editing.

Check:
- MCP stays under the authenticated app API.
- MCP tools require a signed-in user.
- Dataset resources and tool calls stay scoped to the owning user.
- Super-admin access stays explicit.
- Hidden URLs are not the security model.
- Service-token or admin-token access validates approved internal clients with specific role allowlists, rate limiting, and secure audit logging.
- Public FAQ content stays available through public FAQ pages and help chat, not public MCP discovery.
- Dashboard FAQ includes signed-in support, billing, dataset, report, credit, and Hybrid AI answers.
- Operator FAQ content is visible only to super-admin users.
- Search and help chat return role-appropriate FAQ results.
- Requirements and changelog update when user-visible behavior changes.
- AI tracing guidance updates when MCP tools or FAQ sources change AI-visible context.

Do not add `mcp.useclevr.com` unless the task explicitly approves an external customer-facing MCP service with separate auth, rate limits, logs, audit trail, and service ownership.
```
