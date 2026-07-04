# Done TODO

This retired queue stores completed work after product requirements and changelog updates are handled
where needed.

Get the T-number from `.TODO/config.json` before adding new tasks. Keep task numbers stable when
moving work between states.

- [TODO-next.md](todo-next.md)
- [TODO-done.md](todo-done.md)
- [TODO-ignore.md](todo-ignore.md)
- [TODO-future.md](todo-future.md)
- [.TODO/config.json](config.json)

## Label: deployment

- T-776. Wrap Payload CMS seed onInit with graceful table-existence check before querying cms-users collection, so static page generation succeeds on fresh databases without relying on generic try/catch. (labels: deployment, content, ci-build; commit: worktree)

## Label: monitoring

- T-793. Add Docker HEALTHCHECK instruction to dist-root/Dockerfile and generated Dockerfile, checking /api/health every 30s with 3 retries. (labels: monitoring, deployment, stability; commit: worktree)
- T-794. Add SIGTERM/SIGINT graceful shutdown handler to start-dist.cjs that forwards the signal to the child Next.js server process before exiting. (labels: monitoring, deployment, data; commit: worktree)

## Label: mcp

- T-839. Expose locked demo-account dataset metadata and stored insights through Payload Streamable HTTP MCP for ChatGPT developer-mode testing. (labels: mcp, auth, api, testing, security; commit: worktree)
- T-809. Verify UseClevr MCP token creation, dataset scope enforcement, and audit logging through the app MCP routes. (labels: mcp, testing, security; commit: worktree)
- T-816. Store seeded public, dashboard, and operator FAQ content in the Payload FAQ collection. (labels: mcp, content, faq; commit: worktree)
- T-817. Expose Payload News and FAQ tools through Payload-native MCP API keys while `/api/mcp` serves product datasets only. (labels: mcp, content, api; commit: worktree)
- T-836. Store Payload News cover media through S3-compatible durable storage and apply the Media and MCP API-key migration. (labels: content, upload, data; commit: worktree)

## Label: docs

- T-801. Document hotfix path and emergency rollback procedure in GITHUB_WORKFLOW.md. Cover Railway redeploy rollback, revert PR flow, and verification steps. (labels: workflow, deployment, devops; commit: worktree)

## Label: workflow

- T-703. Add pre-commit hooks (lint:todos, lint:changelog, lint:secrets, lint:package) and pre-push hooks (types, dist validate, lint, workflows). Verified fully implemented. (labels: workflow, ci-build; commit: worktree)
- T-851. Distribute the project phase map into active and deferred TODO queues with explicit phase gates. (labels: workflow, docs; commit: worktree)
- T-852. Align sales, product, user, and developer descriptions with usable-MVP, sales-validation, AI-differentiation, and platform-expansion phases. (labels: docs, sales, workflow; commit: worktree)

## Label: upload

- T-910. Show Free plan dataset-limit responses as an informational upgrade state on upload surfaces, with Pro and Business upgrade actions, plan comparison copy, and disabled drag-and-drop until the account upgrades. (labels: upload, billing, ui; commit: worktree)

## Label: auth

- T-909. Simplify MVP authentication to email-password, email verification, password reset, and demo login by removing Google and LinkedIn OAuth providers, UI buttons, status routes, environment checks, and unused social-login dependencies. (labels: auth, ui, security; commit: worktree)
- T-908. Prefer the Railway social sign-in environment names for Google and LinkedIn provider setup, keep legacy provider names as fallback aliases, and suppress stale OAuth configuration query errors after provider status loads. (labels: auth, deployment, ui; commit: 000129bf)
- T-907. Hide unconfigured Google and LinkedIn sign-in options on the login page, suppress social-auth configuration alerts when no social provider is enabled, and keep email-password plus demo sign-in available. (labels: auth, ui, stability; commit: worktree)
- T-892. Fix OAuth provider availability detection, sanitized server config logging, exact provider callback paths, and successful social-login dashboard redirects. (labels: auth, deployment, ui; commit: worktree)
- T-891. Fix OAuth callback, sign-out redirect, and generated app-link origins so browser URLs use localhost locally and the active UseClevr host in deployed environments instead of the server bind host. (labels: auth, deployment, ui; commit: worktree)
- T-889. Route email verification delivery through Resend only, expose a guarded Resend status diagnostic, and surface unverified sender-domain failures in server logs. (labels: auth, logging, deployment, testing; commit: worktree)
- T-888. Fix Google and LinkedIn OAuth sign-in by accepting common provider credential env names, requesting email/profile scopes, and using a same-app dashboard callback. (labels: auth, deployment, ui; commit: worktree)
- T-880. Verify Resend provider configuration and sender-domain readiness before verification email sending, and expose a guarded Resend status diagnostic endpoint. (labels: auth, logging, deployment, testing; commit: worktree)
- T-879. Add an env-gated superadmin fallback verification path that keeps platform access available when email delivery fails. (labels: auth, security, deployment; commit: worktree)
- T-878. Log email-password auth milestones and provide Railway diagnostics for signup, verification, login code, and login verification checks. (labels: auth, logging, testing, deployment; commit: worktree)
- T-877. Log sanitized Resend verification email failures and provide a Railway diagnostic send command for provider delivery testing. (labels: auth, logging, deployment, testing; commit: worktree)
- T-876. Send email verification codes through Resend from the configured UseClevr sender using Railway environment variables. (labels: auth, security, deployment; commit: worktree)
- T-875. Implement UseClevr-owned hashed email verification codes for signup and every email-password login before dashboard access. (labels: auth, security, ui; commit: worktree)
- T-874. Require email OTP verification before email-password accounts can sign in and reach dashboard workflows. (labels: auth, security, ui; commit: worktree)
- T-837. Persist locked built-in accounts as database-backed identities for dashboard updates and all upload workflows. (labels: auth, upload, dashboard, data; commit: worktree)

## Label: ai

- T-906. Add Business Intelligence Engine Phase 1 with automatic post-upload profiling, KPI detection, health scoring, risk detection, opportunity detection, summaries, prioritized actions, and deterministic tests. (labels: ai, data, business, testing; commit: worktree)
- T-905. Complete Hybrid AI feature gates for current Lite and MEGA features with backend enforcement and automated entitlement tests. (labels: ai, billing, security, testing; commit: worktree)
- T-904. Apply simplified Hybrid AI MVP feature gates across frontend, backend routes, provider settings, audit activity, helper roadmap actions, blocked-attempt logs, and user-facing upgrade paths. (labels: ai, billing, security, ui; commit: worktree)
- T-903. Add metadata-only Hybrid AI privacy audit logging, AI Assistant privacy status, and user-scoped AI Activity review. (labels: ai, logging, security, ui; commit: worktree)
- T-902. Route the existing AI Assistant through Hybrid AI provider routing, dataset-aware context, fallback rules, local-only cloud blocking, and unified provider status display. (labels: ai, local-ai, data, ui; commit: worktree)
- T-901. Add dataset-aware Hybrid AI Chat with dataset selection, summarized dataset context, backend KPI extracts, provider routing status, and local-only cloud blocking. (labels: ai, local-ai, data, ui; commit: worktree)
- T-900. Add a UseClevr Hybrid AI chat page and API route that use configured AI providers, respect Hybrid AI mode, show provider routing status, and keep provider secrets server-side. (labels: ai, local-ai, api, ui; commit: worktree)
- T-899. Add Hybrid AI provider health checks with classified connection status, bulk enabled-provider validation, model confirmation, masked key previews, and offline-safe routing errors. (labels: ai, local-ai, security, testing; commit: worktree)
- T-898. Add Hybrid AI mode switching with Auto, Offline local-only, and Cloud-only routing, provider health checks before analysis, cloud-blocking offline behavior, and visible provider status states. (labels: ai, local-ai, security, data; commit: worktree)
- T-897. Provide a complete AI Providers settings page with provider list, add/edit dialog, encrypted-key storage, connection testing, detected models, default selector, fallback selector, and priority routing. (labels: ai, ui, security, data; commit: worktree)
- T-896. Route dataset summaries, predictive summaries, analyst narratives, investigation findings, comparison narratives, query explanations, and report chat through configured AI providers with default cloud fallback. (labels: ai, data, reporting; commit: worktree)
- T-895. Integrate the AI Assistant with the universal AI adapter and show provider status for default, fallback, and unavailable provider states. (labels: ai, ui, data; commit: worktree)
- T-894. Reframe the Hybrid AI modal around Phase 1 BYOAI provider setup and mark UseClevr Helper downloads as coming soon until signed binaries exist. (labels: ai, ui; commit: worktree)
- T-893. Implement Phase 1 Bring Your Own AI provider manager with multiple provider types, encrypted keys, connection testing, model discovery, default provider routing, and fallback through the universal adapter. (labels: ai, ui, security, data; commit: worktree)
- T-821. Fix Auth.js 500 on `/api/auth/session` on Railway by setting `AUTH_SECRET` env var on both test and production services. Add `NEXTAUTH_SECRET` fallback to config Zod schema. (labels: auth, deployment, security; commit: worktree)

