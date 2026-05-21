# Server Settings

This folder stores server-host templates that GitHub Actions copies into generated output.
It is not the GitHub Actions workflow folder; workflow files live in `.github/workflows/`.
It also stays outside `src/` so application code remains free of host-specific configuration.

Each subfolder is one server destination. Current planned production targets are Railway and Vercel.

Railway branch: `dist`
Railway service root: `/dist`
Railway config file: `/dist/railway.json`
Migration phase: Railway `preDeployCommand`

Vercel branch: `main`
Vercel project root: `/`
Vercel config file: `/vercel.json`

Railway needs this file in the deployed commit:

```text
dist/railway.json
```

Sync it from the template:

```bash
pnpm deploy:railway:sync
```

Full production bundle:

```bash
pnpm prod:build
```

Template source (simplified at dist-root root level):

```text
dist-root/railway.json
dist-root/vercel.json
```

These simplified templates are at the `dist-root` root level, outside the `/dist` folder.

Keep server-specific helper scripts under `scripts/server/<host>/`; local/general scripts stay in the existing non-server `scripts/` subfolders.

Do not keep a copy in `dist-root/`. Root files for the deployment branch are branch metadata only;
runtime deployment config belongs in generated output.

Keep migrations in Railway `preDeployCommand` while the app runs as one web service. Move migrations
to a separate controlled job only after schema changes, background work, or operational risk require
isolation.

Railway service settings should not keep old custom npm commands. Leave build, pre-deploy, and start
commands unset in the dashboard so `/dist/railway.json` controls them. If a manual override is needed,
use the generated pnpm-backed scripts:

```bash
pnpm run railway:predeploy
pnpm start
```

Vercel should use `/vercel.json` generated from the Vercel template. Do not hand-edit `vercel.json`;
edit `dist-root/vercel.json`, then run `pnpm deploy:vercel:sync`.
