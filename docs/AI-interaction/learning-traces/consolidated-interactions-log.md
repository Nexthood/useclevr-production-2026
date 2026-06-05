# Consolidated AI Interaction Log

This log documents all major AI agent interactions, user goals, decisions, implemented changes, and learnings during the current project cycle.

---

## Interaction 1: Codebase Restructuring, Refactoring, and Security Hardening

- **Date**: June 2026
- **User Goal**: Complete all outstanding tasks in `.TODO/todo-next.md` to consolidate structure, remove duplicate logic, and harden MCP security.
- **Current Product State**: Functional but with significant route and parser duplication, and lacking rate limiting and token-auth in MCP.
- **Implemented Changes & Decisions**:
  1. **Route Restructuring**: Moved all public pages to `src/app/(public)/` and dashboard pages to `src/app/(auth)/app/` to leverage Next.js Route Groups.
  2. **Auth Guard Consolidation**: Relocated auth guards from middleware to `src/app/(auth)/layout.tsx` and removed middleware redirections, dramatically speeding up public page requests.
  3. **CSV Parsing Consolidation**: Replaced four redundant inline CSV splitting/manual parsers in actions and handlers with a unified `parseCSVString` call (backed by PapaParse in `csvLoader.ts`).
  4. **Clean Numeric Parsing**: Extracted hardcoded currency symbols, date patterns, and `cleanNumericValue` helpers into `src/lib/utils/number-parser.ts` and imported them back in cleaner and preview-generator.
  5. **API Upload Route Unification**: Delegated `/api/upload/route.ts` directly to the canonical server action `uploadCSV`, shrinking the route file from 629 lines to 30 lines.
  6. **Security Hardening**:
     - Added Content-Security-Policy dynamic nonce generation inside `middleware.ts`.
     - Added secure API Key and permission validation to the public AI endpoint (`/api/public/ai/route.ts`).
     - Added strict rate limiting (50/min), audit logging, and `x-mcp-service-token` / `x-mcp-admin-token` client authentication to the MCP endpoint (`/api/mcp/route.ts`).
- **Problems Marked**:
  - `blocker`: Stale type caches under `.next/types/` threw compile errors after folder movement. Fixed by purging `.next/` cache.
  - `risk`: Unused imports and variables triggered linter warnings. Fixed by cleaning up `oauthAccount`, `redirect`, and other variables.
  - `improvement`: Manual CSV parsing couldn't handle edge cases like commas inside quotes. Consolidating into `csvLoader` completely resolved this.
- **User Learning**: Route groups in Next.js allow clean layout scoping and simplify middleware, maintaining security with excellent performance.
- **AI-Agent Learning**: Standardizing shared utilities (like `Result` and `parseCSVString`) before rewriting routes ensures structural stability and fast, error-free refactoring.

---

## Interaction 2: GitHub Actions Workflow Speed Optimization

- **Date**: June 2026
- **User Goal**: Optimize GitHub Actions workflows for speed, reliability, and concurrency, preserving existing Railway deploy logic.
- **Current Product State**: Workflows lacked pnpm dependency caching, concurrency controls, or path-based filtering, leading to duplicate runs and slower build times.
- **Implemented Changes & Decisions**:
  1. **Concurrency Groups**: Added `concurrency` cancelling to `ci.yml` to automatically cancel stale runs on new pushes.
  2. **Path Filtering**: Added `paths-ignore` for `docs/**`, `.TODO/**`, `*.md`, etc., to prevent triggering expensive build/deploy actions when only docs or todo files are changed.
  3. **Dependency Caching**: Enabled `cache: "pnpm"` on all `actions/setup-node@v6` steps across validation and maintenance workflows, greatly speeding up `pnpm install` execution times.
- **Problems Marked**:
  - `improvement`: Redundant validation or building steps could be avoided by caching node dependencies.
- **User Learning**: Concurrency and path ignore filters save significant CI minutes and prevent race conditions.
- **AI-Agent Learning**: Always check for dependency caching options when working with setups like `actions/setup-node`.

---

