# Future TODO

This retired queue stores deferred work until it becomes active enough to move into
`todo-next.md`.
Get the T-number from `.TODO/config.json` before adding new tasks. Keep task numbers stable when
moving work between states.

## Links

- [TODO-next.md](todo-next.md)
- [TODO-done.md](todo-done.md)
- [TODO-ignore.md](todo-ignore.md)
- [TODO-future.md](todo-future.md)
- [.TODO/config.json](config.json)

## Label: accessibility

- T-740. Implement automated accessibility testing in CI pipeline. (labels: accessibility, testing, ci-build)

## Label: ai

- T-721. Create a separate branch for the dev-AI interaction collection that gathers project learning from multiple AI agents working with the developer during this project. (labels: ai, docs, workflow)
- T-575. Add an AI interaction memory import assistant for pasted external chat summaries, redaction checks, classification, and project-learning destinations. (labels: ai, workflow)
- T-677. Add a review screen for imported AI memory summaries that lets the user classify findings into docs, TODO queues, requirements, changelog, or prompt-library entries before saving. (labels: ai, docs, todo, workflow)
- T-467. Improve dataset-aware answers. The AI must use uploaded dataset context, not generic answers. Improve chart suggestions, KPI detection, summaries, and follow-up questions. (labels: ai, business, data, upload)
- T-517. Add insurance policy records with provider, coverage, premium, deductible, renewal date, covered risks, exclusions, related asset or activity, missing-coverage warnings, and renewal reminders. (labels: ai, business, notice, testing)
- T-741. Add AI response caching layer for repeated queries. (labels: ai, performance, caching)

## Label: api

- T-742. Implement API versioning and deprecation policy. (labels: api, workflow, docs)

## Label: auth

- T-772. Allow signed internal MCP token access through the global proxy or narrow the proxy bypass for trusted MCP headers so documented token-based MCP calls can run without a browser session. (labels: auth, mcp, security, workflow)
- T-180. Add OAuth providers if the product roadmap requires them. (labels: auth, ai, workflow)
- T-447. OAuth user ID generation uses Date.now() + Math.random() — switch to uuid for collision resistance. (labels: auth)
- T-673. Add a development settings toggle for switching between real local AI and Mock AI during local-only sessions. (labels: auth, local-ai, ai, dashboard)
- T-465. Verify role handling for user, admin, and superadmin. Make sure protected routes are consistent. Fix onboarding/session edge cases only where needed. (labels: auth, api, dashboard, workflow)
- T-743. Add multi-factor authentication option for sensitive operations. (labels: auth, security)

## Label: billing

- T-468. Clean dashboard, upload flow, pricing page, billing page, empty states, loading states, and error messages. Keep changes minimal and consistent with current design. (labels: billing, dashboard, ui, upload)
- T-744. Implement usage-based billing for API consumption. (labels: billing, payment, api)

## Label: business

- T-514. Add business-type-specific setup packs for e-commerce, SaaS, construction, restaurants, logistics, real estate, agencies, manufacturing, professional services, import/export, and freelancers. (labels: api, business, reports, workflow)
- T-628. Implement domain-driven design with clear bounded contexts for business logic. (labels: business, workflow)
- T-630. Implement CQRS pattern for read/write operations separation in complex business domains. (labels: business, workflow)

## Label: caching

- T-745. Add Redis cache warming strategy for peak hours. (labels: caching, performance)

## Label: ci-build

- T-188. Set up broader CI test gates once the baseline is stable. (labels: ci-build, dashboard, ui, testing)
- T-393. Add a billing smoke test that verifies checkout session ownership, customer reuse, and billing portal fallback states with mocked Stripe responses. (labels: ci-build, payment, billing, auth)
- T-396. Add an AI Assistant layout smoke test that confirms fixed sidebars, scrollable messages, and the fixed chat footer stay usable on desktop and mobile widths. (labels: ci-build, ai, dashboard, ui)
- T-789. Identify and remove the Next.js or Payload compile warning that production builds currently report without warning details. (labels: ci-build, quality, content)
- T-622. Add bundle analysis to CI pipeline to monitor and reduce JavaScript bundle size. (labels: ci-build, data, performance)
- T-680. Set NEXT_PUBLIC_APP_VERSION env var for version display. (labels: ci-build, deployment)
- T-705. Add build metadata to Docker image labels for traceability. (labels: ci-build, deployment)
- T-682. Implement automated dependency security scanning in CI pipeline. (labels: ci-build, security)
- T-725. Reduce production build work by skipping duplicate packaging checks and reusing validated artifacts between build phases. (labels: ci-build, performance, workflow)
- T-726. Measure build memory spikes and cap the heaviest packaging steps before Railway and local dist builds run out of RAM. (labels: ci-build, performance, monitoring)
- T-777. Stop CI force-push to dist-test when smoke test fails, preventing broken builds from reaching Railway deployment. (labels: ci-build, deployment, workflow)

