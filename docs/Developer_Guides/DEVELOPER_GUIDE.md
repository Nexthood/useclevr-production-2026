# Developer Guide

## Setup

```bash
pnpm install
cp .env.local.example .env.local   # copy and fill in your values
pnpm dev
```

## Requirements

| Requirement | Version         |
| ----------- | --------------- |
| Node.js     | ≥ 22            |
| pnpm        | 10.x            |
| Database    | Neon PostgreSQL |
| AI provider | Gemini API key  |

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
  ci/            CI config sync (Railway)
  docs/          Docs lint and link-check scripts
  build/         Clean, dist, and build helpers
  release/       Tag and release-check scripts
  runtime/       Runtime env loader
  health/        Health-check scripts

docs/            Project documentation
  Developer_Guides/
  User_Guides/

.github/workflows/ci.yml   CI pipeline (fast, full, docs-only)
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
| `pnpm validate:dist`    | Railway config sync check          |
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
| `pnpm ci:fast`    | `validate:types` + `validate:dist` |
| `pnpm ci:full`    | `validate` + `prod:build`          |
| `pnpm ci:railway` | Sync Railway config                |

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

### Env safety

Secrets are loaded server-side only via `scripts/runtime/load-env.cjs` for the production dist
process. Browser code must never read env vars directly.

### Auth

```bash
pnpm exec tsc --noEmit        # mandatory pre-PR gate
pnpm lint                     # must be clean
pnpm test:all                 # must pass
```

GitHub Actions CI runs these checks automatically (`fast` job). The `full` job runs after the fast
job passes and executes `pnpm build`.

Markdown and docs-only changes skip CI (`paths-ignore`) unless a workflow also touches source files.

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

On every push to `main` and every PR, three jobs run:

| Job    | Runs       | Steps                          |
| ------ | ---------- | ------------------------------ |
| `fast` | Always     | types, dist-check, lint, tests |
| `full` | After fast | full `pnpm build`              |
| `docs` | PR only    | `pnpm docs:check`              |

Doc-only files (`.md`, `docs/`, `CHANGELOG.md`) are excluded from type and build CI runs but still
trigger the `docs` job on PRs.

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
| Railway fail | env vars, `/api/health`, `dist/railway.json` |

## Deployment

```bash
pnpm ci:railway
pnpm prod:build
pnpm prod:start
```

- Deploy root: `dist/`
- Commit `dist/railway.json`
- Template: `ci-settings/railway.dist.json`

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

- Dockerfile uses `node:22` or newer
- Start command binds to `0.0.0.0`
- App uses Railway `$PORT`
- `/api/health` returns 200 quickly
- `dist/railway.json` committed
- No secrets in Docker image or logs
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` set to activate payments

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
