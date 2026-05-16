# CI and Hosting Settings

This folder stores deploy templates that are copied into production artifacts.

Railway should not use the repository root as its app root. Use `dist/` as the
Railway root after running:

```bash
pnpm prod:build
```

`ci-settings/railway.dist.json` is the source template for `dist/railway.json`.
Keep host-specific placeholders here so developers can review the deployment
contract without changing the repository root into a Railway project.