## Label: dashboard

- T-545. Create the minimal monorepo layout under `apps/web` and `apps/docs` without moving the existing dashboard logic out of the current root app yet. (labels: dashboard, ui, docs)
- T-254. Preserve selected settings tab state in the URL or a shared settings context if settings pages need cross-navigation tab continuity. (labels: dashboard, workflow)
- T-394. Add a dashboard table consistency audit that checks list pages use title links, supporting edit links, and row-end actions before new list pages ship. (labels: dashboard, ui, data)
- T-395. Add a setup progress audit that verifies every business profile field and required setup action contributes to the topbar completion panel. (labels: dashboard, ui, business, data)

## Label: data

- T-299. Evaluate restore candidates for legacy report PDF generation and cloud live-data refresh behavior before deciding whether they should return to the product. (labels: api, data, reports, workflow)
- T-520. Add marketing, compliance, legal, risk, goals, and forecast scenario records with assumption overrides, missing-data confidence flags, and professional-verification labels. (labels: data, sales, content, workflow)
- T-444. Fix legacy constants in csv-upload.tsx — UPLOAD_QUEUE_KEY and LEGACY_UPLOAD_QUEUE_KEY resolve to the same string. (labels: data, upload, todo, workflow)
- T-449. Data processing flow uses external placeholder images — add fallback and alt text. (labels: accessibility, data, workflow)
- T-185. Add unit tests for pure utilities and data transforms. (labels: data, testing)
- T-466. Improve CSV parsing, dirty CSV handling, column detection, preview generation, file size limits, and clear error messages. (labels: data, upload, workflow)
- T-615. Implement input sanitization for all user-provided data displayed in HTML contexts. (labels: data, workflow)
- T-634. Implement repository pattern for data access abstraction. (labels: data, workflow)
- T-683. Add data validation middleware for all API endpoints using Zod schemas. (labels: data, api, workflow)
- T-684. Implement database connection pooling with automatic retry logic. (labels: data, performance)

## Label: deployment

- T-563. Prepare Payload and Fumadocs migration notes only. Map current app structure to future `apps/web` and `apps/docs`, but do not migrate until Railway deploy is stable. (labels: deployment, dashboard, ui, docs)
- T-546. Add verified root scripts for `dev:web`, `dev:docs`, `build:web`, `build:docs`, `lint:web`, and `lint:docs`, and keep the existing deploy flow unchanged. (labels: deployment, ci-build, docs, workflow)
- T-547. Validate Railway service-root deployment for the web and docs apps while preserving the current `dist` and `dist-test` branch behavior. (labels: deployment, ci-build, testing, docs)
- T-521. Add Business Profile output reports covering profile summary, KPI dashboard, financial health score, missing-data report, recommendations, and scenario forecasts. (labels: deployment, dashboard, business, data)
- T-192. Add a Docker deployment option if platform builders create unstable install behavior. (labels: deployment, ci-build, dashboard, ui)
- T-193. Split database migrations into a separate job only if migration duration, lock risk, or background work makes the single web-service pre-deploy phase unsafe. (labels: deployment, data, workflow)
- T-194. Add server-host templates for a second hosting destination if Railway stops being the only production host. (labels: deployment, workflow)
- T-195. Add a Railway account-backed service checklist covering Railway, Neon, Gemini, Stripe, upload storage, and future secondary hosts. (labels: deployment, payment, ai, data)
- T-196. Add a CMS-backed content editing path for FAQ, homepage copy, and pricing copy if non-developers need content changes without deploys. (labels: deployment, faq, content, workflow)
- T-738. Extend Payload beyond Phase 0 news and legal pages only after the admin content flow stays stable through normal editing, logout, and re-login cycles. (labels: deployment, content, workflow)
- T-197. Resolve whether Vercel remains a live deployment target or only a documented fallback. (labels: deployment, docs)
- T-198. Resolve whether dist branch history should keep exactly two commits or use tags/releases for longer deployment audit history. (labels: deployment, ci-build, workflow)
- T-256. Add a dist branch smoke-check workflow only if Railway needs to wait for a GitHub status check before deploying. (labels: deployment, ci-build, testing, workflow)
- T-257. Track Railway builder support status and re-test deployment installs when Railway changes builder behavior. (labels: deployment, ci-build, testing)
- T-391. Add regression tests for login redirect and auth-host handling across local, Railway, and Vercel-style origins. (labels: deployment, auth, testing)
- T-397. Add a documentation cleanup pass that removes stale dist-test setup notes after the Railway workflow stabilizes. (labels: deployment, ci-build, testing, docs)
- T-576. Add compact status report helpers for long-running validation, deploy checks, git workflow steps, and final release summaries. (labels: deployment, ci-build, reports, faq)
- T-463. Stabilize Railway main deploy first. Keep the deprecated middleware workaround if it is the only stable packaging path. Do not migrate middleware/proxy yet. Ensure dist branch contains all runtime files. Document exact deploy flow. (labels: deployment, dashboard, ui, data)
- T-624. Add centralized error reporting with contextual information for production debugging. (labels: deployment, reports, workflow)
- T-685. Add health check endpoints for all external service dependencies. (labels: deployment, monitoring)
- T-686. Implement blue-green deployment strategy for zero-downtime releases. (labels: deployment, devops)
- T-798. Complete Payload admin content pages for news, legal, privacy, and FAQ collections with proper access control and editor workflow. (labels: deployment, content, workflow)
- T-799. Fix Payload admin logout redirect and session expiration handling so users return to login instead of seeing a blank or broken page. (labels: deployment, auth, ui)
- T-800. Add Payload collection field validation with user-friendly error messages for required fields, format checks, and relation constraints. (labels: deployment, content, workflow)

