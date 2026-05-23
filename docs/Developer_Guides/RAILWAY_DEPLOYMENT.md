# Railway Deployment

## Table Of Contents

- [Railway Settings](#railway-settings)
- [Build Shape](#build-shape)
- [Runtime Commands](#runtime-commands)
- [Railway CLI](#railway-cli)
- [Local Checks](#local-checks)
- [Troubleshooting](#troubleshooting)

Railway deploys generated production output from the `dist` branch.

## Railway Settings

- Branch: `dist`
- Root directory: `/dist`
- Config file path: `/server-config/railway.json`
- Builder: Nixpacks

Leave Railway dashboard build, pre-deploy, and start command overrides empty unless debugging a
temporary incident. The config file owns those commands.

## Build Shape

GitHub Actions builds the app from `main`, publishes generated output to `/dist` on the `dist`
branch, and publishes Railway config to `/server-config/railway.json`.

`dist-root/server-config/nixpacks.toml` is copied to generated `/dist/nixpacks.toml` so it can
control Nixpacks install and build phases from the Railway service root:

- setup uses Node 22 so Railway does not fall back to Node 18's stale Corepack
- install refreshes Corepack and activates pnpm 10.23.0 for Node 22.11 compatibility
- install runs production `pnpm install`
- build restores `.next` from `next-build` if Railway's snapshot omits dot-directories

The generated output intentionally does not include `pnpm-workspace.yaml`, `railway.json`, or
`vercel.json`.

## Runtime Commands

Railway config uses:

```bash
pnpm run railway:predeploy
pnpm run start:railway
```

The start command binds to Railway `$PORT` and `0.0.0.0` through the runtime helper.

## Railway CLI

Fastest safe operator flow:

```bash
railway login
railway link
railway status
railway logs
```

Trigger the latest deploy:

```bash
railway redeploy
```

If `redeploy` is unavailable in the installed CLI:

```bash
railway up
```

Use `pnpm dlx @railway/cli <command>` when Railway is not installed globally. CLI access requires a
browser login or `RAILWAY_TOKEN` in the shell environment.

## Local Checks

```bash
pnpm validate:dist
pnpm prod:build
test ! -f dist/pnpm-workspace.yaml
test ! -f dist/railway.json
test ! -f dist/vercel.json
```

## Troubleshooting

If Railway logs show `RUN npm i`, Nixpacks did not use generated `/dist/nixpacks.toml` or Railway is
building the wrong root directory.

If logs show workspace metadata errors, confirm generated `/dist` does not contain
`pnpm-workspace.yaml` and the deployment branch root does not contain `pnpm-workspace.yaml`.

If logs show `$NIXPACKS_PATH` as undefined, keep the Nixpacks plan explicit in
`dist-root/server-config/nixpacks.toml`; do not depend on Railway-only build variables unless they
are defined before use.

If logs show `Cannot find matching keyid` during `corepack prepare`, Railway used an old Corepack
from Node 18. Keep the generated Nixpacks plan on Node 22 and install the latest Corepack before
activating pnpm. If logs show pnpm requiring Node 22.13 or newer, keep Railway on pnpm 10 until
Railway's Nixpacks Node 22 package moves past 22.13.

If logs show `ERR_PNPM_NO_LOCKFILE`, keep Railway runtime installs on `--no-frozen-lockfile` because
the generated deployment package is smaller than the source workspace and Railway installs from
generated output only.

If runtime logs show `Could not find a production build in the './.next' directory`, keep the
generated `next-build` folder and the Nixpacks build restore step. Railway can omit dot-directories
from the service snapshot, while Next still expects `.next` at runtime.
