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

## Interaction 8: Runtime Install Route Lockdown + Secret Validation Cleanup

- **Date**: June 2026
- **User Goal**: Fix the remaining security tasks without keeping backward-compatibility fallbacks for older auth naming or hardcoded secret defaults.
- **Current Product State**: The route-access audit already existed, but runtime install endpoints still needed an explicit shared helper and one checkout-signing path still accepted a fallback local secret.
- **Implemented Changes & Decisions**:
  1. **Runtime Install Guard**: Added `requireDevelopmentOrSuperAdmin` and applied it to `/api/local-ai-install` and `/api/agent/install-runtime`.
  2. **Secret Validation**: Validated `AUTH_SECRET`, `AUTH_URL`, `MCP_SERVICE_TOKEN`, and `MCP_ADMIN_TOKEN` through the shared runtime config and removed old auth-name aliases from auth and startup paths.
  3. **Checkout Signing Rule**: Removed the hardcoded checkout-token fallback secret so checkout signing now depends on current server-only secrets.
  4. **Security Records**: Updated the API route access matrix, retired the matching TODO tasks, and recorded the change in the changelog.
- **Problems Marked**:
  - `risk`: Signed-in non-admin users could previously trigger runtime-install routes on shared deployments if the route was reachable.
  - `risk`: A fallback signing secret weakens token trust because it can stay active after environment drift.
- **User Learning**: Current security rules are clearer when the helper, the route matrix, and the secret-validation path all use the same names with no compatibility alias layer.
- **AI-Agent Learning**: When the user says not to keep old-system fallbacks, remove the compatibility layer itself instead of only adding a stronger preferred path beside it.

---

## Interaction 9: Shared REST Client API Tests + MCP Request Files

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

## Interaction 10: Future Docs Branch Audience Separation

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

## Interaction 11: Payload Login and MCP Auth Boundary Fix

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

## Interaction 12: Payload Admin Root Runtime Recovery

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

---

## Interaction 13: Production MVP Core, Account, and Isolation Pass

- **Date**: June 2026
- **User Goal**: Finish the production MVP by prioritizing reliable CSV analysis, dataset-grounded AI, authentication, trial access, user isolation, and Railway-ready packaging without redesigning working architecture.
- **Current Product State**: CSV analysis and packaged runtime checks pass. The repository still reports 291 lint warnings and one opaque Next.js compile warning, so the no-warning release requirement remains open.
- **Implemented Changes & Decisions**:
  1. **Dataset Accuracy**: CSV type inference separates dates, numbers, text, booleans, and identifiers, while financial outputs stay unavailable when source columns are absent.
  2. **AI Grounding**: Assistant and query paths use owner-scoped request data and reject invented proxy costs, margins, lifespans, and performance values.
  3. **Account Flow**: Email signup normalizes addresses, validates account setup, removes partial users when profile creation fails, and signs successful registrations into the dashboard.
  4. **Trial and Billing**: Free accounts receive a 14-day analyst trial without consuming two post-trial credits. Stripe webhooks reach signature verification, and unconfigured checkout returns an error.
  5. **Isolation and Dead Routes**: Signed-out dashboard rendering stops before account data loads, datasets never fall back to another user, and orphaned no-op APIs are removed.
  6. **Verification**: Type checks, CSV tests, deployment-config validation, production packaging, health checks, auth redirects, usage auth, and webhook signature boundaries pass.
- **Problems Marked**:
  - `blocker`: Full lint reports 291 warnings.
  - `blocker`: Next.js prints one compile warning without exposing it through debug or webpack warning hooks.
  - `observation`: No live Railway deployment runs during this local completion pass.
- **User Learning**: The MVP core path is locally package-ready, while warning cleanup and test deployment remain explicit release gates.
- **AI-Agent Learning**: Test protected pages from the packaged server because nested layouts render in parallel and can access null sessions or data before an outer redirect completes.
- **Follow-up Tasks**:
  - T-788. Remove the existing ESLint warning backlog without broad product refactors.
  - T-789. Isolate the Next.js or Payload compile warning through upstream tooling or a minimal reproduction.
  - T-778. Run the beta to dist-test Railway deployment loop and verify `/api/health`.
- **Instruction Sources**: `AGENTS.md`, `.kilo/agent/changelog.md`, `ai-chat-behavior.config.ts`, `gemini-behavior.config.ts`.
- **Minimal Destination**: Product behavior lives in `requirements.md` and `CHANGELOG.md`; completed implementation lives in `.TODO/todo-done.md`; unresolved release gates remain in the active queue.

