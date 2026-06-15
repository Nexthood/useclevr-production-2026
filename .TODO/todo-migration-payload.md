# Payload Migration Plan

This file defines the current Payload ownership boundary and the migration rules for content and
operator-admin work.

## Phase 0

Phase 0 uses Payload for public content administration without replacing product data ownership.

- Phase 0 adds the smallest CMS footprint needed to create, edit, publish, and unpublish news
  entries.
- Phase 0 manages News, FAQ, homepage sections, Privacy, and Terms content.
- Phase 0 keeps auth, billing, Stripe, datasets, reports, uploads, AI traces, business records, and
  app settings outside Payload.

## Product Operations Extension

Payload also supplies superadmin-only product operations.

- Business profile operations read and write the existing application business tables.
- The Payload Issues collection owns support records used by both operators and dashboard ticket
  routes.
- Administrator CSV uploads write the existing dataset and dataset-row tables for an explicitly
  selected dashboard owner.
- AI Assistant access opens the dashboard session so dataset ownership and trace attribution remain
  enforced.
- Hybrid AI uses the existing shared modal workflow.

## Current Implementation

- Public pages live in `src/app/`: homepage, pricing, FAQ, contact, legal pages, signup, login, affiliate, reports, and checkout success.
- Dashboard pages live under `src/app/app/`; keep `/app` as the product workspace route.
- Existing application super-admin tools stay under `/app/admin`.
- Payload product operations use `/admin/business-profiles`, `/admin/support-issues`, and
  `/admin/dataset-upload`.
- Payload stores News, FAQ, homepage, Privacy, Terms, Media, and Payload MCP API keys.
- Payload product-operation views access business and dataset records through superadmin-only custom
  endpoints. Support issue review uses the native Payload Issues collection.
- `/api/payload/mcp` exposes Payload-native News, FAQ, and locked demo-account dataset read tools.
- Product pricing and billing plan data live in application code and Stripe remains the payment source of truth.
- PostgreSQL tables currently include users, auth accounts, sessions, profiles, businesses, business
  entities, country tax profiles, datasets, dataset rows, user activities, waitlist, workspaces,
  workspace members, workspace invitations, Payload support issues, legacy support tickets,
  referral stats, referral events, AI interaction traces, and app settings.
- Railway deployment uses generated output on the `dist` branch under `/dist`; Payload integration must preserve the generated deployment shape.

## Migration Boundary

- Do not move the dashboard from `/app`.
- Do not rename the existing `/app/admin` super-admin area.
- Do not replace Stripe billing, webhook processing, checkout, subscriptions, referrals, datasets,
  reports, uploads, AI traces, workspaces, auth, or business records with Payload collections.
- Do not store CMS media on Railway disk.
- Do not change public UI copy or routes during the infrastructure setup step unless a content collection is already wired to that page.
- Keep Payload collection ownership limited to editable public content, its media, support issues,
  CMS users, and Payload MCP keys.
- Allow Payload custom operator views to manage approved application records through explicit
  superadmin-only endpoints.
- Keep business, dataset, billing, authentication, workspace, and AI trace records outside Payload.

## Target Shape

- Public site stays at `/`.
- Dashboard stays at `/app`.
- Super-admin app tools stay at `/app/admin`.
- Payload CMS admin uses `/admin`.
- Payload product operations use custom views under `/admin`.
- Payload API uses `/api/payload`.
- Payload MCP uses `/api/payload/mcp`.
- Payload uses the existing PostgreSQL environment through explicit migrations.
- CMS media uses configured S3-compatible storage, and mutations stay disabled without durable storage.

## Current Collections

- News posts.
- FAQ entries.
- Media for News cover images.
- Support issues.
- CMS users and Payload MCP API keys.

## Later Collection Candidates

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

### Current Infrastructure

- Keep `@payloadcms/storage-s3` configured for AWS S3 or Cloudflare R2.
- Keep `@payloadcms/plugin-mcp` limited to News and FAQ tools.
- Create separate Payload MCP API keys for clients that require content access.

### Evaluate After Core Migration

- Evaluate `@payloadcms/plugin-search` for CMS-owned news, FAQ, and page search only after those
  collections are stable. Keep the existing application and Meilisearch planning boundaries
  separate until one search owner is approved.
- Evaluate `@payloadcms/plugin-form-builder` only for public marketing or lead forms. Keep support
  issues in the native Issues collection and keep authenticated business forms in the application
  layer.
- Evaluate `@payloadcms/plugin-nested-docs` only if public pages require editor-managed hierarchy
  and breadcrumbs.

### Do Not Add During This Migration

- Do not add the ecommerce plugin; Stripe and the existing billing layer remain the payment source
  of truth.
