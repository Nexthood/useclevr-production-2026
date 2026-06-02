# AI Behaviour Guide

Use this guide for AI-agent behavior in this repository.

## Operating Rules

- Preserve user and other-agent worktree changes.
- Read local project instructions before editing.
- Keep `docs/AI-interaction/` updated after durable AI instruction changes.
- Keep user guidance, AI-agent guidance, prompt examples, and bookkeeping guidance separate.
- Keep text-file language direct and current-state.

## Production Packaging

- Keep `middleware.ts` temporarily while it is the stable production packaging path.
- Revisit `middleware` to `proxy` only after production build succeeds, dist packages correctly, Railway starts, and `/api/health` passes.
- Treat Railway tokens as sensitive and never write them into docs, TODOs, logs, or summaries.

## Local Checks

- Use the pre-commit hook for staged ESLint autofix, Prettier, TODO checks, package checks, and workflow checks.
- Use `pnpm lint` as a manual deeper review command for broad source changes.
- Use `pnpm prod:build` when a change affects deployment output.
