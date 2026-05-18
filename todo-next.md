# Next Tasks — UseClevr

Last updated: 2026-05-18

---

## 🔴 Critical (blocking production Stripe)

- [ ] **`src/services/stripe/checkout.ts` — guard at callsite, not just module-load** — `getStripe()` now lazy-inits but callers still crash with an uncaught `Error("STRIPE_SECRET_KEY is not configured.")` instead of returning a structured HTTP error. Both `POST /api/checkout/confirm` and `POST /api/webhooks/stripe` must `try/catch` the returned promise or use a safe factory that returns `null` and lets the route respond 500 gracefully.
- [ ] **Replace `src/app/actions/stripe.ts` stub** — `getCheckoutSession()` (called by `checkout/success/page.tsx:3`) throws `"BILLING_DISABLED"`. Real `stripe.checkout.sessions.retrieve(sessionId)` needed so the success page shows subscription status, customer email, and plan name.
- [ ] **Run real end-to-end Stripe test on staging** — confirm `createStripeCheckoutSession` returns a live URL, the redirect lands on `/app/settings/checkout?success=1`, and the webhook fires `customer.subscription.created` updating `profiles` in the database.

## 🟡 High priority

- [ ] **Add `uniqueIndex('Profile_stripeCustomerId_key')` to `profiles` table in `schema.ts`** — without it, `findFirst` silently returns whichever matching row the planner picks first. Collisions are unlikely but possible during re-onboarding, which silently breaks subscription sync.
- [ ] **Rename `stripePriceId` → `stripePriceIds: Record<string, string | null>`** — currently only one price per user is stored. A user who upgrades from Pro to Business will shadow the old `stripePriceId`, making the previous subscription look like the current one. Consider a 1-to-many approach, or add a `subscriptionTierStripeStatus` lookup.
- [ ] **Add `stripeCurrentPeriodEnd` null-guard on `customer.subscription.deleted`** — `updatedAt` is always written even on deletion. On cancel/delete, explicitly null `stripeCurrentPeriodEnd` so the billing expiry field is accurate after the subscription ends.
- [ ] **Audit `subscription/page.tsx` line 78** — `filter(plan => plan.id !== "pro_annual")` excludes the annual plan from the upgrade card list, contradicting the footer *"Annual Pro discounts are applied automatically."* – decide whether to keep `pro_annual` in the visible card list or rewrite the footer.
- [ ] **Chargebee/RevenueCat compatibility layer** — if the business wants to support a second billing provider in parallel with Stripe, refactor `src/services/stripe/*` behind a `BillingAdapter` interface so checkout, webhooks, and confirm routes work with any provider.
- [ ] **Deduplicate homepage `FaqAccordion` vs `app/faq/page.tsx`** — both files export a duplicate accordion component. Move `FaqAccordion` to `src/lib/content/faq.ts` and import it from both pages to avoid behavioural drift.

## 🟢 Shipping quality of life

- [ ] **Full FAQ count in homepage button** — `{faqData.length + 8}+` is a magic-number approximation. Replace with `{getAllFaqItemCount()}` exported from `src/lib/content/faq.ts` so the label is always correct as categories grow.
- [ ] **Remove duplicate `stripePriceId` if no `_priceIds` migration** — the current one-price-per-profile model means a user who has held both a Pro and a Business subscription will only see the latest price. Decide whether to add a migration Django/Alchemy-style or accept single-subscription per account.
- [ ] **Add `GET /api/portal-session` route** — let pro/business users access the Stripe Customer Portal for self-service invoice downloads, plan swaps, and cancellation. Wire it to `stripe.billingPortal.sessions.create` with `customer: profile.stripeCustomerId`.
- [ ] **Redirect `/app/app/settings` → `/app/settings/profile`** — both paths work (Next.js dedupes `/app/app/`), but the canonical URL should be `/app/settings/…` to avoid duplicate indexing.
- [ ] **Export `selectedTab` state in `app/settings/layout.tsx`** — if any settings sub-pages need to preserve a selected tab across client-side navigation, add a `TabContext` provider or keep state in the URL search params.
- [ ] **Track Stripe checkout funnel** — add a `checkout_outcome` event (`page.tsx:submit`) and a `checkout_loaded` impression (in `checkout/confirm/route.ts` after `stripePriceId` guard) so funnels in the BI dashboard show drop-off between each step.
- [ ] **Consider `src/hooks/useBilling.ts`** — shared logic for `getBusinessCompletion`, `getAnalystCreditUsage`, `getBillingSettings`, and `getPlan` is duplicated across the topbar, subscription page, and checkout page. A single hook would remove the duplication.
- [ ] **Silent schema index for `stripePriceId`** — add `stripePriceIdIdx: optionalIndex('Profile_stripePriceId_key').on(table.stripePriceId)` to support a future query `findAll by priceId` for billing reports.

