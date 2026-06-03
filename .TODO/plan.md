# Monorepo Migration Plan

This plan adapts the requested monorepo prompt to the current UseClevr repository and keeps the existing Railway deployment flow intact.

## Current Fit

- The repository is currently a single Next.js app rooted at the project root.
- The existing deployment path is built around the generated `dist` and `dist-test` branches.
- The current package manager is `pnpm` and the workspace config is minimal.
- The safest path is a small, staged migration rather than a large architectural rewrite.

## Recommended Scope

Keep the existing SaaS dashboard app as the primary web app and add a separate documentation app under `apps/docs`.

Use this minimal structure:

```text
/apps
  /web
  /docs
/packages
  /ui
/config
```

Only add shared packages or config if they are genuinely needed after the first pass.

## Adjusted Implementation Prompt

Use this prompt as the working implementation brief:

```text
Implement the smallest safe monorepo split for UseClevr.

Goals:
- Keep the current SaaS dashboard app working.
- Add a separate docs app for public documentation.
- Use Fumadocs built-in search only.
- Do not introduce Meilisearch, Typesense, Algolia, or other external search now.
- Preserve the existing Railway dist / dist-test deployment flow.
- Avoid unnecessary architecture churn.

Constraints:
- Keep the current root app as the main dashboard path.
- Add apps/web and apps/docs only when the migration is stable.
- Do not mix the dashboard build with the docs build.
- Keep deployment roots explicit for Railway.
- Prefer practical scripts and minimal config over enterprise structure.

Expected outcome:
- Root scripts support local dev/build for web and docs.
- Railway can deploy each service from its own service root.
- The docs app is ready for future external search only if it becomes necessary later.
```

## Minimal Safe Migration Path

1. Keep the existing root app as the current source of truth for the dashboard during the first pass.
2. Add the smallest possible `apps/` layout only after the current root build and Railway deploy path are verified.
3. Create `apps/docs` first as a separate Fumadocs app with built-in search, without touching the existing dashboard runtime.
4. Treat `apps/web` as the future dashboard path only after the docs app and root scripts are stable.
5. Add root scripts only for commands that are actually supported by the current package manager and repo layout.
6. Do not change the generated `dist` / `dist-test` publish flow during the migration until the new layout is verified.

## Practical Delivery Steps

### Phase 1: Repo and config audit

- Confirm the current Next.js config and deployment scripts.
- Confirm the current Railway config and generated output path.
- Keep the current root app in place for the first pass unless a small, verified move is clearly safe.
- Record the exact current service-root assumptions before any Railway change.

### Phase 2: Web app path

- Create or adapt `apps/web` as the dashboard app.
- Keep Payload CMS integration and current dashboard functionality in this path.
- Preserve the existing Railway web deployment settings.

### Phase 3: Docs app path

- Create `apps/docs` as the public docs site.
- Use Fumadocs with MDX pages and built-in search.
- Add the requested docs pages:
  - Introduction
  - Getting Started
  - Upload CSV
  - Business Profile Setup
  - AI Analysis
  - Dashboard
  - Billing
  - FAQ

### Phase 4: Root scripts and local runs

Add only the scripts that are verified to work with the current package manager and repository layout:

- `dev:web`
- `dev:docs`
- `build:web`
- `build:docs`
- `lint:web`
- `lint:docs`

If a command cannot be validated in this repo, do not force it into the root `package.json`.

### Phase 5: Railway deployment

- Keep the production deployment branch flow as-is.
- Configure the Railway service roots so the web service points to `apps/web` and the docs service points to `apps/docs`.
- Keep the existing `dist` and `dist-test` branch behavior unchanged unless the deployment plan explicitly requires a small adjustment.

## Non-goals

- No Meilisearch, Typesense, Algolia, or external search integration now.
- No large rewrite of current dashboard logic.
- No complex CI changes unless the new app layout breaks the current publish flow.
- No mixed docs/dashboard build path.

## Risk Notes

- The current deployment model is already working for generated `dist` output; avoid changing that path during the monorepo migration.
- The docs app should be isolated so the main dashboard build remains predictable.
- Any new workspace layout must be validated locally before changing Railway service roots.

## Suggested First Implementation Check

Before changing production deployment settings, verify:

1. current `pnpm` scripts still work,
2. the current Railway config remains valid,
3. the docs app can start independently,
4. the dashboard app can still run independently.
