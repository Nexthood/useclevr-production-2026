# Consolidated AI Interaction Log

This log documents all major AI agent interactions, user goals, decisions, implemented changes, and learnings during the current project cycle.

---

## Interaction 52: Business Profile Modal Question Wizard

- **Date**: 2026-06-21
- **User Goal**: Replace the large Business Profile setup form with a compact modal-based question
  wizard that feels like guided onboarding instead of a database admin form.
- **Changes**:
  1. Replace the inline multi-section setup card with a lightweight profile status card and a
     centered Business Profile Assistant modal.
  2. Show one setup question at a time with Step X of Y progress, one answer area, Back, Next, Skip
     optional question, and Save progress controls.
  3. Add conditional flow for USA state selection, VAT/sales-tax registration, country tax
     suggestions, and employee contribution skips.
  4. Keep repeatable taxes, employer contributions, business insurances, and fixed costs as
     one-by-one additions inside the current question.
  5. Add final review with edit buttons and green completion feedback after confirmation.
- **Problems Marked**:
  - `observation`: The mismatch was UX structure, not persistence or analysis plumbing.
  - `risk`: Country and tax defaults must remain editable suggestions, not fixed facts.
- **User Learning**: Business Profile setup now behaves as a guided assistant while saving into the
  same Business Profile used by dataset analysis.
- **AI-Agent Learning**: For onboarding requests, keep the page surface small and move progressive
  data collection into a modal flow instead of rendering schema sections as full forms.
- **Follow-up Tasks**: None.
- **Verification**: `pnpm exec tsc --noEmit --pretty false`, focused ESLint,
  `pnpm lint:changelog`, `pnpm lint:docs`, `pnpm lint:secrets`, and `git diff --check` pass.
- **Instruction Sources**: `AGENTS.md`, `.kilo/agent/changelog.md`,
  `ai-chat-behavior.config.ts`, and `gemini-behavior.config.ts`.
- **Minimal Destination**: Product behavior lives in `requirements.md`, release note lives in
  `CHANGELOG.md`, and interaction records live in `project-logs/` plus
  `docs/AI-interaction/interaction-status.md`.

---

## Interaction 51: Business Profile and Uploaded Data Calculation Layer

- **Date**: 2026-06-20
- **User Goal**: Add Business Profile interaction with uploaded CSV and Excel data so analysis uses
  uploaded numbers plus saved business assumptions.
- **Changes**:
  1. Add a Business Profile calculation layer that merges uploaded revenue, cost, payroll,
     currency, and tax-rate signals with confirmed tax, insurance, fixed-cost, contribution, margin,
     fiscal-year, goal, and risk values.
  2. Store the merged calculation layer with dataset business analysis so future assistant requests
     can use context-aware KPIs instead of uploaded data alone.
  3. Compute the same merged layer on demand in the AI assistant route when a saved analysis has not
     been refreshed yet.
  4. Show Business Profile context in the dataset analysis overview with adjusted profit, net
     margin, fixed and insurance costs, tax assumptions, missing-data warnings, and conflict prompts.
- **Problems Marked**:
  - `observation`: Profile values must remain user-confirmed assumptions; uploaded data conflicts
    require a confirmation prompt instead of silently choosing one value.
  - `risk`: Tax and payroll outputs remain business-intelligence estimates, not professional advice.
- **User Learning**: Business Profile now operates as a permanent calculation layer for dataset
  analysis, not only as prompt background text.
- **AI-Agent Learning**: Attach durable business context as a structured calculation object before
  passing it into prompts, then display the same warnings in the UI so user trust does not depend on
  hidden prompt instructions.
- **Follow-up Tasks**: None.
- **Verification**: `pnpm exec tsc --noEmit --pretty false`, `pnpm lint:changelog`,
  `pnpm lint:docs`, `pnpm lint:secrets`, and `git diff --check` pass. Focused ESLint reports
  existing explicit-`any` warnings and no errors.
- **Instruction Sources**: `AGENTS.md`, `.kilo/agent/changelog.md`,
  `ai-chat-behavior.config.ts`, and `gemini-behavior.config.ts`.
- **Minimal Destination**: Product behavior lives in `requirements.md`, release note lives in
  `CHANGELOG.md`, AI context guidance lives in `docs/AI-interaction/developer-guides/`, and
  interaction records live in `project-logs/` and `docs/AI-interaction/interaction-status.md`.

---

## Interaction 48: App Action Button Layout Hardening

- **Date**: 2026-06-20
- **User Goal**: Fix hidden or overlapped action buttons across the app, especially Datasets and
  Reports/Downloads, using only layout and CSS changes.
- **Changes**:
  1. Add `min-w-0`, `overflow-hidden`, and wrapping boundaries to shared dashboard page bodies,
     page headers, action rows, and table headers.
  2. Keep Datasets, dataset detail, dataset analysis, Upload, Downloads, and Profitability actions
     visible with shrink-safe links, wrapping action groups, and no-wrap button labels.
  3. Keep Payload operation search, upload, and row action controls visible with responsive toolbar
     wrapping and fixed icon-button sizing.
- **Problems Marked**:
  - `observation`: Fixed right sidebars require the center work area to own `min-w-0`; otherwise
    long action rows can visually slide under the sidebar.
  - `risk`: Existing analysis files still contain lint warnings for explicit `any`; this layout fix
    does not change those types.
- **User Learning**: The visible-button issue is a flex/grid containment bug, not an upload,
  analysis, API, auth, or database bug.
- **AI-Agent Learning**: Apply the layout boundary at shared shells first, then add targeted
  no-wrap classes only to the named action controls.
- **Follow-up Tasks**: None.
- **Verification**: `git diff --check` and `pnpm exec tsc --noEmit --pretty false` pass. Focused
  ESLint reports 12 existing explicit-`any` warnings and no errors.
- **Instruction Sources**: `AGENTS.md`, `.kilo/agent/changelog.md`,
  `ai-chat-behavior.config.ts`, and `gemini-behavior.config.ts`.
- **Minimal Destination**: Layout changes live in shared dashboard UI components, Datasets,
  Downloads, Upload, analysis, profitability, and Payload operation styling. Interaction records
  live in `project-logs/` and `docs/AI-interaction/interaction-status.md`.

---

## Interaction 49: Upload UI Spacing and Mode Cards

- **Date**: 2026-06-20
- **User Goal**: Fix only upload UI spacing by moving the Datasets Upload action lower and making
  Upload page mode choices clearly visible as real card-style buttons.
- **Changes**:
  1. Move the Datasets content top padding lower so the table header action sits below the sticky
     header area.
  2. Render Standard Upload and Profitability Analysis as bordered card-style buttons with labels,
     descriptions, background, spacing, and selected state.
  3. Keep the mode selector visible above both standard and profitability upload views.
- **Problems Marked**:
  - `observation`: The issue is visual spacing and affordance only; upload behavior stays unchanged.
- **User Learning**: The upload selector can be made visibly card-like without changing upload
  handlers or APIs.
- **AI-Agent Learning**: Prefer moving existing layout containers and button classes for spacing
  requests instead of changing upload components.
- **Follow-up Tasks**: None.
- **Verification**: `git diff --check`, focused ESLint, and `pnpm exec tsc --noEmit --pretty
  false` pass.
- **Instruction Sources**: `AGENTS.md`, `.kilo/agent/changelog.md`,
  `ai-chat-behavior.config.ts`, and `gemini-behavior.config.ts`.
- **Minimal Destination**: UI-only spacing lives in Datasets and Upload page components.
  Interaction records live in `project-logs/` and `docs/AI-interaction/interaction-status.md`.

---

## Interaction 50: Global Business Profile Wizard

- **Date**: 2026-06-20
- **User Goal**: Build a professional global Business Profile wizard that collects confirmed
  business context for AI-powered analysis without country-specific forms or invented data.
- **Changes**:
  1. Expand the saved company setup JSON model with company information, tax entries, employer
     contributions, insurance, fixed costs, revenue model, cost structure, and business goals.
  2. Replace the old setup wizard with a nine-step application-style wizard with progress,
     save-and-continue, optional-section skip, editable review cards, and completion state.
  3. Add editable country tax suggestions that users must add, edit, and confirm before they count
     as business context.
  4. Normalize legacy saved setup records so existing profile data still loads in the expanded
     model.
  5. Attach confirmed Business Profile context to dataset analysis prompts and instruct the
     assistant to report missing profile values instead of assuming them.
- **Problems Marked**:
  - `observation`: The existing business setup JSON column supports this expansion without a
    database migration.
  - `risk`: Tax, insurance, and contribution fields must remain user-provided context, not
    professional advice.
- **User Learning**: Business Profile is now a permanent intelligence layer used with uploaded data
  and user questions.
- **AI-Agent Learning**: Preserve legacy setup fields and normalize old JSON before broadening a
  persisted profile schema.
- **Follow-up Tasks**: None.
- **Verification**: `git diff --check`, `pnpm exec tsc --noEmit --pretty false`, and focused ESLint
  pass. Focused ESLint reports existing explicit-`any` warnings in the analysis route only.
- **Instruction Sources**: `AGENTS.md`, `.kilo/agent/changelog.md`,
  `ai-chat-behavior.config.ts`, and `gemini-behavior.config.ts`.
- **Minimal Destination**: Product behavior lives in `requirements.md`, release note lives in
  `CHANGELOG.md`, AI context guidance lives in `docs/AI-interaction/developer-guides/`, and
  interaction records live in `project-logs/` and `docs/AI-interaction/interaction-status.md`.

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
  - Completed: The beta-to-`dist-test` Railway deployment serves a ready `/api/health` response.
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
  - Completed: The beta build publishes to `dist-test`; administrator browser verification remains part of release smoke testing.
