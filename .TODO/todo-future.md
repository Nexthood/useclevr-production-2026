# Future TODO

This retired queue stores deferred work until it becomes active enough to move into
`todo-next.md`.
Use plain labeled bullets here. Assign a T-number from `.TODO/config.json` only when moving work
into the active queue.

- [TODO-next.md](todo-next.md) (labels: todo)
- [TODO-done.md](todo-done.md) (labels: todo)
- [TODO-ignore.md](todo-ignore.md) (labels: todo)
- [TODO-future.md](todo-future.md) (labels: todo)
- [.TODO/config.json](config.json) (labels: todo)

## Label: accessibility

- Capture authenticated AI Governance Providers screenshots at desktop, tablet, and mobile widths after a signed-in browser session is available. (labels: accessibility, ui, testing)
- Implement automated accessibility testing in CI pipeline. (labels: accessibility, testing, ci-build)

## Label: ai

- Create a separate branch for the dev-AI interaction collection that gathers project learning from multiple AI agents working with the developer during this project. (labels: ai, docs, workflow)
- Add an AI interaction memory import assistant for pasted external chat summaries, redaction checks, classification, and project-learning destinations. (labels: ai, workflow)
- Add a review screen for imported AI memory summaries that lets the user classify findings into docs, TODO queues, requirements, changelog, or prompt-library entries before saving. (labels: ai, docs, todo, workflow)
- Activate AI differentiation after the usable-MVP gate passes; strengthen deterministic KPI, trend, anomaly, top-performer, risk, opportunity, executive-summary, recommendation, and follow-up-question quality against representative datasets. (labels: ai, business, data, upload)
- Add insurance policy records with provider, coverage, premium, deductible, renewal date, covered risks, exclusions, related asset or activity, missing-coverage warnings, and renewal reminders. (labels: ai, business, notice, testing)
- Add AI response caching layer for repeated queries. (labels: ai, performance, caching)

## Label: api

- Implement API versioning and deprecation policy. (labels: api, workflow, docs)

## Label: auth

- Add customer-data authorization before Payload MCP exposes private datasets to ChatGPT or other non-demo clients. (labels: auth, mcp, security, api)
- Allow signed internal MCP token access through the global proxy or narrow the proxy bypass for trusted MCP headers so documented token-based MCP calls can run without a browser session. (labels: auth, mcp, security, workflow)
- Add OAuth providers if the product roadmap requires them. (labels: auth, ai, workflow)
- Add a development settings toggle for switching between real local AI and Mock AI during local-only sessions. (labels: auth, local-ai, ai, dashboard)
- Verify role handling for user, admin, and superadmin. Make sure protected routes are consistent. Fix onboarding/session edge cases only where needed. (labels: auth, api, dashboard, workflow)
- Add multi-factor authentication option for sensitive operations. (labels: auth, security)

## Label: billing

- Clean dashboard, upload flow, pricing page, billing page, empty states, loading states, and error messages. Keep changes minimal and consistent with current design. (labels: billing, dashboard, ui, upload)
- Implement usage-based billing for API consumption. (labels: billing, payment, api)

## Label: business

- Add business-type-specific setup packs for e-commerce, SaaS, construction, restaurants, logistics, real estate, agencies, manufacturing, professional services, import/export, and freelancers. (labels: api, business, reports, workflow)
- Implement domain-driven design with clear bounded contexts for business logic. (labels: business, workflow)
- Implement CQRS pattern for read/write operations separation in complex business domains. (labels: business, workflow)

## Label: caching

- Add Redis cache warming strategy for peak hours. (labels: caching, performance)

## Label: ci-build

