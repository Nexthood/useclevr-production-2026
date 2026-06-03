# Payload Migration Plan

This file is the consolidated AI prompt and task plan for future Payload CMS integration. The current app stays the source of truth until this plan moves into `.TODO/todo-next.md`.

## Current Implementation

- Public pages live in `src/app/`: homepage, pricing, FAQ, contact, legal pages, signup, login, affiliate, reports, and checkout success.
- Dashboard pages live under `src/app/app/`; keep `/app` as the product workspace route.
- Super-admin tools live under `/app/admin`; keep existing super-admin pages separate from CMS administration.
- FAQ content lives in `src/lib/content/faq.ts` and dashboard/operator FAQ content lives in `src/lib/content/dashboard-faq.ts`.
- Product pricing and billing plan data live in application code and Stripe remains the payment source of truth.
- PostgreSQL tables currently include users, auth accounts, sessions, profiles, businesses, business entities, country tax profiles, datasets, dataset rows, user activities, waitlist, workspaces, workspace members, workspace invitations, support tickets, referral stats, referral events, AI interaction traces, and app settings.
- Railway deployment uses generated output on the `dist` branch under `/dist`; Payload integration must preserve the generated deployment shape.

## Migration Boundary

- Do not move the dashboard from `/app`.
- Do not rename the existing `/app/admin` super-admin area.
- Do not replace Stripe billing, webhook processing, checkout, subscriptions, referrals, datasets, reports, uploads, AI traces, tickets, workspaces, auth, or business records with Payload collections.
- Do not store CMS media on Railway disk.
- Do not change public UI copy or routes during the infrastructure setup step unless a content collection is already wired to that page.
- Add Payload only as a CMS layer for editable public and sales content.

## Target Shape

- Public site stays at `/`.
- Dashboard stays at `/app`.
- Super-admin app tools stay at `/app/admin`.
- Payload CMS admin uses a distinct route such as `/cms` or `/payload-admin`.
- Payload API uses a distinct route such as `/api/payload`.
- Payload uses the existing PostgreSQL environment only after schema ownership and migration strategy are confirmed.
- CMS media uses durable object storage, not Railway filesystem storage.

## Collection Candidates

- Public FAQ categories and items.
- Dashboard FAQ categories and items, with scope values for public, dashboard, and operator content.
- Homepage sections and calls to action.
- Pricing page copy that reads plan values from the existing billing config instead of duplicating prices.
- Legal page content for Terms, Privacy, and Security.
- Changelog display entries if the product later needs editable public release notes.
- Sales one-pager sections and presentation source content.
- Blog or resource posts if marketing content becomes active.

## AI Migration Prompt

Use this prompt when activating Payload migration work:

```text
Integrate Payload CMS into the current UseClevr Next.js app as an editable content layer only.

Preserve current routes:
- `/` remains the public homepage.
- `/app` remains the dashboard workspace.
- `/app/admin` remains the super-admin product area.

Add Payload under a distinct CMS route such as `/cms` or `/payload-admin`, with API routes under `/api/payload`.

Do not replace existing application data models. Keep auth, profiles, businesses, datasets, dataset rows, tickets, referrals, billing, Stripe webhooks, AI interaction traces, workspaces, reports, uploads, and app settings in the current Drizzle/PostgreSQL application layer.

Migrate only editable content first:
- public FAQ
- dashboard/operator FAQ
- homepage sections
- legal pages
- sales one-pager/source content
- optional blog/resource posts

Keep Stripe as the payment source of truth. Payload may display billing-related copy but must not own prices, checkout state, subscriptions, webhook events, invoices, or customer payment records.

Keep Railway generated-output deployment working from the `dist` branch `/dist` root. Do not introduce runtime filesystem storage for CMS media. Use durable object storage for uploads if media support is enabled.

Implement in small phases:
1. Add dependencies and configuration.
2. Add CMS route and API route.
3. Add content collections without changing public pages.
4. Add read adapters with fallback to existing static content.
5. Switch one content surface at a time.
6. Document env vars, access rules, deployment behavior, and rollback steps.

Validate with TypeScript, dist config checks, linting, production packaging, and route smoke checks.
```

## Precise Tasks

1. Confirm compatible Payload packages for Next.js 16, React 19, TypeScript 6, and the current PostgreSQL runtime.
2. Add Payload dependencies only after package compatibility is confirmed.
3. Add `PAYLOAD_SECRET`, public server URL, database, and media-storage environment requirements to documentation without committing secrets.
4. Create a Payload config in a dedicated source folder and keep it separate from existing Drizzle schema ownership.
5. Add CMS admin and API routes under paths that do not conflict with `/app/admin`.
6. Add collection definitions for FAQ, homepage sections, legal pages, sales content, and optional posts.
7. Add content adapters that return Payload content when available and fall back to existing static content files.
8. Connect public FAQ to the adapter first, then dashboard FAQ, then homepage/legal/sales pages.
9. Keep billing copy synced with existing billing config instead of storing duplicate plan prices in Payload.
10. Add super-admin or CMS-specific access rules for the CMS route.
11. Add object-storage configuration before enabling CMS media uploads.
12. Run `pnpm validate:types`, `pnpm validate:dist`, `pnpm lint`, and `pnpm prod:build`.
13. Document rollback by disabling CMS adapters and falling back to static content files.

## Acceptance Criteria

- Homepage, `/app`, `/app/admin`, checkout, uploads, reports, AI Assistant, and support tickets continue to work.
- CMS admin opens on its own route.
- Payload API uses its own route namespace.
- Public FAQ can read CMS content with static fallback.
- Dashboard/operator FAQ keeps role-aware scoping.
- Stripe remains the billing source of truth.
- Railway production packaging still creates deployable `dist/` output.
- No secrets or CMS media files are committed.