## Label: business

- T-882. Refine Business Profile setup into a polished SaaS onboarding flow with context-aware copy, intelligent examples, clear validation, accessible navigation, and a stronger completion state. (labels: business, ui, accessibility; commit: worktree)
- T-867. Expand Business Profile setup into a professional multi-step wizard with conditional tax, payroll, insurance, fixed-cost, margin, cash-reserve, and growth questions for uploaded-data analysis context. (labels: business, ui, data; commit: worktree)
- T-865. Accountancy shows a pre-bookkeeping empty state, document-upload and package-generation actions, accountant handoff fields, and saved Business Profile accounting context for new-user workflows. (labels: business, ui, workflow; commit: worktree)
- T-863. Move business profile and accountancy operator workflows into Payload, preserve dashboard data ownership and calculations, and provide tabbed credentials, Google, and LinkedIn admin registration and sign-in. (labels: business, reporting, auth, ui; commit: worktree)

## Label: dashboard

- T-885. Apply global authenticated page spacing, visible-field Business Profile completion, and role-aware analyst credit limits across dashboard upload, analysis, and report workflows. (labels: dashboard, billing, business, ui; commit: worktree)
- T-884. Fix dashboard report-header greeting clipping and Business Profile completion badges so visible completed fields show 100%. (labels: dashboard, business, ui; commit: worktree)
- T-883. Fix Dashboard 2.0 TypeScript build blockers so the personalized business dashboard compiles and production builds complete. (labels: dashboard, ci-build, quality; commit: worktree)
- T-881. Render the authenticated dashboard as a personalized AI retail business report with real-data KPIs, inventory intelligence, ABC analysis, and prioritized recommendations. (labels: dashboard, reporting, business, ui; commit: worktree)
- T-869. Show Business and Accountancy sidebar onboarding badges with Required, percentage, and completed states that point incomplete users to the setup workflows. (labels: dashboard, ui, business; commit: worktree)
- T-843. Manage owner-scoped business profiles and dataset uploads through authenticated Payload views, and manage dashboard support records through the native Payload Issues collection. (labels: dashboard, business, upload, ui; commit: worktree)
- T-844. Add Payload admin modal entry points for the dataset-aware AI Assistant and Hybrid AI workflows. (labels: dashboard, ai, local-ai, ui; commit: worktree)
- T-838. Complete ownership-safe dashboard data mutation flows and align Payload admin surfaces with dashboard design tokens. (labels: dashboard, data, business, content, ui, testing; commit: worktree)

## Label: deployment

- T-814. Add two-line README.md for dist branch explaining deployment structure and recovery procedures. (labels: deployment, docs, workflow; commit: worktree)

## Label: ui

- T-914. Tighten Usy header spacing, reduce avatar pulse radius, brighten cyan-lilac suggestion buttons, and balance the assistant panel without reintroducing support-form fields. (labels: ui, ai, accessibility; commit: worktree)
- T-913. Polish Usy with stronger UseClevr colors, larger non-overlapping avatar placement, multi-layer breathing glow, cleaner companion copy, modern chat bubbles, prompt-style input, and no embedded support form. (labels: ui, ai, accessibility; commit: worktree)
- T-912. Replace the floating Help Chat with Usy, the UseClevr AI Business Intelligence Assistant, including avatar-led welcome, suggestion chips, prompt-style input, Hybrid AI attempt, and UseClevr knowledge fallback. (labels: ui, ai, faq; commit: worktree)

- T-873. Remove setup progress and guided tour popups, stop guided-tour visit tracking, and keep onboarding indicators focused on Business Profile, Accountancy, Dataset Upload, and Analysis. (labels: ui, dashboard, workflow; commit: worktree)
- T-872. Add consistent page-header spacing on Downloads, Datasets, Business, Accountancy, and Retail pages so main content starts below the top navigation with readable separation. (labels: ui, dashboard; commit: worktree)
- T-870. Simplify display controls to a compact Light Mode, Dark Mode, and zoom-level menu with dark mode as the default and saved preferences. (labels: ui, dashboard, accessibility; commit: worktree)
- T-868. Show Account settings as a wide control center with Profile, Company, Subscription, Security, account status, completion indicators, and a Continue Setup action. (labels: ui, dashboard, billing; commit: worktree)
- T-842. Align the Payload admin shell with the dashboard hierarchy using a left main-menu sidebar, topbar, page header, body subheader, centered content area, and responsive right information panels. (labels: ui, content, dashboard, accessibility; commit: worktree)
- T-828. Apply gradient background style to login panel matching affiliate page bottom CTA section. (labels: ui, auth, dashboard; commit: worktree)
- T-829. Add smooth theme transition with fade-in-out animation on root layout for light/dark mode changes. (labels: ui, accessibility, workflow; commit: worktree)
- T-830. Add dark-mode-aware accessibility icons grid including eye-dropper, zoom-in, zoom-out, a11y, and voice-control icons. (labels: ui, accessibility, dashboard; commit: worktree)
- T-832. Simplify topbar section panels to show only action links without header or description sections. (labels: ui, dashboard, accessibility; commit: worktree)
- T-834. Add password-reveal for built-in accounts on login page - hidden by default, shows with "edely" password. (labels: ui, auth, security; commit: worktree)

## Label: content

- T-737. Set up Payload Phase 0 with minimal admin content editing for news, homepage, privacy, terms, demo CMS accounts, and shared PostgreSQL migration flow. (labels: content, auth, payment, deployment; commit: worktree)

## Label: ci-build

- T-791. Supply a deterministic CI-only authentication secret to source validation and generated deployment builds so required environment validation and smoke tests complete. (labels: ci-build, auth, deployment; commit: 4b99e59d)
- T-783. Keep the Next.js production proxy entry intact so webpack builds complete middleware finalization. (labels: ci-build, deployment; commit: worktree)
- T-739. Add workflow check-name golden validation, bot-driven golden refresh, and fail-fast pre-push workflow guarding against stale required job names. (labels: ci-build, deployment, workflow; commit: worktree)

## Label: ai

- T-887. Unlock Hybrid AI Lite and Hybrid AI MEGA modules from one shared UseClevr Helper installation through subscription-based module flags. (labels: ai, local-ai, billing, ui; commit: worktree)
- T-886. Implement UseClevr Helper as the branded local Hybrid AI bridge with protected helper downloads and private-analysis chat status. (labels: ai, local-ai, security, ui; commit: worktree)
- T-871. AI Assistant generates at least 10 contextual suggested questions automatically after dataset selection, caches them per dataset, and shows fallback questions when generation fails. (labels: ai, data, ui; commit: worktree)
- T-864. Retail Inventory Analyst shows every product-specific stock, sales, profit, margin, last-sale, order, and owner-action detail row in scrollable low-stock, dead-stock, and top-profit result cards. (labels: ai, data, ui; commit: worktree)

