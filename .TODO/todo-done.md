# Done TODO

This retired queue stores completed work after product requirements and changelog updates are handled
where needed.

Get the T-number from `.TODO/config.json` before adding new tasks. Keep task numbers stable when
moving work between states.

## Links

- [TODO-next.md](todo-next.md)
- [TODO-done.md](todo-done.md)
- [TODO-ignore.md](todo-ignore.md)
- [TODO-future.md](todo-future.md)
- [.TODO/config.json](config.json)

## Completed

- T-462. Railway health checks return liveness separately from database readiness, Railway auth uses the active request host by default, edge route guards avoid Node-only auth modules, production packaging starts from clean generated output, and generated middleware manifests point to the bundled route guard entry.
- T-392. Deployment smoke checks fail when generated Railway output includes pnpm workspace metadata or omits required runtime bundle files.
- T-255. Generated deployment manifests include source commit, source branch, build timestamp, Node version, and healthcheck path.
- T-441. Consolidated 5 duplicate metric display components (ProfileMetric, ContextItem, FinancialItem, TaxItem, ReportMetric) into shared StatCard component.
- T-442. Extracted shared ErrorScreen component — replaced 7 duplicate error pages with a single reusable component.
- T-443. Extracted shared LoadingScreen component — replaced 7 duplicate loading pages with a single reusable component.
- T-435. AI interaction docs define the all-text-files current-state language rule and instruction maintenance checklist.
- T-417. Consolidate `ci-beta.yml` into `ci.yml` — removes one workflow file and prevents duplicate CI runs on beta pushes.
- T-438. Add Next.js middleware for centralized auth and route protection — guards dashboard pages, API
  routes (401 JSON), and superadmin pages; public routes pass through.
- T-440. Fix dashboard consistency issues: remove double AppPageHeader from settings/business layout, fix
  upload breadcrumbs to show `Dashboard > Upload` (not "Datasets"), add sub-page labels to settings
  breadcrumbs via SettingsHeader client component, add metadata titles to 8 server-component pages, add
  null guards to business/locations and business/tax pages, and add error handling to dataset rows query.
- Railway: Fix `"/app/node_modules": not found` on Railway deploy — keep `node_modules/` in dist output,
  remove from `.gitignore` on deployment branches, use `cp -a` to preserve relative pnpm symlinks.
- Railway: Fix Railpack config — use `"provider": "node"` (singular string) with custom install/build
  steps, generate `railpack.json` and minimal `package-lock.json` in dist output.
