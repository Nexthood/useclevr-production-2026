# Developer Guide

## Table of Contents

- [Setup](#setup)
- [Project Phases](#project-phases)
- [Technical Requirements](#technical-requirements)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Scripts](#scripts)
- [Shared API Testing](#shared-api-testing)
- [Database](#database)
- [Release](#release)
- [Development Conventions](#development-conventions)
- [Verified Computation](#verified-computation)
- [Smoke Tests](#smoke-tests)
- [CI / GitHub Actions](#ci--github-actions)
- [Security](#security)
- [Contributing](#contributing)
- [Troubleshooting](#troubleshooting)
- [Deployment](#deployment)

## Setup

```bash
pnpm install
cp .env.local.example .env.local   # copy and fill in your values
pnpm dev
```

## Project Phases

UseClevr works through four gated phases: Usable MVP and Sales Validation are active, AI
Differentiation is next, and Platform Expansion is future. Do not activate connectors, broader
public APIs, private customer MCP, market intelligence, or Intelligence Cloud work before the
current reliability, authorization, retention, and revenue gates pass.

Payload MCP is active limited infrastructure for approved content tools and locked demo-account
dataset summaries. It does not provide private customer-data access.

See [Project Phases](PROJECT_PHASES.md) for the concise gates. Keep active implementation in
`.TODO/todo-next.md` and deferred expansion in `.TODO/todo-future.md`.

## Technical Requirements

| Technology               | Required for                                             | Account required             | Notes                                                                          |
| ------------------------ | -------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------ |
| Git                      | Source control                                           | No                           | Install locally and configure your name and email.                             |
| GitHub                   | Repository hosting, pull requests, rulesets, and Actions | Yes                          | Developers need repository access before they can push branches or review PRs. |
| Node.js 26.x             | Local development, CI, and Railway runtime               | No                           | Use the version declared by the project.                                       |
| pnpm 11.5.0 or newer     | Dependency install and project scripts                   | No                           | Enable through Corepack or install locally.                                    |
| Railway                  | Production hosting from the `dist` branch `/dist` folder | Yes                          | Holds deployment settings and runtime environment variables.                   |
| Vercel                   | Source-branch production or preview hosting from `main`  | Yes                          | Uses root `vercel.json` synced from the Vercel server-config template.         |
| Neon PostgreSQL          | Application database                                     | Yes                          | Required for persisted app data and Drizzle schema operations.                 |
| Gemini API               | Cloud AI features through the AI SDK                     | Yes                          | Requires a Google AI Studio or Google Cloud account and API key.               |
| Auth.js / NextAuth       | Authentication runtime                                   | No                           | Requires local secrets, but no separate hosted account.                        |
| Stripe                   | Checkout, billing, and webhook flows                     | Yes, when billing is enabled | Optional for development unless testing payments.                              |
| AWS S3                   | Durable file storage when `UPLOAD_PROVIDER=s3`           | Yes, when S3 is used         | Requires bucket and access credentials.                                        |
| Cloudflare R2            | Durable file storage when `UPLOAD_PROVIDER=r2`           | Yes, when R2 is used         | S3-compatible storage; often preferred for app uploads.                        |
| Local filesystem uploads | Local upload fallback                                    | No                           | Uses `/tmp/useclevr-uploads` by default and is not durable on Railway.         |
| Ollama                   | Local AI features                                        | No                           | Optional local runtime for local model testing.                                |

Required service accounts for production:

- GitHub
- Railway
- Vercel, if deploying the source branch there
- Neon PostgreSQL
- Gemini API provider

Conditional service accounts:

- Stripe, only when billing or checkout is enabled.
- SpaceMail SMTP, required for production email verification delivery from the `auth@useclevr.com` sender alias.
- AWS S3 or Cloudflare R2, only when durable uploaded-file storage is enabled.

Local-only tools:

- Git
- Node.js
- pnpm
- Ollama, if local AI testing is needed.

## Project Structure

```
src/
  app/           Next.js App Router (pages, layouts, API routes)
  components/    React components and UI library
  lib/           Shared libraries
    ai/          AI and LLM helpers
    data/        Dataset parsing, cleaning, and analysis
    query/       Query intent, validation, and execution
    business/    Business logic and metric mapping
    db/          Database schema and runtime helpers
    auth/        Authentication and permissions
    billing/     Billing and subscriptions
    reports/     Reporting logic and exports
    usage/       Usage tracking and credit accounting
    referrals/   Referral flow helpers
    llm/         LLM provider abstractions
    mcp/         MCP integration
    utils/       Shared helpers and utilities
  assets/        Static files and generated report assets

scripts/         Node/CJS helper scripts
  server/        Server-host-specific helpers, grouped by host
  docs/          Docs lint and link-check scripts
  build/         Clean, dist, and build helpers
  package-dist/  Assemble generated production output
  release/       Tag and release-check scripts
  runtime/       Runtime env loader
  health/        Health-check scripts

docs/            Project documentation
  Developer_Guides/
  User_Guides/

.github/workflows/ci.yml                 CI pipeline (source validation, production build, docs-only)
.github/workflows/branch-maintenance.yml Sync beta and publish generated Railway output
```

## Environment Variables

### Required

```env
DATABASE_URL=          # Neon connection string (pooler)
DIRECT_URL=            # Neon direct connection (migrations)
AUTH_SECRET=           # NextAuth signing secret (min 32 chars)
GEMINI_API_KEY=        # Google AI Studio key
```

### Stripe (optional — activates card collection and webhooks)

```env
STRIPE_SECRET_KEY=          # sk_test_… or sk_live_…
STRIPE_WEBHOOK_SECRET=      # whsec_…  (set on Railway / hosting)
```

### Optional

```env
PORT=3000
AUTH_URL=                # Full app URL (set on Railway)
AUTH_TRUST_HOST=true
AUTH_GOOGLE_ID=          # Google OAuth client ID
AUTH_GOOGLE_SECRET=      # Google OAuth client secret
AUTH_LINKEDIN_ID=        # LinkedIn OAuth client ID
AUTH_LINKEDIN_SECRET=    # LinkedIn OAuth client secret
SMTP_HOST=mail.spacemail.com
SMTP_PORT=465            # SpaceMail SMTP port; 465 uses TLS by default
SMTP_SECURE=true         # Optional; defaults to true for port 465
SMTP_USER=start@useclevr.com
SMTP_PASSWORD=           # SpaceMail SMTP password for start@useclevr.com, set in Railway
EMAIL_FROM="UseClevr <auth@useclevr.com>"
LOCAL_UPLOAD_DIR=/tmp/useclevr-uploads
UPLOAD_PROVIDER=
MOCK_AI_MODE=false       # Local-only AI development responses; production runtime ignores true
MOCK_AI_RESPONSE_DELAY_MS=250
```

SMTP authentication uses `SMTP_USER`; `auth@useclevr.com` is the visible sender alias and is not used for SMTP authentication.

`AUTH_SECRET` and `AUTH_URL` are the canonical Auth.js names. The runtime also accepts
`NEXTAUTH_SECRET` and `NEXTAUTH_URL` for compatibility, but Railway services should use the `AUTH_*`
names unless a legacy deployment already depends on `NEXTAUTH_*`.

OAuth provider callback paths are fixed by the provider IDs in code:

- Google: `/api/auth/callback/google`
- LinkedIn: `/api/auth/callback/linkedin`

For the Railway test service, register these exact redirect URIs in each provider console:

- `https://test.useclevr.com/api/auth/callback/google`
- `https://test.useclevr.com/api/auth/callback/linkedin`

Persist secrets via your hosting platform environment variable UI (Railway, Vercel, etc.) — never
commit `.env` files.

## Scripts

All commands are run from `pnpm`.

### Development

| Command             | Description                              |
| ------------------- | ---------------------------------------- |
| `pnpm dev`          | Start the Next.js dev server (port 3000) |
| `pnpm dev:all`      | Alias for `pnpm dev`                     |
| `pnpm dev:server`   | Alias for `pnpm dev`                     |
| `pnpm dev:frontend` | Alias for `pnpm dev`                     |

### Build

| Command              | Description                         |
| -------------------- | ----------------------------------- |
| `pnpm build`         | Production build (Turbopack)        |
| `pnpm build:next`    | Alias for `pnpm build`              |
| `pnpm build:clean`   | Clean generated artefacts           |
| `pnpm build:preview` | Full prod build + start dist server |
| `pnpm build:prod`    | Generate `dist/` only (no server)   |

### Validate

| Command                 | Description                          |
| ----------------------- | ------------------------------------ |
| `pnpm validate`         | Types + dist check + release check   |
| `pnpm validate:types`   | `tsc --noEmit`                       |
| `pnpm validate:build`   | Full Next.js build                   |
| `pnpm validate:dist`    | Railway and Vercel config sync check |
| `pnpm validate:release` | Release checklist script             |

### Lint & Format

| Command               | Description                                         |
| --------------------- | --------------------------------------------------- |
| `pnpm lint`           | Package, TODO, workflows metadata + ESLint          |
| `pnpm lint:fix`       | ESLint with `--fix`                                 |
| `pnpm lint:docs`      | Markdownlint for docs and root markdown             |
| `pnpm lint:changelog` | Ensure changelog has unreleased entries             |
| `pnpm lint:commits`   | Check recent commit messages                        |
| `pnpm lint:deps`      | Manual dependency freshness check                   |
| `pnpm lint:secrets`   | Scan docs and source text for committed credentials |
| `pnpm format`         | Prettier — write                                    |
| `pnpm format:check`   | Prettier — check only                               |
| `pnpm docs:check`     | Markdown local-link check                           |
| `pnpm link:docs`      | Alias for markdown local-link check                 |

### Test

| Command                  | Description                 |
| ------------------------ | --------------------------- |
| `pnpm test`              | Same as `pnpm test:all`     |
| `pnpm test:all`          | Run CSV-analyser test suite |
| `pnpm test:csv-analyzer` | CSV analyser specific tests |
| `pnpm test:neon`         | Neon connection smoke test  |

## Shared API Testing

Use [docs/api-tests/README.md](../api-tests/README.md) and the
Git-tracked `.http` files under `docs/api-tests/` as the shared API testing method.

- Use REST Client in VS Code for reproducible local, staging, and production request examples.
- Keep Thunder Client for personal manual exploration only.
- Paste session cookies manually for protected-route checks and do not save secrets into Git.

### Analysis Helpers

- `scripts/analysis/test-csv-analyzer.ts` and `scripts/analysis/test-csv-edge-cases.ts` power the CSV analyser test suite.
- `scripts/analysis/analyze-business.ts` is a database-backed diagnostic for the latest dataset.
- Mock AI setup lives in `src/lib/ai/mock-ai.ts`; analysis scripts stay focused on dataset analysis checks.

### Local Mock AI

Set `MOCK_AI_MODE=true` in local development to test AI flows without Gemini, Antigravity, Ollama, or
the local desktop agent. Mock mode returns development responses for chat, streaming chat, dataset
analysis, local AI status, local model tags, model pull, and model verification routes.

Mock mode is ignored in production runtime. Traces from mock responses use provider `Mock AI` and
model `mock-local-development`.

### Payload Phase 0

Payload Phase 0 currently serves:

- `/admin`
- `/admin/business-profiles` for cross-user business-profile operations
- `/admin/accountancy` for cross-user bookkeeping readiness, reporting, tax, and compliance review
- `/admin/datasets` for cross-user dataset inspection and deletion
- `/admin/support-issues` for the support queue
- `/admin/dataset-upload` for owner-assigned CSV uploads
- `/api/payload`
- `/api/payload/admin-operations/*` for Payload-session-protected product operations
- `/api/payload/mcp` for Payload-native News, FAQ, and locked demo-account read MCP tools
- public homepage content
- public privacy page content
- public terms page content
- public news posts
- FAQ content
- durable News cover media through configured S3-compatible storage

Current local safety rules:

- Keep Payload database schema auto-push disabled during normal local startup.
- Use explicit migration commands when Payload schema work is intentional.
- Configure `UPLOAD_PROVIDER=s3` with `AWS_S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, and
  `AWS_SECRET_ACCESS_KEY`, or configure `UPLOAD_PROVIDER=r2` with `R2_BUCKET`, `R2_ENDPOINT`,
  `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and optional `R2_PUBLIC_URL`.
- Payload blocks media mutations when durable S3-compatible storage is not fully configured.
- Create Payload MCP API keys in the Payload admin and grant only the required News, FAQ, or locked demo-account read tools.
- Keep `/api/payload/mcp` for Payload-owned MCP tools and locked demo-account dataset reads.
- Keep app auth routes and Payload auth routes reachable before login, while keeping other
  protected API routes behind authentication.
- Keep `/admin` requests on the Payload root layout so the admin login and admin workspace boot
  with the required Payload providers and server functions.
- Register Payload login branding through `admin.components`, then regenerate the admin import map
  with `node ./node_modules/payload/bin.js generate:importmap`.
- Keep Payload admin shell overrides in the shared Payload branding stylesheet and align typography,
  cyan primary controls, 8px radii, navigation borders, workspace surfaces, and dark backgrounds
  with dashboard tokens.
- Register reusable admin shell slots in `src/components/payload/payload-admin-shell.tsx`. Keep
  the menu label, dashboard header, collection subheaders, and right information panels in those
  slots while Payload retains its native tables, forms, filters, and save actions.
- Register product-operation views through `admin.components.views` and keep their endpoints under
  `/api/payload/admin-operations/*`.
- Require the Payload `superadmin` role for every product-operation endpoint. Require an explicit
  dashboard user owner for business creation and dataset upload.
- Keep Payload credentials registration limited to the base role. The Google and LinkedIn buttons
  use the existing Auth.js providers, and the Payload custom authentication strategy provisions a
  matching base CMS account from the authenticated dashboard session.
- Preserve `superadmin` only when the fixed built-in superadmin dashboard identity authenticates
  through the custom Payload strategy.
- Use Payload's `useAuth` hook from the version-matched `@payloadcms/ui` package to hide
  product-operation navigation and AI actions from base CMS users. Keep endpoint authorization as
  the server-side enforcement boundary.
- Keep Drizzle as the source of truth for business profiles, datasets, and dataset rows. Store
  support issues in the Payload Issues collection and use that collection through the dashboard
  ticket store.
- Use the canonical CSV parser for Payload administrator uploads and write the standard Dataset and
  DatasetRow records.
- Keep dataset-aware AI requests in the dashboard session. The Payload AI Assistant modal opens
  `/app/assistant` so dashboard ownership and AI trace attribution remain active.
- Use the shared Hybrid AI modal control in the Payload topbar instead of creating a separate local
  AI configuration path.
- Use a 220px desktop menu rail, 64px topbar, focused center workspace, and 272px right information
  rail. Stack information panels below content at tablet widths and into one column on mobile.
- Run `pnpm exec payload generate:importmap` after adding or renaming Payload admin components.
- Pin `@payloadcms/ui` to the same exact version as `payload` and every other Payload package.
- Register the dashboard return link through `admin.components.afterNavLinks`.
- Keep dashboard account creation at `/login?tab=signup`. Keep Payload operator sign-in and
  base-role registration in tabs at `/admin/login`.

### Clean

| Command                | Description                                       |
| ---------------------- | ------------------------------------------------- |
| `pnpm clean`           | Remove `dist/`, `.next/`, and generated artefacts |
| `pnpm clean:all`       | Full clean via helper script                      |
| `pnpm clean:dev`       | Dev-only generated artefacts                      |
| `pnpm clean:prod`      | Production-only generated artefacts               |
| `pnpm clean:generated` | Script-driven clean                               |

### CI

| Command                    | Description                                          |
| -------------------------- | ---------------------------------------------------- |
| `pnpm ci:validate`         | Types + dist check + lint + tests + production build |
| `pnpm deploy:railway:sync` | Validate Railway deploy-target config                |
| `pnpm deploy:vercel:sync`  | Sync Vercel source-target config                     |
| `pnpm ci:railway`          | Compatibility alias for Railway config validation    |

### Audit & Dependencies

| Command           | Description                 |
| ----------------- | --------------------------- |
| `pnpm audit`      | pnpm audit (moderate level) |
| `pnpm audit:ci`   | Audit with `--json` output  |
| `pnpm deps:check` | `pnpm outdated`             |

### Health

| Command       | Description                           |
| ------------- | ------------------------------------- |
| `pnpm health` | validate + tests + docs:check + audit |

### Database

| Command            | Description            |
| ------------------ | ---------------------- |
| `pnpm db:push`     | Push schema to Neon    |
| `pnpm db:generate` | Generate migrations    |
| `pnpm db:studio`   | Open Drizzle Studio    |
| `pnpm db:migrate`  | Run pending migrations |

### Release

| Command              | Description                                          |
| -------------------- | ---------------------------------------------------- |
| `pnpm release:check` | Full validation before release                       |
| `pnpm release:tag`   | Create annotated git tag from `package.json` version |
| `pnpm release`       | check → tag → prod build                             |

## Development Conventions

### TypeScript

```bash
pnpm validate:types   # must be clean before opening a PR
```

### Formatting

```bash
pnpm format:check     # CI check — no unformatted files
pnpm format           # auto-fix
```

Markdown source check:

```bash
pnpm docs:check       # broken local links in *.md
```

### Git Hooks

Husky manages local Git hooks from `.husky/`; the local Git hook path should point at `.husky/_`.
Do not keep custom scripts in `.git/hooks` beyond Git sample files.

Current hooks:

- `commit-msg` — runs commitlint and allows `PR:` commit titles used by generated dist commits.
- `pre-commit` — checks the changelog, project interaction records, AI interaction status, TODO
  metadata, secret exposure, and package scripts.
- `pre-push` — runs TypeScript, deploy config checks, linting, production packaging, workflow validation, and workflow check-name golden validation.

See [Pre-commit checklist](PRE_COMMIT_CHECKLIST.md) for required staged records and feature
documentation rules.

Setup and checks:

```bash
pnpm install          # runs the Husky prepare script
git config --local --get core.hooksPath
pnpm exec commitlint --from HEAD~1 --to HEAD
pnpm validate:prepush
```

### Env safety

Secrets are loaded server-side only via `scripts/runtime/load-env.cjs` for the production dist
process. Browser code must never read env vars directly.

For local work across multiple checkouts, put shared development secrets in the parent directory of
the Git checkout, for example `../.env.local`. The runtime loader reads that file first, then reads
checkout-local `.env` and `.env.local` files so branch-specific values can override shared defaults.
Railway-provided environment variables still take priority over files.

### Auth

```bash
pnpm exec tsc --noEmit        # mandatory pre-PR gate
pnpm lint                     # must be clean
pnpm test:all                 # must pass
```

GitHub Actions CI runs one required source check automatically:
`Validate source and production build / validate`.
It type-checks, validates dist config, lints, runs tests, and executes `pnpm build`.

## Quick Checks

```bash
pnpm exec tsc --noEmit    # type-check
pnpm lint                 # lint
pnpm test:all             # tests
pnpm validate:types       # pre-PR gate
```

## Verified Computation

Compute metrics in code. Use AI only for explanation.

Key files:

- `lib/queryEngine.ts`
- `lib/queryIntentPrompt.ts`
- `app/api/query/route.ts`
- `app/api/chat/route.ts`
- `lib/llmAdapter.ts`

Query endpoint: `POST /api/query`

```json
{ "datasetId": "string", "question": "string" }
```

```json
{
  "success": true,
  "result": {
    "computed_value": 123,
    "operation": "sum",
    "column": "Revenue",
    "row_count": 1000,
    "execution_time_ms": 10
  },
  "explanation": "string"
}
```

Validation rules: `count`, `count_distinct`, `sum`, `avg`, `min`, `max`, `group_by`, `top_n` —
column must exist, type must match operation, dataset access must be authorised.

## Smoke Tests

```bash
pnpm dev
```

1. Open the home page
2. Sign in or create a test account
3. Upload a sample CSV
4. Confirm dashboard KPIs and charts render
5. Ask a dataset question in the assistant
6. Generate or download a report

## CI / GitHub Actions

Workflow file: `.github/workflows/ci.yml` (validates both `main` and `beta` branches)

A PostgreSQL 17 service container runs alongside the build job so database-dependent steps (schema
push, build with DB imports) can execute without a permanent database. Production and preview
deployments connect to an external Neon PostgreSQL instance — the CI ephemeral Postgres is
build-time only.

| Job                                               | Runs    | Steps                                            |
| ------------------------------------------------- | ------- | ------------------------------------------------ |
| `Validate source and production build / validate` | Always  | types, dist-check, lint, tests, production build |
| `Documentation checks`                            | PR only | `pnpm docs:check`                                |

## Security

See [`../../SECURITY.md`](../../SECURITY.md) for the vulnerability disclosure policy.

## Contributing

See [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md) for local setup, commit conventions, and PR
guidelines.

## Troubleshooting

| Issue        | Fix                                                  |
| ------------ | ---------------------------------------------------- |
| AI fail      | `GEMINI_API_KEY`, restart dev server                 |
| Auth fail    | `AUTH_SECRET`, `AUTH_URL`                            |
| DB fail      | `DATABASE_URL`, `DIRECT_URL`, SSL mode               |
| Railway fail | see [`RAILWAY_DEPLOYMENT.md`](RAILWAY_DEPLOYMENT.md) |

## Deployment

```bash
pnpm deploy:railway:check
pnpm prod:build
pnpm prod:start
```

- Deploy root: `dist/`
- Do not commit generated `dist/` output from source branches
- Railway guide: [`RAILWAY_DEPLOYMENT.md`](RAILWAY_DEPLOYMENT.md)
- Vercel guide: [`VERCEL_DEPLOYMENT.md`](VERCEL_DEPLOYMENT.md)
- Server config guide: [`CI_SERVER_CONFIGS.md`](CI_SERVER_CONFIGS.md)
- Local runtime parity test: switch to the `dist` branch, then run `cd dist && pnpm install && npm run start`
- Shared local env: put common development secrets in `../.env.local`; checkout-local env files can
  override those values.
- `dist-root/server-config/` contains host config templates with platform-native filenames; GitHub
  Actions workflow files stay in `.github/workflows/`.

### Incidents

1. Rotate secrets
2. Check host variables and logs
3. Confirm deployed commit in the host dashboard or CLI
4. Disable affected route if needed
5. Patch, redeploy, verify `/api/health`