- T-781. Keep each analysis request scoped to the signed-in user's selected dataset without shared server memory between requests. (labels: ai, auth, data, api; commit: worktree)
- T-784. Keep assistant calculations limited to verified dataset values and name missing columns instead of inventing proxy costs, lifespans, or performance values. (labels: ai, data, quality; commit: worktree)
- T-435. AI interaction docs define the all-text-files current-state language rule and instruction maintenance checklist. (labels: ai, data, upload, docs; commit: 53deaed7)
- T-411. The last inline table in `ResultPreview` (`ai-assistant-workspace.tsx`) refactored to use the shared `DataTable` component. (labels: ai, dashboard, ui, data; commit: 53deaed7)
- T-363. Per-page loading and error states added for datasets, settings, business, assistant, tickets, accountancy, and admin sections. (labels: ai, dashboard, ui, business; commit: 53deaed7)
- T-356. AI assistant generates data-aware suggestions through the right sidebar Generate button, stored globally in the database via `appSettings` key `suggestions_global`, and all chat responses route through Google AI (Gemini) for unique per-request answers. (labels: ai, api, dashboard, ui; commit: 53deaed7)
- T-352. AI assistant page layout replaced cascading `min-h-screen` with a proper flex height chain: app layout main uses `flex min-h-[calc(100vh-4rem)] flex-col`, assistant layout and workspace use `flex flex-1` to fill the viewport accounting for the fixed topbar height. (labels: ai, dashboard, ui, workflow; commit: 53deaed7)
- T-328. AI assistant page layout rewritten - left-right sidebar structure, sticky footer, generate suggestions button, dataset selection in left sidebar. (labels: ai, dashboard, ui, data; commit: 53deaed7)
- T-280. Document common development task prompt templates. (labels: ai, docs, todo, workflow; commit: 53deaed7)
- T-281. Document user-AI communication patterns. (labels: ai, docs; commit: 53deaed7)
- T-282. Document future AI collaboration guidelines. (labels: ai, docs, todo; commit: 53deaed7)
- T-297. Dashboard users can open the AI Assistant from the sidebar, select a dataset, and ask follow-up business questions in one workspace. (labels: ai, dashboard, ui, business; commit: 53deaed7)
- T-489. AI interaction trace storage — added `aiInteractionTraces` table to Drizzle schema and fire-and-forget trace logging in the analyze route. (labels: ai, api, dashboard, ui; commit: 545be481)
- T-490. AI interaction history UI — history tab in AI Assistant workspace sidebar shows past questions with provider, date, and feedback status. (labels: ai, dashboard, ui, workflow; commit: 545be481)
- T-491. AI provider indicator — provider name shown in assistant message header next to "AI Analyst" label. (labels: ai, workflow; commit: 545be481)
- T-492. AI response feedback — thumbs-up/thumbs-down buttons on each assistant response, stored via `/api/assistant/feedback`. (labels: ai, api, ui; commit: 545be481)
- T-494. AI interaction export — CSV and JSON export of full conversation history via `/api/assistant/export`. (labels: ai, api, data, upload; commit: 545be481)
- T-497. AI interaction search — search tab with full-text search across past prompts and responses via `/api/assistant/search`. (labels: ai, api, search, docs; commit: 545be481)
- T-498. AI prompt version tracking — `getCurrentPromptVersion()` in `src/lib/ai/ai-trace.ts` tags each trace with the prompt template version. (labels: ai, docs, workflow; commit: 545be481)
- T-500. AI interaction anonymization — `anonymizeUserTraces()` strips email patterns from stored prompts and responses. (labels: ai, api, docs, workflow; commit: 545be481)
- T-504. AI interaction re-run with different provider — re-run button on each history entry calls `askAssistant()` with the stored prompt. (labels: ai, ui, docs, workflow; commit: 3e8d4602)
- T-293. Dashboard language feature implemented with language selector in topbar, LanguageProvider context, and Google Translation service with caching. Language context enhanced with `translate` function for dynamic Google Translation API calls. (labels: ai, api, dashboard, ui; commit: 53deaed7)

## Label: api

- T-786. Remove orphaned dataset comparison, alert, and live-refresh API routes that expose non-persistent or no-op production behavior. (labels: api, data, quality; commit: worktree)
- T-782. Require authentication and dataset ownership for upload and direct dataset query operations. (labels: api, auth, upload, security; commit: worktree)
- T-598. Remove remaining `any` types in API routes — replaced `any` types in `src/app/api/analyze/route.ts` with proper types. (labels: api, workflow; commit: 5b62cb31)
- T-428. Add streaming responses to `/api/chat` using `ReadableStream` and `TextEncoder` for incremental display and abort support. (labels: api; commit: 53deaed7)
- T-309. Language context enhanced with `translate` function using Google Translation API. (labels: api; commit: 53deaed7)

## Label: auth

- T-790. Keep Railway credential login on the public request host and confirm the authenticated session before the login page reports invalid credentials. (labels: auth, deployment, security; commit: 26e5fc63)
- T-787. Stop signed-out dashboard rendering before nested layouts access session data and prevent the datasets page from loading another account as demo content. (labels: auth, data, security; commit: worktree)
- T-499. AI trace retention policy — configurable via superadmin `GET/POST /api/admin/ai-trace-retention`, stored in `appSettings` table. (labels: auth, ai, api, dashboard; commit: 545be481)
- T-600. Remove unused imports and dead code — cleaned up unused imports and unused variables like `oauthAccount` in actions. (labels: auth, accessibility; commit: 5b62cb31)
- T-589. Create shared `requireAuth()` helper — created `src/lib/auth/require-auth.ts` containing throwing `requireAuth` and functional `requireAuthResult` helper functions, and updated all server action call sites. (labels: auth, api, data, faq; commit: 72b947d6)
- T-585. Merge duplicate FAQ and Mentoring pages — removed custom accordion from public FAQ and replaced it with canonical in-app FaqList; consolidated duplicated experts and session types from mentoring-client to mentoring-store. (labels: auth, business, faq; commit: 72b947d6)
- T-556. Business Mentoring AI tracing records booking events in the aiInteractionTraces table for session recommendations and follow-ups. (labels: auth, ai, dashboard, ui; commit: eace3e2d)
- T-555. Business Mentoring sales documentation created with target segments, session type pricing, and sales script reference. (labels: auth, business, sales, docs; commit: eace3e2d)
- T-554. Business Mentoring developer guide created with API routes, database schema, and integration points for MentoringSession table. (labels: auth, api, dashboard, ui; commit: eace3e2d)
- T-553. Business Mentoring user guide created with session types, expert qualifications, booking process, and pricing tiers. (labels: auth, business, docs, workflow; commit: eace3e2d)
- T-551. Business Mentoring feature: MentoringSession DB schema, CRUD API routes (`/api/mentoring/sessions`, `/api/mentoring/experts`), dashboard UI with booking dialog, session list, and cancel, plus 5 expert mentor profiles. (labels: auth, api, dashboard, ui; commit: eace3e2d)
- T-386. API routes use a shared `requireSession` helper that extracts auth, checks expiry, and returns a consistent 401 shape instead of inline session checks. (labels: auth, api, faq; commit: 53deaed7)
- T-350. Combine sign-in and sign-up into one tabbed authentication page. (labels: auth; commit: 53deaed7)
- T-349. Restore demo and social sign-in actions on the login page. (labels: auth, api, sales; commit: 53deaed7)
- T-342. Fix dashboard search overlay, role-filtered results, links, and chat search context. (labels: auth, dashboard, search; commit: 53deaed7)
- T-283. Use database-backed progress and seen state for dashboard onboarding, make social login buttons create local user/profile records when providers are configured, and onboarding/activity actions save to the activity feed. (labels: auth, ai, dashboard, ui; commit: 53deaed7)
- T-241. Keep public login errors inline, let visitors submit public contact requests without sign-in, and show legal links from public/auth footers. (labels: auth, api, content; commit: 53deaed7)
- T-502. AI interaction benchmarking dashboard — superadmin page at `/app/admin/ai-benchmarking` compares provider latency, error rate, satisfaction. (labels: auth, ai, dashboard, workflow; commit: 545be481)
- T-503. AI latency and cost per interaction — latency tracked per trace, aggregate metrics shown in superadmin analytics and benchmarking pages. (labels: auth, ai, data; commit: 3e8d4602)
- T-495. AI trace analytics dashboard — superadmin page at `/app/admin/ai-traces` shows total queries, provider distribution, error rate, latency, top queries. (labels: auth, ai, dashboard, workflow; commit: 545be481)
- T-307. Topbar reordered: Hybrid AI button moved left, notice icon placed before logout. (labels: auth, local-ai, ai, dashboard; commit: 53deaed7)

## Label: billing

- T-866. Upgrade to Pro modals show selected plan pricing, expose a secure checkout action, create Stripe Checkout sessions directly, and show visible checkout errors when payment setup fails. (labels: billing, payment, ui; commit: worktree)

