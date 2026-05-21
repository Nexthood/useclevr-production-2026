# Developer Guide

## Setup

```bash
pnpm install
cp .env.local.example .env.local   # copy and fill in your values
pnpm dev
```

## Technical Requirements

| Technology | Required for | Account required | Notes |
| --- | --- | --- | --- |
| Git | Source control | No | Install locally and configure your name and email. |
| GitHub | Repository hosting, pull requests, rulesets, and Actions | Yes | Developers need repository access before they can push branches or review PRs. |
| Node.js 26.x | Local development, CI, and Railway runtime | No | Use the version declared by the project. |
| pnpm 11.1.2 or newer | Dependency install and project scripts | No | Enable through Corepack or install locally. |
| Railway | Production hosting from the `dist` branch `/dist` folder | Yes | Holds deployment settings and runtime environment variables. |
| Vercel | Source-branch production or preview hosting from `main` | Yes | Uses root `vercel.json` synced from the Vercel server-settings template. |
| Neon PostgreSQL | Application database | Yes | Required for persisted app data and Drizzle schema operations. |
| Gemini API | Cloud AI features through the AI SDK | Yes | Requires a Google AI Studio or Google Cloud account and API key. |
| Auth.js / NextAuth | Authentication runtime | No | Requires local secrets, but no separate hosted account. |
| Stripe | Checkout, billing, and webhook flows | Yes, when billing is enabled | Optional for development unless testing payments. |
| AWS S3 | Durable file storage when `UPLOAD_PROVIDER=s3` | Yes, when S3 is used | Requires bucket and access credentials. |
| Cloudflare R2 | Durable file storage when `UPLOAD_PROVIDER=r2` | Yes, when R2 is used | S3-compatible storage; often preferred for app uploads. |
| Local filesystem uploads | Local upload fallback | No | Uses `/tmp/useclevr-uploads` by default and is not durable on Railway. |
| Ollama | Local AI features | No | Optional local runtime for local model testing. |

Required service accounts for production:

- GitHub
- Railway
- Vercel, if deploying the source branch there
- Neon PostgreSQL
- Gemini API provider

Conditional service accounts:

- Stripe, only when billing or checkout is enabled.
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
LOCAL_UPLOAD_DIR=/tmp/useclevr-uploads
UPLOAD_PROVIDER=
```

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
| `pnpm build`         | Production build (webpack)          |
| `pnpm build:next`    | Alias for `pnpm build`              |
| `pnpm build:clean`   | Clean generated artefacts           |
| `pnpm build:preview` | Full prod build + start dist server |
| `pnpm build:prod`    | Generate `dist/` only (no server)   |

### Validate

| Command                 | Description                        |
| ----------------------- | ---------------------------------- |
| `pnpm validate`         | Types + dist check + release check |
| `pnpm validate:types`   | `tsc --noEmit`                     |
| `pnpm validate:build`   | Full Next.js build                 |
| `pnpm validate:dist`    | Railway and Vercel config sync check |
| `pnpm validate:release` | Release checklist script           |

### Lint & Format

| Command             | Description                           |
| ------------------- | ------------------------------------- |
| `pnpm lint`         | Next.js ESLint                        |
| `pnpm lint:fix`     | ESLint with `--fix`                   |
| `pnpm format`       | Prettier — write                      |
| `pnpm format:check` | Prettier — check only                 |
| `pnpm docs:check`   | Markdown link and .markdownlint check |

### Test

| Command                  | Description                 |
| ------------------------ | --------------------------- |
| `pnpm test`              | Same as `pnpm test:all`     |
| `pnpm test:all`          | Run CSV-analyser test suite |
| `pnpm test:csv-analyzer` | CSV analyser specific tests |
| `pnpm test:neon`         | Neon connection smoke test  |

### Clean

| Command                | Description                                       |
| ---------------------- | ------------------------------------------------- |
| `pnpm clean`           | Remove `dist/`, `.next/`, and generated artefacts |
| `pnpm clean:all`       | Full clean via helper script                      |
| `pnpm clean:dev`       | Dev-only generated artefacts                      |
| `pnpm clean:prod`      | Production-only generated artefacts               |
| `pnpm clean:generated` | Script-driven clean                               |

### CI

| Command           | Description                        |
| ----------------- | ---------------------------------- |
| `pnpm ci:validate` | Types + dist check + lint + tests + production build |
| `pnpm deploy:railway:sync` | Sync Railway deploy-target config |
| `pnpm deploy:vercel:sync`  | Sync Vercel source-target config |
| `pnpm ci:railway`          | Compatibility alias for Railway sync |

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

Current hook:

- `commit-msg` — runs commitlint and allows `PR:` commit titles used by generated dist commits.

Setup and checks:

```bash
pnpm install          # runs the Husky prepare script
git config --local --get core.hooksPath
pnpm exec commitlint --from HEAD~1 --to HEAD
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