## Label: devops

- T-746. Implement automated rollback on health check failure. (labels: devops, deployment, workflow)

## Label: docs

- T-779. Separate user-facing docs onto a dedicated docs branch with operator login support, and keep post-interaction update docs in sync. (labels: docs, deployment, workflow)
- T-626. Add comprehensive JSDoc documentation for all public APIs and complex functions. (labels: docs, workflow)
- T-687. Create API documentation with OpenAPI/Swagger for all backend endpoints. (labels: docs, api)
- T-688. Add code examples to documentation for common usage patterns. (labels: docs, workflow)

## Label: faq

- T-537. Add Payload CMS FAQ collection with public read, admin write access — first Payload migration step after core stability. (labels: faq, content)
- T-747. Create automated FAQ generation from support tickets. (labels: faq, ai, content)

## Label: local-ai

- T-450. LLM client (antigravity-client.ts) uses raw fetch with no deduplication or timeout — use Next.js extended fetch or dedicated client. (labels: local-ai, ai, performance)
- T-669. Add editable Mock AI response templates for assistant chat, dataset analysis, report generation, and error-state testing. (labels: local-ai, ai, api, dashboard)
- T-672. Add persistent Mock AI scenario storage for deterministic local screenshots and repeatable UI tests. (labels: local-ai, ai, dashboard, ui)
- T-748. Add local AI model quantization for reduced memory usage. (labels: local-ai, performance)

## Label: metrics

- T-750. Add business metrics dashboard for executive summary. (labels: metrics, dashboard, reporting)

## Label: notice

- T-181. Implement email notifications. (labels: notice)
- T-751. Implement notice prioritization and filtering system. (labels: notice, ui, workflow)
- T-752. Add notice snooze and reminder functionality for non-critical alerts. (labels: notice, ui)

## Label: observability

- T-753. Implement service mesh for microservices communication observability. (labels: observability, monitoring, performance)

## Label: payment

