# CI Settings

Railway service root: `dist`

Railway needs this file in the deployed commit:

```text
dist/railway.json
```

Sync it from the template:

```bash
pnpm ci:railway
```

Full production bundle:

```bash
pnpm prod:build
```

Template source:

```text
ci-settings/railway.dist.json
```
