# Payload Migration Plan

This file is the consolidated AI prompt and task plan for future Payload CMS integration. The
current app stays the source of truth until this plan moves into `.TODO/todo-next.md`.

## Phase 0

Phase 0 uses Payload for news only.

- Phase 0 adds the smallest CMS footprint needed to create, edit, publish, and unpublish news
  entries.
- Phase 0 keeps FAQ, homepage sections, legal pages, sales content, dashboard content, and pricing
  copy outside Payload.
- Phase 0 keeps auth, billing, Stripe, datasets, reports, uploads, AI traces, tickets, business
  records, and app settings outside Payload.

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
- Add Payload only as a CMS layer for editable news content in Phase 0.
- Keep all other CMS candidates out of scope until a later approved phase.

## Target Shape

- Public site stays at `/`.
- Dashboard stays at `/app`.
- Super-admin app tools stay at `/app/admin`.
- Payload CMS admin uses a distinct route such as `/cms` or `/payload-admin`.
- Payload API uses a distinct route such as `/api/payload`.
- Payload uses the existing PostgreSQL environment only after schema ownership and migration strategy are confirmed.
- CMS media uses durable object storage, not Railway filesystem storage.

## Phase 0 Collection Candidate

- News posts only.

## Later Collection Candidates

- Public FAQ categories and items, mapped from `src/lib/content/faq.ts`.
- Dashboard FAQ categories and items with scope values for public, dashboard, and operator content, mapped from `src/lib/content/dashboard-faq.ts`.
- Homepage sections and calls to action, mapped from `src/app/page.tsx` hero content.
- Pricing page copy that reads plan values from the existing billing config instead of duplicating prices.
- Legal page content for Terms, Privacy, and Security from existing pages.
- Changelog display entries if the product later needs editable public release notes.
- Sales one-pager sections and presentation source content.
- Blog or resource posts if marketing content becomes active.

## Plugin Recommendations

Use first-party Payload plugins only after the collection that needs the plugin enters the active
migration phase. Pin every Payload package to the same version as `payload`.

### Add During Content Migration

- Add `@payloadcms/plugin-import-export` when an approved collection needs repeatable CSV or JSON
  transfer. Restrict import and export access to superadmins, test an export before each import, and
  use stable match fields such as `slug` instead of database IDs.
- Add `@payloadcms/plugin-seo` when news and public pages own editable metadata. Keep application
  defaults as fallback values until every migrated document has validated title and description.
- Add `@payloadcms/plugin-redirects` before changing any public content slug or route. Resolve
  redirects in the Next.js request path and preserve existing URLs during migration.

### Add When Media Enters Scope

- Add one official storage adapter, preferably `@payloadcms/storage-s3` for S3-compatible durable
  storage, before enabling a media collection. Keep Railway filesystem storage disabled.

### Evaluate After Core Migration

- Evaluate `@payloadcms/plugin-search` for CMS-owned news, FAQ, and page search only after those
  collections are stable. Keep the existing application and Meilisearch planning boundaries
  separate until one search owner is approved.
- Evaluate `@payloadcms/plugin-form-builder` only for public marketing or lead forms. Keep support
  tickets, business workflows, and authenticated product forms in the application layer.
- Evaluate `@payloadcms/plugin-nested-docs` only if public pages require editor-managed hierarchy
  and breadcrumbs.

### Do Not Add During This Migration

- Do not add the ecommerce plugin; Stripe and the existing billing layer remain the payment source
  of truth.
- Do not add the multi-tenant plugin; existing workspace and business ownership remain in the
  application schema.
- Do not add the Payload MCP plugin; UseClevr keeps its existing scoped MCP service and audit model.

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

Phase 0 migrates only one editable content surface:
- news posts

Keep Stripe as the payment source of truth. Payload may display billing-related copy but must not own prices, checkout state, subscriptions, webhook events, invoices, or customer payment records.

Keep Railway generated-output deployment working from the `dist` branch `/dist` root. Do not introduce runtime filesystem storage for CMS media. Use durable object storage for uploads if media support is enabled.

Implement in small phases:
1. Add dependencies and configuration.
2. Add CMS route and API route.
3. Add the news collection without changing other public pages.
4. Add a read adapter with fallback for news content only.
5. Switch the news surface only.
6. Document env vars, access rules, deployment behavior, and rollback steps.

Validate with TypeScript, dist config checks, linting, production packaging, and route smoke checks.
```

## AI Planning Prompts

Use these focused prompts during migration planning and implementation reviews:

1. Analyze the current news surface and list only content suitable for Phase 0 CMS ownership.
2. Confirm package compatibility with Next.js 16, React 19, TypeScript 6, current pnpm, and PostgreSQL before adding dependencies.
3. Design a minimal Payload news collection for title, slug, summary, body, publish state, publish date, and cover media only if storage is approved.
4. Design the CMS admin route and API namespace without conflicting with `/app/admin`.
5. Add a read adapter that prefers CMS news content and falls back to the current news source.
6. Preserve Stripe as the billing source of truth and keep plan prices in the current billing configuration.
7. Verify Railway generated-output packaging and Vercel source deployment after every CMS wiring phase.
8. Document environment variables, access rules, media storage, rollback steps, and trace-safe AI guidance.

## Precise Tasks

1. Confirm compatible Payload packages for Next.js 16, React 19, TypeScript 6, and the current PostgreSQL runtime.
2. Add Payload dependencies only after package compatibility is confirmed.
3. Add `PAYLOAD_SECRET`, public server URL, database, and media-storage environment requirements to documentation without committing secrets.
4. Create a Payload config in a dedicated source folder and keep it separate from existing Drizzle schema ownership.
5. Add CMS admin and API routes under paths that do not conflict with `/app/admin`.
6. Add a collection definition for news posts only.
7. Add a content adapter that returns Payload news content when available and falls back to the existing news source.
8. Connect the public news surface only.
9. Keep billing copy synced with existing billing config instead of storing duplicate plan prices in Payload.
10. Add super-admin or CMS-specific access rules for the CMS route.
11. Add object-storage configuration only before enabling news media uploads.
12. Run `pnpm validate:types`, `pnpm validate:dist`, `pnpm lint`, and `pnpm prod:build`.
13. Document rollback by disabling the news adapter and falling back to the current news source.
14. Keep the prompt-library entry aligned with this plan so future AI sessions use the same boundaries.

## Acceptance Criteria

- Homepage, `/app`, `/app/admin`, checkout, uploads, reports, AI Assistant, and support tickets continue to work.
- CMS admin opens on its own route.
- Payload API uses its own route namespace.
- News can read CMS content with fallback to the current news source.
- Stripe remains the billing source of truth.
- Railway production packaging still creates deployable `dist/` output.
- No secrets or CMS media files are committed.
- FAQ, homepage sections, legal pages, dashboard content, and sales content stay outside Phase 0.
