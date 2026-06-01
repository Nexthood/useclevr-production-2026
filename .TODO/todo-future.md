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

## Future Next
- T-299. Evaluate restore candidates for legacy report PDF generation and cloud live-data refresh behavior before deciding whether they should return to the product.
- T-127. Replace checkout review URL proof with a server-issued one-time token before payment collection is enabled.
- T-128. Add real billing invoice rows once the payment provider returns invoice history.
- T-129. Resolve whether the payment readiness page needs provider-specific setup actions after Stripe is connected.
- T-180. Add OAuth providers if the product roadmap requires them.
- T-181. Implement email notifications.
- T-182. Add webhook support beyond the current billing and product events.
- T-183. Create API rate limiting per user.
- T-184. Add multi-workspace support.
- T-189. Add a billing adapter layer if a second payment provider must run beside Stripe.
- T-190. Model multiple payment provider price IDs per customer if accounts can hold several subscriptions over time.
- T-191. Add a nightly billing reconciliation job for missing subscription period-end values.
- T-192. Add a Docker deployment option if platform builders create unstable install behavior.
- T-193. Split database migrations into a separate job only if migration duration, lock risk, or background work makes the single web-service pre-deploy phase unsafe.
- T-194. Add server-host templates for a second hosting destination if Railway stops being the only production host.
- T-195. Add a Railway account-backed service checklist covering Railway, Neon, Gemini, Stripe, upload storage, and future secondary hosts.
- T-196. Add a CMS-backed content editing path for FAQ, homepage copy, and pricing copy if non-developers need content changes without deploys.
- T-197. Resolve whether Vercel remains a live deployment target or only a documented fallback.
- T-198. Resolve whether dist branch history should keep exactly two commits or use tags/releases for longer deployment audit history.
- T-254. Preserve selected settings tab state in the URL or a shared settings context if settings pages need cross-navigation tab continuity.
- T-256. Add a dist branch smoke-check workflow only if Railway needs to wait for a GitHub status check before deploying.
- T-394. Add a dashboard table consistency audit that checks list pages use title links, supporting edit links, and row-end actions before new list pages ship.
- T-395. Add a setup progress audit that verifies every business profile field and required setup action contributes to the topbar completion panel.

## Future Security

- T-398. Add a security audit that confirms user-uploaded files, prompt text, and generated exports stay outside AI context and public static paths.

## Future Quality

- T-444. Fix legacy constants in csv-upload.tsx — UPLOAD_QUEUE_KEY and LEGACY_UPLOAD_QUEUE_KEY resolve to the same string.
- T-445. Upload route retry helper uses in-memory Map that resets on serverless restart — replace with persistent retry tracking.
- T-447. OAuth user ID generation uses Date.now() + Math.random() — switch to uuid for collision resistance.
- T-448. Accessibility: Select component lacks keyboard navigation, aria attributes, and disabled state handling.
- T-449. Data processing flow uses external placeholder images — add fallback and alt text.
- T-450. LLM client (antigravity-client.ts) uses raw fetch with no deduplication or timeout — use Next.js extended fetch or dedicated client.

## Future Performance

- T-446. Consolidate heavy client dependencies (canvg, html2canvas, qrcode, jspdf) — lazy-load or move PDF generation server-side.

## Future Skip: Test

## Skipped

- T-439. Configure test framework (Vitest, Playwright) and add unit tests for `src/lib/` modules.
- T-185. Add unit tests for pure utilities and data transforms.
- T-186. Add integration tests for high-value API routes.
- T-187. Add E2E tests for upload, analyze, and report flows.
- T-188. Set up broader CI test gates once the baseline is stable.
- T-257. Track Railway builder support status and re-test deployment installs when Railway changes builder behavior.
- T-391. Add regression tests for login redirect and auth-host handling across local, Railway, and Vercel-style origins.
- T-393. Add a billing smoke test that verifies checkout session ownership, customer reuse, and billing portal fallback states with mocked Stripe responses.
- T-396. Add an AI Assistant layout smoke test that confirms fixed sidebars, scrollable messages, and the fixed chat footer stay usable on desktop and mobile widths.
- T-397. Add a documentation cleanup pass that removes stale dist-test setup notes after the Railway workflow stabilizes.

## Additional
- T-463. Stabilize Railway main deploy first. Keep the deprecated middleware workaround if it is the only stable packaging path. Do not migrate middleware/proxy yet. Ensure dist branch contains all runtime files. Document exact deploy flow.
- T-464. Create one central billing config for plan names, prices, Stripe Price IDs, intervals, and descriptions. Remove hardcoded prices from UI. Add customer portal, cancellation flow, invoice view, and payment failure handling.
- T-465. Verify role handling for user, admin, and superadmin. Make sure protected routes are consistent. Fix onboarding/session edge cases only where needed.
- T-466. Improve CSV parsing, dirty CSV handling, column detection, preview generation, file size limits, and clear error messages.
- T-467. Improve dataset-aware answers. The AI must use uploaded dataset context, not generic answers. Improve chart suggestions, KPI detection, summaries, and follow-up questions.
- T-468. Clean dashboard, upload flow, pricing page, billing page, empty states, loading states, and error messages. Keep changes minimal and consistent with current design.
- T-469. Do not migrate now. Prepare notes only. Map current DB tables/models to future Payload collections. Avoid changes that make future Payload migration harder.
- T-470. Prepare onepager, simple demo flow, LinkedIn launch post, outreach email, and investor/startup contact list.
- T-471. Clean env usage, remove exposed secrets, add upload limits, add rate limits, review admin routes, and prepare basic GDPR/privacy notes.
- T-472. Create beta feedback flow, bug board, launch checklist, and short public demo script.