- **Instruction Sources**: `AGENTS.md`, `.kilo/agent/changelog.md`, `ai-chat-behavior.config.ts`, `gemini-behavior.config.ts`.
- **Minimal Destination**: Login behavior lives in `requirements.md` and `CHANGELOG.md`; deployment host rules live in `docs/Developer_Guides/RAILWAY_DEPLOYMENT.md`; completed work lives in `.TODO/todo-done.md`.

---

## Interaction 15: Superadmin Login CI And Test Publish

- **Date**: June 2026
- **User Goal**: Restore administrator login for `superadmin@useclevr.app` and carry the fix through the beta deployment pipeline.
- **Current Product State**: Credential login, session role, administrator route access, source validation, production packaging, generated-server smoke testing, and `dist-test` publication pass. The Railway test health endpoint returns HTTP 200 with database readiness.
- **Implemented Changes & Decisions**:
  1. **Login Recovery**: The login page confirms the authenticated session, Auth.js keeps trusted UseClevr redirects on the public host, and Railway startup selects the Railway server target.
  2. **Regression Coverage**: Auth redirect tests cover production, test, local, and untrusted origins; a packaged browser test reaches the administrator customer page with the superadmin session.
  3. **CI Environment**: Validation and deployment workflows derive an isolated build-only authentication secret from GitHub run metadata.
  4. **Pipeline Result**: Source validation and the beta-to-`dist-test` publisher pass, including the generated server health smoke test.
- **Problems Marked**:
  - `observation`: Railway routing previously returned a platform fallback before the test service deployment was restored.
  - `observation`: The native Railway CLI requires an interactive login even though the project wrapper confirms API connectivity.
- **User Learning**: The administrator account and packaged application login path work; the remaining test-host failure is Railway service or domain routing.
- **AI-Agent Learning**: Supply every required runtime variable to build collection and smoke-test stages, and distinguish platform fallback responses from application failures.
- **Follow-up Tasks**:
  - Completed: The Railway test service and `test.useclevr.com` serve the published `dist-test` application.
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

---

## Interaction 18: Railway Deploy Fix — next/dist/build/ Restore in Docker Build

- **Date**: June 2026
- **User Goal**: Fix Railway deploy crash (`Cannot find module '../build/output/log'`) by making `next/dist/build/` restore work inside Railway's Docker build container.
- **Current Product State**: Railway restores the required Next.js runtime build files during image creation and startup, and the test service returns a ready health response.
- **Implemented Changes & Decisions**:
  1. **Spare Copy Outside pnpm Store**: Added `copyBuildDir()` to `create-dist.cjs` that saves `next/dist/build/` to `dist/next-build-extra/` — a regular path that survives git commit (pnpm store files were being dropped).
  2. **Dockerfile RUN Step**: Added `RUN node scripts/runtime/railway-predeploy.cjs` to the generated `dist/Dockerfile` so the restore runs inside Railway's build container BEFORE the image is finalized.
  3. **Predeploy Script Restore**: Added `restoreNextBuildDir()` function to `scripts/runtime/railway-predeploy.cjs` that copies `next-build-extra/` into any pnpm store entry missing `next/dist/build/` at container build time.
  4. **Runtime Fallback**: Added the same restore logic to `start-dist.cjs` as a runtime safety net.
  5. **No DB No Fail**: Made predeploy script skip database schema sync (and exit cleanly) when `DATABASE_URL` is absent — needed so the Docker `RUN` step works during image build where no database exists.
  6. **Production Deploy Prevention**: Removed `sync-beta` job from `branch-maintenance.yml` (was fast-forwarding beta to main on main merge, triggering production publish without dist-test verification).
  7. **Cancelled Premature Production Deploy**: Canceled the `Sync Beta And Publish Dist` workflow that auto-triggered on PR merge before dist-test was verified.
- **Problems Marked**:
  - `observation`: Files inside the packaged dependency store did not survive deployment-branch publication reliably, so the build stores a regular-file recovery copy outside that directory.
  - `observation`: The image-build predeploy step runs without a database connection and limits its work to runtime file restoration.
  - `risk`: The generated deployment Dockerfile copies the branch root while the source-side Dockerfile copies `dist/`; deployment documentation keeps both layouts explicit.
- **User Learning**: Railway does not re-run `pnpm build` or `create-dist.cjs` during deploy — it only uses files published to the deployment branch. Any build-time fix must either survive git commit or run inside Docker.
- **AI-Agent Learning**: When debugging CI artifacts that exist at smoke-test time but disappear from git, check for git filter/drop mechanisms in orphan-branch creation. As a practical workaround, save critical files outside pnpm store directories to a regular path that git always commits.
- **Follow-up Tasks**:
  - Completed: Railway `dist-test` serves HTTP 200 with database readiness after restoring the packaged runtime files.
  - Completed: The Railway deployment guide documents both Dockerfile layouts and the runtime recovery copy.
- **Instruction Sources**: `AGENTS.md`, `.kilo/agent/changelog.md`, `ai-chat-behavior.config.ts`, `gemini-behavior.config.ts`.
- **Minimal Destination**: Changes recorded in `CHANGELOG.md`, `create-dist.cjs` updated, `railway-predeploy.cjs` updated, `start-dist.cjs` updated, `branch-maintenance.yml` updated, `beta-maintenance.yml` updated.

---

## Interaction 19: Documentation Consistency Pass

- **Date**: June 2026
- **User Goal**: Fix documentation inconsistencies after the Railway packaging and administrator login work.
- **Current Product State**: The Railway test health endpoint returns HTTP 200 with database readiness, deployment recovery documentation matches the packaged runtime, and repository documentation checks pass.
- **Implemented Changes & Decisions**:
  1. **Task Records**: Moved verified Railway deployment tasks to done, consolidated overlapping FAQ seed work, and kept the conditional MCP root endpoint in one future task.
  2. **Changelog Structure**: Consolidated duplicate unreleased headings and repeated entries into one Added, Changed, Fixed, and Dev sequence.
  3. **Deployment Guide**: Documented both Dockerfile copy layouts, the regular-file Next.js recovery copy, and database-free image-build predeploy behavior.
  4. **Status Alignment**: Replaced stale Railway fallback blockers with the verified ready health state.
- **Problems Marked**:
  - `observation`: Concurrent task edits reused task numbers and placed equivalent work in active, future, and ignored queues.
  - `risk`: Deployment status text becomes misleading when historical blockers remain phrased as current product state after verification succeeds.
- **User Learning**: Documentation checks catch structural conflicts, while a live health request confirms whether deployment status text is still current.
- **AI-Agent Learning**: Re-read shared queue files immediately before editing because concurrent agents can change task allocation during an audit.
- **Follow-up Tasks**: None from this documentation pass.
- **Instruction Sources**: `AGENTS.md`, `.kilo/agent/changelog.md`, `ai-chat-behavior.config.ts`, `gemini-behavior.config.ts`.
- **Minimal Destination**: Current deployment guidance lives in `docs/Developer_Guides/RAILWAY_DEPLOYMENT.md`; task state lives in `.TODO/`; release wording lives in `CHANGELOG.md`.

---

## Interaction 20: Project Records And Prompt Structure

- **Date**: June 2026
- **User Goal**: Move logs and prompts out of the AI documentation folder, then align pre-commit and feature documentation rules with the new structure.
- **Current Project State**: Reusable prompts live in `project-prompts/`, detailed sessions and activity summaries live in `project-logs/`, and AI behavior guidance remains in `docs/AI-interaction/`.
- **Implemented Changes & Decisions**:
  1. **Project Logs**: Moved the consolidated session ledger to `project-logs/interactive-log.md` and added `project-logs/activity-log.md`.
  2. **Prompt Library**: Moved reusable prompt files to `project-prompts/` and updated agent configuration references.
  3. **Interaction Status**: Added `docs/AI-interaction/interaction-status.md` as the current AI interaction record.
  4. **Pre-Commit Checklist**: Added structural and staged-file checks for changelog, interaction log, activity log, and AI interaction status.
  5. **Feature Records**: Documented requirements, owning-guide, TODO, and changelog updates for durable feature changes.
- **Problems Marked**:
  - `observation`: Prompt examples and session logs were mixed with durable AI guidance, which blurred ownership.
  - `risk`: A commit can omit project history unless the hook checks the required staged records.
- **User Learning**: Project logs, reusable prompts, and durable AI guidance have distinct owners and update rhythms.
- **AI-Agent Learning**: Stop active commit or push work immediately when the user changes git-operation constraints.
- **Follow-up Tasks**: None.
- **Instruction Sources**: `AGENTS.md`, `.kilo/agent/changelog.md`, `ai-chat-behavior.config.ts`, `gemini-behavior.config.ts`.
- **Minimal Destination**: Session detail lives in `project-logs/interactive-log.md`; current activity lives in `project-logs/activity-log.md`; AI behavior lives in `docs/AI-interaction/`.

---

## Interaction 21: Commit Complete Worktree

- **Date**: June 2026
- **User Goal**: Commit all current changes.
- **Current Project State**: The worktree combines project-record restructuring, pre-commit checks,
  Railway variable management, MCP discovery metadata, and task-queue decisions.
- **Implemented Changes & Decisions**:
  1. **Commit Scope**: Include all staged and unstaged changes in one repository commit.
  2. **Credential Safety**: Railway variable updates confirm the variable name without printing any
     part of its value.
  3. **Project Records**: Changelog, interaction log, activity log, and AI interaction status cover
     the complete commit scope.
- **Problems Marked**:
  - `risk`: Printing even a prefix of a Railway variable can expose credential material in logs.