## Interaction 3: Agent Config Memory Ritual + Dashboard/Sidebar UI Fixes

- **Date**: June 2026
- **User Goal**: Enforce post-interaction memory capture across all agent-facing configs, then fix 5 dashboard UI issues (profile demo disabling, sidebar collapse button positioning/size, scroll-to-top on navigation, app version display, nested scroll containers).
- **Current Product State**: Post-interaction memory capture existed as a prompt file but wasn't wired into agent configs. Profile form accepted an `isDemo` prop but never used it. Sidebar collapse button sat outside the sidebar border. Pages with nested `min-h-screen` or `overflow-y-auto` created double scroll.
- **Implemented Changes & Decisions**:
  1. **Agent Configs**: Added post-interaction memory capture rules to `ai-chat-behavior.config.ts`, `gemini-behavior.config.ts`, `AGENTS.md`, and `.kilo/agent/changelog.md`.
  2. **Profile Form**: Disabled name/email inputs when `isDemo=true`, added demo notice banner, disabled submit button — the prop existed but wasn't wired to the UI.
  3. **Sidebar Collapse**: Moved button from `-right-3` (outside panel) to `right-2` (inside panel), increased from h-10 to h-12, enlarged icon.
  4. **Scroll Fixes**: Removed nested `min-h-screen` and nested `<main>` from datasets client. Removed `overflow-y-auto` from admin traces/benchmarking pages. Added `window.scrollTo` on route change.
  5. **App Version**: Added `v7.0.0` display under credit panel in sidebar.
  6. **Dead Code**: Removed unused `TopbarSidebarToggle` component and unused shadcn `sidebar.tsx`.
- **Problems Marked**:
  - `observation`: Profile `isDemo` prop existed but was never used for UI gating — the form let demo users type but silently failed on save.
  - `observation`: Sidebar collapse button was positioned outside the sidebar panel, overlapping the border.
  - `observation`: `PageVisitTracker` already tracks pathname changes and is the natural home for scroll-to-top side effect.
  - `observation`: `NEXT_PUBLIC_APP_VERSION` not configured in CI — version falls back to hardcoded `"7.0.0"`.
- **User Learning**: Post-interaction capture must be distributed across the correct files, not dumped in a single temp summary. AI should use product language in responses, not file paths or function names.
- **AI-Agent Learning**: Read `dev-persona.md` before starting work with this dev. They prefer short, direct result summaries in product language. When they say "too tech", strip all code references and reframe. Keep configs, docs, and TODOs in sync in the same pass.
- **Interaction Evaluation**: The first delivery (single-file tech summary at `/tmp/opencode/`) was wrong in two ways: it dumped everything in one file instead of distributing across the right docs, and it used file paths and code references instead of product language. The user corrected with "that is too tech" and "should be in multiple files". The correction propagated to 3 files: a dev-persona profile, an updated interaction log entry, and a user FAQ addition. Future evaluations should recognize this pattern immediately: if the user asks for a summary of what happened, distribute the learning across the relevant docs (persona, log, guides) in product language — never a single temp file with code references.

---

## Interaction 4: MCP Developer Guide Expansion + OpenCode MCP Config

- **Date**: June 2026
- **User Goal**: Document MCP support across ChatGPT web, OpenCode, VS Code native, terminal CLI clients, and VS Code extensions. Add MCP server config to opencode and verify it works.
- **Current Product State**: MCP dev guide only covered UseClevr's internal MCP interface. No MCP server configured in `.opencode.json`. No documentation of third-party MCP clients or platforms.
- **Implemented Changes & Decisions**:
  1. **ChatGPT Web MCP**: Documented Developer Mode (full read/write) and Connectors (read-only search/fetch), including availability tiers, transport constraints, and security rules.
  2. **OpenCode MCP Config**: Added `mcp_everything` test server to `.opencode.json` with local `npx` command. Documented local, remote, OAuth, and per-agent scoping patterns.
  3. **VS Code Native MCP**: Documented `.vscode/mcp.json` config, all supported features (tools, prompts, resources, MCP Apps, sampling, OAuth), configuration methods (6 entry points), management commands, extension-bundled servers, and development mode debugging.
  4. **Terminal MCP Clients**: Documented 7 CLI tools (mcpc, mcpx, mcp-cli, mcp2cli, mcp-gateway-cli, mcp-proxy-cli, mcpmu) with install commands, transport support, and feature comparisons.
  5. **VS Code MCP Extensions**: Documented 7 popular marketplace extensions (VSCode MCP, VSCode-MCP Server, VSC-MCPServer, Maestro MCP, VSCode MCP Bridge, IDE-LSP, MCP Tool Explorer) with tool lists, transport details, and configuration.
  6. **Quick Reference Table**: Added decision guide mapping user needs (add to AI agent, use in Copilot, call from terminal, pipe to jq, connect to ChatGPT, debug, aggregate, test, expose LSP) to the recommended client.
