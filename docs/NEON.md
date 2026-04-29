# Neon project and connection (local setup)

Project ID: withered-star-79790747
Branch ID: br-crimson-sun-ai49oqj4 (main)
Database: neondb
Role: neondb_owner

Connection string is stored in `.env.local.neon` in this repository (local-only).
Prefer copying values into your existing `.env.local` or configuring them in your deployment platform's secret store.

Quick usage:

1) Copy local secrets into your working env (recommended):

```bash
cp .env.local.neon .env.local
```

2) Or set environment variables in your deployment platform (Vercel/Netlify/etc.).

Security note:

- `.env.local.neon` and `.env.local` are ignored by `.gitignore` and should never be committed.
- Keep `.env.local.example` in the repo as a template without secrets.