- T-785. Give signed-in accounts a 14-day analyst trial from account creation, preserve two free credits after the trial, and require authentication for usage and checkout account actions. (labels: billing, auth, security; commit: worktree)
- T-540. Sales one-pager created from project brief, business case, product description, and marketing plan. (labels: billing, business, reports, sales; commit: 3e8d4602)
- T-429. Split 906-line chat route into focused modules: validation, SQL executor, explanation, fallback, and utils. (labels: billing, api, data, testing; commit: 53deaed7)
- T-403. Superadmin `Admin` section added to topbar before Credits section, conditionally rendered via `session?.user?.role`. (labels: billing, auth, dashboard, ui; commit: 53deaed7)
- T-401. Sidebar collapse toggle button added to topbar after Credits section (no border), synchronises state via custom event. (labels: billing, dashboard, ui; commit: 53deaed7)
- T-400. dashboard: topbar - dedup credit number in topbar and show wording (labels: billing, dashboard, ui; commit: 53deaed7)
- T-357. Free-tier analyst credit consumption increments the usage counter (`consumeAnalystCredit`), and `requireAnalystCredit` enforces the limit by throwing. (labels: billing, data; commit: 53deaed7)
- T-345. Improve dashboard sitemap guide with clickable site-plan wireframe. (labels: billing, dashboard, docs, workflow; commit: 53deaed7)
- T-324. Add contact sales button to billing page (sales@useclevr.com). (labels: billing, ui, sales; commit: 53deaed7)
- T-332. Topbar sidebar secondary menu - Account moved to secondary panel above credits, profile combined with settings as Account. (labels: billing, dashboard, ui, business; commit: 53deaed7)
- T-312. Support dedicated business, business entity, and country tax profile storage with multi-business listing rows, archive and restore state, and subscription-tier business limits. (labels: billing, api, business, data; commit: 53deaed7)
- T-311. Promote Business Profile from settings into a top-level Business workspace with a listing table, workspace subpages, updated setup progress links, and aligned planning notes. (labels: billing, dashboard, ui, business; commit: 53deaed7)
- T-298. Complete business profile review, setup progress tracking, the setup tour, sidebar links, dashboard FAQ actions, plan suggestions, and TODO retirement updates. (labels: billing, dashboard, ui, business; commit: 53deaed7)
- T-126. Use shared read-first tables with focused row edit pages for admin customer, customer level, and discount pages. (labels: billing, dashboard, ui, data; commit: 53deaed7)
- T-233. Show dashboard notices in a topbar inbox with recent product activity, user activity history, super-admin total activity, and subscription-focused credit access. (labels: billing, dashboard, ui, notice; commit: 53deaed7)
- T-493. "How AI Analysis Works" user guide — updated `docs/AI-interaction/user-guides/user-guide.md` with architecture explanation, provider indicator, feedback, history, and export guidance. (labels: billing, ai, data, reports; commit: 545be481)
- T-501. AI data-usage transparency notice — dismissable notice bar in chat area explains aggregated metrics only, no raw row data sent. (labels: billing, ai, data, notice; commit: 545be481)

## Label: business

- T-339. Move review and info panels from business profile to business main page (profile summary and review sections). (labels: business, data, upload, workflow; commit: 53deaed7)
- T-541. Demo datasets prepared: SaaS revenue H1 2025 (32 rows, founder/SME demo) and beverage sales Q1 2025 (36 rows, e-commerce/consultant demo). (labels: business, data, sales, workflow; commit: 3e8d4602)
- T-513. Company Setup Wizard created: 8-step form component, types/validation in company-setup.ts, route at `/app/business/setup`, Setup link in business-nav.tsx. (labels: api, business, testing; commit: 3e8d4602)
- T-561. CompanyCalculationContext module computes 7 adjusted KPIs (gross revenue, net profit, profit margin, operating costs, tax estimate, cash flow, revenue growth) with high/medium/low confidence labels and missing-input warnings. (labels: business, data, workflow; commit: eace3e2d)
- T-219. Move static files into `src/assets/` and serve them through `/assets/...`. (labels: business, data, upload; commit: 53deaed7)

## Label: ci-build

- T-512. Type check verified: all new AI tracing and MCP files pass with zero errors. (labels: ci-build, mcp, ai, data; commit: 3e8d4602)
- T-675. Document Mock AI usage, tracing behavior, and local-only boundaries for AI-agent workflows. (labels: ci-build, billing, local-ai, ai; commit: d8d24e66)
- T-591. Normalize pnpm version constant between ESM and CJS configs — updated CJS `app-config.cjs` requiredPackageManager to match ESM requiredPackageManager with the hash. (labels: ci-build; commit: 72b947d6)
- T-578. Remove dead turbo.json and turbo devDependency — verified turbo.json and turbo are completely removed from package.json devDependencies. (labels: ci-build; commit: 72b947d6)
- T-579. Consolidate overlapping build aliases in package.json — kept only canonical scripts, removing duplicate and confusing build/prod/preview aliases. (labels: ci-build, workflow; commit: 72b947d6)
- T-534. MCP tools integrated into analyze route via `buildMCPToolsPrompt` and `analyzeWithMCP` in integration.ts with trusted wrapper functions. (labels: ci-build, mcp, ai, api; commit: 3e8d4602)
- T-417. Consolidate `ci-beta.yml` into `ci.yml` — removes one workflow file and prevents duplicate CI runs on beta pushes. (labels: ci-build, data, upload, workflow; commit: 53deaed7)
- T-421. Extract duplicated CI job steps into shared reusable workflow and composite action. (labels: ci-build, workflow; commit: 53deaed7)
- T-415. Requirements and unreleased changelog text use direct current-state language for product behavior. (labels: ci-build, docs, workflow; commit: 53deaed7)
- T-365. ESLint configuration expanded with `no-console`, `@typescript-eslint/no-explicit-any`, and unused-disable-directive reporting. (labels: ci-build, reports; commit: 53deaed7)
- T-269. Link promoted GitHub issues back to local task IDs and release targets. (labels: ci-build, todo, workflow; commit: 53deaed7)
- T-270. Define which CI outputs should be attached to GitHub Releases. (labels: ci-build, workflow; commit: 53deaed7)
- T-277. Document common git command patterns for repeatable local workflows. (labels: ci-build, dashboard, ui, docs; commit: 53deaed7)
- T-264. Add dashboard topbar onboarding, shared activity popup behavior, TODO retirement guidance, and GitHub issue/project/release guidance. (labels: ci-build, dashboard, ui, notice; commit: 53deaed7)
- T-222. Update npm and pnpm dependencies for the current app baseline. (labels: ci-build; commit: 53deaed7)
- T-239. Dispatch branch maintenance after auto-merged release pull requests merge. (labels: ci-build, api, workflow; commit: 53deaed7)
- T-436. Optimized CHANGELOG.md [Unreleased] section: reordered sections, optimized entries for present-action language and user benefit. (labels: ci-build, docs, workflow; commit: 53deaed7)
- T-593. Add src/lib/cms/\*\* to eslint ignore list — eslint now ignores the CMS planning directory that tsconfig excludes, preventing parsing errors against non-existent types. (labels: ci-build, billing, todo, content; commit: 411e4d14)
- T-359. POST API routes for chat, analyze, query, datasets, and tickets validate request bodies with Zod schemas using a shared `validateOrError` helper in `src/lib/validation.ts`. (labels: ci-build, api, dashboard, data; commit: 53deaed7)
- T-590. Consolidate `ValidationResult` into `Result` type — removed the duplicate structurally identical types from `src/lib/validation.ts` and updated `validateOrError` return type. (labels: ci-build, testing; commit: 72b947d6)

## Label: dashboard

