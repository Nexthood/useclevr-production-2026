# CI Server Configs

## Table Of Contents

- [Ownership](#ownership)
- [Validation](#validation)
- [Adding Another Host](#adding-another-host)

This project keeps server-host config templates separate from GitHub Actions workflow files so hosts
can be replaced without reshaping the CI pipeline.

## Ownership

| Path                                       | Owner                                 | Published location                                                                              |
| ------------------------------------------ | ------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `dist-root/server-config/railway.json`     | Railway generated-output deploys      | `dist` branch `/server-config/railway.json`                                                     |
| `dist-root/server-config/nixpacks.toml`    | Railway generated-output install plan | copied to generated `/dist/nixpacks.toml`                                                       |
| `dist-root/server-config/vercel.json`      | Vercel source-branch deploys          | source branch root `vercel.json`, plus `dist` branch `/server-config/vercel.json` for reference |
| `.github/workflows/branch-maintenance.yml` | GitHub Actions                        | not published to deployment hosts                                                               |

Host config files must not land at the `dist` branch root. `nixpacks.toml` is the exception copied
into `/dist` because Nixpacks reads it from the Railway service root.

## Validation

```bash
pnpm validate:dist
```

This validates the Railway template and checks that source-branch `vercel.json` matches the Vercel
template.

## Adding Another Host

1. Add a native config template under `dist-root/server-config/`.
2. Add a host helper under `scripts/server/<host>/`.
3. Add the helper to `pnpm validate:dist`.
4. Update this guide and the deployment branch publishing checks.

Keep generated app output assembly in `scripts/package-dist/`. Keep host-specific policy in
`dist-root/server-config/` and `scripts/server/<host>/`.
