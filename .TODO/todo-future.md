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

## Label: ai

- T-721. Create a separate branch for the dev-AI interaction collection that gathers project learning from multiple AI agents working with the developer during this project. (labels: ai, docs, workflow)
- T-575. Add an AI interaction memory import assistant for pasted external chat summaries, redaction checks, classification, and project-learning destinations. (labels: ai, workflow)
- T-677. Add a review screen for imported AI memory summaries that lets the user classify findings into docs, TODO queues, requirements, changelog, or prompt-library entries before saving. (labels: ai, docs, todo, workflow)
- T-467. Improve dataset-aware answers. The AI must use uploaded dataset context, not generic answers. Improve chart suggestions, KPI detection, summaries, and follow-up questions. (labels: ai, business, data, upload)
- T-517. Add insurance policy records with provider, coverage, premium, deductible, renewal date, covered risks, exclusions, related asset or activity, missing-coverage warnings, and renewal reminders. (labels: ai, business, notice, testing)

## Label: auth

- T-594. Evaluate a dedicated MCP subdomain only when MCP becomes an external customer-facing service with separate auth, rate limits, logs, and service ownership. (labels: auth, mcp, ai, performance)
- T-180. Add OAuth providers if the product roadmap requires them. (labels: auth, ai, workflow)
- T-447. OAuth user ID generation uses Date.now() + Math.random() — switch to uuid for collision resistance. (labels: auth)
- T-673. Add a development settings toggle for switching between real local AI and Mock AI during local-only sessions. (labels: auth, local-ai, ai, dashboard)
- T-465. Verify role handling for user, admin, and superadmin. Make sure protected routes are consistent. Fix onboarding/session edge cases only where needed. (labels: auth, api, dashboard, workflow)

## Label: billing

- T-468. Clean dashboard, upload flow, pricing page, billing page, empty states, loading states, and error messages. Keep changes minimal and consistent with current design. (labels: billing, dashboard, ui, upload)

## Label: business

- T-514. Add business-type-specific setup packs for e-commerce, SaaS, construction, restaurants, logistics, real estate, agencies, manufacturing, professional services, import/export, and freelancers. (labels: api, business, reports, workflow)

## Label: ci-build

- T-188. Set up broader CI test gates once the baseline is stable. (labels: ci-build, dashboard, ui, testing)
- T-393. Add a billing smoke test that verifies checkout session ownership, customer reuse, and billing portal fallback states with mocked Stripe responses. (labels: ci-build, payment, billing, auth)
- T-396. Add an AI Assistant layout smoke test that confirms fixed sidebars, scrollable messages, and the fixed chat footer stay usable on desktop and mobile widths. (labels: ci-build, ai, dashboard, ui)

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

## Label: faq

- T-537. Add Payload CMS FAQ collection with public read, admin write access — first Payload migration step after core stability. (labels: faq, content)

## Label: local-ai

- T-450. LLM client (antigravity-client.ts) uses raw fetch with no deduplication or timeout — use Next.js extended fetch or dedicated client. (labels: local-ai, ai, performance)
- T-669. Add editable Mock AI response templates for assistant chat, dataset analysis, report generation, and error-state testing. (labels: local-ai, ai, api, dashboard)
- T-672. Add persistent Mock AI scenario storage for deterministic local screenshots and repeatable UI tests. (labels: local-ai, ai, dashboard, ui)

## Label: notice

- T-181. Implement email notifications. (labels: notice)

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

## Label: reports

- T-446. Consolidate heavy client dependencies (canvg, html2canvas, qrcode, jspdf) — lazy-load or move PDF generation server-side. (labels: reports, performance)

## Label: sales

- T-470. Prepare onepager, simple demo flow, LinkedIn launch post, outreach email, and investor/startup contact list. (labels: sales, workflow)
- T-472. Create beta feedback flow, bug board, launch checklist, and short public demo script. (labels: sales, workflow)

## Label: security

- T-183. Create API rate limiting per user. (labels: security, api, performance)
- T-398. Add a security audit that confirms user-uploaded files, prompt text, and generated exports stay outside AI context and public static paths. (labels: security, ai, data, upload)
- T-678. Add redaction checks before saving imported AI memory summaries — strip email addresses, API keys, tokens, and private values from imported text. (labels: security, ai, api, workflow)
- T-471. Clean env usage, remove exposed secrets, add upload limits, add rate limits, review admin routes, and prepare basic GDPR/privacy notes. (labels: security, billing, api, upload)

## Label: testing

- T-439. Configure test framework (Vitest, Playwright) and add unit tests for `src/lib/` modules. (labels: testing)
- T-186. Add integration tests for high-value API routes. (labels: api, testing)

## Label: ui

- T-448. Accessibility: Select component lacks keyboard navigation, aria attributes, and disabled state handling. (labels: ui, accessibility)

## Label: upload

- T-445. Upload route retry helper uses in-memory Map that resets on serverless restart — replace with persistent retry tracking. (labels: api, upload, faq, performance)
- T-187. Add E2E tests for upload, analyze, and report flows. (labels: upload, reports, testing, workflow)

## Label: workflow

- T-184. Add multi-workspace support. (labels: workflow)