- T-191. Add a nightly billing reconciliation job for missing subscription period-end values. (labels: payment, billing)
- T-515. Add structured revenue-stream records with VAT treatment, payment terms, customer segment, margin estimate, seasonality, refunds, returns, and B2B/B2C/B2G classification. (labels: payment, business)
- T-516. Add structured cost records with fixed and variable categories, net/VAT/gross separation, payment frequency, due date, supplier, deductibility, and operating/capital/financing/tax classification. (labels: payment, accessibility, business)
- T-518. Add loans, leasing, debt, and financing records with lender, balance, interest, repayment schedule, collateral, fees, early repayment terms, debt service, and financing risk. (labels: payment, api, business)
- T-519. Add assets, equipment, inventory, payroll, HR cost, and cash-flow profile records with calculation inputs for working capital, depreciation context, payroll ratios, payment pressure, and runway. (labels: payment, business, data, upload)
- T-128. Add real billing invoice rows once the payment provider returns invoice history. (labels: payment, billing, ai, data)
- T-129. Resolve whether the payment readiness page needs provider-specific setup actions after Stripe is connected. (labels: payment, ai, workflow)
- T-182. Add webhook support beyond the current billing and product events. (labels: payment, billing, api, workflow)
- T-189. Add a billing adapter layer if a second payment provider must run beside Stripe. (labels: payment, billing, ai, workflow)
- T-190. Model multiple payment provider price IDs per customer if accounts can hold several subscriptions over time. (labels: payment, billing, ai, workflow)
- T-464. Create one central billing config for plan names, prices, Stripe Price IDs, intervals, and descriptions. Remove hardcoded prices from UI. Add customer portal, cancellation flow, invoice view, and payment failure handling. (labels: payment, billing, ui, workflow)
- T-506. Add PayPal payment provider support when checkout needs a second provider beside Stripe. (labels: payment, billing, ai, workflow)
- T-754. Add support for multiple payment providers (PayPal, Stripe, etc.). (labels: payment, billing)

## Label: mcp

- T-813. Serve the MCP endpoint at the subdomain root when MCP operates as a separate customer-facing product. (labels: mcp, deployment, api)

## Label: performance

- T-620. Add lazy loading for non-critical components and routes to improve initial load performance. (labels: api, ui, performance, workflow)
- T-679. Remove unused components (TopbarSidebarToggle, shadcn sidebar). (labels: ui, performance)
- T-711. Improve perceived dashboard speed with route-level loading states, cached summary data, and fewer blocking startup requests. (labels: performance, dashboard, ui)
- T-712. Reduce memory use in dataset and assistant flows by paging large records, sampling previews, and avoiding full-row duplication in client state. (labels: performance, data, ai)
- T-692. Implement HTTP/2 push for critical assets in production builds. (labels: performance, deployment)
- T-693. Add server-side caching with Redis for expensive database queries. (labels: performance, data, caching)
- T-727. Reduce dashboard memory pressure by unloading inactive panels, trimming oversized client stores, and limiting repeated fetch payloads. (labels: performance, dashboard, data)
- T-728. Serve faster first responses by prioritizing above-the-fold dashboard data and deferring low-value background requests. (labels: performance, ui, dashboard)
- T-755. Implement adaptive loading based on network conditions and device capabilities. (labels: performance, ui, api)
- T-756. Add server-side rendering caching with stale-while-revalidate strategy. (labels: performance, docs)

## Label: quality

- T-788. Remove the existing ESLint warning backlog so the production validation gate completes with zero warnings. (labels: quality, ci-build, workflow)
- T-757. Implement code quality gates in CI pipeline with minimum coverage thresholds. (labels: quality, ci-build, testing)

## Label: reports

- T-446. Consolidate heavy client dependencies (canvg, html2canvas, qrcode, jspdf) — lazy-load or move PDF generation server-side. (labels: reports, performance)
- T-633. Add proper layering (presentation, application, domain, infrastructure) with clear boundaries. (labels: reports, sales, workflow)
- T-694. Add report scheduling and automated delivery via email. (labels: reports, workflow)
- T-695. Implement report versioning and change tracking for audit trails. (labels: reports, data)
- T-758. Add report templates for common business use cases. (labels: reports, docs)
- T-759. Implement report sharing and collaboration features. (labels: reports, workflow)

## Label: sales

- T-470. Prepare onepager, simple demo flow, LinkedIn launch post, outreach email, and investor/startup contact list. (labels: sales, workflow)
- T-472. Create beta feedback flow, bug board, launch checklist, and short public demo script. (labels: sales, workflow)

## Label: search

- T-760. Add search analytics and popular queries tracking. (labels: search, monitoring)
- T-761. Implement search result personalization based on user history. (labels: search, ui)

## Label: security