- CI: Remove `node_modules/` cleanup from all publish workflows and composite action setup.
- T-418. Replace barrel re-export files with direct imports across all consuming modules.
- T-419. Deployment manifest generation already present in `create-dist.cjs`.
- T-420. Add Neon WebSocket connection pooling to `src/lib/db/index.ts`.
- T-421. Extract duplicated CI job steps into shared reusable workflow and composite action.
- T-422. Replace checkout URL session ID proof with server-issued one-time checkout token.
- T-423. Add Stripe webhook event replay endpoint and admin panel component.
- T-424. Store suggestions per-user instead of global key, with userId filter.
- T-425. Add fire-and-forget suggestion refresh trigger after dataset upload.
- T-426. Add full-text search across dataset row JSONB data in global search.
- T-427. Add type-ahead search suggest endpoint with result-type filter buttons.
- T-429. Split 906-line chat route into focused modules: validation, SQL executor, explanation, fallback, and utils.
- T-430. Add dedicated `/api/mcp/` endpoint stub for future MCP tool execution.
- T-431. Add cross-dataset comparison MCP tool with tool registry.
- T-428. Add streaming responses to `/api/chat` using `ReadableStream` and `TextEncoder` for incremental display and abort support.
- T-434. Railway dist-test publishing omits pnpm and yarn lockfiles while keeping minimal npm detection metadata and guarding generated output before test deployment.
- T-433. AI interaction docs separate user guidance, AI-agent guidance, prompt collection, and bookkeeping user/developer guides.
- T-432. AI instructions require AI-interaction docs updates after durable instruction changes and scope Railway test deploy reviews to beta and dist-test.
- T-416. Accountancy overview shows bookkeeping cards, a bookkeeping queue, monthly close readiness, and direct accounting action links.
- T-415. Requirements and unreleased changelog text use direct current-state language for product behavior.
- T-390. Server action responses typed as a discriminated `Result<T, E>` union so every handler returns a consistent `{ success, data }` / `{ success: false, error }` shape.
- T-389. Popover dropdown shadow and z-index values align with the shared `Modal` backdrop layer to prevent overlay gaps.
- T-388. Client-side data fetching wraps in a shared `useApi` hook that handles loading, error, and abort-controller cleanup for every page.
- T-387. Upload route form-data parsing extracts into a dedicated `parseUploadForm` utility to reduce the 640-line route file.
- T-386. API routes use a shared `requireSession` helper that extracts auth, checks expiry, and returns a consistent 401 shape instead of inline session checks.
- T-385. `updatedAt` timestamps use a Drizzle `onUpdate` trigger or middleware so all update queries set it automatically without manual inclusion.
- T-384. Health endpoint verifies database connectivity before returning a healthy status.
- T-383. Dataset detail page paginates through the `datasetRows` table instead of loading all rows from the JSONB column.
- T-414. Orphaned duplicate `src/assets/images/icon.svg` removed (asset duplication fix).
- T-410. Business page verified functional — metrics, DataTable, profile/review panels, archive/restore all work with no type errors.
- T-409. Upload server action now writes rows to `datasetRows` table so the dataset detail page displays paginated data instead of showing empty rows.
- T-406. Theme toggle already provides multi-theme switcher (light/dark/system/high-contrast/larger-text) with accessibility icons.
- T-405. Search popup enhanced with debounced auto-search as the user types and fixed body overflow save/restore.
- T-404. Notification sidebar feature already present via `TopbarNoticeActivityDrawer` — bell icon in topbar opens a modal sidebar with notices and activity feed.
- T-402. App version already shown in topbar next to logo (v{version}); changed from `hidden sm:inline` to always visible.
- T-413. Project favicon resolves from the app route and broken duplicate favicon assets are removed.
- T-412. Every page already passes a page-specific `icon` prop to `AppPageHeader` — no changes needed.
- T-411. The last inline table in `ResultPreview` (`ai-assistant-workspace.tsx`) refactored to use the shared `DataTable` component.
- T-408. FAQ page contains no inline issue form — only links to `/app/tickets` and `/contact`.
- T-407. Font sizes reduced across the board in `tailwind.config.ts`: page-title 24→22, card-title 15→14, small-title 13→12, body 13→12, meta 11→10.5.
- T-403. Superadmin `Admin` section added to topbar before Credits section, conditionally rendered via `session?.user?.role`.
- T-401. Sidebar collapse toggle button added to topbar after Credits section (no border), synchronises state via custom event.
- T-400. dashboard: topbar - dedup credit number in topbar and show wording
- T-399. dashboard: topbar - logo bigger without margin and border
- T-366. `updatedAt` timestamps include on every write operation across all database update queries (verified already present).
- T-365. ESLint configuration expanded with `no-console`, `@typescript-eslint/no-explicit-any`, and unused-disable-directive reporting.
- T-364. Barrel re-export files removed from `src/lib/` root after confirming zero imports reference them.
- T-363. Per-page loading and error states added for datasets, settings, business, assistant, tickets, accountancy, and admin sections.
- T-362. `Content-Security-Policy` header added to the security headers in `next.config.mjs`.
- T-361. Shared data aggregation and column detection functions extracted into `src/lib/data/queryEngine.ts` — `findColumn`, `normalizeCurrencyValue`, `formatCurrencyValue`, `formatPercentValue`, `aggregateData` — and used by both `chat/route.ts` and `query/route.ts`.
- T-360. Dataset upload stores parsed rows in the dedicated `datasetRows` table via batched inserts instead of the single JSONB column.
- T-359. POST API routes for chat, analyze, query, datasets, and tickets validate request bodies with Zod schemas using a shared `validateOrError` helper in `src/lib/validation.ts`.
- T-358. All bare `console.error` and `console.warn` calls across API routes and hooks replaced with gated `debugError`/`debugWarn` helpers.
- T-357. Free-tier analyst credit consumption increments the usage counter (`consumeAnalystCredit`), and `requireAnalystCredit` enforces the limit by throwing.
- T-356. AI assistant generates data-aware suggestions through the right sidebar Generate button, stored globally in the database via `appSettings` key `suggestions_global`, and all chat responses route through Google AI (Gemini) for unique per-request answers.
- T-355. Dashboard page layout uses consistent flex-based heights across settings, business, accountancy, datasets, admin, and all sub-pages - `min-h-screen` replaced with `flex-1` in 20+ page wrappers. Navigation lives only in the left sidebar and horizontal sub-page bars.
- T-352. AI assistant page layout replaced cascading `min-h-screen` with a proper flex height chain: app layout main uses `flex min-h-[calc(100vh-4rem)] flex-col`, assistant layout and workspace use `flex flex-1` to fill the viewport accounting for the fixed topbar height.