---

## 🏗️ Infrastructure

- [ ] **Add `.nvmrc`** — pin Node.js v22.22.3 (current install) to prevent accidental `fnm use 23` or `n` switching to an incompatible major. `cat > .nvmrc <<< 22.22.3`
- [ ] **SFN / Neon serverless cold-start watch** — `src/lib/db/index.ts:45` retries the connection in dev but is silent in production. Add a `process.env.NODE_ENV === 'production'` probe with a single fast query so connection errors are logged before the first request.

---

## 📦 Dependency drift

- [ ] **Run `pnpm outdated` now and each sprint** — `@ai-sdk/google: ^3.0.65`, `ai: ^6.0.169`, `stripe: ^14`, `next-auth: 5.0.0-beta.31` are all pre-release or wide-range. Lock major versions once a stable `next-auth@5.0.0` ships and `ai@6.x` stabilises.
- [ ] **Add `pnpm audit` to CI fast job** — currently only `validate:types + validate:dist`. Mild advisory risk should be caught in CI, not just locally.
- [ ] **Remove `uuid` dependency if not needed at runtime** — `package.json:100` starts at `^14.0.0` v4+; confirm it is only used in tests or mock data to avoid having to refresh the package.

---

## 🛡️ Security & privacy

- [ ] **Move `STRIPE_SECRET_KEY` runtime-reference audit out of `STRIPE_SECRET_KEY` logs** — `checkout/confirm/route.ts`, `webhooks/stripe/route.ts`, `payment/page.tsx`, and `checkout.ts` all read `process.env.STRIPE_SECRET_KEY`. A misconfigured log-forwarder that captures `process.env` on crash would ship the secret. Add an `envGuard` helper that reads env in a single place and returns `undefined` so nothing references `process.env.STRIPE_SECRET_KEY` more than once in the codebase.
- [ ] **Prevent CSRF on `POST /api/checkout/confirm`** — the endpoint trusts `form === "review-accepted"` in the URL as the T&C proof. A user who crafts a URL with `?form=review-accepted&plan=pro_monthly` and shares it bypasses the T&C step. Require a server-issued one-time token (e.g. in session state or a signed JWT) instead of a URL query flag.
- [ ] **Strip `process.env.STRIPE_SECRET_KEY!` from all TypeScript files before LLM context inclusion** — Kilo reads `.aiignore` and skips `dist/`, but make sure all Stripe env references are TRULY excluded from any agent context that escapes the machine. Review `kilo.json:4` `instructions` to include a reminder.
- [ ] **Rate limit `POST /api/webhooks/stripe`** — no rate limiter exists on this route. Malicious callers can drain DB connections by flooding the webhook endpoint. Consider a lightweight in-memory rate limiter or Cloudflare Turnstile if publicly exposed.

---

## 🧪 Test coverage

- [ ] **Stripe unit test: `stripe/checkout.ts::createStripeCheckoutSession`** — mock `new Stripe()` with `vi.mock`, verify `line_items`, `mode`, `success_url`, `cancel_url`, `client_reference_id` are passed correctly. Mocha/Jest not yet configured; use `tsx` for now.
- [ ] **Webhook unit test: `stripe/webhook.ts::handleSubscriptionEvent`** — mock DB client, pass a synthetic `customer.subscription.created` event, assert `.update(profiles)` is called with the right fee. Use `@mswjs/db` or a straightforward `vi.spyOn`.
- [ ] **Integration test: checkout flow** — use Playwright or Vitest Browser mode to simulate Step 1 → 2 → 3 (review → T&C → redirect), asserting that the checkout URL is generated and that `/app/settings/checkout?success=1` loads without 404.

---

## 🗄️ Data / migrations

- [ ] **Migration: add `stripePriceIds` JSONB column instead of `stripePriceId` text** — allow multiple Stripe prices per user (one per subscription type). The migration: add `stripePriceIds jsonb default '{}'` then backfill from existing `stripePriceId` → `{ tier: value }`. Apply via `drizzle-kit push`.
- [ ] **Populate missing `stripeCurrentPeriodEnd` values** — for users who subscribed before the Stripe integration, `stripeCurrentPeriodEnd` is null. Run a nightly reconciliation cron that queries Stripe for the current period end for each `profiles.stripeCustomerId` and patches the DB.

