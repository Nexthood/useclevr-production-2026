# GitHub Actions

Purpose: run lightweight checks before Railway deployment.

## Recommended Checks

| Check | Command |
| --- | --- |
| Install | `pnpm install --frozen-lockfile` |
| Build | `pnpm build` |
| TypeScript | `pnpm exec tsc --noEmit` |
| Security audit | `pnpm audit` |

## Required Repo Secrets

Only add these if workflows need Railway CLI access:

```text
RAILWAY_TOKEN
RAILWAY_PROJECT_ID
```

App runtime secrets should stay in Railway unless a workflow explicitly needs them.

## PR Expectations

- Install succeeds.
- Build succeeds.
- TypeScript status is visible.
- Security audit output is visible.
- Workflow comments or checks are short and actionable.

## Failure Triage

| Failure | Check |
| --- | --- |
| Install | pnpm version, lockfile, Node version. |
| Build | Next.js errors, missing env stubs, asset paths. |
| TypeScript | Existing strict issues vs new errors. |
| Railway deploy | Railway logs and `railway.json`. |
