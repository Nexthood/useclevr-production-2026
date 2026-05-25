# Active TODO Queue

This is the only active TODO file. Add confirmed work here before it starts.

Get T-number (task number) from `.TODO/config.json` before adding new tasks.

## Links

- [TODO-done.md](todo-done.md)
- [TODO-ignore.md](todo-ignore.md)
- [TODO-future.md](todo-future.md)
- [.TODO/config.json](config.json)

## Active

No active implementation task is currently in progress.

## Next

- T-130. Document API endpoints and request/response contracts.
- T-131. Create a user-facing product guide.
- T-132. Review and remove production-facing debug logs.
- T-133. Check for exposed API keys, secrets, or real connection strings.
- T-134. Verify Railway environment variables after the successful dist deployment.
- T-135. Review authentication flow and protected route behavior.
- T-136. Check rate limiter behavior in the deployed environment.
- T-137. Verify security headers in the deployed app.
- T-138. Test authentication bypass scenarios.
- T-139. Review CORS and trusted-host configuration.
- T-140. Review database queries for injection risks.
- T-141. Verify upload validation, including MIME type and file size handling.
- T-142. Verify Railway deployment reaches the app shell.
- T-143. Verify `/api/health` returns quickly.
- T-144. Check Neon connection pooling and direct connection settings.
- T-145. Review Railway runtime memory usage.
- T-146. Test cold-start performance.
- T-147. Remove unused imports and dependencies.
- T-148. Clean up dead code paths and old backup files.
- T-149. Add error boundaries to high-value React routes.
- T-150. Improve TypeScript types around analysis, forecasts, and reports.
- T-151. Add consistent loading and error states to async UI.
- T-152. Review database query patterns for expensive dashboard and report flows.
- T-153. Add safe caching where data can be reused.
- T-154. Optimize image and static asset loading.
- T-155. Lazy-load heavy dashboard and report components where useful.
- T-156. Review production bundle size.
- T-157. Add application error tracking.
- T-158. Define structured server logging conventions.
- T-159. Configure production health checks.
- T-160. Add basic performance metrics for upload, analysis, and report generation.
- T-161. Guard Stripe checkout and webhook call sites so missing secrets return structured HTTP errors.
- T-162. Replace the Stripe checkout success stub with real checkout session retrieval.
- T-163. Run an end-to-end Stripe test on staging.
- T-164. Add a unique index for customer payment provider IDs.
- T-165. Fix subscription deletion handling so billing expiry is cleared when access ends.
- T-166. Decide whether the annual Pro plan appears in subscription settings or the footer copy changes.
- T-167. Add a Stripe customer portal route for invoice downloads, plan swaps, and cancellation.
- T-168. Track checkout funnel events.
- T-169. Add a `.nvmrc` that matches the supported Node runtime.
- T-170. Add production database connection probes for cold-start visibility.
- T-171. Run dependency drift checks and lock stable majors where appropriate.
- T-172. Add audit coverage to CI if the current validation gate does not catch advisories.
- T-173. Review whether `uuid` remains needed at runtime.
- T-174. Centralize Stripe secret reads in an environment guard helper.
- T-175. Add unit coverage for checkout session creation.
- T-176. Add unit coverage for subscription webhook handling.
- T-177. Add integration coverage for the checkout review flow.
- T-178. Add a payment-provider health endpoint that reports configured status without leaking secrets.
- T-179. Review Railway runtime memory settings after the successful dist deployment.
- T-246. Deduplicate homepage and public FAQ accordion behavior into one shared component.
- T-247. Replace the homepage FAQ count approximation with a computed FAQ item count.
- T-248. Add a canonical redirect from `/app/app/settings` to `/app/settings/profile`.
- T-249. Add a shared billing hook or helper for topbar, subscription, and checkout billing state.
- T-250. Add a payment price lookup index or document why price-based billing reports are unsupported.
- T-251. Strip direct payment secret references from files that may be included in AI context.
- T-252. Add route-level rate limiting to the payment webhook endpoint.
- T-253. Verify the running Railway container Node version after the successful dist deployment.
- T-266. Add tests for the onboarding popup first-run state, database-backed seen state, under-25%
  repeat-open behavior, and step navigation links.
- T-268. Add keyboard and screen-reader coverage for the shared modal use in onboarding and activity
  panels.
- T-271. Break Company Calculation Context into separate type file for cleaner imports.
- T-272. Create test script to verify each layer builds successfully.
- T-273. Add dist packaging validation for stripped layers.
- T-274. Document migration path from useclevr-2026 base to _ai-base-project.
- T-275. Add TypeScript validation for Mermaid diagrams in pre-commit.
- T-276. Create draft PR template for plan review process.
- T-279. Expand analysis to include file-based interaction patterns.
- T-284. Run a full dashboard interaction audit across topbar, sidebar, settings, dataset, checkout,
   admin, FAQ, ticket, and download flows.
- T-285. Add an authenticated end-to-end smoke test that clicks each dashboard button and verifies
   expected navigation, modal, form, or API behavior.
- T-286. Verify Google and GitHub OAuth login and registration in staging with configured provider credentials and callback URLs.
- T-309. Fix language feature not applying on language change.