- T-383. Dataset detail page paginates through the `datasetRows` table instead of loading all rows from the JSONB column. (labels: dashboard, ui, data; commit: 53deaed7)
- T-409. Upload server action now writes rows to `datasetRows` table so the dataset detail page displays paginated data instead of showing empty rows. (labels: api, dashboard, ui, data; commit: 53deaed7)
- T-408. FAQ page contains no inline issue form — only links to `/app/tickets` and `/contact`. (labels: dashboard, faq; commit: 53deaed7)
- T-331. Accountancy sidebar menu added with Receipt icon and database-connected main page with overview panels. (labels: dashboard, ui, business, data; commit: 53deaed7)
- T-566. Refactor topbar panels to icons-only with tooltips. Replace Popover backgrounds with transparent overlays and add tooltip labels that appear on hover for narrow icon buttons. (labels: dashboard, ui, data; commit: a3a308b6)
- T-567. Move sidebar toggle from topbar to the AppSidebar component. Relocate the TopbarSidebarToggle button into the sidebar header for desktop view and keep mobile toggle in place. (labels: dashboard, ui; commit: a3a308b6)
- T-543. Demo scripts created for founder (5min), SME owner (7min), consultant (5min), accountancy-prep (3min), and full product tour (10min) sales conversations. (labels: dashboard, business, sales, workflow; commit: 3e8d4602)
- T-542. Screenshot guide created listing 20 public and dashboard pages with capture standards and priority order. (labels: dashboard, testing, docs, workflow; commit: 3e8d4602)
- T-410. Business page verified functional — metrics, DataTable, profile/review panels, archive/restore all work with no type errors. (labels: api, dashboard, ui, business; commit: 53deaed7)
- T-404. Notification sidebar feature already present via `TopbarNoticeActivityDrawer` — bell icon in topbar opens a modal sidebar with notices and activity feed. (labels: dashboard, ui, notice, workflow; commit: 53deaed7)
- T-402. App version already shown in topbar next to logo (v{version}); changed from `hidden sm:inline` to always visible. (labels: dashboard, ui; commit: 53deaed7)
- T-399. dashboard: topbar - logo bigger without margin and border (labels: dashboard, ui; commit: 53deaed7)
- T-360. Dataset upload stores parsed rows in the dedicated `datasetRows` table via batched inserts instead of the single JSONB column. (labels: dashboard, ui, data, upload; commit: 53deaed7)
- T-355. Dashboard page layout uses consistent flex-based heights across settings, business, accountancy, datasets, admin, and all sub-pages - `min-h-screen` replaced with `flex-1` in 20+ page wrappers. Navigation lives only in the left sidebar and horizontal sub-page bars. (labels: dashboard, ui, business, data; commit: 53deaed7)
- T-348. Normalize dashboard business overview, dataset library, and downloads table flows. (labels: dashboard, ui, business, data; commit: 53deaed7)
- T-344. Add dashboard sitemap docs, account subpage bar, table consistency, and full-height topbar targets. (labels: dashboard, ui, docs; commit: 53deaed7)
- T-337. Create accountancy-nav.tsx subpages bar component with Overview, Reporting, Tax, and Compliance links. (labels: dashboard, business, reports; commit: 53deaed7)
- T-326. Topbar menu simplified - single icon items without subpanels, spread layout, clean navigation. (labels: dashboard, ui, workflow; commit: 53deaed7)
- T-329. Dataset table unified - action bar header with business-related stat panels (total datasets, avg revenue, ready count) instead of row/column counts. (labels: dashboard, ui, business, data; commit: 53deaed7)
- T-330. Business menu pages fixed - overview panels for business metrics, auto-start add business flow when empty, sidebar selection persistence. (labels: dashboard, ui, business, data; commit: 53deaed7)
- T-313. Use a table-first dashboard ticket queue with row edit pages and a separate new ticket page. (labels: dashboard, ui, data, todo; commit: 53deaed7)
- T-204. Add coming-soon mobile app buttons, social placeholders, the user panel, and Terms access to the dashboard sidebar footer. (labels: dashboard, ui; commit: 53deaed7)
- T-245. Add project audit and testing guides for repeatable start-to-finish review. (labels: dashboard, ui, testing, docs; commit: 53deaed7)
- T-265. Let small-screen dashboard users reopen onboarding from the topbar Process button. (labels: dashboard, ui, workflow; commit: 53deaed7)
- T-267. Show loading and error states in topbar notices and the activity popup when recent activity cannot be fetched. (labels: dashboard, ui, notice; commit: 53deaed7)
- T-224. Refresh the docs landing page and onboarding docs. (labels: dashboard, docs; commit: 53deaed7)
- T-301. Fix ticketing so super admins can send messages and admin notes show admin name and timestamp. (labels: dashboard; commit: 53deaed7)
- T-304. App version text added under Terms & Conditions in sidebar. (labels: dashboard, ui; commit: 53deaed7)
- T-306. Social panel title removed from sidebar. (labels: dashboard, ui; commit: 53deaed7)
- T-308. Hover color contrast improved in dashboard FAQ actions (hover:bg-accent/50). (labels: dashboard, ui, accessibility, faq; commit: 53deaed7)
- T-560. Business Profile pre-accounting: company setup persistence via JSONB column on businesses table, API route (GET/PUT/DELETE /api/business/setup), wizard wired to save/load, missing-data warnings on business overview page. (labels: api, dashboard, ui, business; commit: eace3e2d)

## Label: data

- T-911. Load dataset detail and analysis through shared user-scoped access, keep superadmin dataset access available, remove broken dataset navigation from analysis, and show forecast guidance for missing forecast inputs. (labels: data, reporting, ui; commit: worktree)

- T-780. Classify numeric, text, date, boolean, identifier, and mixed CSV columns from representative values without treating every unique value as an identifier. (labels: data, upload, testing; commit: worktree)
- T-437. Enhanced sales and marketing materials: added research data and mermaid charts where applicable. (labels: data, reports, search, sales; commit: 53deaed7)
- T-582. Merge duplicate upload implementations — made the server action `uploadCSV` in `src/app/actions/upload.ts` canonical, merged database retry logic and processRows types, and delegated the API route `/api/upload` to call it. (labels: api, data, upload, performance; commit: 72b947d6)
- T-587. Consolidate CSV parsing into one canonical module — replaced split-by-newline-split-by-comma manual parsers with robust PapaParse-backed `parseCSVString` calls across upload actions and handlers. (labels: data, upload; commit: 72b947d6)
- T-588. Consolidate currency/number cleaning into shared module — extracted currency symbols, date patterns, and cleanNumericValue into a canonical `src/lib/utils/number-parser.ts` and imported them back in cleaner and preview generator. (labels: data, workflow; commit: 72b947d6)
- T-469. Mapped current application data models and route ownership to future Payload CMS collection boundaries without starting a migration. (labels: api, data, todo, content; commit: 26fea2a6)
- T-418. Replace barrel re-export files with direct imports across all consuming modules. (labels: data, upload, reports; commit: 53deaed7)
- T-425. Add fire-and-forget suggestion refresh trigger after dataset upload. (labels: data, upload, search; commit: 53deaed7)
- T-426. Add full-text search across dataset row JSONB data in global search. (labels: data, search; commit: 53deaed7)
- T-390. Server action responses typed as a discriminated `Result<T, E>` union so every handler returns a consistent `{ success, data }` / `{ success: false, error }` shape. (labels: api, data; commit: 53deaed7)
- T-387. Upload route form-data parsing extracts into a dedicated `parseUploadForm` utility to reduce the 640-line route file. (labels: api, data, upload; commit: 53deaed7)
- T-366. `updatedAt` timestamps include on every write operation across all database update queries (verified already present). (labels: data, workflow; commit: 53deaed7)
- T-364. Barrel re-export files removed from `src/lib/` root after confirming zero imports reference them. (labels: data, upload, reports; commit: 53deaed7)
- T-361. Shared data aggregation and column detection functions extracted into `src/lib/data/queryEngine.ts` — `findColumn`, `normalizeCurrencyValue`, `formatCurrencyValue`, `formatPercentValue`, `aggregateData` — and used by both `chat/route.ts` and `query/route.ts`. (labels: api, data; commit: 53deaed7)
- T-231. Normalize repository text files with UTF-8 and LF rules. (labels: data, upload, docs; commit: 53deaed7)
- T-291. Service layer extraction created lib/services/datasetService.ts for dataset analysis orchestration. (labels: data; commit: 53deaed7)
- T-340. Add API endpoint for bulk dataset deletion. (labels: api, data; commit: 53deaed7)
- T-562. Upload and analysis hardened: file size check (50MB) and rate limit (10/min) on upload route, rate limit (30/min) on analyze route, improved dirty-CSV error messages. (labels: api, data, upload, performance; commit: eace3e2d)
- T-420. Add Neon WebSocket connection pooling to `src/lib/db/index.ts`. (labels: data, performance; commit: 53deaed7)

## Label: deployment

