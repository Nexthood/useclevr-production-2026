# UseClevr 2026

AI business intelligence for uploaded CSV/business datasets.

Needs Node.js 26+. Static/PHP-only hosting is not supported.

## Stack

Next.js 16, React 19, TypeScript 6, Tailwind CSS, Drizzle, Neon PostgreSQL, Auth.js, Gemini AI,
pnpm, Railway.

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

## Commands

| Command                  | Purpose                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------ |
| `pnpm dev`               | Local dev                                                                            |
| `pnpm build`             | Build                                                                                |
| `pnpm start`             | Start built app                                                                      |
| `pnpm prod`              | Production bundle                                                                    |
| `pnpm ci:railway`        | Sync `dist/railway.json` only                                                        |
| `pnpm analyze:business`  | Inspect latest dataset business metrics from the database                            |
| `pnpm test:csv-analyzer` | Run the CSV analyzer smoke script                                                    |
| `pnpm test:neon`         | Test database connectivity with `NEON_DATABASE_URL`, `DIRECT_URL`, or `DATABASE_URL` |
| `pnpm clean:dev`         | Remove local `.next` cache and `tsconfig.tsbuildinfo`                                |
| `pnpm clean:prod`        | Remove `dist` production bundle plus dev cache                                       |
| `pnpm clean:generated`   | Remove generated public assets                                                       |
| `pnpm db:push`           | Push DB schema                                                                       |
| `pnpm db:studio`         | Open Drizzle Studio                                                                  |

## Deploy

- Use Railway root directory `dist`.
- Railway service config must exist at `dist/railway.json` in the deployed commit.
- To refresh only that file: `pnpm ci:railway`.
- To refresh the full bundle: `pnpm prod:build`.
- Build command: `echo 'Using pre-built artifacts from dist/'`
- Start command:
  `AUTH_URL=${AUTH_URL:-$NEXTAUTH_URL} AUTH_SECRET=${AUTH_SECRET:-$NEXTAUTH_SECRET} AUTH_TRUST_HOST=true HOSTNAME=0.0.0.0 PORT=${PORT:-8080} node server.js`
- Health: `/api/health`

## Development Notes

### Workflow Improvements

- Smoke test in `branch-maintenance.yml` simplified to use fixed sleep interval for faster, more predictable execution
- Customer management API enhanced with PATCH/DELETE endpoints for admin dashboard
- Admin dashboard features loading states and toast notifications for better UX
- Frontpage contact button now links to contact page instead of mailto:

## Docs

- [Developer guides](docs/Developer_Guides/README.md)
- [User guides](docs/User_Guides/README.md)