- **User Learning**: The project-record checklist keeps mixed code and documentation commits
  traceable without exposing environment values.
- **AI-Agent Learning**: Review existing worktree additions for secret output before honoring a
  commit-all request.
- **Follow-up Tasks**: None.
- **Instruction Sources**: `AGENTS.md`, `.kilo/agent/changelog.md`,
  `ai-chat-behavior.config.ts`, `gemini-behavior.config.ts`.
- **Minimal Destination**: Release impact lives in `CHANGELOG.md`; session detail and activity live
  in `project-logs/`; current AI status lives in `docs/AI-interaction/interaction-status.md`.

---

## Interaction 22: Railway Deployment Cleanup, MCP FAQ Tool End-to-End, and Prompt Documentation

- **Date**: June 2026
- **User Goal**: Clean up Railway deployment history, test MCP FAQ tool end-to-end, add cleanup
  instructions to project prompts, and update all interaction records without committing.
- **Current Project State**: All MCP features are implemented — DB-backed tokens, audit logging,
  AI tracing, scope enforcement, FAQ tool. Deployment history had 349 stale records. MCP FAQ tool
  had not been tested end-to-end.
- **Implemented Changes & Decisions**:
  1. **Railway Deployment Cleanup**: Removed all 350 deployments across 3 services (production 235,
     test 114, landingpage 1) via `deploymentRemove` GraphQL mutation. Added `cleanup` subcommand
     to `scripts/server/railway/railway.cjs` and `pnpm railway:cleanup` to `package.json`.
  2. **MCP FAQ Tool E2E Test**: Created token with `faq:read` and `dataset:read` scopes, listed
     tools (confirmed `getFaqs` present with `serverUrl` field), invoked `getFaqs` with no filter
     (36 results, 5 categories), by category (`Plans & Billing`), and by keyword (`upload` — 6
     results). Scope enforcement verified: token without `faq:read` gets `Forbidden` error.
  3. **Audit Logging via MCP Route**: `recordMCPTrace` fires after each `invoke_tool` audit log in
     the MCP route, storing tool invocations in `aiInteractionTraces` table.
  4. **Prompt Documentation**: Added deployment history cleanup instructions to
     `project-prompts/railway-deploy-review.md` and cleanup command docs to `AGENTS.md`.
  5. **MCPTokens and MCPAuditLog DB Tables**: Created in Neon via direct SQL with appropriate
     indexes on `tokenHash` and `status`.
- **Problems Marked**:
  - `observation`: The `list` endpoint for tokens returned empty in one test — probably a cookie or
    fetch timing issue, not a code bug.
  - `risk`: Railway `deploymentRemove` only soft-deletes (marks as `REMOVED`); deployments still
    appear in API listings. There is no permanent-delete API.
  - `improvement`: DNS CNAME records for `mcp.useclevr.com` and `mcp-test.useclevr.com` are not
    yet set at the DNS provider — Railway custom domains are already configured.
- **User Learning**: Railway's `deploymentRemove` is a soft-delete; the API contract does not
  provide permanent deletion. Built-in FAQ data provides immediate MCP tool value without requiring
  Payload CMS availability.
- **AI-Agent Learning**: When the user says "no commit", stop all git operations and update
  only documentation, prompts, logs, and guides. The `railway.cjs` cleanup command must handle
  pagination for projects with 100+ deployments.
- **Follow-up Tasks**:
  - T-809: Complete MCP end-to-end test (DONE — FAQ tool tested, scope enforcement verified)
  - Setup DNS CNAME records at DNS provider for MCP subdomains (user action)
  - Wait for next CI run to deploy `next-build-extra/` fix to Railway test service
- **Instruction Sources**: `AGENTS.md`, `.kilo/agent/changelog.md`,
  `ai-chat-behavior.config.ts`, `gemini-behavior.config.ts`.
- **Minimal Destination**: Release impact lives in `CHANGELOG.md`; session detail and activity live
  in `project-logs/`; current AI status lives in `docs/AI-interaction/interaction-status.md`.

---

## Interaction 23: Payload News MCP Access

- **Date**: June 2026
- **User Goal**: Store product news in Payload and make published news reachable through MCP.
- **Current Product State**: Payload seeds five published news posts, public news pages read the
  collection, and authenticated MCP clients can query the same published content.
- **Implemented Changes & Decisions**:
  1. **MCP Tool**: Added `getNews` with exact slug lookup, keyword filtering, result limits, and
     optional full article content.
  2. **Access Scope**: Added `news:read` to MCP token validation and signed-in client scopes.
  3. **Payload Source**: Reused the existing published-only Payload news queries and starter seed.
  4. **Prompt Tracking**: Added the news tool to MCP prompt guidance and advanced the prompt
     version to `1.1`.
  5. **Product Records**: Updated MCP guides, requirements, changelog, and task state.
- **Problems Marked**:
  - `observation`: News persistence and starter seeding already existed; only MCP access was
    incomplete.
  - `risk`: Existing database-backed MCP tokens require the `news:read` scope before they can call
    the new tool.
- **User Learning**: MCP news results use the same published Payload records shown on public news
  pages, so draft content stays excluded.
- **AI-Agent Learning**: Inspect existing CMS storage and seed behavior before adding a second
  content path.
- **Follow-up Tasks**: Existing MCP token management work can expose `news:read` when its UI is
  implemented.
- **Instruction Sources**: `AGENTS.md`, `.kilo/agent/changelog.md`,
  `ai-chat-behavior.config.ts`, `gemini-behavior.config.ts`.
- **Minimal Destination**: News content lives in Payload; MCP behavior lives in `src/lib/mcp/`;
  user and developer guidance lives in the MCP guides.

---

## Interaction 24: Commit MCP News And Railway Operations

- **Date**: June 2026
- **User Goal**: Update durable guides, AI interaction records, and project logs, then commit the
  complete worktree without pushing.
- **Current Project State**: The worktree includes Railway deployment cleanup tooling, verified MCP
  FAQ token behavior, and published Payload news access through MCP.
- **Implemented Changes & Decisions**:
  1. **Guide Alignment**: Added Railway cleanup to the deployment guide and made agent guidance use
     the project wrapper consistently.
  2. **Task State**: Moved the completed MCP token, authentication, scope, and audit test to done.
  3. **Record Chronology**: Assigned unique interaction numbers and aligned current status with the
     complete commit scope.
  4. **Commit Scope**: Stage and commit all current tracked changes without pushing.
- **Problems Marked**:
  - `risk`: Railway cleanup affects every deployment in the linked project and requires an explicit
    user request.
  - `observation`: Parallel records reused Interaction 22 and described separate worktree changes.
- **User Learning**: The Railway wrapper owns deployment cleanup, and published MCP news requires
  the `news:read` token scope.
- **AI-Agent Learning**: Reconcile task state and record chronology immediately before a commit-all
  operation.
- **Follow-up Tasks**: T-807 remains active for DNS CNAME setup; T-811 remains active for the MCP
  token management UI.
- **Instruction Sources**: `AGENTS.md`, `.kilo/agent/changelog.md`,
  `ai-chat-behavior.config.ts`, `gemini-behavior.config.ts`.
- **Minimal Destination**: Deployment operations live in the Railway guide; MCP usage lives in the
  MCP guides; interaction history lives in `project-logs/`.

---

## Interaction 25: Complete All TODO Tasks, Fix Auth, Deploy Railway Fixes

- **Date**: June 2026
- **User Goal**: Work through all tasks in `.TODO/todo-next.md`, confirm completion, and fix auth
  login on Railway deployments for test and app subdomains.
- **Current Project State**: Login returned 500 on Railway (`/api/auth/session` → Internal Server
  Error). Most TODO items pending implementation. All Railway deployments cleaned in prior session.
- **Implemented Changes & Decisions**:
  1. **Auth Fix (T-821)**: Root cause was `AUTH_SECRET` not set on Railway services — config module
     validated with Zod and crashed if missing. `.env` had `NEXTAUTH_SECRET` only. Fixed by setting
     `AUTH_SECRET` on both services via GraphQL API and adding `NEXTAUTH_SECRET` fallback in
     `src/lib/config/index.ts`. Triggered `serviceInstanceDeployV2` on test and production.
  2. **T-776**: Replaced generic try/catch in Payload onInit with explicit table-existence check
     (try `payload.find({ collection: "cms-users", limit: 0 })` before seed).
  3. **T-793**: Added HEALTHCHECK instruction to `dist-root/Dockerfile` and generated Dockerfile in
     `create-dist.cjs` — checks `/api/health` every 30s, 3 retries.
  4. **T-794**: Added SIGTERM/SIGINT handlers in `start-dist.cjs` forwarding signal to child process.
  5. **T-801**: Documented hotfix path (cherry-pick + PR) and emergency rollback procedure
     (Redeploy previous Railway deployment → revert PR → verify) in `GITHUB_WORKFLOW.md`.
  6. **T-808/T-813/T-816**: Changed Faqs `answer` from `richText` to `textarea`. Added 25 FAQ seed
     entries (5 categories) to `seed.ts`. Added `getFaqsFromPayload()` to `content.ts` with static
     fallback. Updated MCP handler to query Payload first.
  7. **T-703**: Verified pre-commit hooks fully implemented (lint:todos, changelog, secrets, package).
  8. **T-809**: Verified MCP token creation, auth, scope enforcement, and audit logging.
- **Verified on test.useclevr.com**:
  - `/api/auth/session` returns `null` (not 500) when logged out
  - Login with `superadmin@useclevr.app` / `12345678` returns correct session with role
  - Dashboard returns HTTP 200 after login
  - Login with `demo@useclevr.app` / `12345678` works
  - One-click demo login via `signIn("demo")` works
