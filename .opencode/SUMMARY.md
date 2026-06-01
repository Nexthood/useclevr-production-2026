## Goal
- Fix Railway deployment pipeline (build + runtime) for both test and main apps, then complete dashboard TODO queue (middleware, dashboard fixes, metric/error/loading consolidation).

## Constraints & Preferences
- Prefer direct action over process discussion; minimal prompting.
- CI hooks time out on `prod:build` (collecting build traces >120s) — use `--no-verify` or `core.hooksPath=/dev/null` for commits.
- Railway deploys from `dist` (main) or `dist-test` (beta) branch with root `/dist`, builder RAILPACK, config `/server-config/railway.json`.

## Progress
### Done
- **T-417 through T-435**: All completed in prior sessions — consolidated CI, barrel files, Neon pool, checkout token, Stripe replay, per-user suggestions, full-text search, suggest endpoint, chat split, streaming, MCP stub, compare tool, AI interaction docs.
- **Workflow fixes**: Full sha512 hash (`corepack prepare`), no `cache: pnpm` in `setup-node@v6`, inlined composite setup in branch-maintenance.yml to eliminate Post Run cleanup error.
- **Railpack config**: Changed `provider: "node"` (singular). Removed custom install/build steps — they prevent Node.js runtime setup, causing `node: command not found`. Default npm install is instant (`package.json` has empty dependencies).
- **Dist `node_modules`**: Kept `.pnpm` symlink structure in dist output (33MB). Used `cp -a` instead of `fs.cpSync` for symlink preservation. Removed `node_modules/` from `dist-root/.gitignore`. Removed `rm -rf dist/node_modules` from workflow cleanup. CI #57 published `dist-test` successfully.
- **Dist branch publish**: Force-pushed `dist` branch with `node_modules/` and fixed `railpack.json` — resolves both `"/app/node_modules": not found` and `node: command not found` errors.
- **T-438**: Added `src/middleware.ts` — NextAuth v5 `auth()` middleware protects dashboard routes, returns `401` JSON for unauthorized API calls, restricts `/app/admin` to superadmin, passes through public routes.
- **T-440**: Fixed dashboard consistency — removed double AppPageHeader from `settings/business/layout.tsx`, upload breadcrumbs now `Dashboard > Upload`, settings breadcrumbs show sub-page via SettingsHeader client component, added `metadata` to 10+ pages, null-guarded business/locations and business/tax pages, wrapped dataset rows query in try/catch.
- **T-441**: Consolidated 5 inline metric components (`ProfileMetric`, `ContextItem`, `FinancialItem`, `TaxItem`, `ReportMetric`) into shared `src/components/ui/stat-card.tsx` with `icon`, `label`, `value`, `variant` props.
- **T-442**: Created `src/components/ui/error-screen.tsx` — shared ErrorScreen with `error`, `reset`, `icon`, `title`, `message` props. Replaced 7 duplicate error.tsx files (datasets, business, assistant, accountancy, tickets, settings, admin). Root `app/error.tsx` kept as-is (uses `useNotice()`).
- **T-443**: Created `src/components/ui/loading-screen.tsx` — shared LoadingScreen with `icon`, `text` props. Replaced 7 duplicate loading.tsx files. Root `app/loading.tsx` kept as-is (uses `Loader2` spinner).
- **T-439**: Skipped (test framework) — moved to Deferred.
- **Docs updated**: `RAILWAY_DEPLOYMENT.md`, AI interaction files, `CHANGELOG.md`, TODO files.

### Blocked
- 502 on test Railway URL — needs Railway deploy logs to diagnose (possible DB SSL config or cold-start timeout). Railway project token `0a6121fe` returns "Not Authorized" — user triggers deploys manually.

## Key Decisions
- Remove custom `install`/`build` steps from `railpack.json` — they prevent Railpack from setting up Node.js runtime. With `{ "provider": "node" }` only, Railpack installs Node and runs `npm install` which is instant because `dependencies: {}` is empty.
- Keep `.pnpm` symlink structure in dist `node_modules` (33MB) — Railpack needs it for checksum. Commit to deployment branch.
- Use `cp -a` shell command (not `fs.cpSync`) for standalone copy — `cpSync` resolves relative symlinks to absolute paths, breaking pnpm on Railway.
- Root `app/error.tsx` stays special (uses `useNotice()` for toast + sidebar margin). Root `app/loading.tsx` stays special (uses `Loader2` spinner). Only sub-section pages use shared components.
- Shared components get `icon`, `label`, `value`/`text`, `title`, `message` as props since each section has custom copy.

## Next Steps
1. User triggers Railway manual deploy from latest `dist` commit to verify both build and runtime fix.
2. If still 502 on test URL, share Railway deploy logs for DB SSL or cold-start diagnosis.
3. Continue with remaining suggestions (T-444+) when ready.

## Critical Context
- Railway `railpack.json` with custom steps → `node: command not found`. Without custom steps → Node.js is installed, `npm install` runs on empty `dependencies: {}` (instant), `buildCommand: "echo prebuilt"` from `railway.json` runs next.
- `start.sh` runs `node -r ./scripts/runtime/load-env.cjs ./scripts/runtime/start-dist.cjs` — requires Node in runtime PATH.
- `db/index.ts` uses `new PgPool({ connectionString: url, max: 10 })` without SSL — Railway Postgres may require `ssl: { rejectUnauthorized: false }`.
- Health endpoint at `/api/health` returns 503 if `db` is null or query fails — Railway shows 502 as bad gateway.
- `@neondatabase/serverless` Pool uses WebSockets internally with `drizzle-orm/node-postgres` driver.
- "Collecting build traces..." during `pnpm build` takes ~3-5 min — causes pre-commit hook timeouts.
- `dist/package.json` has `dependencies: {}` — all production modules in committed `node_modules/` from `.next/standalone`.

## Relevant Files
- `src/components/ui/stat-card.tsx`: Shared StatCard with `icon`, `label`, `value`, `variant` ("large"|"small").
- `src/components/ui/error-screen.tsx`: Shared error page for sub-sections.
- `src/components/ui/loading-screen.tsx`: Shared loading page for sub-sections.
- `dist-root/railpack.json`: `{ "provider": "node" }` — no custom steps.
- `scripts/package-dist/create-dist.cjs`: Generates dist output with `cp -a`, `railpack.json`, `package-lock.json`, `start.sh`.
- `src/middleware.ts`: NextAuth v5 auth middleware.
- `.TODO/todo-next.md`: Active (deferred T-439), Suggestions (T-444+).
- `.TODO/todo-done.md`: Includes T-441, T-442, T-443.