- T-183. Create API rate limiting per user. (labels: security, api, performance)
- T-398. Add a security audit that confirms user-uploaded files, prompt text, and generated exports stay outside AI context and public static paths. (labels: security, ai, data, upload)
- T-678. Add redaction checks before saving imported AI memory summaries — strip email addresses, API keys, tokens, and private values from imported text. (labels: security, ai, api, workflow)
- T-471. Clean env usage, remove exposed secrets, add upload limits, add rate limits, review admin routes, and prepare basic GDPR/privacy notes. (labels: security, billing, api, upload)
- T-608. Add Content Security Policy (CSP) headers with nonce-based script and style allowlisting. (labels: security, content)
- T-609. Implement rate limiting on all API endpoints using Redis-backed sliding window counter. (labels: security, api, performance)
- T-612. Add security scanning dependencies and integrate with CI pipeline for vulnerability detection. (labels: security, ci-build)
- T-614. Add audit logging for sensitive operations (user data access, permission changes, financial transactions). (labels: security, auth, business, data)
- T-676. Store external API keys in a persistent, owner-scoped table with hashed key values, expiry, revocation, last-used tracking, and audit logging. (labels: security, api, dashboard, ui)
- T-696. Implement API gateway with request/response validation and threat protection. (labels: security, api, deployment)
- T-697. Add file upload virus scanning for all user-uploaded content. (labels: security, upload)
- T-698. Implement account lockout mechanism after failed login attempts. (labels: security, auth)
- T-729. Tighten security headers, cookie flags, and session defaults across local and deployed environments. (labels: security, auth, deployment)
- T-730. Add secret-exposure review for docs, prompts, logs, and trace exports so operational text cannot leak credentials or private data. (labels: security, docs, ai)
- T-762. Add regular security audit automation and compliance reporting. (labels: security, ci-build)
- T-763. Implement zero-trust architecture principles for service-to-service communication. (labels: security, monitoring)

## Label: testing

- T-439. Configure test framework (Vitest, Playwright) and add unit tests for `src/lib/` modules. (labels: testing)
- T-186. Add integration tests for high-value API routes. (labels: api, testing)
- T-764. Add visual regression testing for UI components. (labels: testing, ui)
- T-765. Implement contract testing for API integrations. (labels: testing, api)

## Label: ui

- T-448. Accessibility: Select component lacks keyboard navigation, aria attributes, and disabled state handling. (labels: ui, accessibility)
- T-701. Implement responsive design breakpoints for all screen sizes. (labels: ui, accessibility)
- T-702. Add keyboard navigation support for all interactive components. (labels: ui, accessibility)
- T-713. Add plain expectation text to upload, assistant, reports, and accountancy queues so users know what happens next. (labels: ui, content, dashboard)
- T-714. Serve AI answers in a straight response format with the direct result first, followed by short evidence and next action. (labels: ui, ai, content)
- T-715. Change progress into an onboarding checklist that shows completed setup, missing setup, visited pages, and next best action. (labels: ui, dashboard, workflow)
- T-766. Add dark mode automatic switching based on system preferences. (labels: ui, accessibility)
- T-767. Implement responsive typography scaling for better readability. (labels: ui, accessibility)

## Label: upload

- T-445. Upload route retry helper uses in-memory Map that resets on serverless restart — replace with persistent retry tracking. (labels: api, upload, faq, performance)
- T-187. Add E2E tests for upload, analyze, and report flows. (labels: upload, reports, testing, workflow)
- T-610. Add request size limits and timeout protection to prevent DoS attacks. (labels: api, upload, performance, workflow)
- T-768. Add upload progress tracking with resumable uploads for large files. (labels: upload, api)
- T-769. Implement upload file validation beyond extension (MIME type, content inspection). (labels: upload, api)

## Label: workflow

- T-184. Add multi-workspace support. (labels: workflow)
- T-619. Implement proper error boundaries in React components with fallback UIs. (labels: workflow)
- T-617. Replace all `any` types with proper TypeScript interfaces and utility types. (labels: workflow)
- T-621. Implement image optimization with responsive formats (WebP, AVIF) and proper sizing. (labels: workflow)
- T-623. Implement server-side rendering for SEO-critical pages with proper meta tags. (labels: workflow)
- T-627. Refactor monolithic service classes into cohesive, single-responsibility modules. (labels: workflow)
- T-631. Add event-driven architecture with message broker for inter-service communication. (labels: workflow)
- T-632. Implement plugin architecture for extensible functionality without core modifications. (labels: workflow)
- T-704. Implement automated release notes generation from commit history. (labels: workflow, deployment)
- T-716. Add automated dependency update checks with security vulnerability scanning. (labels: workflow, ci-build)
- T-718. Add documentation generation from code comments and JSDoc. (labels: workflow, docs)
- T-720. Implement rollback mechanism for failed deployments with health check verification. (labels: workflow, deployment)
- T-731. Track slow developer workflows and remove repeated manual steps from local setup, build packaging, and deploy verification. (labels: workflow, performance, deployment)
- T-770. Add automated dependency licensing compliance checks. (labels: workflow, ci-build)
- T-771. Implement feature flag lifecycle management with automated cleanup. (labels: workflow, testing)
