# Testing Guide

| Check | Command |
| --- | --- |
| Build | `pnpm build` |
| TypeScript | `pnpm exec tsc --noEmit` |
| Database studio | `pnpm db:studio` |
| Health endpoint | `curl http://localhost:3000/api/health` |

## Manual Smoke Tests

1. Start the app with `pnpm dev`.
2. Open the public home page.
3. Sign in or create a test account.
4. Upload a sample CSV.
5. Confirm dashboard KPIs and charts render.
6. Ask a dataset question in the assistant.
7. Generate or download a report.

## Verified Computation Checks

Use [../Architecture/VERIFIED_COMPUTATION_OPERATIONS.md](../Architecture/VERIFIED_COMPUTATION_OPERATIONS.md) for query-specific checks.

## Deployment Checks

1. Confirm Railway environment variables are set.
2. Confirm `/api/health` responds after deployment.
3. Confirm the app binds to Railway `$PORT`.
4. Review Railway logs for build or runtime errors.