- **Problems Marked**:
  - `observation`: `@modelcontextprotocol/server-everything` spawns a persistent process — background verification in shell timed out; needs opencode restart to confirm.
  - `improvement`: MCP dev guide now covers both internal UseClevr MCP and external third-party client/platform documentation in one file.
- **User Learning**: MCP is now supported across all major coding platforms — OpenCode, VS Code native, ChatGPT web, and multiple terminal CLI clients. The `.opencode.json` config is the standard entry point for OpenCode MCP.
- **AI-Agent Learning**: When documenting MCP, cover all major clients (AI coding agents, IDEs, web chat, terminal CLIs, inspector tools) in one comprehensive guide rather than scattering across files. Use a quick-reference table to help users choose the right tool for their need.
- **Follow-Up**: Verify the `mcp_everything` server works by restarting opencode and testing with a tool call prompt.

---

## Interaction 5: Workflow Required-Check Drift Guard + Parallel-Agent Memory Scope

- **Date**: June 2026
- **User Goal**: Update the docs and post-interaction actions while another AI agent continues working in the same repository.
- **Current Product State**: The repository now guards workflow action refs and workflow check-run names locally, but the AI-interaction docs also need to teach agents how to record that safeguard and how to scope memory updates during parallel work.
- **Implemented Changes & Decisions**:
  1. **Workflow Guard Documentation**: Updated the AI-interaction docs so workflow guard changes are treated as durable instruction changes, not as one-off CI fixes.
  2. **Parallel-Agent Scope Rule**: Added a rule that the active AI agent updates only the instruction and learning files that match its own completed change when another agent is editing in parallel.
  3. **Post-Interaction Prompt Precision**: Tightened the post-interaction prompt so the memory record names the actor, action, and destination with no vagueness.
- **Problems Marked**:
  - `risk`: Branch protection can wait forever if the required check name drifts from the emitted GitHub Actions check-run name.
  - `observation`: Parallel AI work can pollute the memory record if one agent tries to summarize unrelated worktree changes from another agent.
- **User Learning**: Workflow job-name guarding belongs in both the developer workflow docs and the AI memory rules, because the same drift can break merge flow even when the workflows are green.
- **AI-Agent Learning**: When another AI agent is active in the same repository, keep the post-interaction update scoped to your own completed change and the smallest matching instruction files.

---

## Interaction 6: MCP FAQ Tool + Railway CLI Usage Guidance

- **Date**: June 2026
- **User Goal**: Add FAQ querying to the app's MCP server, commit, create PR from beta to main, check Railway deploy status, and update agent instructions so other AIs can find Railway CLI usage without hand-crafting GraphQL queries.
- **Current Product State**: MCP had dataset-analysis tools but no FAQ capability. No Railway CLI usage reference existed in AGENTS.md. The railway-deploy-review prompt lacked CLI status commands.
- **Implemented Changes & Decisions**:
  1. **MCP FAQ Tool**: Added `getFaqs` tool to `src/lib/mcp/` — filters by category, keyword search, or returns all FAQs from `src/lib/content/faq.ts`. Registered in tools.ts, handlers.ts, server.ts, integration.ts.
  2. **MCP Docs**: Updated `docs/Developer_Guides/MCP.md` with local ping process and FAQ tool listing.
  3. **PR & Deploy**: Created PR #120 from beta → main, auto-merged, dist branch published, Railway deploy triggered.
  4. **Railway CLI Guidance**: Added Railway CLI section to `AGENTS.md`, updated `ai-agent-guide.md` with explicit commands, updated `railway-deploy-review.md` prompt with CLI status commands, added "do not hand-craft GraphQL" warning to `RAILWAY_DEPLOYMENT.md`.
