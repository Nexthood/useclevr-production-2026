# Deployment Skill

Use this checklist when changing Railway, environment variables, health checks, build scripts, or production startup behavior.

## Current Deployment Stack

Railway runs the production Next.js app with Nixpacks, Node.js 22+, and pnpm.

## Review Checklist

| Area | What To Check |
| --- | --- |
| Build command | `railway.json` and `package.json` agree on install/build behavior. |
| Start command | Production starts on `0.0.0.0` and uses Railway `$PORT`. |
| Health check | `/api/health` remains fast and dependency-light. |
| Environment | Required secrets are present and not committed to the repo. |
| Database | Neon connection strings are valid for the target environment. |
| Generated files | Runtime uploads, reports, and temporary files stay in ignored or ephemeral paths. |
| Logs | Build and runtime logs contain enough context to diagnose failures. |

## Required Production Variables

- `DATABASE_URL`
- `DIRECT_URL`
- `AUTH_SECRET`
- `GEMINI_API_KEY`

## Useful Commands

```bash
pnpm railway:install
pnpm railway:build
pnpm railway:start
pnpm prod:build
pnpm prod:start
```
