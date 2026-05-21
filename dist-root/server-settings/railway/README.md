# Railway Deployment Target

This folder contains Railway-specific deployment templates copied into generated output.

Railway should deploy from:

```text
branch: dist
root: /dist
config: /dist/railway.json
```

Do not put `railway.json` at the `dist` branch root or in `dist-root/`.

The generated `/dist` folder includes:

```text
package.json
pnpm-workspace.yaml
railway.json
server.js
```

`pnpm-workspace.yaml` and the Railway build command both allow dependency build scripts so Railway
can install `sharp`, `esbuild`, and `core-js` without an interactive `pnpm approve-builds` step.

The generated package also exposes Railway-safe scripts:

```bash
pnpm run railway:predeploy
pnpm run db:push
pnpm run db:migrate
pnpm start
```

Do not configure Railway dashboard custom commands with `npm`. Dashboard command overrides can hide
the repo config for that deployment. Prefer clearing those fields and letting `/dist/railway.json`
provide `buildCommand`, `preDeployCommand`, and `startCommand`.