- Set up broader CI test gates once the baseline is stable. (labels: ci-build, dashboard, ui, testing)
- Add a billing smoke test that verifies checkout session ownership, customer reuse, and billing portal fallback states with mocked Stripe responses. (labels: ci-build, payment, billing, auth)
- Add an AI Assistant layout smoke test that confirms fixed sidebars, scrollable messages, and the fixed chat footer stay usable on desktop and mobile widths. (labels: ci-build, ai, dashboard, ui)
- Identify and remove the Next.js or Payload compile warning that production builds currently report without warning details. (labels: ci-build, quality, content)
- Add bundle analysis to CI pipeline to monitor and reduce JavaScript bundle size. (labels: ci-build, data, performance)
- Set NEXT_PUBLIC_APP_VERSION env var for version display. (labels: ci-build, deployment)
- Add build metadata to Docker image labels for traceability. (labels: ci-build, deployment)
- Implement automated dependency security scanning in CI pipeline. (labels: ci-build, security)
- Reduce production build work by skipping duplicate packaging checks and reusing validated artifacts between build phases. (labels: ci-build, performance, workflow)
- Measure build memory spikes and cap the heaviest packaging steps before Railway and local dist builds run out of RAM. (labels: ci-build, performance, monitoring)
- Stop CI force-push to dist-test when smoke test fails, preventing broken builds from reaching Railway deployment. (labels: ci-build, deployment, workflow)

## Label: dashboard

- Create the minimal monorepo layout under `apps/web` and `apps/docs` without moving the existing dashboard logic out of the current root app yet. (labels: dashboard, ui, docs)
- Preserve selected settings tab state in the URL or a shared settings context if settings pages need cross-navigation tab continuity. (labels: dashboard, workflow)
- Add a dashboard table consistency audit that checks list pages use title links, supporting edit links, and row-end actions before new list pages ship. (labels: dashboard, ui, data)
- Add a completion indicator audit that verifies Business Profile and Accountancy percentages match their source workflow readiness. (labels: dashboard, ui, business, data)

## Label: data

- Evaluate restore candidates for legacy report PDF generation and cloud live-data refresh behavior before deciding whether they should return to the product. (labels: api, data, reports, workflow)
- Add marketing, compliance, legal, risk, goals, and forecast scenario records with assumption overrides, missing-data confidence flags, and professional-verification labels. (labels: data, sales, content, workflow)
- Add the complete 10-family CSV and Excel fixture suite with mapping notes, then run parity, semantic-output, row-count, and cross-dataset contamination validation for every required upload fixture. (labels: data, upload, testing)
- Add a committed full-report XLSX regression fixture when QA requires manual PDF reproduction from a durable binary artifact instead of deterministic fixture generation. (labels: data, upload, testing)
- Add an admin cleanup tool for old generated report files when stale report storage requires bulk cleanup. (labels: reports, data, workflow)
- Fix legacy constants in csv-upload.tsx — UPLOAD_QUEUE_KEY and LEGACY_UPLOAD_QUEUE_KEY resolve to the same string. (labels: data, upload, todo, workflow)
- Data processing flow uses external placeholder images — add fallback and alt text. (labels: accessibility, data, workflow)
- Add unit tests for pure utilities and data transforms. (labels: data, testing)
- Improve CSV parsing, dirty CSV handling, column detection, preview generation, file size limits, and clear error messages. (labels: data, upload, workflow)
- Implement input sanitization for all user-provided data displayed in HTML contexts. (labels: data, workflow)
- Implement repository pattern for data access abstraction. (labels: data, workflow)
- Add data validation middleware for all API endpoints using Zod schemas. (labels: data, api, workflow)
- Implement database connection pooling with automatic retry logic. (labels: data, performance)

## Label: deployment

