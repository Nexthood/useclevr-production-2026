# Dist Branch Deployment No-Fix Decisions

- No rollback documentation now. Use Railway redeploys and normal `dist` branch commits while the
  deployment path is still settling.
- Do not move database migrations to a separate job now. Keep them in Railway `preDeployCommand`
  because the app has one web service and migrations should run in the target runtime environment
  immediately before release.
- Do not move `server-settings/` into `scripts/build`. The folder contains server-host templates, not
  executable build scripts.
- Do not commit `node_modules/` to the `dist` branch. Railway/Railpack and pnpm caching should handle
  installs.
