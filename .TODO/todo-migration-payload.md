# Payload Migration Plan

This file defines the current Payload ownership boundary and the migration rules for later content
work.

## Phase 0

Phase 0 uses Payload for public content administration without replacing product data ownership.

- Phase 0 adds the smallest CMS footprint needed to create, edit, publish, and unpublish news
  entries.
- Phase 0 manages News, FAQ, homepage sections, Privacy, and Terms content.
- Phase 0 keeps auth, billing, Stripe, datasets, reports, uploads, AI traces, tickets, business
  records, and app settings outside Payload.

## Current Implementation

- Public pages live in `src/app/`: homepage, pricing, FAQ, contact, legal pages, signup, login, affiliate, reports, and checkout success.
- Dashboard pages live under `src/app/app/`; keep `/app` as the product workspace route.
- Super-admin tools live under `/app/admin`; keep existing super-admin pages separate from CMS administration.
- Payload stores News, FAQ, homepage, Privacy, Terms, Media, and Payload MCP API keys.
- `/api/payload/mcp` exposes Payload-native News and FAQ tools.
- `/api/mcp` exposes UseClevr dataset and analysis tools only.
- Product pricing and billing plan data live in application code and Stripe remains the payment source of truth.
- PostgreSQL tables currently include users, auth accounts, sessions, profiles, businesses, business entities, country tax profiles, datasets, dataset rows, user activities, waitlist, workspaces, workspace members, workspace invitations, support tickets, referral stats, referral events, AI interaction traces, and app settings.
- Railway deployment uses generated output on the `dist` branch under `/dist`; Payload integration must preserve the generated deployment shape.

## Migration Boundary

- Do not move the dashboard from `/app`.
- Do not rename the existing `/app/admin` super-admin area.
- Do not replace Stripe billing, webhook processing, checkout, subscriptions, referrals, datasets, reports, uploads, AI traces, tickets, workspaces, auth, or business records with Payload collections.
- Do not store CMS media on Railway disk.
- Do not change public UI copy or routes during the infrastructure setup step unless a content collection is already wired to that page.
- Keep Payload limited to editable public content and its media.
- Keep product and operational records outside Payload.

## Target Shape

- Public site stays at `/`.
- Dashboard stays at `/app`.
- Super-admin app tools stay at `/app/admin`.
- Payload CMS admin uses `/admin`.
- Payload API uses `/api/payload`.
- Payload MCP uses `/api/payload/mcp`.
- Payload uses the existing PostgreSQL environment through explicit migrations.
- CMS media uses configured S3-compatible storage, and mutations stay disabled without durable storage.

## Current Collections

- News posts.
- FAQ entries.
- Media for News cover images.
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
  tickets, business workflows, and authenticated product forms in the application layer.
- Evaluate `@payloadcms/plugin-nested-docs` only if public pages require editor-managed hierarchy
  and breadcrumbs.

### Do Not Add During This Migration

- Do not add the ecommerce plugin; Stripe and the existing billing layer remain the payment source
  of truth.
- Do not add the multi-tenant plugin; existing workspace and business ownership remain in the
  application schema.
- Do not expose product datasets through Payload MCP; UseClevr keeps dataset ownership, scopes,
  auditing, and rate limits in `/api/mcp`.

## AI Migration Prompt

Use this prompt when activating Payload migration work:

```text
Integrate Payload CMS into the current UseClevr Next.js app as an editable content layer only.

Preserve current routes:
- `/` remains the public homepage.
- `/app` remains the dashboard workspace.
- `/app/admin` remains the super-admin product area.

Keep Payload admin at `/admin`, Payload REST at `/api/payload`, and Payload MCP at
`/api/payload/mcp`.

Do not replace existing application data models. Keep auth, profiles, businesses, datasets, dataset rows, tickets, referrals, billing, Stripe webhooks, AI interaction traces, workspaces, reports, uploads, and app settings in the current Drizzle/PostgreSQL application layer.

Payload owns News, FAQ, homepage, Privacy, Terms, Media, CMS users, and Payload MCP API keys.

Keep Stripe as the payment source of truth. Payload may display billing-related copy but must not own prices, checkout state, subscriptions, webhook events, invoices, or customer payment records.

Keep Railway generated-output deployment working from the `dist` branch `/dist` root. Store CMS
media through configured S3-compatible storage and reject media mutations without durable storage.
Keep Payload News and FAQ tools on `/api/payload/mcp`; keep UseClevr dataset tools on `/api/mcp`.

Implement in small phases:
1. Confirm the requested content belongs in Payload.
2. Add or update the smallest matching collection or global.
3. Generate and review a PostgreSQL migration.
4. Keep public route behavior stable while switching the content adapter.
5. Update Payload MCP permissions only when the content requires agent access.
6. Verify durable media storage, access rules, deployment behavior, and rollback steps.

Validate with TypeScript, dist config checks, linting, production packaging, and route smoke checks.
```

## AI Planning Prompts

Use these focused prompts during migration planning and implementation reviews:

1. Review the requested content against the current Payload ownership boundary.
2. Confirm package compatibility with Next.js, React, TypeScript, pnpm, and PostgreSQL before updating Payload packages.
3. Keep News cover media in the Media collection through the configured S3-compatible adapter.
4. Keep `/admin`, `/api/payload`, and `/api/payload/mcp` separate from `/app/admin` and `/api/mcp`.
5. Preserve Stripe as the billing source of truth and keep plan prices in the current billing configuration.
6. Verify Railway generated-output packaging and Vercel source deployment after every schema or plugin change.
7. Document environment variables, access rules, media storage, rollback steps, and trace-safe AI guidance.

## Precise Tasks

1. Keep every Payload package on the same release.
2. Keep `PAYLOAD_SECRET`, public server URL, database, and media-storage requirements documented without secrets.
3. Keep Payload migrations separate from the Drizzle application schema.
4. Require CMS superadmin access for News, FAQ, and Media mutations.
5. Grant Payload MCP API keys only the News or FAQ tools required by the client.
6. Keep billing, product data, datasets, app auth, and operational records outside Payload.
7. Run `pnpm payload:types`, `pnpm payload:migrate:status`, `pnpm validate:types`,
   `pnpm validate:dist`, and `pnpm lint` after Payload schema changes.
8. Keep the prompt-library entry aligned with this ownership boundary.

## Acceptance Criteria

- Homepage, `/app`, `/app/admin`, checkout, uploads, reports, AI Assistant, and support tickets continue to work.
- CMS admin opens at `/admin`.
- Payload REST and MCP use `/api/payload` and `/api/payload/mcp`.
- News, FAQ, homepage, Privacy, and Terms read Payload-managed content.
- News cover media uses durable S3-compatible storage.
- Payload MCP API keys expose only approved News and FAQ tools.
- UseClevr MCP exposes dataset and analysis tools without Payload content tools.
- Stripe remains the billing source of truth.
- Railway production packaging still creates deployable `dist/` output.
- No secrets or CMS media files are committed.
- Dashboard content, product data, billing data, and sales content stay outside Payload.
