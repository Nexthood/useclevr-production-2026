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

- Add durable Payload Media storage and move News and FAQ MCP ownership to Payload-native API keys.
- Keep UseClevr MCP scopes and tools limited to product datasets and analysis.
- Separate dashboard theme and accessibility controls and align page bodies around center workspaces with optional sidebars.
- Move Business and Dataset summaries to right sidebars and keep table actions in selectable table headers.
- Prevent topbar popovers from being clipped and make the main sidebar navigation independently scrollable.
- Make topbar sections icon-only (Business, Mentoring, Credits, Admin, Profile). Hybrid AI, Search, Onboarding keep labels.
- Fix login page: top padding, use `result.ok` instead of `getSession()` for reliable sign-in flow.
- Add sign-up/sign-in nav links to Payload admin login, style to match app login page.
- Fix middleware blocking MCP token auth: add `/api/mcp` to public API paths so token headers reach the route handler.
- Test MCP test subdomain FAQ tool: create DB token, verify endpoint reachable, identify middleware auth gap.
- Add MCP write tools: createFaq, updateFaq, deleteFaq (faq:write + admin scope), createNews, updateNews, deleteNews (news:write + admin scope), listDatasets (dataset:read, user-scoped).
- Add faq:write and news:write scopes to schema, token creation, and auth context.
- Wrap business profile db updates in try/catch to prevent server action crashes.
- Fix Stripe checkout success URL param name (`s` → `session_id`).
- Remove `superadmin` from admin plan dropdown — only billing plans listed.
- Audit Railway config, Dockerfile, predeploy, health endpoint — all correct.

## 2026-06-12

- Persist dashboard updates, business setup, onboarding, and every dataset upload for locked
  built-in accounts.
- Repair configured database and Railway predeploy schema coverage for Business, Profile, and
  dataset timestamp writes.
- Give built-in accounts unrestricted upload and analysis access while keeping their identities
  fixed.
- Verify dashboard data mutation ownership and add repeatable built-in business CRUD coverage.
- Fix dataset bulk deletion and add archived secondary-business permanent deletion.
- Align Payload admin navigation and workspace styling with the dashboard design system.
- Place the sidebar collapse control beside Dashboard and document Railway cleanup that retains
  successful deployments.
- Validate and prepare dashboard persistence, Payload design, documentation, and AI interaction
  records as one commit.
- Verify that the UseClevr test MCP endpoint is not ready for ChatGPT developer mode and queue the
  required standard MCP transport and OAuth work.
- Register read-only locked test-account dataset tools in Payload MCP, route the test MCP host
  through Payload with a server-held restricted key, and keep private customer access behind
  deferred OAuth.
- Fix dist-root `.gitignore` patterns `build/` and `out/` matching any directory (not just root),
  which stripped compiled JS from pnpm store entries and caused runtime `MODULE_NOT_FOUND` for
  `@aws-crypto/crc32c` on Railway
- Extend `fixAwsSdkPackages` in `create-dist.cjs` to create top-level symlinks for bare transitive
  deps (tslib, fast-xml-parser) that the scoped AWS SDK packages depend on but Next.js standalone
  tracing omits

## 2026-06-13

- Align Payload content admin with the dashboard shell using a main-menu rail, topbar, page and
  body headers, focused center workspace, and responsive right information panels.
- Move business-profile administration, support issue review, and owner-assigned CSV uploads into
  Payload custom views backed by existing Drizzle records.
- Add Payload modal entry points for the dataset-aware AI Assistant and Hybrid AI controls.
- Align Payload requirements, migration guidance, API access documentation, testing guidance, and
  sales planning with the active operator workspace and existing application data ownership.
- Hide Payload product operations and AI actions from base CMS accounts through the official
  Payload authentication hook.
- Add focused Payload MCP migration tasks and update MCP docs, REST Client checks, access rules,
  requirements, changelog, and planning records to use `/api/payload/mcp` as the canonical connector.
- Remove current dashboard MCP documentation and keep historical project logs as historical records.
- Fix Markdown table alignment, table spacing, and fenced-code formatting so `pnpm lint:docs` passes.
- Add theme sync and Payload-native theme toggle to admin pages and login.
- Redesign Payload admin login with dashboard-style gradient backgrounds, card form, and teal buttons.
- Add nav footer with admin search modal, theme toggle, and logout to Payload sidebar.
- Add Lucide SVG icons to custom nav sections and CSS `::before` icons for built-in collection links.
- Add breadcrumb navigation to admin view page headers.
- Add 4 admin management views (Customers, Discounts, Levels, Progress) with CRUD via API routes.