GitHub Actions CI runs one required source check automatically: `Validate source and production build`.
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

Workflow file: `.github/workflows/ci.yml`

On every push to `main` and every PR, the required job runs:

| Job | Runs | Steps |
| --- | --- | --- |
| `Validate source and production build` | Always | types, dist-check, lint, tests, production build |
| `Documentation checks` | PR only | `pnpm docs:check` |

## Security

See [`../../SECURITY.md`](../../SECURITY.md) for the vulnerability disclosure policy.

## Contributing

See [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md) for local setup, commit conventions, and PR
guidelines.

## Troubleshooting

| Issue        | Fix                                          |
| ------------ | -------------------------------------------- |
| AI fail      | `GEMINI_API_KEY`, restart dev server         |
| Auth fail    | `AUTH_SECRET`, `AUTH_URL`                    |
| DB fail      | `DATABASE_URL`, `DIRECT_URL`, SSL mode       |
| Railway fail | env vars, `/api/health`, generated Railway config |

## Deployment

```bash
pnpm deploy:railway:sync
pnpm prod:build
pnpm prod:start
```

- Deploy root: `dist/`
- Do not commit generated `dist/` output from source branches
- Template: `dist-root/server-settings/railway/railway.dist.json`
- Vercel template: `dist-root/server-settings/vercel/vercel.source.json`
- Local runtime parity test: switch to the `dist` branch, then run `cd dist && pnpm install && npm run start`
- Shared local env: put common development secrets in `../.env.local`; checkout-local env files can
  override those values.
- `dist-root/server-settings/` contains one subfolder per server host; GitHub Actions workflow files stay
  in `.github/workflows/`.

### Railway Environment

**Required:**

```env
DATABASE_URL=
DIRECT_URL=
AUTH_SECRET=
GEMINI_API_KEY=
```

**Optional:**

```env
AUTH_URL=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
LOCAL_UPLOAD_DIR=/tmp/useclevr-uploads
UPLOAD_PROVIDER=
```

### Railway Checklist

- Dockerfile uses `node:26` or newer
- Start command binds to `0.0.0.0`
- App uses Railway `$PORT`
- `/api/health` returns 200 quickly
- Generated Railway config comes from `dist-root/server-settings/railway/railway.dist.json`
- The `dist` branch root must not contain `railway.json`; Railway reads `/dist/railway.json`
- Railway install uses generated pnpm build approvals for `sharp`, `esbuild`, and `core-js`
- Database migrations stay in Railway pre-deploy while this is a single web-service deployment
- Railway dashboard custom command fields should be empty; old `npm` command overrides can bypass the
  generated config. If a temporary override is needed, use `pnpm run railway:predeploy` and
  `pnpm start`.
- No secrets in Docker image or logs
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` set to activate payments

### Vercel Checklist

- Vercel deploys from `main`, not from the generated `dist` branch.
- Root `vercel.json` is synced from `dist-root/server-settings/vercel/vercel.source.json`.
- Run `pnpm deploy:vercel:sync` after Vercel template edits.
- Run `pnpm validate:dist` before opening the PR so Railway and Vercel deploy settings are both in sync.
- Configure the same required production secrets in Vercel project environment variables.
- Do not rely on Vercel for Railway-style pre-deploy migrations; run migrations through Railway,
  manual operator control, or a future dedicated migration job.

### Debug

```bash
railway logs
railway status
railway open
```

### Incidents

1. Rotate secrets
2. Check Railway variables and logs
3. Confirm deployed commit (`railway status`)
4. Disable affected route if needed
5. Patch, redeploy, verify `/api/health`