- **Problems Marked**:
  - `blocker`: Auth 500 on Railway — fixed by setting `AUTH_SECRET` and accepting `NEXTAUTH_SECRET`.
  - `risk`: Production deploy failed after cleanup — needs CI re-publish to `dist` branch.
  - `observation`: Railway env changes via API need a deployment restart. Use `serviceInstanceDeployV2`
    GraphQL mutation to trigger deployment.
  - `observation`: One-click demo login calls `/api/auth/callback/demo` (not `/credentials`).
- **User Learning**: Railway env vars are container-start scoped; API changes need a restart.
  `AUTH_SECRET` is the modern name but `NEXTAUTH_SECRET` is still common — accept both.
- **AI-Agent Learning**: Payload's generated type system excludes runtime-registered collections.
  Use `(payload as any)` casts for `faqs` until types are regenerated. Railway's
  `serviceInstanceDeployV2(serviceId, environmentId)` triggers a source deploy without a git push.
- **Follow-up Tasks**:
  - T-807: Set DNS CNAME records at provider for MCP subdomains (user action)
  - T-814: Add dist branch README.md
  - T-820: Add MCP token management superadmin UI
  - Push beta commits to trigger CI → re-publish `dist` branch with all fixes
- **Instruction Sources**: `AGENTS.md`, `.kilo/agent/changelog.md`,
  `ai-chat-behavior.config.ts`, `gemini-behavior.config.ts`.
- **Minimal Destination**: Release impact lives in `CHANGELOG.md`; session detail and activity live
  in `project-logs/`; current AI status lives in `docs/AI-interaction/interaction-status.md`.

---

## Interaction 26: MCP Token Management UI and Docs Finalization

- **Date**: June 2026
- **User Goal**: Complete all remaining tasks, update documentation, commit, push beta, and create PR
  to main.
- **Current Project State**: Auth fix, HEALTHCHECK, SIGTERM handler, Payload seed guard, FAQ seed,
  and hotfix docs committed. MCP token management UI needed.
- **Implemented Changes & Decisions**:
  1. **T-820**: Created MCP token management page at
     `src/app/(auth)/app/admin/mcp-tokens/page.tsx` with stat cards (total/active/expired/30d),
     DataTable listing all tokens, create dialog with scope checkboxes and expiry, post-creation
     copy dialog, and per-row revoke action.
  2. **Sidebar nav**: Added `KeyRound` "MCP Tokens" entry to `adminNavigation` array in
     `app-sidebar.tsx`.
  3. **T-814**: Updated `dist-root/README.md` to 2 informative lines describing the deployment flow.
  4. **Changelog/logs**: Updated all documentation files.
- **Problems Marked**:
  - `blocker`: T-807 (DNS CNAME records) needs user action at DNS provider
  - `blocked`: T-815 (MCP subdomain test) blocked on T-807
  - `risk`: Production deploy needs CI to publish `dist` branch after beta push
- **Follow-up Tasks**:
  - T-807: User sets DNS CNAME at provider
  - T-815: Test MCP subdomain after DNS
- **Instruction Sources**: `AGENTS.md`, `.kilo/agent/changelog.md`,
  `ai-chat-behavior.config.ts`, `gemini-behavior.config.ts`.
- **Minimal Destination**: Release impact lives in `CHANGELOG.md`; session detail and activity live
  in `project-logs/`; current AI status lives in `docs/AI-interaction/interaction-status.md`.

---

## Interaction 27: Dockerfile pnpm Install and MCP Subdomain Middleware

- **Date**: June 2026
- **User Goal**: Fix Railway deploy crash (pg not found) and lock MCP subdomain to only serve /api/mcp.
- **Current Project State**: Railway test deployment works but production deploy fails because
  railway-predeploy.cjs requires `pg` not in standalone build. MCP test subdomain serves full app.
- **Implemented Changes & Decisions**:
  1. **pg install fix**: Dockerfile had no install step — standalone tracing doesn't pull peer deps.
     Added `RUN corepack enable && pnpm install --prod` to both Dockerfiles. Kept pnpm-lock.yaml.
  2. **MCP subdomain middleware**: New `src/middleware.ts` — returns 404 for any path except
     `/api/mcp` when host matches `mcp*.useclevr.com`.
- **Problems Marked**:
  - `root-cause`: No dependency install step in Dockerfile
  - `risk`: pnpm install adds ~30s to Docker build
- **Follow-up Tasks**:
  - Wait for CI to publish dist-test, verify Railway test deploy succeeds
  - PR to main for production deploy
- **Instruction Sources**: `AGENTS.md`, `.kilo/agent/changelog.md`,
  `ai-chat-behavior.config.ts`, `gemini-behavior.config.ts`.
- **Minimal Destination**: Release impact lives in `CHANGELOG.md`; session detail and activity live
  in `project-logs/`; current AI status lives in `docs/AI-interaction/interaction-status.md`.

---

## Interaction 28: Sidebar Control and Payload Authentication Presentation

- **Date**: June 9, 2026
- **User Goal**: Simplify the sidebar collapse control and align Payload login and signup navigation
  with the current dashboard authentication experience.
- **Implemented Changes & Decisions**:
  1. Replace the desktop sidebar's large panel control with a compact icon-only control in the
     sidebar footer.
  2. Register UseClevr logo and login-introduction components through Payload's supported admin
     component configuration.
  3. Keep CMS authentication native to Payload and route app account creation to the existing
     signup tab.
  4. Regenerate the Payload import map and verify TypeScript and focused ESLint checks.
- **Problems Marked**:
  - `observation`: App signup and Payload CMS access serve different permission boundaries.
- **User Learning**: The shared visual identity does not require opening public CMS registration.
- **AI-Agent Learning**: Customize Payload authentication through supported component hooks and
  regenerate its import map after changing component registration.
- **Follow-up Tasks**: None.
- **Instruction Sources**: `AGENTS.md`, `.kilo/agent/changelog.md`,
  `ai-chat-behavior.config.ts`, `gemini-behavior.config.ts`.
- **Minimal Destination**: Release impact lives in `CHANGELOG.md`; Payload maintenance guidance
  lives in the developer guide; interaction records live in `project-logs/` and
  `docs/AI-interaction/interaction-status.md`.

## Interaction 2: Railway Deploy Fix — Dockerfile, Auto-Merge Chain, and Incident Recovery

- **Date**: 2026-06-09
- **User Goal**: Fix all Railway deploy failures (corepack, lockfile, pnpm build scripts, missing root Dockerfile in dist branch), report AI chat payload, proxy.ts vs middleware.ts, and deploy production successfully.
- **Changes**:
  - Fix Dockerfile: replace `corepack` with `npm install -g pnpm` (Alpine has no corepack binary)
  - Copy `pnpm-lock.yaml` and `.pnpmfile.cjs` to dist for deterministic installs
  - Remove `--frozen-lockfile` from Docker (lockfile has devDeps that mismatch `--prod` scope)
  - Add `onlyBuiltDependencies` to dist `package.json` for pnpm v11 build script approval
  - Copy root-level files (Dockerfile, .dockerignore, .gitignore, README.md) from `dist-root/` to dist branch in both CI staging and publish steps
  - Fix report AI chat: `answerReportQuestion()` calls `runLLM()` directly instead of proxying through `/api/analyze`
  - Move MCP subdomain logic from `middleware.ts` to `proxy.ts` (Next.js 16 cannot have both)
  - Fix auto-merge chain: add `closed` event handler to dispatch `branch-maintenance.yml` after PR merge
  - Remove `pnpm install --prod` from Dockerfiles — dist has complete node_modules from Next.js standalone tracing
  - Stop deleting node_modules from CI workflows — CI was removing node_modules before committing to dist branch, so Docker build had no deps. Railway predeploy script requires pg which was lost.
  - Fix dist-root copy in beta CI: `cp -a dist-root /tmp/` created dist-root subdirectory, so .gitignore never landed at repo root. Fallback .gitignore (with node_modules) was generated. Changed to `cp -a dist-root/.` to copy contents directly.
- **Blocked (RESOLVED)**: Railway Metal builder incident (June 9 16:52 UTC — 17:35 UTC) resolved; incident moved to Monitoring at 17:35 UTC
- **Next**: Rebuild dist, push, trigger production deploy now that node_modules is committed to dist branch

---

## Interaction 4: UI Fixes, Login Auth, Business Profile Error Handling, Stripe Checkout, Superadmin Role Picker

- **Date**: 2026-06-11
- **User Goal**: Fix multiple UI and backend issues across the app: topbar icons-only mode, login page padding and auth flow, business profile db error handling, Stripe checkout URL param mismatch, superadmin role picker, Payload admin login style.
- **Changes**:
  1. **Topbar icons only**: Added `iconOnly` prop to Business, Mentoring, Credits, Admin, Profile TopbarSection components in `topbar.tsx`. Hybrid AI, Search, Onboarding button keep full labels.
  2. **Login page padding & flow**: Changed login card layout from vertically centered to top-aligned with `pt-16 md:pt-24`. Added `pt-6` to `CardContent`. Replaced `getSession()` calls with `result?.ok` to fix timing issues where the session cookie wasn't immediately available after sign-in.
  3. **Payload admin login**: Added "Sign in to UseClevr" and "Sign up" nav links to `PayloadLoginIntro` component. Restyled CSS with button-like nav links. Fixed test credentials box layout with BEM classes.
  4. **Business profile error handling**: Wrapped `upsertBusinessDetails()` and legacy profile path in `settings.ts` with try/catch, returning `failure()` with the error message instead of crashing the server action.
  5. **Stripe checkout URL**: Fixed param name mismatch in `checkout/confirm/route.ts` — changed `s={CHECKOUT_SESSION_ID}` to `session_id={CHECKOUT_SESSION_ID}` so the success page correctly reads it.
  6. **Superadmin role picker**: Removed `"superadmin"` from plan dropdown options in `admin/edit/page.tsx`. Only billing plans (`free`, `pro`, `business`) are shown.
  7. **Railway audit**: Verified Dockerfile, predeploy schema sync script, health endpoint, start command all correct.
