# UseClevr 2026

AI-powered business intelligence platform built with Next.js, Drizzle, Neon, and Gemini.

## Project Summary

UseClevr helps teams upload business datasets and get:
- Natural-language analysis and insights
- KPI and chart generation
- Shareable/downloadable reports
- Authenticated dashboard workflows

Core stack:
- Next.js (App Router)
- React
- Drizzle ORM + Neon PostgreSQL
- NextAuth v5
- Gemini Flash 2.5 (cloud AI)
- pnpm

## Development

Requirements:
- Node.js 22+
- pnpm 10+

Install and run:

```bash
pnpm install
pnpm dev
```

Build and start:

```bash
pnpm build
pnpm start
```

## Environment Variables

Minimum required:
- `DATABASE_URL`
- `DIRECT_URL`
- `AUTH_SECRET`
- `NEXTAUTH_URL`
- `NEXT_PUBLIC_APP_URL`
- `GEMINI_API_KEY`

Reference template:
- `.env.railway.example`

## Railway Deployment (pnpm)

This project is configured for pnpm-based Railway deployments.

### 1) Railway service setup
- Connect repository in Railway
- Set Runtime/Builder to Nixpacks (Node)
- Ensure Node 22+ is used

### 2) Railway build/start commands
Use these in Railway service settings:

- Install command:
  - `pnpm install --frozen-lockfile`
- Build command:
  - `pnpm build`
- Start command:
  - `pnpm start`

Or use the combined script:
- `pnpm railway:ci`

### 3) Environment variables in Railway
Set all required variables from `.env.railway.example`.

### 4) Health check
- Path: `/api/health`
- Port: `8080`

## Notes

- Proxy/auth edge logic uses `proxy.ts` (Next 16 convention)
- Metadata viewport is exported via `viewport` in `app/layout.tsx`
- Neon fetch connection cache deprecation handled in `lib/db/index.ts`
