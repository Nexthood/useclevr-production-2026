# Deployment

Checklist for changing Railway, environment variables, health checks, or production startup.

## Stack

Railway runs production with Docker, Node.js 22+, and pnpm.

## Checklist

| Area | Check |
| --- | --- |
| Build command | `railway.json` and `package.json` agree on install/build behavior |
| Start command | Production starts on `0.0.0.0` and uses Railway `$PORT` |
| Health check | `/api/health` remains fast and dependency-light |
| Environment | Required secrets present and not committed |
| Database | Neon connection strings valid for target environment |
| Generated files | Runtime uploads, reports, temporaries in ignored or ephemeral paths |
| Logs | Build and runtime logs contain enough context to diagnose failures |

## Required Production Variables

- `DATABASE_URL`
- `DIRECT_URL`
- `AUTH_SECRET`
- `GEMINI_API_KEY`

## Commands

```bash
pnpm railway:install
pnpm railway:build
pnpm railway:start
pnpm prod:build
pnpm prod:start
```