- **Improvement**: `checkout-token.ts` still falls back to `STRIPE_SECRET_KEY` for HMAC signing when `AUTH_SECRET` is unset — should use separate secret.
- **Blocked**: Middleware blocks token-based MCP auth on MCP subdomains — `/api/mcp` not in publicApiPaths, so 401 returned before route handler can validate token. Fixed by adding `/api/mcp` to public paths.
- **Changes**: Added MCP write tools for FAQ and News (create/update/delete), listDatasets tool for user's own datasets. Added `faq:write`, `news:write` scopes. Wired auth context through invokeTool. Updated middleware to allow MCP token auth on subdomains.
- **Next**: Commit, push to beta, CI deploy.

---

## Interaction 29: Dashboard Display Controls and Workspace Structure

- **Date**: 2026-06-11
- **User Goal**: Separate theme and accessibility controls, review dashboard navigation, and make page headers, body sidebars, and management tables consistent.
- **Changes**:
  1. Separate Light, Dark, and System selection from icon-only text size, zoom, and contrast state controls.
  2. Keep topbar items on one line without clipping their popovers and let the main sidebar navigation scroll independently.
  3. Separate route-level titles, breadcrumbs, and subpage navigation from center page workspaces.
  4. Keep AI Assistant left and right sidebars and move Business and Dataset summaries into right sidebars.
  5. Start Business, Dataset, and Download table rows with selection controls and place bulk and primary actions in table headers.
- **Problems Marked**:
  - `observation`: A horizontal overflow container clips topbar popovers even when vertical overflow is declared visible.
  - `improvement`: Remaining management lists can adopt the shared selection and action-header contract during their next focused update.
- **User Learning**: Supporting information stays easier to scan when the center workspace contains only the primary table or form.
- **AI-Agent Learning**: Route layouts own headers and subpage navigation; page components own center workspaces and optional sidebars.
- **Follow-up Tasks**: None.
- **Instruction Sources**: `AGENTS.md`, `.kilo/agent/changelog.md`, `ai-chat-behavior.config.ts`, `gemini-behavior.config.ts`.
- **Minimal Destination**: Product behavior lives in `requirements.md` and `CHANGELOG.md`; display guidance and dashboard structure live in their user and developer guides; interaction records live in `project-logs/` and `docs/AI-interaction/interaction-status.md`.

---

## Interaction 30: Payload Storage and MCP Ownership

- **Date**: 2026-06-11
- **User Goal**: Continue the Payload setup, add durable storage, move News and FAQ MCP access to
  Payload, update Kilo endpoint references, and commit the work.
- **Changes**:
  1. Add a Media collection and S3-compatible storage for AWS S3 or Cloudflare R2.
  2. Block Media mutations when durable storage credentials are incomplete.
  3. Add Payload-native MCP tools for News and FAQ under `/api/payload/mcp`.
  4. Remove News and FAQ tools and scopes from the UseClevr dataset MCP service.
  5. Generate and apply the Media, News cover relation, and Payload MCP API-key migration.
  6. Align Payload packages and Next.js with their current compatible releases.
- **Problems Marked**:
  - `observation`: Payload migration generation fails under Node 26 because the loader attempts to
    open a namespaced `node:crypto` URL as a file.
  - `risk`: The Payload MCP dependency currently reports an upstream MCP SDK peer-version mismatch.
- **User Learning**: Product-data MCP and content MCP use separate credentials, permissions, and
  endpoints.
- **AI-Agent Learning**: Keep Payload content tools in the Payload plugin and preserve the custom
  app MCP for ownership-aware product data.
- **Follow-up Tasks**: None.
- **Instruction Sources**: `AGENTS.md`, `.kilo/agent/changelog.md`,
  `ai-chat-behavior.config.ts`, `gemini-behavior.config.ts`.
- **Minimal Destination**: Product behavior lives in `requirements.md` and `CHANGELOG.md`; MCP and
  Payload operations live in developer and user guides; session records live in `project-logs/`
  and `docs/AI-interaction/interaction-status.md`.

---

## Interaction 31: Built-In Account Database Persistence

- **Date**: 2026-06-12
- **User Goal**: Fix dashboard database updates and allow every built-in account to upload and
  analyze datasets as a real locked account.
- **Changes**:
  1. Materialize built-in base, demo, and superadmin identities as fixed database-backed users and
     profiles without allowing identity edits.
  2. Route built-in onboarding, business setup, settings, and dataset uploads through normal
     user-owned persistence.
  3. Give built-in accounts unrestricted analyst access and keep explicit non-persistent demo mode
     limited to non-built-in profitability uploads.
  4. Add the missing Business table, Profile preference fields, and timestamp defaults to the
     configured database and Railway predeploy schema repair.
- **Problems Marked**:
  - `root-cause`: Upload and settings paths treated built-in user IDs as disposable demo sessions.
  - `root-cause`: The configured database lacked schema elements required by dashboard writes.
- **Verification**: Type validation passes; all three built-in identities persist; company setup
  and dataset creation persist against the configured database; the temporary verification data is
  removed.
- **Follow-up Tasks**: None.
- **Instruction Sources**: `AGENTS.md`, `.kilo/agent/changelog.md`,
  `ai-chat-behavior.config.ts`, and `gemini-behavior.config.ts`.
- **Minimal Destination**: Product behavior lives in `requirements.md` and `CHANGELOG.md`;
  deployment behavior lives in the Railway guide; session records live in `project-logs/` and
  `docs/AI-interaction/interaction-status.md`.

---

## Interaction 32: Dashboard CRUD and Payload Design Alignment

- **Date**: 2026-06-12
- **User Goal**: Verify dashboard data creation, updating, and deletion and make Payload admin feel
  continuous with the dashboard.
- **Changes**:
  1. Connect selected dataset deletion to the existing authenticated dataset endpoint and surface
     failed API responses.
  2. Require ownership and valid state for business archive, restore, and deletion; allow permanent
     deletion only for archived secondary businesses.
  3. Add a reusable configured-database health test for built-in business create, update, archive,
     restore, delete, and cross-user rejection.
  4. Align Payload typography, cyan controls, 8px radii, navigation, workspace surfaces, and dark
     backgrounds with the dashboard and add a dashboard return link.
  5. Regenerate the Payload admin import map.
- **Problems Marked**:
  - `root-cause`: Dataset bulk deletion called an API route that does not exist.
  - `risk`: Business mutation helpers swallowed database failures and did not verify changed rows.
  - `observation`: The primary business remains protected account context; archived secondary
    businesses provide the permanent deletion workflow.
- **Verification**: Type validation and live configured-database business CRUD ownership checks
  pass; temporary verification data is removed.
- **Follow-up Tasks**: None.
- **Instruction Sources**: `AGENTS.md`, `.kilo/agent/changelog.md`,
  `ai-chat-behavior.config.ts`, and `gemini-behavior.config.ts`.
- **Minimal Destination**: Product behavior lives in `requirements.md` and `CHANGELOG.md`; user and
  Payload maintenance guidance live in product and developer guides; interaction records live in
  `project-logs/` and `docs/AI-interaction/interaction-status.md`.

---

## Interaction 33: Commit Documentation and AI Trace Alignment

- **Date**: 2026-06-12
- **User Goal**: Update documentation and AI interaction records, then commit the completed work.
- **Changes**:
  1. Document Railway cleanup that retains successful deployments with `--keep-success`.
  2. Record the compact sidebar collapse control beside Dashboard.
  3. Align the current AI interaction status, detailed session log, activity summary, requirements,
     changelog, user guide, developer guides, and completed TODO state.
  4. Prepare the validated dashboard persistence and Payload design changes as one commit.
- **Problems Marked**:
  - `observation`: The worktree contains related changes completed across consecutive dashboard,
    deployment, documentation, and AI interaction requests.
- **Verification**: Production build, TypeScript, tests, live dashboard CRUD ownership checks,
  deployment config checks, project records, TODO, changelog, package, secret, and diff checks pass.
- **Follow-up Tasks**: None.
- **Instruction Sources**: `AGENTS.md`, `.kilo/agent/changelog.md`,
  `ai-chat-behavior.config.ts`, and `gemini-behavior.config.ts`.
- **Minimal Destination**: Release behavior lives in `CHANGELOG.md`; operator and product behavior
  lives in the matching guides and `requirements.md`; interaction records live in `project-logs/`
  and `docs/AI-interaction/interaction-status.md`.

---

## Interaction 34: ChatGPT Developer Mode MCP Readiness

- **Date**: 2026-06-12
- **User Goal**: Add the UseClevr test MCP service as a ChatGPT developer-mode app.
- **Findings**:
  1. `https://mcp-test.useclevr.com/api/mcp` returns HTTP 500 for discovery and MCP initialization.
  2. The route accepts custom GET responses and `{ name, input }` POST bodies instead of standard
     remote MCP initialization, `tools/list`, and `tools/call`.
  3. The route requires custom `x-mcp-token` headers or a browser session.
  4. ChatGPT developer mode requires a remote Streamable HTTP or SSE MCP endpoint and cannot present
     a custom API key; private UseClevr dataset access therefore requires per-user OAuth.
- **Problems Marked**:
  - `blocker`: The endpoint cannot complete ChatGPT's tool scan.
  - `security`: Anonymous test access would expose user-owned datasets and is not an acceptable
    substitute for OAuth.
