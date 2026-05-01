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
| `pnpm db:push` | Push DB schema |
| `pnpm db:studio` | Open Drizzle Studio |

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

Static files live in `assets/` and are served through `/assets/...`.