- T-810. Verify the Railway test deployment starts with the restored Next.js runtime build files and serves a ready health response. (labels: deployment, ci-build, monitoring; commit: b30cd54d)
- T-792. Restore required Next.js runtime build files during Railway packaging and startup so generated deployments boot successfully. (labels: deployment, ci-build, stability; commit: b30cd54d)
- T-778. Serve the beta build from the Railway test service with a ready database health response. (labels: deployment, ci-build; commit: b30cd54d)
- T-584. Use route groups to simplify middleware auth — restructured `src/app/` into `(public)` and `(auth)` route groups, moved the authenticated layout check to `(auth)/layout.tsx`, and simplified the middleware logic. (labels: deployment, auth, api, ui; commit: 72b947d6)
- T-583. Replace barrel proxy files with direct imports — updated callers in api routes and chat helper to import directly from queryEngine and queryIntentPrompt. (labels: deployment, ai, api, data; commit: 72b947d6)
- T-577. Fix Node.js version mismatch in generated Dockerfile — changed to node:26-alpine matching package.json engine requirements. (labels: deployment, ci-build, data, upload; commit: 72b947d6)
- T-580. Eliminate redundant `.next` copy in dist packaging — copy only server/Railway-specific files from `.next/standalone/.next` to `next-build` instead of copying the whole `.next` directory with static assets. (labels: deployment, ci-build, business, data; commit: 72b947d6)
- T-581. Merge redundant .env cleanup loops in create-dist.cjs — consolidated env cleanup into a single, efficient loop over all .env files and .npmrc. (labels: deployment, data, upload; commit: 72b947d6)
- T-525. Retired the dist-branch migration prompt into the current Railway and GitHub deployment guides. (labels: deployment, ai, docs, todo; commit: 3e8d4602)
- T-524. Created a practical Payload transformation prompt and migration task plan based on the current app routes, schema, billing, content, and deployment shape. (labels: deployment, billing, ai, api; commit: 3e8d4602)
- T-462. Railway health checks return liveness separately from database readiness, Railway auth uses the active request host by default, edge route guards avoid Node-only auth modules, production packaging starts from clean generated output, generated middleware manifests point to the bundled route guard entry, and generated Railway starts use a portable shell entrypoint. (labels: deployment, ci-build, auth, api; commit: b952d8c7)
- T-392. Deployment smoke checks fail when generated Railway output includes pnpm workspace metadata or omits required runtime bundle files. (labels: deployment, ci-build, data, upload; commit: 53deaed7)
- T-255. Generated deployment manifests include source commit, source branch, build timestamp, Node version, and healthcheck path. (labels: deployment, ci-build, workflow; commit: 53deaed7)
- T-438. Add Next.js middleware for centralized auth and route protection — guards dashboard pages, API routes (401 JSON), and superadmin pages; public routes pass through. (labels: deployment, auth, api, dashboard; commit: 53deaed7)
- T-440. Fix dashboard consistency issues: remove double AppPageHeader from settings/business layout, fix upload breadcrumbs to show `Dashboard > Upload` (not "Datasets"), add sub-page labels to settings breadcrumbs via SettingsHeader client component, add metadata titles to 8 server-component pages, add null guards to business/locations and business/tax pages, and add error handling to dataset rows query. remove from `.gitignore` on deployment branches, use `cp -a` to preserve relative pnpm symlinks. steps, generate `railpack.json` and minimal `package-lock.json` in dist output. (labels: deployment, ci-build, dashboard, ui; commit: 53deaed7)
- T-419. Deployment manifest generation already present in `create-dist.cjs`. (labels: deployment, workflow; commit: 53deaed7)
- T-434. Railway dist-test publishing omits pnpm and yarn lockfiles while keeping minimal npm detection metadata and guarding generated output before test deployment. (labels: deployment, ci-build, data, upload; commit: 53deaed7)
- T-432. AI instructions require AI-interaction docs updates after durable instruction changes and scope Railway test deploy reviews to beta and dist-test. (labels: deployment, ai, testing, docs; commit: 53deaed7)
- T-385. `updatedAt` timestamps use a Drizzle `onUpdate` trigger or middleware so all update queries set it automatically without manual inclusion. (labels: deployment, data; commit: 53deaed7)
- T-384. Health endpoint verifies database connectivity before returning a healthy status. (labels: deployment, api, data; commit: 53deaed7)
- T-347. Add GitHub pnpm cache and keep Railway dist install metadata. (labels: deployment, ci-build, data, performance; commit: 53deaed7)
- T-346. Fix generated dist pnpm build-script approvals for local and Railway installs. (labels: deployment, ci-build, workflow; commit: 53deaed7)
- T-325. Fix corepack pnpm for Railway build - use pnpm@11.5.0 version matching package.json engines. (labels: deployment, ci-build; commit: 53deaed7)
- T-206. Move document markup into the App Router shell, fail production builds on TypeScript errors, and render public FAQ highlighting through React instead of injected HTML. (labels: deployment, ci-build, api, faq; commit: 53deaed7)
- T-207. Fold completed dist deployment confirmations into the regular TODO queues after deployment succeeds. (labels: deployment, todo, workflow; commit: 53deaed7)
- T-244. Retire dist and audit TODO files into the regular next, done, future, and ignored queues. (labels: deployment, data, upload, todo; commit: 53deaed7)
- T-258. Deploy Railway from the `dist` branch with `/dist` as the root directory. (labels: deployment, workflow; commit: 53deaed7)
- T-260. Retire the older source-branch Railway deployment path from the active deploy target. (labels: deployment, todo, workflow; commit: 53deaed7)
- T-261. Confirm fresh generated `/dist` output on the dist branch after publishing succeeds. (labels: deployment, workflow; commit: 53deaed7)
- T-262. Limit dist branch publish scope to generated `/dist` output and `/server-config`. (labels: deployment, workflow; commit: 53deaed7)
- T-263. Document how retired audit and dist tasks moved into the regular queues. (labels: deployment, docs, todo, workflow; commit: 53deaed7)
- T-215. Split flowcharts into user-facing, production technical, and deployment charts. (labels: deployment, reports, workflow; commit: 53deaed7)
- T-220. Remove the Railway debug endpoint for homepage HTML. (labels: deployment, api, content; commit: 53deaed7)
- T-221. Move runtime target off the old Node.js baseline. (labels: deployment, ci-build; commit: 53deaed7)
- T-225. Move host-specific commands, settings, and troubleshooting notes into Railway and Vercel deployment guides. (labels: deployment, dashboard, docs; commit: 53deaed7)
- T-226. Refresh Corepack and use a Node-compatible pnpm release in Railway generated-output builds. (labels: deployment, ci-build; commit: 53deaed7)
- T-227. Avoid conflicting pnpm build-approval settings in generated runtime packages. (labels: deployment, ci-build, dashboard, workflow; commit: 53deaed7)
- T-228. Allow runtime installs for generated deployment packages without a committed lockfile. (labels: deployment, ci-build, data, upload; commit: 53deaed7)
- T-229. Include migration tooling required by pre-deploy schema steps in generated runtime packages. (labels: deployment, ci-build, data, workflow; commit: 53deaed7)
- T-230. Restore the Next.js build output when host snapshots omit dot-directories. (labels: deployment, ci-build, api; commit: 53deaed7)
- T-234. Keep the previous deployment commit visible in dist publish history while reducing workflow log output. (labels: deployment, ci-build, workflow; commit: 53deaed7)
- T-235. Keep dist deployment config under `/server-config` and run generated deployment output from `/dist`. (labels: deployment; commit: 53deaed7)
- T-236. Use a generated Nixpacks plan so Railway generated-output installs run through Corepack pnpm. (labels: deployment, ci-build, billing; commit: 53deaed7)
- T-237. Use Nixpacks with explicit Corepack pnpm activation for Railway runtime builds. (labels: deployment, ci-build; commit: 53deaed7)
- T-240. Run the production publish build during local pre-commit validation. (labels: deployment, ci-build, testing, workflow; commit: 53deaed7)
- T-242. Split generated production starts by local, Railway, and Vercel server targets. (labels: deployment, workflow; commit: 53deaed7)
- T-544. Review Sales registers after test deploy — I-001 closed (both endpoints verified 200), I-002 remains in progress (manual screenshots). (labels: deployment, api, sales, testing; commit: 3e8d4602)
- T-674. Disable Mock AI mode automatically in production runtime. (labels: deployment, local-ai, ai, workflow; commit: d8d24e66)
- T-238. Keep PDF export browser dependencies as explicit production dependencies. (labels: deployment, data, reports, workflow; commit: 53deaed7)
- T-243. Add operational storage, referral reward guards, production readiness checks, and CSV edge-case tests. (labels: deployment, data, upload, testing; commit: 53deaed7)
- T-586. Guard debug API routes with production 404 responses so dataset and request-header diagnostics stay development-only. (labels: deployment, api, data, workflow; commit: 72b947d6)
- T-292. Configuration centralization created lib/config/index.ts with Zod validation for runtime envs. (labels: deployment, testing; commit: 53deaed7)