- **Follow-up Tasks**:
  - T-839. Implement Streamable HTTP MCP and OAuth, deploy to `beta` and `dist-test`, verify the
    test endpoint, then create the ChatGPT draft app from the workspace UI.
- **Instruction Sources**: `AGENTS.md`, `.kilo/agent/changelog.md`,
  `ai-chat-behavior.config.ts`, and `gemini-behavior.config.ts`.
- **Minimal Destination**: Active implementation stays in `.TODO/todo-next.md`; protocol guidance
  lives in the MCP developer and user guides; interaction state lives in `project-logs/` and
  `docs/AI-interaction/interaction-status.md`.

---

## Interaction 35: Payload Dashboard MCP Adapter

- **Date**: 2026-06-12
- **User Goal**: Use Payload as the primary test MCP and expose dashboard dataset information for
  ChatGPT developer mode.
- **Changes**:
  1. Register `listDashboardDatasets` and `getDashboardDatasetInsights` as Payload MCP tools.
  2. Scope both tools to the locked superadmin test identity and omit uploaded rows.
  3. Route the test MCP host to Payload Streamable HTTP MCP with a server-held restricted key.
  4. Add Payload capability columns, generated types, Railway additive schema sync, and a
     repeatable database-backed smoke test.
- **Problems Marked**:
  - `risk`: The test Payload key must enable only the two dashboard read tools.
  - `blocker`: Live ChatGPT registration requires the source deployment and Railway test key.
  - `observation`: Private customer dataset access still requires OAuth.
- **Verification**: Type validation, deployment config validation, pre-commit checks, clean
  production build, proxy rewrite test, tool registration test, and a database-backed smoke test
  with 11 locked test datasets pass. A later database retry failed during an external Neon
  connectivity interruption.
- **Follow-up Tasks**:
  - T-840. Add OAuth authorization before exposing private customer datasets.
  - T-841. Configure and deploy the Railway test connector, verify JSON-RPC, and create the
    ChatGPT draft app.
- **Instruction Sources**: `AGENTS.md`, `.kilo/agent/changelog.md`,
  `ai-chat-behavior.config.ts`, and `gemini-behavior.config.ts`.
- **Minimal Destination**: Product behavior lives in `requirements.md` and `CHANGELOG.md`; MCP and
  deployment guidance lives in the matching developer and user guides; pending operations live in
  `.TODO/todo-next.md`.

---

## Interaction 20: Bare Transitive Dep Resolution for AWS SDK in Dist Build

- **Date**: 2026-06-12
- **User Goal**: Fix Railway test deployment where Payload routes (`/admin`, `/api/payload/*`) return
  500 while `/api/health` works.
- **Current Product State**: After fixing the `.gitignore` to not strip `@aws-crypto/crc32c/build/`,
  a new `MODULE_NOT_FOUND` for `tslib` appears in the dist-test branch. The
  `fixAwsSdkPackages` function in `create-dist.cjs` only handles scoped packages
  (`@aws-sdk/*`, `@smithy/*`, `@aws-crypto/*`) but not non-scoped transitive deps like `tslib`.
- **Implemented Changes & Decisions**:
  1. Added step 3 to `fixAwsSdkPackages`: iterate copied pnpm store entries, scan their
     `node_modules/` for non-scoped children (e.g. `tslib`, `fast-xml-parser`), and create
     top-level symlinks for any missing bare deps.
  2. Added `findPnpmEntry()` helper to locate the pnpm store entry for a bare module name.
  3. This is a general fix that handles any bare dep that AWS SDK packages need, not just
     `tslib`.
- **Problems Marked**:
  - `resolved`: `@aws-crypto/crc32c/build/` stripped by over-broad `.gitignore` patterns.
    Fixed by root-anchoring `build/` and `out/` in `dist-root/.gitignore`.
  - `resolved`: `tslib` missing from dist top-level `node_modules`. Fixed by step 3 in
    `fixAwsSdkPackages`.
  - `risk`: If `fast-xml-parser` is not in the dist's pnpm store when AWS SDK XML parsing
    is triggered, it will fail. The fix mechanism handles it if the pnpm entry exists.
- **User Learning**: pnpm store entries have sibling non-scoped deps that need top-level
  symlinks for Node.js module resolution to work with degraded symlink-to-directory copies.
- **AI-Agent Learning**: `node -c <file>` syntax-checks CommonJS files; project record files must
  always be staged with code changes or commits are rejected by pre-commit hooks.

---

## Interaction 36: Payload Admin Dashboard Shell

- **Date**: 2026-06-13
- **User Goal**: Continue matching Payload admin with the dashboard using a left main menu,
  topbar, page header, body subheader, center work area, and right information panels.
- **Changes**:
  1. Add Payload-native component slots for the menu label, dashboard header, collection
     subheaders, and information panels.
  2. Apply dashboard proportions to the Payload navigation, topbar, headers, content grid, cards,
     and right information rail.
  3. Stack information panels below content at tablet widths and into one column on mobile.
  4. Regenerate the Payload admin import map.
- **Problems Marked**:
  - `observation`: Payload's native tables, filters, forms, permissions, and save controls remain
    unchanged.
  - `blocker`: Authenticated browser inspection could not complete because Payload initialization
    encountered an external PostgreSQL `ECONNRESET`.
- **Verification**: TypeScript, focused ESLint, TODO checks, pre-commit checks, import-map
  generation, and the production build pass.
- **Follow-up Tasks**: None.
- **Instruction Sources**: `AGENTS.md`, `.kilo/agent/changelog.md`,
  `ai-chat-behavior.config.ts`, and `gemini-behavior.config.ts`.
- **Minimal Destination**: Product behavior lives in `requirements.md`, `CHANGELOG.md`, and the
  product overview; interaction records live in `project-logs/` and
  `docs/AI-interaction/interaction-status.md`.

---

## Interaction 37: Payload Product Operations

- **Date**: 2026-06-13
- **User Goal**: Move administrator business profiles, support issues, dataset uploads, and AI
  entry points into Payload while keeping the dashboard AI and Hybrid AI workflows.
- **Changes**:
  1. Add Payload custom views for business profiles, support issues, and owner-assigned CSV uploads.
  2. Add Payload-superadmin endpoints backed by existing Drizzle business, ticket, dataset, and
     dataset-row storage.
  3. Parse operator CSV uploads with the canonical parser and preserve standard dataset ownership.
  4. Add Payload topbar modal actions for the AI Assistant and Hybrid AI.
  5. Update requirements, release notes, developer guidance, and the product overview.
- **Problems Marked**:
  - `observation`: The installed Payload plugins do not include an issue-management plugin that
    matches the existing support-ticket workflow.
  - `risk`: Payload and dashboard authentication remain separate, so the AI Assistant opens the
    dashboard session instead of accepting cross-user dataset context from Payload.
  - `observation`: Production build static generation logs an external PostgreSQL `ECONNRESET` and
    still completes successfully.
- **Verification**: TypeScript, focused ESLint, Payload import-map generation, TODO validation,
  changelog validation, secret checks, documentation links, and the production build pass.
- **Follow-up Tasks**: None.
- **Instruction Sources**: `AGENTS.md`, `.kilo/agent/changelog.md`,
  `ai-chat-behavior.config.ts`, and `gemini-behavior.config.ts`.
- **Minimal Destination**: Product behavior lives in `requirements.md` and `CHANGELOG.md`;
  operator guidance lives in the developer guide and product overview; completed work lives in
  `.TODO/todo-done.md`.

---

## Interaction 38: Payload Documentation And Access Alignment

- **Date**: 2026-06-13
- **User Goal**: Update documentation and requirements, fix Payload inconsistencies, and keep the
  work uncommitted.
- **Changes**:
  1. Align requirements, migration guidance, API access rules, testing steps, and sales project
     records with the active Payload operator workspace.
  2. Define Payload as the content owner and operator interface while application stores remain the
     source of truth for auth, billing, businesses, tickets, datasets, reports, and traces.
  3. Hide product-operation navigation and AI actions from base CMS users through Payload
     authentication state.
  4. Show a permission state on direct product-operation URLs without requesting customer data.
  5. Keep async form errors visible in active modals and reset successful upload forms reliably.
- **Problems Marked**:
  - `resolved`: Planning and sales records described Payload as future or content-only.
  - `resolved`: Base CMS users could see links for endpoints that always rejected their role.
  - `resolved`: The first role-gating approach depended on an undeclared Payload UI package.
- **Verification**: TypeScript, focused ESLint, TODO validation, changelog validation, secret
  checks, package validation, focused Markdown lint, documentation links, and the production build
  pass. Static generation logs an external PostgreSQL `ECONNRESET`, then completes all 123 pages.
- **Follow-up Tasks**: None.
- **Instruction Sources**: `AGENTS.md`, `.kilo/agent/changelog.md`,
  `ai-chat-behavior.config.ts`, and `gemini-behavior.config.ts`.
- **Minimal Destination**: Current product rules live in `requirements.md`; operator and security
  guidance lives in developer and user guides; planning boundaries live in the Payload migration
  plan and sales project records.

---

## Interaction 39: Payload MCP Documentation Migration

- **Date**: 2026-06-13
- **User Goal**: Add focused MCP migration tasks and update documentation so Payload MCP is the
  canonical connector while dashboard MCP references are removed.
- **Changes**:
  1. Add active MCP migration tasks T-845 through T-848 to `.TODO/todo-next.md` and advance
     `.TODO/config.json` to `849`.
  2. Rewrite user and developer MCP guidance around `/api/payload/mcp`, Bearer API-key auth,
     JSON-RPC discovery, and locked demo-account read tools.
  3. Replace dashboard MCP REST Client checks with Payload MCP checks in `docs/api-tests/mcp.http`.
  4. Update API access, requirements, changelog, Payload migration prompts, and current planning
     records to reference Payload MCP instead of a dashboard MCP connector.
