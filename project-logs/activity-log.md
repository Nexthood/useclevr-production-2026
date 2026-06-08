# Project Activity Log

This file summarizes current project activity. Detailed session records live in
[interactive-log.md](interactive-log.md).

## 2026-06-08

- Restore Railway test deployment health and document packaged Next.js runtime recovery.
- Restore administrator credential login and public-host redirects.
- Consolidate duplicate TODO identifiers and stale deployment status records.
- Move reusable prompts to `project-prompts/` and project session records to `project-logs/`.
- Add a pre-commit project-record checklist for changelog, logs, and AI-interaction guidance.
- Add Railway variable management with redacted output and MCP discovery server metadata.
- Remove all 350 Railway deployments from production, test, and landingpage services.
- Add `cleanup` subcommand to railway.cjs CLI wrapper and `pnpm railway:cleanup` npm script.
- Test MCP FAQ tool end-to-end: token creation, tool listing, filtered/keyword queries, scope enforcement.
- Create database-backed MCP tokens (`MCPToken`, `MCPAuditLog`) and wire MCP tracing into AI interaction traces.
- Expose published Payload news through the scoped MCP news tool.
- Align Railway cleanup guidance, MCP task state, and AI interaction records for commit.
