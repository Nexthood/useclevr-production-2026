# Developer Guide

## Setup

```bash
pnpm install
cp .env.local.example .env.local   # copy and fill in your values
pnpm dev
```

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
MOCK_AI_MODE=false       # Local-only AI development responses; production runtime ignores true
MOCK_AI_RESPONSE_DELAY_MS=250
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

Use [docs/api-tests/README.md](/home/csaba/Documents/Useclever-2026/docs/api-tests/README.md) and the
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
- `pre-commit` — keeps commits fast and leaves validation to commit message and push gates.
- `pre-push` — runs TypeScript, deploy config checks, linting, production packaging, workflow validation, and workflow check-name golden validation.

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

| Job                                    | Runs    | Steps                                            |
| -------------------------------------- | ------- | ------------------------------------------------ |
| `Validate source and production build / validate` | Always  | types, dist-check, lint, tests, production build |
| `Documentation checks`                 | PR only | `pnpm docs:check`                                |

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