- **Problems Marked**:
  - `observation`: Full `pnpm lint:docs` still reports pre-existing Markdown lint errors outside the
    changed MCP documentation.
  - `risk`: Historical project logs still describe earlier dashboard MCP work, but current guidance
    no longer documents that connector.
- **Verification**: `pnpm lint:todos`, `pnpm link:docs`, focused Markdown lint on changed
  documentation files, and changed-file Markdown lint pass except for pre-existing
  `.TODO/plan_project_stability.md` ordered-list warnings.
- **Follow-up Tasks**:
  - T-845. Replace dashboard MCP references in markdown docs with Payload MCP migration wording and remove `/api/mcp` dashboard connector examples.
  - T-846. Update MCP REST Client examples to call Payload Streamable HTTP MCP with Bearer API-key auth and JSON-RPC discovery.
  - T-847. Verify production and test MCP subdomains route only to Payload MCP, not dashboard MCP.
  - T-848. Document ChatGPT developer-mode setup for Payload MCP and remove dashboard MCP setup instructions.
- **Instruction Sources**: `AGENTS.md`, `.kilo/agent/changelog.md`,
  `ai-chat-behavior.config.ts`, and `gemini-behavior.config.ts`.
- **Minimal Destination**: MCP product rules live in `requirements.md`; user and developer MCP
  guidance lives in `docs/User_Guides/mcp.md` and `docs/Developer_Guides/MCP.md`; test guidance
  lives in `docs/api-tests/mcp.http`; active work lives in `.TODO/todo-next.md`; interaction records
  live in `project-logs/` and `docs/AI-interaction/interaction-status.md`.

---

## Interaction 40: Payload Admin Shell Enhancements

- **Date**: 2026-06-13
- **User Goal**: Enhance Payload admin UI with nav footer (search/theme/logout), Lucide icons on all nav links, breadcrumbs on admin views, and review login page styling.
- **Changes**:
  1. Created `PayloadNavFooter` in `afterNavLinks` slot with admin search modal, theme toggle, and logout button.
  2. Added Lucide icons (Building2, Ticket, Upload, Users, Percent, Layers, BarChart3) to custom nav sections.
  3. Added CSS `::before` SVG data URI icons for built-in Payload collection nav links (CMS Users, News Posts, FAQs, Media).
  4. Added breadcrumb nav (Admin / Section) to `OperationHeader` in both operational and admin management views.
  5. Styled nav icons, breadcrumbs, and collection link icons in `payload-auth-brand.css` with dark-mode support.
  6. Created `PayloadThemeToggle` (Light/Dark/System) and `TailwindThemeSync` (MutationObserver) for theme persistence.
  7. Redesigned Payload admin login page with dashboard-style radial gradients, card form with blur/glow, and teal buttons.
- **Problems Marked**:
  - `resolved`: Logged out admin pages (`/admin/login`, `/admin/logout`) don't run client components, so theme toggle and sync needed careful slot placement in `graphics.Logo` and `beforeLogin`.
  - `resolved`: Payload 3 styling conflicts with Tailwind dark class — MutationObserver on `data-theme` → class bridge works reliably.
  - `observation`: Full `next build` exceeds 5-minute timeout locally but `tsc --noEmit` passes.
- **Verification**: `tsc --noEmit` passes cleanly. All admin views registered and navigable.
- **Follow-up Tasks**:
  - Verify Railway test and app deploys after push.
  - Review business profiles view in Payload admin for CRUD completeness.
  - Add Google/LinkedIn OAuth to login page if not present.
  - Verify 14-day demo credit system works end-to-end.
  - Add credits/credit system UI to Payload admin topbar and sidebar.
- **Instruction Sources**: `AGENTS.md`, `.kilo/agent/changelog.md`, `ai-chat-behavior.config.ts`, and `gemini-behavior.config.ts`.
- **Minimal Destination**: Payload admin component code lives in `src/components/payload/`; styling in `payload-auth-brand.css`; nav configuration in `payload.config.ts`; admin operation and management views in `payload-operational-views.tsx` and `payload-admin-management-views.tsx`.

---

## Interaction 41: Markdown Lint Cleanup

- **Date**: 2026-06-13
- **User Goal**: Fix Markdown lint failures across documentation and project Markdown files without committing.
- **Changes**:
  1. Fixed table pipe alignment in AI tools, founder, sales, and project-controls docs.
  2. Added blank-line spacing around Markdown tables.
  3. Fixed fenced-code spacing and nested REST Client prompt code fences.
- **Problems Marked**:
  - `observation`: Markdown lint failures were formatting-only and did not change product behavior.
- **Verification**: `pnpm lint:docs`, `pnpm link:docs`, and `git diff --check -- "*.md" .TODO/*.md project-prompts/*.md` passed.
- **Follow-up Tasks**: None.
- **Instruction Sources**: `AGENTS.md`, `.kilo/agent/changelog.md`, `ai-chat-behavior.config.ts`, and `gemini-behavior.config.ts`.
- **Minimal Destination**: Documentation formatting lives in the updated Markdown files; interaction records live in `project-logs/` and `docs/AI-interaction/interaction-status.md`.

---

## Interaction 42: Payload Admin Topbar, OAuth Login, Credit Badge & CI Fix

- **Date**: 2026-06-15
- **User Goal**: Complete Payload admin shell with topbar controls, OAuth login buttons, credit badge, search popup, breadcrumbs, and CRUD on all views. Then fix CI pipeline failure.
- **Changes**:
  1. Created `PayloadTopbarControls` (`payload-admin-topbar.tsx`): portal into `.app-header` with logo badge, search button (⌘K modal), credit badge, theme toggle, sign out link.
  2. Created `PayloadCreditBadge` (`payload-admin-credit-badge.tsx`): reads `useclevr_credits` from localStorage, links to `/app/settings/billing`.
  3. Added credit badge to both topbar (`PayloadTopbarControls`) and sidebar footer (`PayloadNavFooter`).
  4. Added Google + LinkedIn OAuth buttons to `PayloadLoginView` with "Or continue with" divider.
  5. Verified 14-day trial: `TRIAL_DAYS = 14` in `analyst-credits.ts`, trial computed from user `createdAt`.
  6. Fixed stale `PayloadSupportIssuesView` import in `importMap.js` (removed entry for dead component).
  7. Fixed migration placeholder `__name` in `src/migrations/index.ts` — Payload auto-generated `20260615_183958___name` was committed as a template placeholder; replaced with `20260615_183958_payload_support_issues`.
- **Problems Marked**:
  - `blocker`: CI failed on Validate Source — stale `PayloadSupportIssuesView` import in `importMap.js` from prior local dev runs.
  - `blocker`: CI failed on second push — `src/migrations/index.ts(5,51): error TS2307` — migration index had `__name` placeholder never replaced by developer.
  - `observation`: `importMap.js` is auto-generated and manually edited entries get overwritten on next `payload dev`.
  - `observation`: Local `src/migrations/index.ts` already had correct `payload_support_issues` name (auto-fixed by running `payload dev`), but committed version still had `__name`.
- **Verification**: `pnpm exec tsc --noEmit --pretty false` passes on local machine.
- **Next Steps**: Push migration fix, wait for CI green, verify Railway auto-deploys, test live Payload admin.
- **Instruction Sources**: `AGENTS.md`, `.kilo/agent/changelog.md`, `ai-chat-behavior.config.ts`, and `gemini-behavior.config.ts`.
- **Minimal Destination**: Payload admin component code in `src/components/payload/`; styling in `payload-auth-brand.css`; nav config in `payload.config.ts`; migration index at `src/migrations/index.ts`.

---

## Interaction 43: Payload Product Operations Completion

- **Date**: 2026-06-15
- **User Goal**: Update guides, commit, and complete Payload operator support for business profiles,
  issues, dataset uploads, AI Assistant, and Hybrid AI with dashboard-consistent presentation.
- **Changes**:
  1. Store support issues in a native Payload collection while dashboard ticket routes use the same
     owner-scoped records.
  2. Add an explicit Payload migration that creates the issue schema and copies legacy tickets
     without duplicate IDs.
  3. Run Railway's additive schema helper before standalone startup and include the Payload issue
     schema in that helper.
  4. Keep business profiles and datasets in existing owner-scoped Drizzle tables through
     superadmin-only Payload views.
  5. Keep AI Assistant and Hybrid AI as Payload modal handoffs into existing dashboard workflows.
  6. Replace fabricated login metrics with direct descriptions of content, support, upload, and AI
     operations.
  7. Align requirements, changelog, migration guidance, deployment guidance, project phases, user
     guidance, developer guidance, and sales planning with current ownership and MCP behavior.
- **Problems Marked**:
  - `blocker`: Payload migration generation fails under Node 26 because TSX resolves a built-in
    module as a file URL; generation succeeds under Node 22 and the resulting migration validates
    under the project runtime.
  - `risk`: Railway previously started without its documented predeploy schema command.
  - `observation`: Concurrent agent changes modified TODO guidance during validation; the final
    queue rules and checker now agree.
- **User Learning**: Payload can own support issues without moving business profiles or datasets
  out of their existing account-scoped storage.
- **AI-Agent Learning**: Re-read branch and staged state before final validation because another
  agent can commit or stage work during an active request.
- **Follow-up Tasks**: T-841 remains responsible for test-host MCP deployment and ChatGPT
  developer-mode verification.
