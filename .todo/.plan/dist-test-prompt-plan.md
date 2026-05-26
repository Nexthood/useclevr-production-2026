# Dist-Test Branch Prompt Plan

## Prompt for Agent

Set up and validate deployment to `test.useclevr.com` using a Railway link to the `dist-test` branch.

**Tasks:**

1.  Create/copy `dist-root/server-config/railway.json` for the test environment, adjusting settings for `dist-test` branch.
2.  Run `node ./scripts/server/railway/sync-config.cjs --check` to validate Railway config.
3.  Ensure `dist-root/server-config/nixpacks.toml` supports `pnpm@latest` for stable builds (already fixed).
4.  Generate `dist/` via `pnpm prod:build` to preview test deployment.
5.  Verify Railway deployment can run `dist-root/server-config/railway.json` from `dist-test` branch.
6.  Validate core endpoints: `/api/health`, `/api/auth`, `/api/datasets` on test environment.
7.  Report status of `test.useclevr.com` with any config adjustments needed.
