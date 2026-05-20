# Server Settings

This folder stores server-host templates that GitHub Actions copies into generated output.
It is not the GitHub Actions workflow folder; workflow files live in `.github/workflows/`.
It also stays outside `src/` so application code remains free of host-specific configuration.

Each subfolder is one server destination. The current production target is Railway.

Railway branch: `dist`
Railway service root: `/dist`
Migration phase: Railway `preDeployCommand`

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

Template source:

```text
server-settings/railway/railway.dist.json
```

If a second destination is added, keep one server subfolder per destination, for example:

```text
server-settings/railway/railway.dist.json
server-settings/docker/docker.dist.json
server-settings/fly/fly.dist.json
```

Keep this folder focused on server-host templates. Server-specific helper scripts belong under
`scripts/server/<host>/`; local/general scripts stay in the existing non-server `scripts/`
subfolders.

Do not keep a copy in `dist-root/`. Root files for the deployment branch are branch metadata only;
runtime deployment config belongs in generated output.

Keep migrations in Railway `preDeployCommand` while the app runs as one web service. Move migrations
to a separate controlled job only after schema changes, background work, or operational risk require
isolation.