- Add a migration coverage check that verifies every table read by release-blocking Server Components has an idempotent fresh-install SQL path. (labels: deployment, testing, stability)
- Align Drizzle migration journal metadata with source SQL migrations 0005 through 0015 so the primary migration command can apply current database changes noninteractively. (labels: deployment, data, workflow)
- Prepare Payload and Fumadocs migration notes only. Map current app structure to future `apps/web` and `apps/docs`, but do not migrate until Railway deploy is stable. (labels: deployment, dashboard, ui, docs)
- Add verified root scripts for `dev:web`, `dev:docs`, `build:web`, `build:docs`, `lint:web`, and `lint:docs`, and keep the existing deploy flow unchanged. (labels: deployment, ci-build, docs, workflow)
- Validate Railway service-root deployment for the web and docs apps while preserving the current `dist` and `dist-test` branch behavior. (labels: deployment, ci-build, testing, docs)
- Add Business Profile output reports covering profile summary, KPI dashboard, financial health score, missing-data report, recommendations, and scenario forecasts. (labels: deployment, dashboard, business, data)
- Add a Docker deployment option if platform builders create unstable install behavior. (labels: deployment, ci-build, dashboard, ui)
- Split database migrations into a separate job only if migration duration, lock risk, or background work makes the single web-service pre-deploy phase unsafe. (labels: deployment, data, workflow)
- Add server-host templates for a second hosting destination if Railway stops being the only production host. (labels: deployment, workflow)
- Add a Railway account-backed service checklist covering Railway, Neon, Gemini, Stripe, upload storage, and future secondary hosts. (labels: deployment, payment, ai, data)
- Add CMS-backed pricing copy only if non-developers need pricing-language changes without deploys; keep plan values in billing configuration. (labels: deployment, content, billing, workflow)
- Extend Payload beyond current content and support ownership only after the operator flow remains stable through editing, logout, re-login, migration, and deployment cycles. (labels: deployment, content, workflow)
- Resolve whether Vercel remains a live deployment target or only a documented fallback. (labels: deployment, docs)
- Resolve whether dist branch history should keep exactly two commits or use tags/releases for longer deployment audit history. (labels: deployment, ci-build, workflow)
- Add a dist branch smoke-check workflow only if Railway needs to wait for a GitHub status check before deploying. (labels: deployment, ci-build, testing, workflow)
- Track Railway builder support status and re-test deployment installs when Railway changes builder behavior. (labels: deployment, ci-build, testing)
- Add regression tests for login redirect and auth-host handling across local, Railway, and Vercel-style origins. (labels: deployment, auth, testing)
- Add a documentation cleanup pass that removes stale dist-test setup notes after the Railway workflow stabilizes. (labels: deployment, ci-build, testing, docs)
- Add compact status report helpers for long-running validation, deploy checks, git workflow steps, and final release summaries. (labels: deployment, ci-build, reports, faq)
- Stabilize Railway main deploy first. Keep the deprecated middleware workaround if it is the only stable packaging path. Do not migrate middleware/proxy yet. Ensure dist branch contains all runtime files. Document exact deploy flow. (labels: deployment, dashboard, ui, data)
- Add centralized error reporting with contextual information for production debugging. (labels: deployment, reports, workflow)
- Add health check endpoints for all external service dependencies. (labels: deployment, monitoring)
- Add a superadmin-safe Square integration diagnostics view that shows configured environment and endpoint hosts without secrets. (labels: deployment, monitoring, security)
- Implement blue-green deployment strategy for zero-downtime releases. (labels: deployment, devops)
- Fix Payload admin logout redirect and session expiration handling so users return to login instead of seeing a blank or broken page. (labels: deployment, auth, ui)
- Add Payload collection field validation with user-friendly error messages for required fields, format checks, and relation constraints. (labels: deployment, content, workflow)
- Add Google Sheets and Snowflake connectors only after usable-MVP reliability, sales validation, retention, and revenue satisfy the platform-expansion gate. (labels: data, api, workflow)
- Productize analyze, chat, and report APIs only after customer workflows, authorization, operating reliability, retention, and revenue satisfy the platform-expansion gate. (labels: api, workflow)
- Add competitor, industry, company, and startup market intelligence only after core BI workflows and revenue validation satisfy the platform-expansion gate. (labels: ai, data, workflow)
- Add UseClevr Intelligence Cloud only after customer-data, financial-data, market-data, security, and AI-reasoning foundations pass their operating and commercial gates. (labels: ai, data, workflow)

## Label: devops

- Implement automated rollback on health check failure. (labels: devops, deployment, workflow)

## Label: docs

- Separate user-facing docs onto a dedicated docs branch with operator login support, and keep post-interaction update docs in sync. (labels: docs, deployment, workflow)
- Add comprehensive JSDoc documentation for all public APIs and complex functions. (labels: docs, workflow)
- Create API documentation with OpenAPI/Swagger for all backend endpoints. (labels: docs, api)
- Add code examples to documentation for common usage patterns. (labels: docs, workflow)

