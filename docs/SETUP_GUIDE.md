# UseClevr Setup Guide

This guide reflects the current stack: Next.js 16, React 19, Auth.js / NextAuth v5, Drizzle ORM, Neon PostgreSQL, Gemini, Railway, and pnpm.

## Prerequisites

- Node.js 22+
- pnpm 10+
- Neon PostgreSQL database
- Gemini API key from Google AI Studio

## Install

```bash
pnpm install
```

## Environment

Create a local environment file:

```bash
cp .env.local.example .env.local
```

Minimum required values:

```env
DATABASE_URL="postgresql://user:pass@host.neon.tech/db?sslmode=require"
DIRECT_URL="postgresql://user:pass@host.neon.tech/db?sslmode=require"
AUTH_SECRET="generate-with-openssl-rand-base64-32"
GEMINI_API_KEY="AIza..."
```

Optional upload storage can be configured with S3/R2 variables from `.env.railway.example`. If no upload provider is configured, the app uses local runtime storage.

## Database

```bash
pnpm db:generate
pnpm db:push
pnpm db:studio
```

Schema lives under `lib/db/` and migrations live under `lib/db/migrations/`.

## Development

```bash
pnpm dev
```

Use a different port:

```bash
PORT=4000 pnpm dev
```

## Production Dist

Create the production web-app bundle:

```bash
pnpm prod:build
```

This creates `dist/` as a runnable production app:

- `dist/server.js` is the standalone Next.js server entry.
- `dist/.next/` contains runtime server/static assets.
- `dist/public/` contains public assets.
- Environment files are not copied into `dist`; production reads secrets from the runtime environment.
- `dist/` is generated output and is intentionally ignored by Git.

Run the production bundle:

```bash
pnpm prod:start
```

Or install, build, and run in one command:

```bash
pnpm prod
```

## Railway

Set required variables from `.env.railway.example`, then use:

```bash
pnpm prod:build
pnpm prod:start
```

Health check:

```text
/api/health
```

## Active Integrations

- Cloud AI: Gemini
- Database: Neon PostgreSQL
- ORM: Drizzle
- Auth: Auth.js / NextAuth credentials auth
- Payments: disabled/not configured
- DeepSeek/OpenAI cloud providers: removed/inactive
- Stripe: removed/inactive

## Troubleshooting

### AI Features Not Working

Confirm `GEMINI_API_KEY` is set in the environment used by the server.

### Authentication Not Working

Confirm `AUTH_SECRET` is set and at least 32 characters. `AUTH_URL` is optional unless host inference is not enough for a custom proxy/domain.

### Database Connection Issues

Confirm `DATABASE_URL` and `DIRECT_URL` are valid Neon PostgreSQL URLs and include SSL settings required by your Neon connection.