- **Problems Marked**:
  - `observation`: Railway API GraphQL schema changes frequently — hand-crafted queries fail silently or return schema errors.
  - `improvement`: AI agents now have a direct Railway CLI reference in AGENTS.md instead of guessing the auth flow.
- **User Learning**: Use the project's Railway wrapper at `scripts/server/railway/railway.cjs` for auth, status, and connectivity. Use `railway deployment list` for recent deployment statuses. Never hand-craft Railway GraphQL queries.
- **AI-Agent Learning**: Before querying any external API (Railway, GitHub, etc.), check if the project already has a wrapper script, doc reference, or pnpm script for that purpose. Hand-crafted API calls bypass auth loading, error formatting, and environment handling that the project scripts already provide.

---

## Interaction 7: UseClevr MCP Local Ping + VS Code Integrated Browser Test Documentation

- **Date**: June 2026
- **User Goal**: Test the internal UseClevr MCP route locally and document terminal and VS Code testing paths.
- **Current Product State**: The internal `/api/mcp` route answers locally. The unsigned ping returns `401 Unauthorized`, which confirms the route exists and the current auth boundary blocks unauthenticated access. A positive tool-list response requires a valid signed-in session cookie.
- **Implemented Changes & Decisions**:
  1. **Terminal Test Path**: Documented unsigned route reachability, signed-in tool listing, and signed-in tool invocation examples.
  2. **VS Code Test Path**: Documented REST Client, Thunder Client, and VS Code integrated browser testing paths for the current JSON route.
  3. **Manual-Step Rule**: Recorded that the AI agent can run the terminal half and document the browser-cookie step, but cannot click the integrated browser or extract its live cookies directly.
- **Problems Marked**:
  - `observation`: `curl -b cookies.txt http://127.0.0.1:3000/api/mcp` returned `401 Unauthorized`, so the local cookie jar did not contain a valid active session.
- `risk`: Agents can overclaim browser testing if they do not mark live browser-cookie extraction as a manual local operator step.
- **User Learning**: The current negative ping is still useful because it confirms route reachability and the active auth boundary. The positive local MCP list test needs a valid signed-in session cookie.
- **AI-Agent Learning**: When a test depends on a live browser cookie or IDE-integrated browser state, document the manual step directly and do not imply the AI agent completed the browser interaction itself.

---

## Interaction 8: Shared REST Client API Tests + MCP Request Files

- **Date**: June 2026
- **User Goal**: Add a shared REST Client testing kit, test the current MCP route, update docs, and record the durable post-interaction learning.
- **Current Product State**: The local app returns `200` from `/api/health` and returns `401 Unauthorized` from unsigned `/api/mcp`. The team needed a Git-tracked API testing path instead of personal-only request collections.
- **Implemented Changes & Decisions**:
  1. **Shared REST Client Files**: Added `docs/api-tests/` request files for health, auth, upload, analyze, business profile, billing, Railway smoke, and MCP checks.
  2. **VS Code Environments**: Added safe shared REST Client base URLs in `.vscode/settings.json` for local, staging, and production.
  3. **MCP Current-State Testing**: Recorded the real local MCP contract directly in the shared request files and MCP guide.
- **Problems Marked**:
  - `observation`: Unsigned `/api/mcp` still stops at the current auth boundary, so a positive MCP request example must remain a manual signed-in session step.
  - `improvement`: Shared API tests now live in one Git-tracked location that other developers can reuse without exporting personal tool collections.
- **User Learning**: Use `docs/api-tests/` as the shared project API test source of truth. Reuse a temporary local session cookie only when a protected route needs a signed-in request.
- **AI-Agent Learning**: When the user asks for shared API testing, create reproducible REST Client files in the repo first and treat personal test tools as secondary.

