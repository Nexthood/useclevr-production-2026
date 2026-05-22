# Railway Deployment

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

Generated `/dist/nixpacks.toml` controls Nixpacks phases:

- setup installs Node 26
- install enables Corepack and activates pnpm 11.1.2
- install runs production `pnpm install`
- build is a no-op because GitHub Actions already built the standalone app

The generated output intentionally does not include `pnpm-workspace.yaml`, `railway.json`, or
`vercel.json`.

## Runtime Commands

Railway config uses:

```bash
pnpm run railway:predeploy
pnpm run start:railway
```

The start command binds to Railway `$PORT` and `0.0.0.0` through the runtime helper.

## Local Checks

```bash
pnpm validate:dist
pnpm prod:build
test ! -f dist/pnpm-workspace.yaml
test ! -f dist/railway.json
test ! -f dist/vercel.json
```

If Railway logs show `RUN npm i`, Nixpacks did not use generated `/dist/nixpacks.toml` or Railway is
building the wrong root directory.
