# UseClevr 2026
# Static Distribution

AI business intelligence for uploaded CSV/business datasets.
This application is designed as a **Hybrid AI Application** and requires a Node.js runtime to function correctly.

UseClevr turns data into dashboards, KPIs, forecasts, verified AI answers, and downloadable reports.
### Why a pure static export is not supported:
- **Security:** AI API keys and Database credentials must remain server-side.
- **Dynamic Features:** Chat, File Uploads, and Database queries require the Next.js server environment.
- **Middleware:** Authentication and route protection rely on server-side logic.

### Hosting without Node.js (e.g., PHP servers):
This project is **not compatible** with PHP-only hosting. While a static export can be served by any web server, the core AI and database features require a Node.js runtime (v22+). If you must use a PHP environment, you would need to rewrite the backend logic in PHP and use the React components as a headless frontend.

## Stack

Next.js 16, React 19, TypeScript 6, Tailwind CSS, Drizzle, Neon PostgreSQL, Auth.js, Gemini AI, pnpm, Railway.

## Start

```bash
pnpm install
cp .env.local.example .env.local
# Set AUTH_URL and AUTH_TRUST_HOST in .env.local
pnpm dev
```

Required env vars:

```env
DATABASE_URL=
DIRECT_URL=
AUTH_SECRET= # Also supports NEXTAUTH_SECRET
AUTH_URL= # Production: https://useclevr-main.up.railway.app
          # Local Dev (pnpm dev): http://localhost:3000 (or comment out for auto-detection)
          # Local Prod (pnpm prod:local): http://localhost:8080
          # Also supports NEXTAUTH_URL
AUTH_TRUST_HOST=true # Required for production, local prod testing, and network dev
GEMINI_API_KEY=
```

Setup guide: [docs/Developer_Guides/Setup/SETUP.md](docs/Developer_Guides/Setup/SETUP.md)

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Local dev |
| `pnpm build` | Build |
| `pnpm start` | Start built app |
| `pnpm prod` | Production bundle |
| `pnpm analyze:business` | Inspect latest dataset business metrics from the database |
| `pnpm test:csv-analyzer` | Run the CSV analyzer smoke script |
| `pnpm test:neon` | Test database connectivity with `NEON_DATABASE_URL`, `DIRECT_URL`, or `DATABASE_URL` |
| `pnpm clean:dev` | Remove local `.next` cache and `tsconfig.tsbuildinfo` |
| `pnpm clean:prod` | Remove `dist` production bundle plus dev cache |
| `pnpm clean:generated` | Remove generated public assets |
| `pnpm db:push` | Push DB schema |
| `pnpm db:studio` | Open Drizzle Studio |

## Workspace Outputs

Keep root clutter predictable:

| Path | Purpose | Git policy |
| --- | --- | --- |
| `.next/` | Local Next.js dev/build cache created by `pnpm dev` and `pnpm build` | Ignored |
| `dist/` | Flat standalone production bundle for Railway deployment | Production artifact |
| `src/assets/` | App images, downloads, styles, and static assets served through `/assets/...` | Tracked |
| `src/assets/generated/` | Runtime-generated report files served through `/assets/generated/...` | Ignored except README |
| `.kilo/agent/*.md` | Durable Kilo agent presets | Tracked |
| `.kilo/*` local state | Kilo sessions, worktrees, node_modules | Ignored |

Best practice during development: use `pnpm dev` and leave `.next/` ignored. If the dev cache gets stale or noisy, run `pnpm clean:dev`. Use `pnpm prod:build` only when you need to regenerate production output.

## Deploy

Railway:

- Use Railway root directory `dist`.
- Build command: `echo 'Using pre-built artifacts from dist/'`
- Start command: `AUTH_URL=${AUTH_URL:-$NEXTAUTH_URL} AUTH_SECRET=${AUTH_SECRET:-$NEXTAUTH_SECRET} AUTH_TRUST_HOST=true HOSTNAME=0.0.0.0 PORT=${PORT:-8080} node server.js`
- Health: `/api/health`
- Railway reads `dist/railway.json` when the selected root directory is `dist`. Dashboard-level build/start settings override the file if they are set.

Guide: [docs/Developer_Guides/Ops/deploy.md](docs/Developer_Guides/Ops/deploy.md)

## Docs

- [Developer guides](docs/Developer_Guides/README.md)
- [User guides](docs/User_Guides/README.md)
- [TODO](.TODO/TODO.md)
- [Local agent contract](app/api/local-agent/contract.md)

## Assets

Static files live in `src/assets/` and are served through `/assets/...`.
The folder `src/app/assets/` is only the route handler that exposes those files.

- `src/assets/images/` for images and branding assets
- `src/assets/scripts/` for build/runtime helper scripts and SQL helpers
- `src/assets/styles/` for global CSS
- `src/assets/downloads/` for downloadable assets and README metadata
- `src/assets/generated/` for runtime-generated report files
### Deployment Recommendation:
- Use `dist/` for Node-compatible hosting (e.g., Railway, Vercel, or a VPS).
- Ensure the server has access to the environment variables defined in the project configuration.
