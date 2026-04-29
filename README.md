# UseClevr 2026

AI-powered business intelligence platform for turning uploaded business datasets into KPI dashboards, natural-language insights, and downloadable reports.

## Frontend Features

- Dataset upload and analysis dashboard
- KPI cards, charts, regional/product breakdowns, and report views
- AI chat for dataset questions and verified computations
- Local AI installer/status UI with dynamic same-origin API calls
- Authenticated app shell, settings, downloads, referral, and assistant pages
- Responsive public pages for landing, pricing, auth, legal, and contact

## Tech Stack

- Next.js 16 App Router with React 19
- TypeScript 6
- Tailwind CSS with Radix UI primitives and lucide icons
- Drizzle ORM with Neon PostgreSQL
- Auth.js / NextAuth v5 credentials auth
- Gemini via AI SDK for cloud AI
- Local AI bridge routes for Ollama/local runtime support
- pnpm 10 package management

## Development

Requirements:
- Node.js 22+
- pnpm 10+

Install and run:

```bash
pnpm install
pnpm dev
```

Use a custom local port:

```bash
PORT=4000 pnpm dev
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
- `GEMINI_API_KEY`

Reference template:
- `.env.local.example`
- `.env.railway.example`

## Railway Deployment (pnpm)

This project is configured for pnpm-based Railway deployments.

### 1) Railway service setup
- Connect repository in Railway
- Set Runtime/Builder to Nixpacks (Node)
- Ensure Node 22+ is used

### 2) Railway build/start commands
Use these in Railway service settings:

- Build command:
  - `pnpm railway:ci:min`
- Start command:
  - leave empty when using `pnpm railway:ci:min` as the build command

Alternative split commands:
- Install command: `pnpm install --frozen-lockfile`
- Build command: `pnpm build`
- Start command: `pnpm start`

`pnpm railway:ci:min` runs install, build, and the minimal production start from `package.json`. The underlying start command is:

```bash
next start --hostname 0.0.0.0 --port ${PORT:-8080}
```

Railway provides `PORT` automatically. The fallback `8080` is only for local production-style starts.

For non-silent deploy logs, use `pnpm railway:ci`.

### 3) Environment variables in Railway
Set all required variables from `.env.railway.example`.
Do not set fixed frontend URLs unless you need a custom `AUTH_URL`; the app trusts Railway proxy host headers.

### 4) Health check
- Path: `/api/health`
- Port: Railway `$PORT`

## Notes

- Proxy/auth edge logic uses `proxy.ts` (Next 16 convention)
- Metadata viewport is exported via `viewport` in `app/layout.tsx`
- Neon fetch connection cache deprecation handled in `lib/db/index.ts`
- Runtime-generated files are ignored (`.next/`, `public/generated/`, `datasets/`, report temp data)