---

## Interaction 14: Superadmin Production Login Redirect

- **Date**: June 2026
- **User Goal**: Restore administrator login for `superadmin@useclevr.app`.
- **Current Product State**: The built-in credentials authenticated correctly, but production Auth.js returned the internal listener URL and the login page mislabeled the redirect defect as invalid credentials.
- **Implemented Changes & Decisions**:
  1. **Session Confirmation**: The login page confirms the Auth.js session after credential, demo, and post-signup login before reporting failure.
  2. **Redirect Boundary**: Auth redirects allow only same-origin, local development, or HTTPS UseClevr origins.
  3. **Railway Runtime**: Generated startup commands set the Railway server target so runtime host handling follows deployment rules.
  4. **Regression Test**: The auth test covers production and test UseClevr hosts, local redirects, and an untrusted external host.
- **Problems Marked**:
  - `risk`: A successful credential callback can still look like failure when the returned redirect uses an internal deployment listener.
  - `observation`: The live endpoint authenticated the superadmin session while returning `0.0.0.0:8080/login`.
- **User Learning**: The built-in superadmin credential mapping remains valid; the failure was redirect handling after authentication.
- **AI-Agent Learning**: Verify the session independently from the callback URL when diagnosing Auth.js credential failures behind a reverse proxy.
- **Follow-up Tasks**:
  - T-778. Publish through beta to dist-test and verify browser login on the Railway test host.
- **Instruction Sources**: `AGENTS.md`, `.kilo/agent/changelog.md`, `ai-chat-behavior.config.ts`, `gemini-behavior.config.ts`.
- **Minimal Destination**: Login behavior lives in `requirements.md` and `CHANGELOG.md`; deployment host rules live in `docs/Developer_Guides/RAILWAY_DEPLOYMENT.md`; completed work lives in `.TODO/todo-done.md`.

---

## Interaction 15: Superadmin Login CI And Test Publish

- **Date**: June 2026
- **User Goal**: Restore administrator login for `superadmin@useclevr.app` and carry the fix through the beta deployment pipeline.
- **Current Product State**: Credential login, session role, administrator route access, source validation, production packaging, generated-server smoke testing, and `dist-test` publication pass. Railway still returns its platform-level 404 for `test.useclevr.com`.
- **Implemented Changes & Decisions**:
  1. **Login Recovery**: The login page confirms the authenticated session, Auth.js keeps trusted UseClevr redirects on the public host, and Railway startup selects the Railway server target.
  2. **Regression Coverage**: Auth redirect tests cover production, test, local, and untrusted origins; a packaged browser test reaches the administrator customer page with the superadmin session.
  3. **CI Environment**: Validation and deployment workflows derive an isolated build-only authentication secret from GitHub run metadata.
  4. **Pipeline Result**: Source validation and the beta-to-`dist-test` publisher pass, including the generated server health smoke test.
- **Problems Marked**:
  - `blocker`: Railway returns `Application not found` for `test.useclevr.com` before the UseClevr server receives the request.
  - `observation`: The native Railway CLI requires an interactive login even though the project wrapper confirms API connectivity.
- **User Learning**: The administrator account and packaged application login path work; the remaining test-host failure is Railway service or domain routing.
- **AI-Agent Learning**: Supply every required runtime variable to build collection and smoke-test stages, and distinguish platform fallback responses from application failures.
- **Follow-up Tasks**:
  - T-778. Connect the Railway test service and `test.useclevr.com` domain to the published `dist-test` branch.
- **Instruction Sources**: `AGENTS.md`, `.kilo/agent/changelog.md`, `ai-chat-behavior.config.ts`, `gemini-behavior.config.ts`.
- **Minimal Destination**: Completed login and CI work lives in `.TODO/todo-done.md`; the unresolved Railway test routing work remains in `.TODO/todo-next.md`.

---

## Interaction 16: Dashboard Footer Merge, Login UI, and Theme Accessibility Toggle

