# Project Structure Audit

## Current Assessment

The project has a solid Next.js App Router foundation with clear top-level ownership:

- `app/` handles pages, layouts, API routes, and server actions.
- `components/` contains reusable UI and feature components.
- `lib/` contains business logic, data processing, AI adapters, storage, and utilities.
- `docs/` contains deployment, architecture, and project notes.

The current deployment direction is Railway + Nixpacks + pnpm. Stripe is not an active project dependency.

## Recommended Priorities

### 1. Service Layer Extraction

Create a service layer for orchestration-heavy logic before moving files broadly.

Suggested first targets:

- `lib/services/reportService.ts`
- `lib/services/analyticsService.ts`
- `lib/services/aiService.ts`
- `lib/services/datasetService.ts`

API routes should stay thin: validate input, call a service, return a response.

### 2. Component Organization

Move toward feature grouping as files are touched:

- `components/ui/` for primitives.
- `components/layout/` for shell, header, footer, sidebar.
- `components/features/datasets/`
- `components/features/upload/`
- `components/features/reports/`
- `components/features/local-ai/`

Avoid a large one-shot move unless imports are covered by tests.

### 3. Configuration Centralization

Add `lib/config/` for runtime configuration:

- `lib/config/index.ts`
- `lib/config/schema.ts`
- `lib/config/server.ts`
- `lib/config/public.ts`

Use Zod validation for required server envs. Frontend code should avoid direct `process.env` access except for explicitly public values.

### 4. API Route Standardization

Do not move all existing routes into `/api/v1` immediately. Instead:

- Keep existing routes stable for the frontend.
- Add versioned routes for new public API contracts.
- Gradually move repeated response/error handling into shared helpers.

### 5. Testing Baseline

Add tests after the service boundary exists:

- Unit tests for pure analytics and formatting.
- Integration tests for high-value API routes.
- A small Playwright smoke test for upload, analyze, and report flows.

Do not enable a strict type-check script until current strict-mode issues are fixed.

## Deployment Notes

- Keep Railway commands aligned with `package.json`.
- `pnpm start` must bind to `0.0.0.0` and Railway `$PORT`.
- `/api/health` should remain fast and dependency-light.
- Runtime file output should stay in ignored paths or `/tmp`.

## Anti-Patterns To Avoid

- Business logic inside components or API handlers.
- Hardcoded frontend origins or ports.
- Direct browser calls to local services when a same-origin Next API proxy exists.
- Letting `lib/` become a catch-all without service/config/client boundaries.
- Large folder moves without tests or incremental verification.
