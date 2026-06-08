# Pre-Commit Checklist

The pre-commit hook runs `pnpm validate:precommit`.

## Required Records

Every commit stages current versions of:

- `CHANGELOG.md`
- `project-logs/interactive-log.md`
- `project-logs/activity-log.md`
- `docs/AI-interaction/interaction-status.md`

The project-record check also confirms reusable prompts live in `project-prompts/` and rejects the
retired prompt and interaction-log locations under `docs/AI-interaction/`.

## Feature Changes

When a feature changes:

- Update `requirements.md` for user-visible behavior.
- Update the owning user or developer guide for durable workflows, rules, or operator procedures.
- Update `.TODO/` when work becomes active, completed, deferred, or deliberately ignored.
- Update `CHANGELOG.md` with current user or developer impact.

## Validation Split

- Pre-commit checks project records, TODO metadata, changelog wording, secret exposure, and package
  scripts.
- Pre-push checks TypeScript, deployment configuration, ESLint, production packaging, and workflow
  metadata.