- T-350. Combine sign-in and sign-up into one tabbed authentication page.
- T-349. Restore demo and social sign-in actions on the login page.
- T-348. Normalize dashboard business overview, dataset library, and downloads table flows.
- T-347. Add GitHub pnpm cache and keep Railway dist install metadata.
- T-346. Fix generated dist pnpm build-script approvals for local and Railway installs.
- T-345. Improve dashboard sitemap guide with clickable site-plan wireframe.
- T-344. Add dashboard sitemap docs, account subpage bar, table consistency, and full-height topbar targets.
- T-342. Fix dashboard search overlay, role-filtered results, links, and chat search context.
- T-341. Fix Stripe checkout and webhook subscription activation.
- T-337. Create accountancy-nav.tsx subpages bar component with Overview, Reporting, Tax, and Compliance links.
- T-339. Move review and info panels from business profile to business main page (profile summary and review sections).
- T-325. Fix corepack pnpm for Railway build - use pnpm@11.5.0 version matching package.json engines.
- T-326. Topbar menu simplified - single icon items without subpanels, spread layout, clean navigation.
- T-324. Add contact sales button to billing page (sales@useclevr.com).
- T-323. Fix Stripe integration message in billing page.
- T-327. Search popup fixed - added submit button, proper width, non-blocking modal.
- T-328. AI assistant page layout rewritten - left-right sidebar structure, sticky footer, generate suggestions button, dataset selection in left sidebar.
- T-329. Dataset table unified - action bar header with business-related stat panels (total datasets, avg revenue, ready count) instead of row/column counts.
- T-330. Business menu pages fixed - overview panels for business metrics, auto-start add business flow when empty, sidebar selection persistence.
- T-331. Accountancy sidebar menu added with Receipt icon and database-connected main page with overview panels.
- T-332. Topbar sidebar secondary menu - Account moved to secondary panel above credits, profile combined with settings as Account.

(Existing tasks below)
- T-312. Support dedicated business, business entity, and country tax profile storage with
  multi-business listing rows, archive and restore state, and subscription-tier business limits.
- T-313. Use a table-first dashboard ticket queue with row edit pages and a separate new ticket page.
- T-311. Promote Business Profile from settings into a top-level Business workspace with a
  listing table, workspace subpages, updated setup progress links, and aligned planning notes.
- T-298. Complete business profile review, setup progress tracking, the setup tour, sidebar links,
  dashboard FAQ actions, plan suggestions, and TODO retirement updates.
- T-269. Link promoted GitHub issues back to local task IDs and release targets.
- T-270. Define which CI outputs should be attached to GitHub Releases.
- T-277. Document common git command patterns for repeatable local workflows.
- T-278. Document long-running command and timeout handling patterns.
- T-280. Document common development task prompt templates.
- T-281. Document user-AI communication patterns.
- T-282. Document future AI collaboration guidelines.
- T-297. Dashboard users can open the AI Assistant from the sidebar, select a dataset, and ask
  follow-up business questions in one workspace.
- T-126. Use shared read-first tables with focused row edit pages for admin customer, customer level,
  and discount pages.
- T-204. Add coming-soon mobile app buttons, social placeholders, the user panel, and Terms access
  to the dashboard sidebar footer.
- T-205. Open the dashboard directly to datasets, route Hybrid AI and subscription changes through
  checkout review, include Business and super-admin paid download access, and use filtered
  expandable dashboard FAQ answers.
- T-206. Move document markup into the App Router shell, fail production builds on TypeScript errors,
  and render public FAQ highlighting through React instead of injected HTML.
- T-207. Fold completed dist deployment confirmations into the regular TODO queues after deployment
  succeeds.
- T-208. Convert project audit work into regular TODO tasks plus auditor and testing guide documents.
- T-209. Use `T-` task numbers and `todo-next.md` as the only active queue.
- T-244. Retire dist and audit TODO files into the regular next, done, future, and ignored queues.
- T-245. Add project audit and testing guides for repeatable start-to-finish review.
- T-258. Deploy Railway from the `dist` branch with `/dist` as the root directory.
- T-259. Keep Railway runtime secrets in Railway environment variables.
- T-260. Retire the older source-branch Railway deployment path from the active deploy target.
- T-261. Confirm fresh generated `/dist` output on the dist branch after publishing succeeds.
- T-262. Limit dist branch publish scope to generated `/dist` output and `/server-config`.
- T-263. Document how retired audit and dist tasks moved into the regular queues.
- T-264. Add dashboard topbar onboarding, shared activity popup behavior, TODO retirement guidance,
  and GitHub issue/project/release guidance.