---

## Interaction 9: Future Docs Branch Audience Separation

- **Date**: June 2026
- **User Goal**: Keep the future docs-branch plan explicit that user-facing docs stay separate from operator docs, even when both live on one docs host with operator login.
- **Current Product State**: The repository already had a docs-subdomain planning file, but the audience boundary needed to be stated as a durable information-architecture rule instead of staying implicit.
- **Implemented Changes & Decisions**:
  1. **Planning Rule**: Updated the docs-subdomain planning file so public user docs and protected operator docs stay separate in routes, navigation, search scope, breadcrumbs, and sitemap behavior.
  2. **Hook Rule**: Updated AI-interaction guidance so future agents record docs-audience separation in the planning file that owns docs structure instead of scattering the rule across active TODO files.
- **Problems Marked**:
  - `risk`: A combined docs host can still blur audiences if login is treated as the only boundary and the route structure stays mixed.
  - `improvement`: Future docs planning now has one owning document for the public-versus-operator split.
- **User Learning**: One docs host can stay acceptable if the public user-doc structure and the protected operator-doc structure remain separate by design.
- **AI-Agent Learning**: When a planning change defines durable docs information architecture, update the owning plan and the smallest matching AI-instruction files instead of creating duplicate TODO entries.

---

## Interaction 10: Payload Login and MCP Auth Boundary Fix

- **Date**: June 2026
- **User Goal**: Fix Payload admin login and MCP authenticated testing, then record the durable rule in docs and post-interaction files.
- **Current Product State**: The proxy blocked unauthenticated app-auth and Payload-auth API routes, so login could not start. Payload local admin startup also attempted automatic schema push against the shared database.
- **Implemented Changes & Decisions**:
  1. **Proxy Auth Boundary**: Allowed the app auth routes and the required Payload CMS auth routes to stay reachable before login, while keeping the rest of the protected API surface behind authentication.
  2. **Payload Dev Safety**: Disabled automatic Payload schema push during normal local startup.
  3. **Runtime Verification**: Verified app login, Payload login API, authenticated MCP access, and signed session retrieval against the live local server.
- **Problems Marked**:
  - `risk`: A global API guard can accidentally block the login routes that are required to create the session in the first place.
  - `risk`: Payload local admin startup can become unsafe if development auto-push runs against the shared app database.
- **User Learning**: When login fails across both app auth and Payload auth, verify the proxy boundary before treating the credentials or provider setup as broken.
- **AI-Agent Learning**: When auth testing fails at the first request, verify the route guard and the required pre-login endpoints before debugging deeper provider logic.

---

## Interaction 11: Payload Admin Root Runtime Recovery

- **Date**: June 2026
- **User Goal**: Fix the remaining Payload admin caveat and keep the docs and post-interaction records aligned with the actual runtime behavior.
- **Current Product State**: Payload auth API login worked, but `/admin/login` still failed because the app root layout was not handing admin requests into Payload's root runtime.
- **Implemented Changes & Decisions**:
  1. **Admin Root Handoff**: Routed `/admin` requests through the Payload root layout so the admin UI boots with the required providers, import map generation, and server-function bridge.
  2. **Runtime Verification**: Verified `/admin/login` now returns `200 OK` and verified Payload CMS local login still succeeds through `/api/payload/cms-users/login`.
  3. **Owning Docs**: Added the current Payload admin runtime rule to the developer guide and recorded the current-state fix in the changelog.
- **Problems Marked**:
  - `risk`: A mixed app root and Payload admin route can fail even when the auth API is already healthy, because the admin UI still needs the Payload runtime wrapper.
  - `risk`: A partial fix that restores only the login API can hide a second failure at the admin page boot layer.
- **User Learning**: When the Payload login API succeeds but `/admin/login` still fails, treat the next check as a layout-runtime handoff problem before changing credentials, cookies, or CMS user records.
- **AI-Agent Learning**: When a framework-owned admin route crashes after auth is restored, verify the route is still using the framework's required root runtime before replacing deeper view logic.