## Label: faq

- Add Payload CMS FAQ collection with public read, admin write access — first Payload migration step after core stability. (labels: faq, content)
- Create automated FAQ generation from support tickets. (labels: faq, ai, content)

## Label: local-ai

- LLM client (antigravity-client.ts) uses raw fetch with no deduplication or timeout — use Next.js extended fetch or dedicated client. (labels: local-ai, ai, performance)
- Add editable Mock AI response templates for assistant chat, dataset analysis, report generation, and error-state testing. (labels: local-ai, ai, api, dashboard)
- Add persistent Mock AI scenario storage for deterministic local screenshots and repeatable UI tests. (labels: local-ai, ai, dashboard, ui)
- Add local AI model quantization for reduced memory usage. (labels: local-ai, performance)

## Label: metrics

- Add business metrics dashboard for executive summary. (labels: metrics, dashboard, reporting)

## Label: notice

- Implement email notifications. (labels: notice)
- Implement notice prioritization and filtering system. (labels: notice, ui, workflow)
- Add notice snooze and reminder functionality for non-critical alerts. (labels: notice, ui)

## Label: observability

- Implement service mesh for microservices communication observability. (labels: observability, monitoring, performance)

## Label: payment

- Add a nightly billing reconciliation job for missing subscription period-end values. (labels: payment, billing)
- Add structured revenue-stream records with VAT treatment, payment terms, customer segment, margin estimate, seasonality, refunds, returns, and B2B/B2C/B2G classification. (labels: payment, business)
- Add structured cost records with fixed and variable categories, net/VAT/gross separation, payment frequency, due date, supplier, deductibility, and operating/capital/financing/tax classification. (labels: payment, accessibility, business)
- Add loans, leasing, debt, and financing records with lender, balance, interest, repayment schedule, collateral, fees, early repayment terms, debt service, and financing risk. (labels: payment, api, business)
- Add assets, equipment, inventory, payroll, HR cost, and cash-flow profile records with calculation inputs for working capital, depreciation context, payroll ratios, payment pressure, and runway. (labels: payment, business, data, upload)
- Add real billing invoice rows once the payment provider returns invoice history. (labels: payment, billing, ai, data)
- Resolve whether the payment readiness page needs provider-specific setup actions after Stripe is connected. (labels: payment, ai, workflow)
- Add webhook support beyond the current billing and product events. (labels: payment, billing, api, workflow)
- Add a billing adapter layer if a second payment provider must run beside Stripe. (labels: payment, billing, ai, workflow)
- Model multiple payment provider price IDs per customer if accounts can hold several subscriptions over time. (labels: payment, billing, ai, workflow)
- Create one central billing config for plan names, prices, Stripe Price IDs, intervals, and descriptions. Remove hardcoded prices from UI. Add customer portal, cancellation flow, invoice view, and payment failure handling. (labels: payment, billing, ui, workflow)
- Add PayPal payment provider support when checkout needs a second provider beside Stripe. (labels: payment, billing, ai, workflow)
- Add support for multiple payment providers (PayPal, Stripe, etc.). (labels: payment, billing)

## Label: mcp

- Serve the MCP endpoint at the subdomain root when MCP operates as a separate customer-facing product. (labels: mcp, deployment, api)
- Create separate MCP Railway service with independent scaling and monitoring when MCP demand grows. (labels: mcp, deployment, monitoring)
- Add MCP rate limiting dashboards showing per-client usage, throttling events, and response time metrics. (labels: mcp, monitoring, metrics)

## Label: performance