- T-283. Use database-backed progress and seen state for dashboard onboarding, make social login buttons
  create local user/profile records when providers are configured, and onboarding/activity actions
  save to the activity feed.
- T-265. Let small-screen dashboard users reopen onboarding from the topbar Process button.
- T-267. Show loading and error states in topbar notices and the activity popup when recent
  activity cannot be fetched.
- T-210. Move technical guides into developer documentation.
- T-211. Move flowcharts into developer guide folders.
- T-212. Move user-facing documentation into user guide folders.
- T-213. Move project requirements into developer-facing documentation where appropriate.
- T-214. Replace troubleshooting guidance with a developer testing guide.
- T-215. Split flowcharts into user-facing, production technical, and deployment charts.
- T-216. Move TODO and future recommendation documents into `.TODO/`.
- T-217. Update documentation links after folder changes.
- T-218. Add Mermaid editor guidance for project diagrams.
- T-219. Move static files into `src/assets/` and serve them through `/assets/...`.
- T-220. Remove the Railway debug endpoint for homepage HTML.
- T-221. Move runtime target off the old Node.js baseline.
- T-222. Update npm and pnpm dependencies for the current app baseline.
- T-223. Create the original system flowchart.
- T-224. Refresh the docs landing page and onboarding docs.
- T-225. Move host-specific commands, settings, and troubleshooting notes into Railway and Vercel
  deployment guides.
- T-226. Refresh Corepack and use a Node-compatible pnpm release in Railway generated-output builds.
- T-227. Avoid conflicting pnpm build-approval settings in generated runtime packages.
- T-228. Allow runtime installs for generated deployment packages without a committed lockfile.
- T-229. Include migration tooling required by pre-deploy schema steps in generated runtime packages.
- T-230. Restore the Next.js build output when host snapshots omit dot-directories.
- T-231. Normalize repository text files with UTF-8 and LF rules.
- T-232. Require super-admin access for payment provider settings and super-admin dashboard pages
  opened from direct URLs.
- T-233. Show dashboard notices in a topbar inbox with recent product activity, user activity
  history, super-admin total activity, and subscription-focused credit access.
- T-234. Keep the previous deployment commit visible in dist publish history while reducing workflow
  log output.
- T-235. Keep dist deployment config under `/server-config` and run generated deployment output from
  `/dist`.
- T-236. Use a generated Nixpacks plan so Railway generated-output installs run through Corepack
  pnpm.
- T-237. Use Nixpacks with explicit Corepack pnpm activation for Railway runtime builds.
- T-238. Keep PDF export browser dependencies as explicit production dependencies.
- T-239. Dispatch branch maintenance after auto-merged release pull requests merge.
- T-240. Run the production publish build during local pre-commit validation.
- T-241. Keep public login errors inline, let visitors submit public contact requests without
  sign-in, and show legal links from public/auth footers.
- T-242. Split generated production starts by local, Railway, and Vercel server targets.
- T-243. Add operational storage, referral reward guards, production readiness checks, and CSV
  edge-case tests.
- T-290. Service layer extraction created lib/services/reportService.ts for report generation orchestration.
- T-291. Service layer extraction created lib/services/datasetService.ts for dataset analysis orchestration.
- T-292. Configuration centralization created lib/config/index.ts with Zod validation for runtime envs.
- T-293. Dashboard language feature implemented with language selector in topbar, LanguageProvider context, and Google Translation service with caching. Language context enhanced with `translate` function for dynamic Google Translation API calls.
- T-301. Fix ticketing so super admins can send messages and admin notes show admin name and
  timestamp.
- T-302. FAQ items open by default with open/close all buttons in header.
- T-303. FAQ page includes open/close all buttons.
- T-304. App version text added under Terms & Conditions in sidebar.
- T-305. Sign out redirect fixed to use relative URL.
- T-306. Social panel title removed from sidebar.
- T-307. Topbar reordered: Hybrid AI button moved left, notice icon placed before logout.
- T-308. Hover color contrast improved in dashboard FAQ actions (hover:bg-accent/50).
- T-309. Language context enhanced with `translate` function using Google Translation API.
- T-310. Cookie consent bar added with accept button.
- T-338. Fix progress system - single line display, page-based steps instead of field-based, activity integration.
- T-340. Add API endpoint for bulk dataset deletion.
- T-437. Enhanced sales and marketing materials: added research data and mermaid charts where applicable.
- T-436. Optimized CHANGELOG.md [Unreleased] section: reordered sections, optimized entries for present-action language and user benefit.
