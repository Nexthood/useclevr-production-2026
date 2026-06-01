# Active TODO Queue

This file is the only active queue. Add confirmed implementation work here before it starts.

Get the T-number from `.TODO/config.json` before adding new tasks. Keep task numbers stable when
moving work between states.

## Links

- [TODO-next.md](todo-next.md)
- [TODO-done.md](todo-done.md)
- [TODO-ignore.md](todo-ignore.md)
- [TODO-future.md](todo-future.md)
- [.TODO/config.json](config.json)

## Active

*No active tasks — suggestions below are pending review.*

## Suggestions

### Structure

- T-417. Consolidate `ci-beta.yml` into `ci.yml` since `ci.yml` now triggers on both `main` and `beta` — removes one workflow file and prevents duplicate CI runs on beta pushes.
  - Links: [ci.yml](/.github/workflows/ci.yml), [ci-beta.yml](/.github/workflows/ci-beta.yml), [check-github-workflows.js](/scripts/check-github-workflows.js)

- T-418. Replace barrel re-export files (`src/lib/utils/index.ts`, `src/lib/auth/index.ts`) with direct imports across all consuming modules to reduce module resolution overhead and prevent circular dependency risks.
  - Links: [src/lib/utils/index.ts](/src/lib/utils/index.ts), [src/lib/auth/index.ts](/src/lib/auth/index.ts)

### Infrastructure

- T-419. Add deployment manifest generation to `create-dist.cjs` that records source commit SHA, build timestamp, Node version, pnpm version, and healthcheck path into `dist/deployment-manifest.json`.
  - Links: [scripts/package-dist/create-dist.cjs](/scripts/package-dist/create-dist.cjs)

- T-420. Add Neon WebSocket connection pooling by configuring `@neondatabase/serverless` with the `ws` endpoint (pooler) and fallback logic for direct connections, reducing cold-start latency and connection overhead.
  - Links: [src/lib/db/index.ts](/src/lib/db/index.ts), [.env.railway.example](/.env.railway.example)

- T-421. Extract duplicated CI job steps into a shared reusable workflow (e.g., `.github/workflows/validate.yml`) called by `ci.yml`, `ci-beta.yml`, `beta-maintenance.yml`, and `branch-maintenance.yml` to keep build config in one place.
  - Links: [.github/workflows/ci.yml](/.github/workflows/ci.yml), [.github/workflows/beta-maintenance.yml](/.github/workflows/beta-maintenance.yml), [.github/workflows/branch-maintenance.yml](/.github/workflows/branch-maintenance.yml)

### Stripe

- T-422. Replace the checkout URL proof (bare `checkoutSessionId` in URL) with a server-issued one-time token that expires after first use, preventing session replay and unauthorized access to checkout confirmations.
  - Links: [src/app/actions/stripe.ts](/src/app/actions/stripe.ts), [src/app/api/webhooks/stripe/route.ts](/src/app/api/webhooks/stripe/route.ts)

- T-423. Add a webhook event replay action in the admin billing-settings panel that re-fires missed Stripe events (checkout, subscription update) for manual reconciliation after billing downtime.
  - Links: [src/services/stripe/webhook.ts](/src/services/stripe/webhook.ts), [src/components/billing/billing-settings-form.tsx](/src/components/billing/billing-settings-form.tsx)

### AI Suggestions

- T-424. Add per-user personalized suggestion generation that weights suggestions by the user's dataset history, common query intent patterns, and recently viewed analyses — stored per-user instead of the current global `suggestions_global` key.
  - Links: [src/app/api/suggestions/generate/route.ts](/src/app/api/suggestions/generate/route.ts), [src/lib/data/dataset-intelligence.ts](/src/lib/data/dataset-intelligence.ts)

- T-425. Add a suggestion refresh trigger that re-generates dataset suggestions when new data is uploaded to an existing dataset, so the assistant sidebar always reflects the latest available rows and columns.
  - Links: [src/app/actions/upload.ts](/src/app/actions/upload.ts), [src/app/api/datasets/[id]/suggestions/route.ts](/src/app/api/datasets/[id]/suggestions/route.ts)

### Search API

- T-426. Add full-text search across dataset row content (the `datasetRows` table) so users can search for specific values within their uploaded datasets from the global search popup, with configurable limits on rows scanned per dataset.
  - Links: [src/lib/search/app-search.ts](/src/lib/search/app-search.ts), [src/app/api/search/route.ts](/src/app/api/search/route.ts), [src/components/ui/search-popup.tsx](/src/components/ui/search-popup.tsx)

- T-427. Add a type-ahead/autocomplete search endpoint (`/api/search/suggest`) that returns quick results as the user types, and add result-type filters (pages, datasets, reports, FAQ, data) in the search popup sidebar.
  - Links: [src/app/api/search/route.ts](/src/app/api/search/route.ts), [src/components/ui/search-popup.tsx](/src/components/ui/search-popup.tsx)

### Chat

- T-428. Add streaming responses to the `/api/chat` endpoint using `ReadableStream` and `TextEncoder` so the chat UI displays partial answers incrementally instead of waiting for the full response, with an abort signal for cancellation.
  - Links: [src/app/api/chat/route.ts](/src/app/api/chat/route.ts), [src/lib/ai/ai-router.ts](/src/lib/ai/ai-router.ts)

- T-429. Split the 906-line chat route (`src/app/api/chat/route.ts`) into focused modules: validation, SQL execution, explanation generation, and fallback chat — reducing per-file complexity and making each step testable in isolation.
  - Links: [src/app/api/chat/route.ts](/src/app/api/chat/route.ts), [src/lib/queryEngine.ts](/src/lib/queryEngine.ts)

### MCP

- T-430. Add a dedicated `/api/mcp/` endpoint that exposes all MCP tools via REST — listing tools, invoking tools by name, and reading resources — so the frontend or external MCP clients can interact with MCP without going through the analyze route.
  - Links: [src/lib/mcp/server.ts](/src/lib/mcp/server.ts), [src/lib/mcp/tools.ts](/src/lib/mcp/tools.ts), [src/app/api/analyze/route.ts](/src/app/api/analyze/route.ts)

- T-431. Add an MCP tool for cross-dataset comparison that accepts two dataset IDs and a column pair, returning shared statistics, difference metrics, and anomaly detection — bridging the gap between single-dataset analysis and multi-dataset business intelligence.
  - Links: [src/lib/mcp/tools.ts](/src/lib/mcp/tools.ts), [src/lib/mcp/handlers.ts](/src/lib/mcp/handlers.ts), [mcp/tools/getDatasetSummary.ts](/mcp/tools/getDatasetSummary.ts)