- Add lazy loading for non-critical components and routes to improve initial load performance. (labels: api, ui, performance, workflow)
- Remove unused components (TopbarSidebarToggle, shadcn sidebar). (labels: ui, performance)
- Improve perceived dashboard speed with route-level loading states, cached summary data, and fewer blocking startup requests. (labels: performance, dashboard, ui)
- Reduce memory use in dataset and assistant flows by paging large records, sampling previews, and avoiding full-row duplication in client state. (labels: performance, data, ai)
- Implement HTTP/2 push for critical assets in production builds. (labels: performance, deployment)
- Add server-side caching with Redis for expensive database queries. (labels: performance, data, caching)
- Reduce dashboard memory pressure by unloading inactive panels, trimming oversized client stores, and limiting repeated fetch payloads. (labels: performance, dashboard, data)
- Serve faster first responses by prioritizing above-the-fold dashboard data and deferring low-value background requests. (labels: performance, ui, dashboard)
- Implement adaptive loading based on network conditions and device capabilities. (labels: performance, ui, api)
- Add server-side rendering caching with stale-while-revalidate strategy. (labels: performance, docs)

## Label: quality

- Remove the existing ESLint warning backlog so the production validation gate completes with zero warnings. (labels: quality, ci-build, workflow)
- Implement code quality gates in CI pipeline with minimum coverage thresholds. (labels: quality, ci-build, testing)

## Label: reports

- Fix the classic SaaS generated PDF results-summary Top Findings assertion while keeping source-backed SaaS and startup unit-economics analysis intact. (labels: reports, testing)
- Consolidate heavy client dependencies (canvg, html2canvas, qrcode, jspdf) — lazy-load or move PDF generation server-side. (labels: reports, performance)
- Add proper layering (presentation, application, domain, infrastructure) with clear boundaries. (labels: reports, sales, workflow)
- Add report scheduling and automated delivery via email. (labels: reports, workflow)
- Implement report versioning and change tracking for audit trails. (labels: reports, data)
- Add report templates for common business use cases. (labels: reports, docs)
- Implement report sharing and collaboration features. (labels: reports, workflow)

## Label: sales

- Expand launch campaigns, outreach sequences, and investor/startup contact lists after the sales-validation kit and demo flow pass review. (labels: sales, workflow)
- Expand beta feedback and launch operations after the usable-MVP smoke journey and activation measurement are reliable. (labels: sales, workflow)

## Label: search

- Add search analytics and popular queries tracking. (labels: search, monitoring)
- Implement search result personalization based on user history. (labels: search, ui)

## Label: security

- Review and remediate dependency audit findings for Auth.js, Next.js, SheetJS, Payload transitive packages, DOMPurify, Sharp, PostCSS, and workflow tooling without broad unreviewed dependency upgrades. (labels: security, ci-build, testing)
- Re-enable the external Public AI API only after persistent hashed API keys, key revocation, expiration, per-key permissions, rate limits, request-size limits, dataset row/column limits, abuse controls, and audit logging are implemented. (labels: security, api, ai, monitoring)
- Create API rate limiting per user. (labels: security, api, performance)
- Add a security audit that confirms user-uploaded files, prompt text, and generated exports stay outside AI context and public static paths. (labels: security, ai, data, upload)
- Add redaction checks before saving imported AI memory summaries — strip email addresses, API keys, tokens, and private values from imported text. (labels: security, ai, api, workflow)
- Clean env usage, remove exposed secrets, add upload limits, add rate limits, review admin routes, and prepare basic GDPR/privacy notes. (labels: security, billing, api, upload)
- Add Content Security Policy (CSP) headers with nonce-based script and style allowlisting. (labels: security, content)
- Implement rate limiting on all API endpoints using Redis-backed sliding window counter. (labels: security, api, performance)
- Add audit logging for sensitive operations (user data access, permission changes, financial transactions). (labels: security, auth, business, data)
- Store external API keys in a persistent, owner-scoped table with hashed key values, expiry, revocation, last-used tracking, and audit logging. (labels: security, api, dashboard, ui)
- Implement API gateway with request/response validation and threat protection. (labels: security, api, deployment)
- Add file upload virus scanning for all user-uploaded content. (labels: security, upload)
- Implement account lockout mechanism after failed login attempts. (labels: security, auth)
- Tighten security headers, cookie flags, and session defaults across local and deployed environments. (labels: security, auth, deployment)
- Add secret-exposure review for docs, prompts, logs, and trace exports so operational text cannot leak credentials or private data. (labels: security, docs, ai)
- Add regular security audit automation and compliance reporting. (labels: security, ci-build)
- Implement zero-trust architecture principles for service-to-service communication. (labels: security, monitoring)

