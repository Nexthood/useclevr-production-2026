# Local Private Config Copies Plan

Keep private local-only config outside git, but make sure each ignored config has a durable private
copy so a fresh checkout does not lose the setup.

## Goal

- Keep build output ignored.
- Keep secrets and workstation-only files out of git.
- Keep a private copy path for local config that another checkout can restore from.

## In Scope

- Root local environment files:
  - `.env`
  - `.env.local`
  - `.env.local.neon`
  - `.env.*.local`
  - `.env.production`
- Local editor settings:
  - `.vscode/settings.json`
- Local Railway link:
  - `.railway/project.json`
- Local AI and agent state:
  - `.antigravitycli/`
  - local-only `.kilo/` files that are not already tracked under `.kilo/agent/`
- Matching local-only files under `dist-root/` when a deployment checkout uses its own ignored env
  or editor settings there.

## Private Copy Rules

- Store private copies outside the repo in a stable personal backup location.
- Keep one restore-ready copy per environment: local app, local deploy test, and production-only
  reference values without live secrets in the repo.
- Keep example or template files in the repo only when they do not expose real secrets.
- Do not copy `dist/`, `.next/`, logs, caches, or generated output into the private config backup.

## Recommended Backup Layout

```text
<private-backup-root>/
  UseClevr/
    env/
      root.env.local
      root.env.production
      dist-root.env.local
    railway/
      project.json
    editor/
      vscode-settings.json
    ai-local/
      antigravitycli/
      kilo-local/
```

## Implementation Steps

1. Audit ignored config files that contain environment, host, editor, or local-agent setup.
2. Create or refresh private backup copies outside the repo.
3. Keep redacted example files in the repo when a new checkout needs a visible starting point.
4. Add restore instructions to the developer guide when the copy path becomes standardized.
5. Review the private copies after local environment, Railway project, or AI-agent setup changes.

## Notes

- The repo stays the source of truth for shared config.
- The private backup location stays the source of truth for ignored personal config.
- Build output remains disposable and never belongs in the private-copy workflow.
