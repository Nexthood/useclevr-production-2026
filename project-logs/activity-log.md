# Project Activity Log

This file summarizes current project activity. Detailed session records live in
[interactive-log.md](interactive-log.md).

## 2026-06-08

- Align the Payload login surface with UseClevr app authentication and simplify the sidebar
  collapse control.
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
- Fix Payload CMS seed crash with explicit table-existence check in onInit handler.
- Add Docker HEALTHCHECK to dist-root/Dockerfile and generated Dockerfile.
- Add SIGTERM graceful shutdown handler to start-dist.cjs.
- Document hotfix path and emergency rollback procedure in GITHUB_WORKFLOW.md.
- Add FAQ seed data to Payload Faqs collection (5 categories, 25 questions) and wire MCP handler to read from Payload with fallback.
- Fix Auth.js 500 on `/api/auth/session` by setting `AUTH_SECRET` on Railway services and accepting `NEXTAUTH_SECRET` fallback.
- Add superadmin MCP token management page with create/revoke/list UI and sidebar nav entry.
- Add middleware blocking non-MCP routes on MCP subdomains (404 for everything except /api/mcp).
- Fix Railway deploy crash: add pnpm install --prod to Dockerfile so pg is available for railway-predeploy.cjs.
- Expose published Payload news through the scoped MCP news tool.
- Align Railway cleanup guidance, MCP task state, and AI interaction records for commit.

## 2026-06-09

- Fix auto-merge chain so PR merges trigger dist publish via workflow_dispatch.
- Remove pnpm install from Dockerfiles — standalone node_modules is complete.
- Railway Metal builder incident identified, then moved to monitoring. Production deploy pending.
- Keep node_modules in dist branch commits (stop CI from deleting them). Railway Docker build needs pg for predeploy script.
- Fix beta CI dist-root copy (cp -a copied dir not contents, fallback .gitignore with node_modules generated).

## 2026-06-11

- Make topbar sections icon-only (Business, Mentoring, Credits, Admin, Profile). Hybrid AI, Search, Onboarding keep labels.
- Fix login page: top padding, use `result.ok` instead of `getSession()` for reliable sign-in flow.
- Add sign-up/sign-in nav links to Payload admin login, style to match app login page.
- Fix middleware blocking MCP token auth: add `/api/mcp` to public API paths so token headers reach the route handler.
- Test MCP test subdomain FAQ tool: create DB token, verify endpoint reachable, identify middleware auth gap.
- Wrap business profile db updates in try/catch to prevent server action crashes.
- Fix Stripe checkout success URL param name (`s` → `session_id`).
- Remove `superadmin` from admin plan dropdown — only billing plans listed.
- Audit Railway config, Dockerfile, predeploy, health endpoint — all correct.
