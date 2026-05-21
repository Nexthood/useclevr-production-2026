# Production Readiness Checklist

Use this checklist before promoting a beta-to-main change to production.

## Branch And CI

- PR title starts with `PR:`.
- PR targets `main`.
- Source validation is green.
- Auto-merge is enabled only after required checks appear.
- `beta` push did not trigger source CI.

## Deployment Targets

- Railway deploys from branch `dist` with root `/dist`.
- Railway config file path points to `/railway.json` on the dist branch root.
- Railway dashboard command overrides are empty unless a temporary pnpm-backed override is required.
- Railway waits for GitHub Actions before deploying.
- Vercel deploys from branch `main` with root `/`.
- Vercel `vercel.json` is in sync with `dist-root/server-config/vercel.json`.
- Vercel preview and production branch settings match the intended release flow.
- `/api/health` returns 200 on each production target.
- `dist/deployment-manifest.json` identifies the source commit and healthcheck path.

## Accounts And Secrets

- GitHub repository rules require the source validation check on `main`.
- Railway has `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, and `GEMINI_API_KEY`.
- Vercel has the same required runtime secrets for source-branch deploys.
- Neon database is reachable from the active deployment targets.
- Stripe secrets are configured only when billing is enabled.
- Upload storage account and bucket are configured when durable uploads are enabled.

## Data And AI

- Empty uploads return a controlled result.
- Malformed rows do not crash analysis.
- Missing headers show an actionable user-facing error.
- Large CSV files stay within configured upload limits.
- Mixed currencies and time zones produce deterministic summaries.
- AI answers refuse questions that cannot be answered from uploaded data.
- AI answers separate verified calculations from suggested interpretation.

## Access And Support

- Regular users cannot access super-admin pages or APIs.
- Support tickets are visible only to the ticket owner or a super-admin.
- Super-admin support notes are not editable by regular users.
- Referral signup and paid events are idempotent.
- Self-referrals do not earn rewards.
- Referred-user lists do not expose unnecessary personal data.

## Billing Operations

- Payment provider events can be reconciled after downtime.
- Refund, cancellation, and credit reversal rules are confirmed before billing changes ship.
- Any migration job or worker-service split is added only when the single web-service deployment
  becomes operationally risky.