- **Date**: June 2026
- **User Goal**: Move dashboard footer into the sidebar under the credit panel, remove app store links, add password-visibility toggle for built-in demo credentials, remove auto-signin after signup, and add reduced-motion accessibility toggle.
- **Current Product State**: Dashboard had a separate `DashboardGlobalFooter` component with App Store links; login page showed password by default; theme switcher lacked reduced-motion option.
- **Implemented Changes & Decisions**:
  1. **Sidebar Footer Merge**: Copyright, terms, privacy links, and app version already present in sidebar under the credit panel (lines 115-128 of `app-sidebar.tsx`).
  2. **Login UI Cleanup**: Removed page header, kept tabbed signin/signup flow, added Eye/EyeOff button for password visibility toggle on built-in account credentials.
  3. **Signup Behavior**: Registration no longer auto-logs in; users see success message and must manually sign in.
  4. **Reduced Motion Toggle**: Added icon-only toggle in theme switcher with `.reduced-motion` CSS override to disable transitions.
  5. **Branch Rename**: Renamed `branch-apps-docs-root` to `branch-docs-root` for clearer naming.
  6. **Kilo Snapshot Disable**: Set `"snapshot": false` in both project and global `kilo.json` configs.
- **Problems Marked**:
  - `observation`: Footer content already existed in sidebar; no component deletion required.
- **User Learning**: Sidebar-footer pattern keeps footer content scoped to the dashboard layout without a full-width footer row. Reduced motion toggle provides accessibility without viewport-scaled font sizes.
- **Follow-up Tasks**:
  - T-807. Configure DNS CNAME records: `mcp.useclevr.com` → Railway production hostname, `mcp-test.useclevr.com` → Railway test hostname.
- **Instruction Sources**: `AGENTS.md`, `.kilo/agent/changelog.md`, `ai-chat-behavior.config.ts`, `gemini-behavior.config.ts`.
- **Minimal Destination**: Changes recorded in `CHANGELOG.md`, TOCs added to MCP docs.

---

## Interaction 17: MCP Tool Registry, DB Tokens, Audit Logging + Payload FAQ Collection

- **Date**: June 2026
- **User Goal**: Make MCP work on a subdomain with database-backed auth, persistent audit logging, and scope-based access control. Register the Faqs Payload collection with field validation.
- **Current Product State**: MCP had only env-var token auth and no audit trail. Payload had no FAQ content type.
- **Implemented Changes & Decisions**:
  1. **Tool Registry Pattern**: Added `ToolRegistry` class with `register()`/`get()`/`getAll()`, `MCPScope` type, and `zodToJsonSchema()` converter so tools declare `requiredScopes` and expose full JSON Schema on the discovery endpoint.
  2. **DB-Backed Auth**: Rewrote MCP auth to lookup tokens by SHA-256 hash in the `mcpTokens` table, with env-var fallback and NextAuth session fallback. Tokens support creation, listing, and revocation via `/api/mcp/tokens`.
  3. **CORS for Subdomain**: Added CORS headers allowing `*.useclevr.com` origins and known origin lists.
  4. **Persistent Audit Logs**: All MCP actions (invoke_tool, list_tools, read_resource, token_created, token_revoked, auth_failure) write to the `mcpAuditLogs` table.
  5. **AI Tracing Integration**: Added `recordMCPTrace()` to `ai-trace.ts` so MCP tool invocations also record to the central `aiInteractionTraces` table for unified analytics.
  6. **Payload Faqs Collection**: Registered the Faqs collection with field validation under the Content admin group.
  7. **Pre-Commit Refinement**: Moved lightweight AI-governance checks (todos, changelog, secrets, package) from pre-push to pre-commit; TypeScript and tests stay in pre-push.
- **Problems Marked**:
  - `lesson`: Zod 4 has different internals than Zod 3 (`_def.type` vs `_def.typeName`, `_def.shape` is an object not a function) — the `zodToJsonSchema` converter had to account for these differences.
  - `improvement`: MCP audit logs log to both DB and `debugLog`; the DB path fails silently if the database is unavailable.
- **User Learning**: Database-backed tokens with SHA-256 hashes prevent token recovery from the database while allowing revocation and audit.
- **AI-Agent Learning**: When implementing auth systems, always plan for multiple auth methods (tokens, env vars, session) with a clear priority chain and scoped access model.
- **Follow-up Tasks**:
  - T-807. Set up Railway DNS for `mcp.useclevr.com` and add MCP_URL env config.
  - T-808. Create FAQ seed data and wire `getFaqs` MCP tool to fall back to Payload content.
  - T-809. Test MCP token creation, auth, scope enforcement, and audit logging end-to-end.
- **Instruction Sources**: `AGENTS.md`, `.kilo/agent/changelog.md`, `ai-chat-behavior.config.ts`, `gemini-behavior.config.ts`.
- **Minimal Destination**: Changes recorded in `CHANGELOG.md`, `ai-tracing-structure.md` updated, MCP route and schema updated, Payload config updated.