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

### MCP Security

- T-595. Add MCP rate limiting and audit logging for tool listing, resource reads, and tool invocation while keeping logs free of raw dataset content.
- T-596. Add MCP service-token and admin-token access only for approved internal clients, with ownership checks, role-based tool allowlists, and AI trace guidance updates.

### Build

- T-577. Fix Node.js version mismatch in generated Dockerfile — `FROM node:22-alpine` in `scripts/package-dist/create-dist.cjs` hardcodes Node 22 but `package.json` engine requires `>=26.1.0`. Change to `FROM node:26-alpine` or read the version dynamically from `package.json`.
- T-578. Remove dead turbo.json and turbo devDependency — `turbo.json` defines build tasks with caching but no script in `package.json` invokes `turbo`. Delete `turbo.json` and remove `turbo` from `package.json` devDependencies to reduce install time and complexity.
- T-579. Consolidate overlapping build aliases in package.json — `build:next`, `build:preview`, `build:prod`, `build:clean`, `prod`, `preview` all boil down to either `pnpm build` or `pnpm prod:build`. Keep only `build`, `prod:build`, `start`, and `preview`; remove duplicate/confusing aliases.
- T-580. Eliminate redundant `.next` copy in dist packaging — `scripts/package-dist/create-dist.cjs` copies `.next/static` to `dist/.next/static` then copies the entire `.next` directory to `dist/next-build`, duplicating static files and inflating the dist bundle. Copy only Railway-specific files to `dist/next-build` instead.
- T-581. Merge redundant .env cleanup loops in create-dist.cjs — lines 190-193 delete `.env` explicitly, then lines 195-202 loop over all entries deleting `.env.*`. The explicit `.rmSync` on `.env` is dead code since `.env` does not match the `.env.*` glob. Remove lines 190-193.

### Next.js Structure

- T-582. Merge duplicate upload implementations — `src/app/api/upload/route.ts` (629 lines) and `src/app/actions/upload.ts` (562 lines) both handle CSV file upload, column type detection, dataset creation, and row insertion with slightly different logic and bugs. Pick the server action as canonical, delegate API route to it, merge `executeWithRetry` from the API route into the server action.
- T-583. Replace barrel proxy files with direct imports — `src/lib/query/engine.ts` re-exports from `src/lib/data/queryEngine` and `src/lib/query/intent-prompt.ts` re-exports from `src/lib/utils/queryIntentPrompt`. Delete both proxies and update all callers to import directly.
- T-584. Use route groups to simplify middleware auth — restructure `src/app/` into `(public)/`, `(auth)/`, and `api/` route groups. Move auth guard from middleware into `src/app/(auth)/layout.tsx`. Maintains security while colocating auth rules with the pages they protect.
- T-585. Merge duplicate FAQ and Mentoring pages — `src/app/faq/page.tsx` / `src/app/app/faq/page.tsx` and `src/app/mentoring/page.tsx` / `src/app/app/mentoring/page.tsx` are separate implementations. Extract shared shell (header, breadcrumbs) into a component to eliminate layout duplication, or use route groups to serve a single page at both paths.
### Shared Code

- T-587. Consolidate CSV parsing into one canonical module — four implementations exist: `src/lib/data/csvLoader.ts` (PapaParse), `src/lib/data/upload-handler.ts` (custom `parseCSVLine`), `src/app/api/upload/route.ts` (inline), and `src/app/actions/upload.ts` (inline). Hand-rolled parsers cannot handle quoted fields or commas inside values. Make `csvLoader.ts` the single source of truth and replace all inline parsing with calls to it.
- T-588. Consolidate currency/number cleaning into shared module — `CURRENCY_SYMBOLS`, `DATE_PATTERNS`, and `parseNumericValue`/`cleanNumericValue` duplicated across `src/lib/data/data-cleaner.ts`, `src/app/api/upload/route.ts`, and `src/lib/utils/formatting.ts`. Extract into `src/lib/utils/number-parser.ts` and remove duplication.
- T-589. Create shared `requireAuth()` helper — auth check pattern (`session = await auth(); if (!session?.user?.id)`) repeated across ~15 files in server actions and API routes. Create `src/lib/auth/require-auth.ts` exporting `requireAuth()` (throws) and `requireAuthResult()` (returns `Result` type). Update all call sites.
- T-590. Consolidate `ValidationResult` into `Result` type — `src/lib/validation.ts` defines `ValidationResult<T>` and `ValidationError` interfaces structurally identical to `Result<T, string>` from `src/lib/result.ts`. Remove the duplicate types and change `validateOrError` to return `Result<T, string>`.
- T-591. Normalize pnpm version constant between ESM and CJS configs — `scripts/lib/app-config.js` exports `pnpm@11.5.0+sha512.<hash>` while `scripts/lib/app-config.cjs` exports `pnpm@11.5.0` (no hash). The CJS version should match the ESM version so both configs validate against the same `packageManager` value.
- T-597. Add CSP nonce support to Next.js headers — generate cryptographically random nonces for inline scripts and styles so Content-Security-Policy allows only trusted inline execution.
- T-598. Remove remaining `any` types in API routes — replace `any` in `src/app/api/analyze/route.ts`, `src/app/api/admin/*` with proper Zod infer types.
- T-599. Audit public API route exposure — verify all public routes at `src/app/api/public/*` return safe data only and fail closed on error.
- T-600. Remove unused imports and dead code in login page — clean up unused `oauthAccount` variable and any stale debugging code.
- T-601. Add an API route access matrix covering public, signed-in, owner-scoped, super-admin, webhook, and development-only routes with expected auth helper, ownership check, rate limit, and audit evidence.
- T-602. Restrict local AI install and agent install runtime routes to development mode or approved super-admin operations so signed-in users cannot trigger server-host runtime actions on shared deployments.

## Deferred

## Suggestions
