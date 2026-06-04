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
