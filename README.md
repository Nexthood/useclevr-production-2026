# UseClevr 2026

AI business intelligence for uploaded CSV/business datasets.

UseClevr turns data into dashboards, KPIs, forecasts, verified AI answers, and downloadable reports.

## Stack

Next.js 16, React 19, TypeScript 6, Tailwind CSS, Drizzle, Neon PostgreSQL, Auth.js, Gemini AI, pnpm, Railway.

## Start

```bash
pnpm install
cp .env.local.example .env.local
pnpm dev
```

Required env vars:

```env
DATABASE_URL=
DIRECT_URL=
AUTH_SECRET=
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
| `dist/` | Standalone production bundle created by `pnpm prod:build` | Production artifact |
| `public/` | Files that must be served directly from the site root | Tracked, except generated assets |
| `src/assets/` | App images, downloads, styles, and static assets served through `/assets/...` | Tracked |
| `.kilo/agent/*.md` | Durable Kilo agent presets | Tracked |
| `.kilo/*` local state | Kilo sessions, worktrees, node_modules | Ignored |

Best practice during development: use `pnpm dev` and leave `.next/` ignored. If the dev cache gets stale or noisy, run `pnpm clean:dev`. Use `pnpm prod:build` only when you need to regenerate the production `dist/` bundle.

## Deploy

Railway:

- Build: `pnpm railway:install && pnpm railway:build`
- Start: `pnpm railway:start`
- Health: `/api/health`

Guide: [docs/Developer_Guides/Ops/deploy.md](docs/Developer_Guides/Ops/deploy.md)

## Docs

- [Developer guides](docs/Developer_Guides/README.md)
- [User guides](docs/User_Guides/README.md)
- [TODO](.TODO/TODO.md)
- [Local agent contract](app/api/local-agent/contract.md)

## Assets

Use `public/` only when a file must be reachable at a root URL such as `/robots.txt`, `/manifest.webmanifest`, or `/assets/generated/...`.

Static files live in `src/assets/` and are served through `/assets/...`.
The folder `src/app/assets/` is only the route handler that exposes those files.

- `src/assets/images/` for images and branding assets
- `src/assets/scripts/` for build/runtime helper scripts and SQL helpers
- `src/assets/styles/` for global CSS
- `src/assets/downloads/` for downloadable assets and README metadata