## Label: docs

- T-278. Document long-running command and timeout handling patterns. (labels: performance, docs; commit: 53deaed7)
- T-216. Move TODO and future recommendation documents into `.TODO/`. (labels: docs, todo; commit: 53deaed7)
- T-217. Update documentation links after folder changes. (labels: docs; commit: 53deaed7)
- T-210. Move technical guides into developer documentation. (labels: docs; commit: 53deaed7)
- T-212. Move user-facing documentation into user guide folders. (labels: docs; commit: 53deaed7)
- T-213. Move project requirements into developer-facing documentation where appropriate. (labels: docs, workflow; commit: 53deaed7)

## Label: faq

- T-570. Help chat toggle enlarged on right side with wider input field for better usability. (labels: faq; commit: 56fce428)
- T-358. All bare `console.error` and `console.warn` calls across API routes and hooks replaced with gated `debugError`/`debugWarn` helpers. (labels: api, faq; commit: 53deaed7)
- T-601. Add an API route access matrix — created `docs/Developer_Guides/API_ROUTE_ACCESS_MATRIX.md` covering access classifications, expected helpers, ownership checks, rate limits, and audit tracking. (labels: api, faq, performance, docs; commit: 5b62cb31)

## Label: security

- T-602. Restrict local AI install and agent runtime install routes to development mode or explicit super-admin operations on shared deployments. (labels: security, local-ai, auth, api; commit: worktree)
- T-603. Validate authentication, Stripe signing, and MCP service secrets from current server-only environment variables at startup without old compatibility aliases or hardcoded fallback tokens. (labels: security, auth, payment, mcp; commit: worktree)

## Label: local-ai

- T-667. Add development-only Mock AI mode for local chat and analysis responses without external AI provider calls. (labels: local-ai, ai, api, data; commit: d8d24e66)
- T-668. Add Mock AI environment configuration for enabling local mode and setting response delay. (labels: local-ai, ai, api; commit: d8d24e66)
- T-670. Route local Mock AI responses through the active chat, streaming, and analysis AI paths. (labels: local-ai, ai, api, data; commit: d8d24e66)
- T-671. Add configurable Mock AI response delay for local UI state testing. (labels: local-ai, ai, api, ui; commit: d8d24e66)
- T-433. AI interaction docs separate user guidance, AI-agent guidance, prompt collection, and bookkeeping user/developer guides. (labels: local-ai, ai, business, docs; commit: 53deaed7)

## Label: mcp

- T-533. MCP tool `getProfitMarginTrend` added: combines profit margin calculation with growth trend direction in handlers.ts, tools.ts, server.ts, integration.ts. (labels: mcp, ai, data, workflow; commit: 3e8d4602)
- T-532. MCP resource `revenue-by-region` added with ranked rows and share percentages (already existed as `getTopRegions` in resources.ts). (labels: mcp, ai, data, workflow; commit: 3e8d4602)
- T-531. MCP tool `getCostBreakdown` added: extracts cost categories from precomputed metrics with percentage shares in handlers.ts, tools.ts, server.ts, integration.ts. (labels: mcp, ai, data, workflow; commit: 3e8d4602)
- T-530. MCP tool `compareDatasets` added: async DB handler fetches precomputed metrics for two datasets and returns comparison in handlers.ts, server.ts, tools.ts, integration.ts. (labels: mcp, ai, data, workflow; commit: 3e8d4602)
- T-529. MCP resource `top-products` added: ranked products by revenue/profit with percentage share in resources.ts, tools.ts, server.ts, integration.ts. (labels: mcp, ai, workflow; commit: 3e8d4602)
- T-528. MCP tool `getDatasetSchema` added: returns column mapping and inferred types from precomputed metrics (handler already existed in handlers.ts, wired in tools.ts, server.ts). (labels: mcp, ai, data, workflow; commit: 3e8d4602)
- T-430. Add dedicated `/api/mcp/` endpoint stub for future MCP tool execution. (labels: mcp, ai, api, todo; commit: 53deaed7)
- T-431. Add cross-dataset comparison MCP tool with tool registry. (labels: mcp, ai, data; commit: 53deaed7)

## Label: notice

- T-338. Fix progress system - single line display, page-based steps instead of field-based, activity integration. (labels: notice, workflow; commit: 53deaed7)

## Label: payment

- T-205. Open the dashboard directly to datasets, route Hybrid AI and subscription changes through checkout review, include Business and super-admin paid download access, and use filtered expandable dashboard FAQ answers. (labels: payment, billing, local-ai, ai; commit: 53deaed7)
- T-552. Business Mentoring public landing page at `/mentoring` with value proposition, session types, how-it-works cards, and sign-up CTA. (labels: payment, auth, ui, business; commit: eace3e2d)
- T-565. FAQ filtering already correctly restricts super-admin sections (Payments and subscriptions, Key pages) to super-admin users only in help-chatbox.tsx. (labels: payment, billing, api, faq; commit: cd82dd9a)
- T-441. Consolidated 5 duplicate metric display components (ProfileMetric, ContextItem, FinancialItem, TaxItem, ReportMetric) into shared StatCard component. (labels: payment, ui, business, data; commit: 53deaed7)
- T-423. Add Stripe webhook event replay endpoint and admin panel component. (labels: payment, api, dashboard; commit: 53deaed7)
- T-416. Accountancy overview shows bookkeeping cards, a bookkeeping queue, monthly close readiness, and direct accounting action links. (labels: payment, dashboard, ui, business; commit: 53deaed7)
- T-407. Font sizes reduced across the board in `tailwind.config.ts`: page-title 24→22, card-title 15→14, small-title 13→12, body 13→12, meta 11→10.5. (labels: payment, ui; commit: 53deaed7)
- T-341. Fix Stripe checkout and webhook subscription activation. (labels: payment, billing, api; commit: 53deaed7)
- T-323. Fix Stripe integration message in billing page. (labels: payment, billing; commit: 53deaed7)
- T-232. Require super-admin access for payment provider settings and super-admin dashboard pages opened from direct URLs. (labels: payment, ai, dashboard, workflow; commit: 53deaed7)
- T-496. AI error transparency in UI — error messages show clear explanation and suggested next steps in a styled error card. (labels: payment, billing, ai, ui; commit: 545be481)

## Label: reports

- T-290. Service layer extraction created lib/services/reportService.ts for report generation orchestration. (labels: reports; commit: 53deaed7)
- T-211. Move flowcharts into developer guide folders. (labels: reports, docs, workflow; commit: 53deaed7)
- T-223. Create the original system flowchart. (labels: reports, workflow; commit: 53deaed7)

## Label: search

- T-424. Store suggestions per-user instead of global key, with userId filter. (labels: search; commit: 53deaed7)

## Label: security

- T-595. Add MCP rate limiting and audit logging for tool listing, resource reads, and tool invocation while keeping logs free of raw dataset content. (labels: security, mcp, ai, data; commit: 411e4d14)
- T-596. Add MCP service-token and admin-token access only for approved internal clients, with ownership checks, role-based tool allowlists, and AI trace guidance updates. (labels: security, auth, mcp, ai; commit: 411e4d14)
- T-597. Add CSP nonce support to Next.js headers — generated cryptographically random nonces in `middleware.ts` and set dynamic CSP headers, removing the static duplicate CSP from `next.config.mjs`. (labels: security, deployment; commit: 5b62cb31)
- T-599. Audit public API route exposure — added a secure `validateAPIKey` and permission checks to `src/app/api/public/ai/route.ts` to ensure it fails closed on unauthorized access and returns safe data only. (labels: security, ci-build, auth, ai; commit: 5b62cb31)
- T-569. Login page password improvements: forgot password link under inputs for shorter tab flow, password strength indicator showing length/upper/numbers/special requirements. (labels: security, auth, docs, workflow; commit: 56fce428)
- T-574. Login changed from external labels to inner labels (placeholder + aria-label) for shorter tab flow; password validation upgraded to detailed criteria checklist with per-rule checkmarks; split show/hide toggle into independent sign-in/sign-up states. (labels: security, auth, accessibility, testing; commit: 56fce428)
- T-127. Checkout success verification uses a signed, time-limited server token for payment redirects. (labels: security, payment, billing; commit: 53deaed7)
- T-488. Local Railway CLI commands and token-safe login guidance support project deployment operations. (labels: security, deployment, auth, workflow; commit: 26fea2a6)
- T-422. Replace checkout URL session ID proof with server-issued one-time checkout token. (labels: security, payment, billing, auth; commit: 53deaed7)
- T-362. `Content-Security-Policy` header added to the security headers in `next.config.mjs`. (labels: security, content; commit: 53deaed7)
- T-259. Keep Railway runtime secrets in Railway environment variables. (labels: security, deployment, accessibility; commit: 53deaed7)
- T-557. Fix social login and sign-up interconnection — when a user exists via OAuth, the signup form detects it and offers to link a password instead of creating duplicate accounts. (labels: security, auth; commit: eace3e2d)
- T-592. Document lockfile handling in create-dist.cjs — added clarifying comment that pnpm-lock.yaml is removed from dist output because Railway Dockerfile uses npm install with precompiled standalone bundle, while .aiignore keeps lockfiles from AI context for token optimization. (labels: security, deployment, ci-build, ai; commit: dcf5a927)