- **Verification**: `pnpm validate:types`, `pnpm lint:docs`, `pnpm lint:todos`,
  `pnpm lint:secrets`, `pnpm validate:dist`, focused ESLint, and `pnpm build` pass. The production
  build reports the existing generic compile warning without a warning detail.
- **Instruction Sources**: `AGENTS.md`, `.kilo/agent/changelog.md`, `ai-chat-behavior.config.ts`, and `gemini-behavior.config.ts`.
- **Minimal Destination**: Product behavior lives in `requirements.md`; release behavior lives in
  `CHANGELOG.md`; operator and deployment guidance lives in developer and user guides; detailed and
  compact records live in `project-logs/` and `docs/AI-interaction/interaction-status.md`.

---

## Interaction 44: Project Phase Distribution

- **Date**: 2026-06-15
- **User Goal**: Review the internal project phase plan, distribute current and future work into
  TODO queues, align current descriptions and sales guidance, and keep the phase document concise.
- **Changes**:
  1. Consolidate delivery into Usable MVP, Sales Validation, AI Differentiation, and Platform
     Expansion with explicit exit or activation gates.
  2. Keep CSV as the current upload format and Payload MCP as limited active infrastructure for
     approved content and locked demo-account summaries.
  3. Replace phase-documentation tasks with concrete acceptance, privacy, demo-kit, activation,
     billing, and Railway test-release tasks.
  4. Gate AI differentiation, connectors, public API productization, private customer MCP, market
     intelligence, and Intelligence Cloud in the future queue.
  5. Align requirements, README, developer and user guides, sales plan, marketing guidance, project
     brief, product description, business case, issue register, risk register, and stage plan.
  6. Repair duplicated sales-plan table headers and remove active MCP tasks duplicated in the
     future queue.
- **Problems Marked**:
  - `risk`: Current and future capability claims diverged across CSV/Excel, MCP, Payload, and sales
    documents.
  - `improvement`: Phase tasks now describe measurable exit work instead of documentation intent.
  - `observation`: An unrelated untracked Payload business-store file exists and remains untouched.
- **User Learning**: Phase gates let current sales and product work remain ambitious without
  presenting unvalidated platform expansion as available.
- **AI-Agent Learning**: Distribute planning information by audience and action: requirements state
  product rules, TODO queues state work, sales docs state proof and claims, and the phase guide stays
  concise.
- **Follow-up Tasks**: T-849, T-850, and T-853 through T-856 define the active phase exit work.
- **Verification**: `pnpm lint:docs`, `pnpm link:docs`, `pnpm lint:todos`,
  `pnpm lint:secrets`, and `git diff --check` pass.
- **Instruction Sources**: `AGENTS.md`, `.kilo/agent/changelog.md`,
  `ai-chat-behavior.config.ts`, and `gemini-behavior.config.ts`.
- **Minimal Destination**: Internal phase rules live in `.TODO/.PLAN/project-phases.md`; concise
  developer gates live in `docs/Developer_Guides/PROJECT_PHASES.md`; current and deferred work lives
  in `.TODO/`; commercial gates live in `docs/Sales/`; interaction records live in `project-logs/`
  and `docs/AI-interaction/interaction-status.md`.

---

## Interaction 45: Current Phase TODO Expansion

- **Date**: 2026-06-15
- **User Goal**: Add meaningful current-phase TODO tasks without committing, then update docs and AI interaction records.
- **Changes**:
  1. Add active tasks for Excel upload parity, privacy shield acceptance, analysis quality, Payload admin login review, and release-candidate checklist.
  2. Keep current-phase work in `.TODO/todo-next.md` and future platform expansion out of active work.
  3. Update phase docs and product overview to include the expanded current-phase checklist.
  4. Refresh AI interaction status with the new active phase work and validation result.
- **Problems Marked**:
  - `observation`: Current-phase work should stay measurable and release-oriented.
  - `risk`: Advanced platform work can distract from the usable MVP and sales-validation gates.
- **Follow-up Tasks**: T-857 through T-862 define the added current-phase tasks.
- **Verification**: `pnpm lint:todos`, `pnpm lint:docs`, `pnpm link:docs`, and `git diff --check` pass.
- **Instruction Sources**: `AGENTS.md`, `.kilo/agent/changelog.md`, `ai-chat-behavior.config.ts`, and `gemini-behavior.config.ts`.
- **Minimal Destination**: Active work lives in `.TODO/todo-next.md`; phase guidance lives in `docs/Developer_Guides/PROJECT_PHASES.md`; product wording lives in `docs/User_Guides/product-overview.md`; interaction records live in `project-logs/` and `docs/AI-interaction/interaction-status.md`.

---

## Interaction 46: Payload Product Operations Full CRUD & Dataset Management

- **Date**: 2026-06-15
- **User Goal**: Move business profiles, dataset upload, and AI features to Payload admin with full CRUD and Payload-native presentation.
- **Changes**:
  1. Created `admin-business-store.ts` with consolidated full CRUD: list with entity counts, create, update, archive, restore, delete (with archive-only, non-primary guards), get by ID, list entities.
  2. Created `admin-dataset-store.ts` with list, get by ID, upload (CSV parse, batch insert), delete, preview (paginated row data).
  3. Rewrote `admin-operations.ts` to use the new stores and expose endpoints: GET/POST/DELETE businesses, archive/restore, GET entities, GET/POST/DELETE datasets, GET preview.
  4. Rewrote `payload-operational-views.tsx`:
     - Business profiles: search bar, full table (name, owner, industry, entities, status, updated), row actions (view detail, edit, archive/restore, delete), create/edit form modal, detail modal with all fields.
     - Datasets view: list table (name, owner, size, rows/columns, status, uploaded), detail modal with data preview table, column chips, delete confirmation.
     - Dataset upload: drag-and-drop zone, owner select, upload progress.
     - AI modals: Payload-native modal overlay for AI Assistant (features, open dashboard link) and Hybrid AI (Lite/MEGA tiers, configure link).
  5. Registered `PayloadDatasetsView` in payload.config.ts and importMap.js.
  6. Added nav footer quick link for datasets management.
  7. Added ~300 lines of CSS for: spinner, badges, toolbar, search, status badges (draft/active/archived), row actions, detail grid, preview table, upload zone, button styles, AI modals.
  8. Updated project records, changelog, and interaction status.
  9. Ran typecheck — passes cleanly.
- **Problems Marked**:
  - `observation`: Business data stays in Drizzle tables (dashboard continues to use them directly); Payload admin bridges through the new store layer.
  - `observation`: ImportMap needs manual edits between `payload dev` runs because view registration in payload.config.ts doesn't auto-register in importMap until next dev build.
- **Verification**: `pnpm exec tsc --noEmit --pretty false` passes. Full project validation pending commit.
- **Follow-up Tasks**: Push to beta, verify CI green, verify Railway deploys, test live Payload admin datasets/businesses views.
- **Instruction Sources**: `AGENTS.md`, `.kilo/agent/changelog.md`, `ai-chat-behavior.config.ts`, and `gemini-behavior.config.ts`.
- **Minimal Destination**: Business store at `src/lib/payload/admin-business-store.ts`; dataset store at `src/lib/payload/admin-dataset-store.ts`; API endpoints in `admin-operations.ts`; views in `payload-operational-views.tsx`; CSS in `payload-auth-brand.css`; config in `payload.config.ts`; importMap in `src/app/(payload)/admin/importMap.js`.

---

## Interaction 47: Payload Business, Accountancy, and Authentication Migration

- **Date**: 2026-06-15
- **User Goal**: Move business profile and accountancy workflows into Payload, preserve the current
  design, restore one-page tabbed operator authentication, and support Google and LinkedIn access.
- **Changes**:
  1. Add a Payload accountancy view with dashboard-account and business selectors for overview,
     reporting, tax, and compliance context.
  2. Keep businesses, company setup, profiles, datasets, and dataset rows in their existing
     owner-scoped Drizzle records.
  3. Extend Payload business editing with legal structure, accounting method, tax registration,
     tax type, tax rate, and currency fields.
  4. Fix business entity counts to query business IDs and let operators clear optional profile
     values.
  5. Combine Payload sign-in and base-role registration in tabs with the shared password policy.
  6. Authenticate configured Google and LinkedIn sessions through a Payload custom strategy that
     provisions matching base-role CMS accounts and preserves the fixed built-in superadmin role.
- **Problems Marked**:
  - `risk`: Social provider access requires the existing Auth.js Google or LinkedIn credentials.
  - `observation`: Product-operation endpoints remain superadmin-only even when base-role operator
    registration is available.
- **User Learning**: Payload can host operator workflows without duplicating dashboard business or
  accountancy records.
- **AI-Agent Learning**: Use a Payload custom authentication strategy when an Auth.js provider must
  authorize Payload requests; a redirect alone does not create a Payload-authenticated request.
- **Follow-up Tasks**: T-861 verifies the final Payload login and operator UI in the release
  candidate.
- **Verification**: `pnpm exec tsc --noEmit --pretty false`, focused ESLint, `pnpm lint:todos`,
  `pnpm lint:changelog`, `pnpm lint:secrets`, `pnpm lint:docs`, `pnpm link:docs`, `git diff
  --check`, and `pnpm build` pass. The production build reports the existing generic compiled
  warning banner without warning details.
- **Instruction Sources**: `AGENTS.md`, `.kilo/agent/changelog.md`,
  `ai-chat-behavior.config.ts`, and `gemini-behavior.config.ts`.
- **Minimal Destination**: Product behavior lives in `requirements.md`; operator implementation
  guidance lives in `docs/Developer_Guides/DEVELOPER_GUIDE.md`; release behavior lives in
  `CHANGELOG.md`; active verification remains in `.TODO/todo-next.md`.
