# AI Interaction Workflow Guide

Use this guide when a user asks for implementation, review, validation, release work, or durable instruction updates.

## Work Cycle

1. Check current branch and worktree status.
2. Read the relevant files before deciding.
3. Preserve staged and unstaged work from the user or other agents.
4. Make focused edits that match existing project patterns.
5. Run the smallest useful validation first.
6. Update requirements, changelog, TODO files, the owning feature guide, and prompt files when
   durable behavior changes.
7. Update `project-logs/interactive-log.md`, `project-logs/activity-log.md`, and
   `docs/AI-interaction/interaction-status.md` after every completed AI interaction.
8. Report the result with concise success, failure, validation, and remaining-risk notes.

## Status Updates

- Use short progress updates during long-running checks, builds, deploy waits, or broad reviews.
- State the current phase and next action in one line.
- Avoid repeated generic reassurance.
- Avoid asking for confirmation when project context gives a safe next step.

## Git And Release Flow

- Start with `git status --short --branch`.
- Keep local work on `beta` unless the user explicitly names another source branch.
- Commit only after validation and documentation updates required by the change.
- Push the requested branch and open the requested PR target.
- Stay on the requested local branch after release actions.

## Validation Pattern

- Use typecheck for TypeScript or shared logic changes.
- Use docs and changelog checks for text-only instruction changes.
- Use TODO lint after task metadata changes.
- Use production packaging checks when deployment output can be affected.
- Summarize skipped validation with the reason.

## Interaction Learning

- Convert loose AI interaction notes into the durable docs folder that matches the audience.
- Store reusable prompts in `project-prompts/`.
- Store detailed session records in `project-logs/interactive-log.md`.
- Store current activity summaries in `project-logs/activity-log.md`.
- Store agent-facing rules in this folder and `AGENTS.md`.
- Store user-facing request guidance in `docs/AI-interaction/user-guides/`.
- Store implementation plans in `.TODO/.PLAN/` only while they are active planning references.