## Label: testing

- T-208. Convert project audit work into regular TODO tasks plus auditor and testing guide documents. (labels: testing, docs, todo, workflow; commit: 53deaed7)
- T-214. Replace troubleshooting guidance with a developer testing guide. (labels: testing, docs; commit: 53deaed7)

## Label: todo

- T-209. Use `T-` task numbers and `todo-next.md` as the only active queue. (labels: todo, workflow; commit: 53deaed7)
- T-710. TODO management and AI memory collection guidance use one label, wording, and post-interaction capture rule across agent docs and prompt files. (labels: ai, docs, todo; commit: worktree)

## Label: dashboard

- T-722. Resolve dashboard-ui-refactor audit plan — delete plan file, distribute content to dashboard-ui.md, AGENTS.md, DEVELOPER_GUIDE.md, todo-future.md. (labels: dashboard, ui, docs; commit: worktree)

## Label: ui

- Add reduced motion accessibility toggle in theme switcher with `.reduced-motion` CSS override. (labels: ui, accessibility; commit: worktree)
- Add TOCs to MCP documentation files for improved navigation. (labels: ui, docs; commit: worktree)

## Label: ai

- T-890. Add a Bring Your Own AI provider connector with encrypted OpenAI-compatible provider storage, connection testing, Account settings controls, and analysis fallback routing. (labels: ai, ui, security, api; commit: worktree)
- T-723. Enhance local AI and mock AI documentation with router priority, mock guard logic, endpoint coverage, and local bridge details. (labels: ai, docs; commit: worktree)
- T-724. Extend sales planning with stage gate reviews, product focus quality criteria, sales tolerances, and lessons integration. (labels: sales, docs; commit: worktree)
- T-732. Fix accountancy reporting page naming — rename misleading `totalRevenue` variable to `totalRows`. (labels: dashboard, reports; commit: worktree)
- T-733. Fix search popup inconsistencies — "FAQ" label, localStorage key naming, double-fetch on form submit. (labels: ui, search; commit: worktree)
- T-734. Fix onboarding button indentation and auto-open re-open logic — allow re-opening when completion drops below threshold. (labels: ui, dashboard; commit: worktree)
- T-735. Add FAQ link to desktop public header nav — mobile had it, desktop was missing. (labels: ui, faq; commit: worktree)
- T-736. Review business profile naming — business and company used interchangeably, "organization" term absent. (labels: business, dashboard; commit: worktree)
- T-302. FAQ items open by default with open/close all buttons in header. (labels: ui, faq; commit: 53deaed7)
- T-303. FAQ page includes open/close all buttons. (labels: ui, faq; commit: 53deaed7)
- T-427. Add type-ahead search suggest endpoint with result-type filter buttons. (labels: api, ui, search; commit: 53deaed7)
- T-571. Fix theme switcher panel: separate light/dark/system theme selection from high contrast and larger text accessibility options that apply on top of selected theme. (labels: ui, accessibility; commit: 56fce428)
- T-573. All chat input areas enlarged (h-12 floating, h-14 full-page) with proportionally sized send buttons and icons on right. (labels: ui, workflow; commit: 56fce428)
- T-536. Search popup recent history saves last 5 searches to localStorage with save/load/clear methods. (labels: ui, search; commit: 3e8d4602)
- T-535. Search popup type filter added: `searchSuggest()` queries datasets and reports from DB with optional type param; `/api/search/suggest` route accepts type query param. (labels: api, ui, data, reports; commit: 3e8d4602)
- T-443. Extracted shared LoadingScreen component — replaced 7 duplicate loading pages with a single reusable component. (labels: ui; commit: 53deaed7)
- T-389. Popover dropdown shadow and z-index values align with the shared `Modal` backdrop layer to prevent overlay gaps. (labels: ui, workflow; commit: 53deaed7)
- T-388. Client-side data fetching wraps in a shared `useApi` hook that handles loading, error, and abort-controller cleanup for every page. (labels: ui, data; commit: 53deaed7)
- T-414. Orphaned duplicate `src/assets/images/icon.svg` removed (asset duplication fix). (labels: ui, business; commit: 53deaed7)
- T-406. Theme toggle already provides multi-theme switcher (light/dark/system/high-contrast/larger-text) with accessibility icons. (labels: ui, accessibility, workflow; commit: 53deaed7)
- T-405. Search popup enhanced with debounced auto-search as the user types and fixed body overflow save/restore. (labels: api, ui, search, workflow; commit: 53deaed7)
- T-413. Project favicon resolves from the app route and broken duplicate favicon assets are removed. (labels: api, ui, business, workflow; commit: 53deaed7)
- T-412. Every page already passes a page-specific `icon` prop to `AppPageHeader` — no changes needed. (labels: ui, workflow; commit: 53deaed7)
- T-327. Search popup fixed - added submit button, proper width, non-blocking modal. (labels: ui, search, workflow; commit: 53deaed7)
- T-310. Cookie consent bar added with accept button. (labels: ui; commit: 53deaed7)

## Label: ai

- T-773. Add MCP FAQ query tool with category filtering and keyword search, wired through tools.ts, handlers.ts, server.ts, integration.ts. (labels: ai, mcp, faq; commit: 6ccd0b84)
- T-774. Add Railway CLI usage guidance for AI agents across AGENTS.md, ai-agent-guide.md, railway-deploy-review.md, and RAILWAY_DEPLOYMENT.md. (labels: ai, docs; commit: b9ccda2b)
- T-775. Update consolidated-interactions-log.md with MCP FAQ tool and Railway CLI workflow interaction. (labels: ai, docs; commit: b2409b83)
- T-749. Add tool scope declarations and convert static tool array to registry pattern with registerTool() and getRegisteredTools(). (labels: mcp, api, ai; commit: worktree)
- T-795. Expose full JSON Schema per tool via MCP discovery endpoint and add CORS headers for subdomain access. (labels: mcp, api, ai; commit: worktree)
- T-796. Create mcp_tokens DB table with scoped permissions and replace env-var-only auth with DB-backed token validation. (labels: mcp, auth, security; commit: worktree)
- T-797. Create mcp_audit_logs DB table, persist audit logs instead of console, add per-token rate limiting with DB storage, and add usage stats endpoint. (labels: mcp, monitoring, security; commit: worktree)
- T-804. Register Faqs Payload collection in payload.config.ts and consolidate CMS content types under /src/lib/cms/collections. (labels: deployment, content, workflow; commit: worktree)
- T-805. Add field validation rules (required, format, min/max, unique) to all Payload collection fields with user-friendly error messages. (labels: deployment, content, workflow; commit: worktree)
- T-806. Fix Payload admin logout redirect and session expiration by configuring Payload routes and session TTL correctly. (labels: deployment, auth, ui; commit: worktree)

## Label: workflow

- T-218. Add Mermaid editor guidance for project diagrams. (labels: workflow; commit: 53deaed7)
- T-442. Extracted shared ErrorScreen component — replaced 7 duplicate error pages with a single reusable component. (labels: workflow; commit: 53deaed7)
- T-305. Sign out redirect fixed to use relative URL. (labels: workflow; commit: 53deaed7)
