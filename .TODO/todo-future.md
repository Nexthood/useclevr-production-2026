# Future TODO

Deferred work lives here until it becomes active enough to move into `todo-next.md`.

Get T-number (task number) from `.TODO/config.json` before adding new tasks.

## Links

- [TODO-done.md](todo-done.md)
- [TODO-ignore.md](todo-ignore.md)
- [TODO-future.md](todo-future.md)
- [.TODO/config.json](config.json)

## Future


- T-299. Review restore candidates for legacy report PDF generation and cloud live-data refresh
  behavior before deciding whether they should return to the product.

- T-127. Replace checkout review URL proof with a server-issued one-time token before payment collection is enabled.
- T-128. Add real billing invoice rows once the payment provider returns invoice history.
- T-129. Review whether the payment readiness page needs provider-specific setup actions after Stripe is connected.
- T-180. Add OAuth providers if the product roadmap requires them.
- T-181. Implement email notifications.
- T-182. Add webhook support beyond the current billing and product events.
- T-183. Create API rate limiting per user.
- T-184. Add multi-workspace support.
- T-185. Add unit tests for pure utilities and data transforms.
- T-186. Add integration tests for high-value API routes.
- T-187. Add E2E tests for upload, analyze, and report flows.
- T-188. Set up broader CI test gates once the baseline is stable.
- T-189. Add a billing adapter layer if a second payment provider must run beside Stripe.
- T-190. Model multiple payment provider price IDs per customer if accounts can hold several subscriptions over time.
- T-191. Add a nightly billing reconciliation job for missing subscription period-end values.
- T-192. Add a Docker deployment option if Nixpacks and Railpack both create unstable install behavior.
- T-193. Split database migrations into a separate job only if migration duration, lock risk, or background work makes the single web-service pre-deploy phase unsafe.
- T-194. Add server-host templates for a second hosting destination if Railway stops being the only production host.
- T-195. Add a Railway account-backed service checklist covering Railway, Neon, Gemini, Stripe, upload storage, and future secondary hosts.
- T-196. Add a CMS-backed content editing path for FAQ, homepage copy, and pricing copy if non-developers need content changes without deploys.
- T-197. Confirm whether Vercel remains a live deployment target or only a documented fallback.
- T-198. Review whether dist branch history should keep exactly two commits or use tags/releases for longer deployment audit history.
- T-254. Preserve selected settings tab state in the URL or a shared settings context if settings pages need cross-navigation tab continuity.
- T-255. Add a generated deployment manifest with source commit, build timestamp, Node version, pnpm version, and healthcheck path.
- T-256. Add a dist branch smoke-check workflow only if Railway needs to wait for a GitHub status check before deploying.
- T-257. Track Railway Nixpacks support status and re-test Railpack with Corepack pnpm if Railway deprecates Nixpacks.