- Do not add the multi-tenant plugin; existing workspace and business ownership remain in the
  application schema.
- Do not expose product datasets through a separate dashboard MCP connector; Payload MCP owns the documented MCP surface and scopes locked demo-account reads.

## AI Migration Prompt

Use this prompt when activating Payload migration work:

```text
Integrate Payload CMS into the current UseClevr Next.js app as an editable content and operator
administration layer.

Preserve current routes:
- `/` remains the public homepage.
- `/app` remains the dashboard workspace.
- `/app/admin` remains the super-admin product area.

Keep Payload admin at `/admin`, Payload REST at `/api/payload`, and Payload MCP at
`/api/payload/mcp`.

Do not replace existing application data models. Keep auth, profiles, businesses, datasets, dataset
rows, referrals, billing, Stripe webhooks, AI interaction traces, workspaces, reports, uploads, and
app settings in the current Drizzle/PostgreSQL application layer.

Payload owns News, FAQ, homepage, Privacy, Terms, Media, support issues, CMS users, and Payload MCP
API keys.

Payload may provide superadmin-only custom views for business profiles and owner-assigned dataset
uploads. Keep business and dataset records in the current Drizzle/PostgreSQL application tables,
use the native Payload Issues collection for support, and require an explicit dashboard owner for
cross-user writes.

Keep Stripe as the payment source of truth. Payload may display billing-related copy but must not own prices, checkout state, subscriptions, webhook events, invoices, or customer payment records.

Keep Railway generated-output deployment working from the `dist` branch `/dist` root. Store CMS
media through configured S3-compatible storage and reject media mutations without durable storage.
Keep Payload News, FAQ, and locked demo-account dataset read tools on `/api/payload/mcp`; do not document a separate dashboard MCP connector.

Implement in small phases:
1. Confirm the requested content belongs in Payload.
2. Add or update the smallest matching collection or global.
3. Generate and review a PostgreSQL migration.
4. Keep public route behavior stable while switching the content adapter.
5. Update Payload MCP permissions only when the content requires agent access.
6. Verify durable media storage, access rules, deployment behavior, and rollback steps.
7. Verify base CMS users cannot see or load product-operation data.

Validate with TypeScript, dist config checks, linting, production packaging, and route smoke checks.
```

## AI Planning Prompts

Use these focused prompts during migration planning and implementation reviews:

1. Review the requested content against the current Payload ownership boundary.
2. Confirm package compatibility with Next.js, React, TypeScript, pnpm, and PostgreSQL before updating Payload packages.
3. Keep News cover media in the Media collection through the configured S3-compatible adapter.
4. Keep `/admin`, `/api/payload`, and `/api/payload/mcp` separate from `/app/admin`.
5. Preserve Stripe as the billing source of truth and keep plan prices in the current billing configuration.
6. Verify Railway generated-output packaging and Vercel source deployment after every schema or plugin change.
7. Document environment variables, access rules, media storage, rollback steps, and trace-safe AI guidance.

## Precise Tasks

1. Keep every Payload package on the same release.
2. Keep `PAYLOAD_SECRET`, public server URL, database, and media-storage requirements documented without secrets.
3. Keep Payload migrations separate from the Drizzle application schema.
4. Require CMS superadmin access for News, FAQ, and Media mutations.
5. Grant Payload MCP API keys only the News or FAQ tools required by the client.
6. Keep billing, business data, datasets, app auth, workspaces, and AI traces outside Payload
   collections while approved custom views operate on the existing stores.
7. Run `pnpm payload:types`, `pnpm payload:migrate:status`, `pnpm validate:types`,
   `pnpm validate:dist`, and `pnpm lint` after Payload schema changes.
8. Keep the prompt-library entry aligned with this ownership boundary.

## Acceptance Criteria

- Homepage, `/app`, `/app/admin`, checkout, uploads, reports, AI Assistant, and support tickets continue to work.
- CMS admin opens at `/admin`.
- Payload superadmins can manage business profiles, support issues, and owner-assigned CSV uploads.
- Dashboard ticket routes create, list, and update the same Payload support issues shown to
  operators.
- Base CMS users cannot see or load Payload product operations.
- Payload REST and MCP use `/api/payload` and `/api/payload/mcp`.
- News, FAQ, homepage, Privacy, and Terms read Payload-managed content.
- News cover media uses durable S3-compatible storage.
- Payload MCP API keys expose approved News, FAQ, and locked demo-account read tools.
- Stripe remains the billing source of truth.
- Railway production packaging still creates deployable `dist/` output.
- No secrets or CMS media files are committed.
- Business, dataset, billing, authentication, workspace, AI trace, and sales records stay outside
  Payload collections.
