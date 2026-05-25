# Git Command Patterns

## Status

```bash
git status --short --branch
git diff --stat
```

## Review

```bash
git diff --check
git diff -- path/to/file
git log --oneline -n 20
```

## Branches

```bash
git fetch origin
git switch beta
git pull --ff-only
```

## Release Flow

```bash
pnpm validate
git status --short
```

Run release or publish steps only from the documented branch for that workflow.
