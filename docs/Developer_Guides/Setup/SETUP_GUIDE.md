# Setup Guide

## Requirements

- Node.js 22+
- pnpm 10+
- Neon PostgreSQL
- Gemini API key

## Install

```bash
pnpm install
cp .env.local.example .env.local
pnpm dev
```

## Required Env

```env
DATABASE_URL=
DIRECT_URL=
AUTH_SECRET=
GEMINI_API_KEY=
```

## Optional Env

| Variable | Use |
| --- | --- |
| `PORT` | Local dev port. |
| `AUTH_URL` | Auth URL override when host inference is not enough. |
| `LOCAL_UPLOAD_DIR` | Runtime upload path. |
| `LOCAL_UPLOAD_URL` | Runtime upload URL prefix. |
| `UPLOAD_PROVIDER` | Optional `s3` or `r2`. |

## Database

```bash
pnpm db:generate
pnpm db:push
pnpm db:migrate
pnpm db:studio
```

Files:

- `lib/db/schema.ts`
- `lib/db/index.ts`
- `lib/db/migrations/`

## Production Bundle

```bash
pnpm prod:build
pnpm prod:start
```

Output:

- `dist/server.js`
- `dist/.next/`
- `dist/assets/`

## Troubleshooting

| Issue | Check |
| --- | --- |
| AI fails | `GEMINI_API_KEY`, server restart. |
| Auth fails | `AUTH_SECRET`, optional `AUTH_URL`. |
| DB fails | `DATABASE_URL`, `DIRECT_URL`, Neon SSL. |
| Railway fails | env vars, `/api/health`, `railway.json`. |