---

## 🚀 Deployment & ops

- [ ] **Check Railway build logs for Node version mismatch** — the build log currently shows `Node 22.x` via `actions/setup-node@v5`, but verify the running container is also `22.x` and not `20.x` (some base images ship an older Node).
- [ ] **Add health-check endpoint `GET /api/health/stripe`** — returns `{ configured: boolean, keyPresent: boolean, webhookPresent: boolean }` without leaking secret values. Use it in `nginx` or Railway's health-check config.
- [ ] **Set Railway variable `NODE_OPTIONS=--max-old-space-size=512`** — the `Dashboard` page does `Promise.all([getAnalystCreditUsage, getBillingSettings, loadBusinessCompletion])` which loads all settings before render. On low-memory containers, one slow query can OOM-kill.

---

## 🌐 CMS migration plan (lightweight Next.js CMS for front-pages)

**Goal:** edit FAQ Q&As, homepage copy, and pricing page from a single admin interface — no deploy or code change required.

### Recommended approach: Content Collections (`src/lib/content/`) + sanity.io

| Layer | Choice | Why |
|---|---|---|
| **Storage** | [Sanity.io](https://sanity.io) (free tier for small sites) | Structured content via GROQ, has a free hosted Studio (admin UI) |
| **Data fetching** | `lib/content/page-faq.ts` → fetch `/_doc(s)?` from Sanity on request | Already structured as `FaqCategory[] { category, items[] }` — zero schema changes needed; Sanity types map 1-1 |
| **Admin UI** | Sanity Studio (configured once in `sanity.config.ts`) | Runs on `/studio` route inside the same Next.js app; non-technical staff can add/edit/delete FAQ items |
| **Static fallback** | `static/faq.json` current file becomes a local snapshot fallback | if Sanity is down, fall back to local file with a single import change |
| **Deploy** | Free — runs on same Vercel/Railway instance | No external service costs |

### Migration steps (estimate: 4–6 hours)

1. **Create `studio/` directory** with `sanity.config.ts`, a single `faq` schema (mirrors current `FaqCategory` type). Run `npx sanity init` inside the repo.
2. **Add `sanity/schemas/faq.ts`** with `category: string`, `items: FaqItemSchema`. Seed from the current 23-item `src/lib/content/faq.ts`.
3. **Import `@sanity/client` in `lib/content/faq.ts`** — add `getFaqsFromSanity()` async function wrapping `client.fetch('*[_type == "faq"]{ category, items }')`. Guard with `try/catch` and fall back to the local array.
4. **Update `page.tsx` and `faq/page.tsx`** to use the new async getter (use Suspense boundary around the async component pattern the rest of the app already uses, e.g. `posts.tsx` pattern).
5. **Port `src/lib/content/page-pricing.ts` (homepage pricing bullets) and `src/lib/content/page-pages.ts` (feature rows)** to Sanity schema in the same Studio. The homepage `components: PageCollectionProps[]` already loads from database objects — extend this pattern to FAQ.
6. **Ship `sanity.deploy` hook** to push studio changes on git push via Railway or Vercel post-deploy step.

### CMS-ready watch list

- Keep the `FaqCategory` interface in `src/lib/content/faq.ts` stable — it is the contract type.
- Do not embed `dangerouslySetInnerHTML` in production content until the CMS stores HTML as sanitized Markdown.
- If you move to **Strapi** instead of Sanity: deploy the Strapi instance as a one-click Railway service (`strapi/strapi` official image), then use `strapi-sdk-js` to `GET /api/faqs?populate=*` and parse the `data.attributes` response shape (same `FaqCategory` shape).

---

## .env audit

- ✅ `STRIPE_SECRET_KEY` — documented in both `.env.railway.example` and `.env.local.example`
- ✅ `STRIPE_WEBHOOK_SECRET` — documented in both examples
- ✅ `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_ANNUAL`, `STRIPE_PRICE_BUSINESS_MONTHLY` — documented in both examples
- ✅ Node v22.22.3 (local) / `22.x` (CI) — matches `>=22.22.0` in package.json
- ✅ pnpm 10.33.2 (local and CI) — matches `>=10.33.2` in package.json
- ⚠️ `stripePriceId` schema field has no `uniqueIndex` — see High priority section
- ⚠️ `references STRIPE_SECRET_KEY!` in `src/services/stripe/checkout.ts:3` — guard upgraded to lazy getter, but callers must `try/catch`