## Label: testing

- Configure test framework (Vitest, Playwright) and add unit tests for `src/lib/` modules. (labels: testing)
- Add integration tests for high-value API routes. (labels: api, testing)
- Add visual regression testing for UI components. (labels: testing, ui)
- Implement contract testing for API integrations. (labels: testing, api)

## Label: ui

- Accessibility: Select component lacks keyboard navigation, aria attributes, and disabled state handling. (labels: ui, accessibility)
- Implement responsive design breakpoints for all screen sizes. (labels: ui, accessibility)
- Add keyboard navigation support for all interactive components. (labels: ui, accessibility)
- Add plain expectation text to upload, assistant, reports, and accountancy queues so users know what happens next. (labels: ui, content, dashboard)
- Serve AI answers in a straight response format with the direct result first, followed by short evidence and next action. (labels: ui, ai, content)
- Change progress into an onboarding checklist that shows completed setup, missing setup, visited pages, and next best action. (labels: ui, dashboard, workflow)
- Add dark mode automatic switching based on system preferences. (labels: ui, accessibility)
- Implement responsive typography scaling for better readability. (labels: ui, accessibility)

## Label: upload

- Upload route retry helper uses in-memory Map that resets on serverless restart — replace with persistent retry tracking. (labels: api, upload, faq, performance)
- Add E2E tests for upload, analyze, and report flows. (labels: upload, reports, testing, workflow)
- Add request size limits and timeout protection to prevent DoS attacks. (labels: api, upload, performance, workflow)
- Add upload progress tracking with resumable uploads for large files. (labels: upload, api)
- Implement upload file validation beyond extension (MIME type, content inspection). (labels: upload, api)
- Connect a production OCR adapter for scanned PDFs and image receipts so Pre-bookkeeping can extract document fields instead of only routing files to scanner status. (labels: upload, data)
- Complete production-grade DATEV, QuickBooks, and Xero export mapping setup before enabling those Pre-bookkeeping export buttons. (labels: upload, reports, testing)
- Run authenticated browser upload validation against the deployed test application with representative CSV, Excel, PDF, receipt, invoice, and bank-export files, and capture request logs for `/api/accountancy/upload`. (labels: upload, deployment, testing)

## Label: workflow

- Add multi-workspace support. (labels: workflow)
- Implement proper error boundaries in React components with fallback UIs. (labels: workflow)
- Replace all `any` types with proper TypeScript interfaces and utility types. (labels: workflow)
- Implement image optimization with responsive formats (WebP, AVIF) and proper sizing. (labels: workflow)
- Implement server-side rendering for SEO-critical pages with proper meta tags. (labels: workflow)
- Refactor monolithic service classes into cohesive, single-responsibility modules. (labels: workflow)
- Add event-driven architecture with message broker for inter-service communication. (labels: workflow)
- Implement plugin architecture for extensible functionality without core modifications. (labels: workflow)
- Implement automated release notes generation from commit history. (labels: workflow, deployment)
- Add automated dependency update checks with security vulnerability scanning. (labels: workflow, ci-build)
- Add documentation generation from code comments and JSDoc. (labels: workflow, docs)
- Implement rollback mechanism for failed deployments with health check verification. (labels: workflow, deployment)
- Track slow developer workflows and remove repeated manual steps from local setup, build packaging, and deploy verification. (labels: workflow, performance, deployment)
- Add automated dependency licensing compliance checks. (labels: workflow, ci-build)
- Implement feature flag lifecycle management with automated cleanup. (labels: workflow, testing)
- Add MCP audit log viewer in superadmin panel for tracing tool invocations, auth attempts, and rate limit events. (labels: mcp, monitoring, security, ui)
- Implement MCP tool invocation streaming with progressive result delivery for long-running dataset queries. (labels: mcp, api, performance)
- Create reusable accessibility icon set component supporting dark mode variants for eye-dropper, zoom, voice-control, and screen-reader icons. (labels: ui, accessibility, dashboard)

## Suggestions
