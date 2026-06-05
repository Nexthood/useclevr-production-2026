# AI Interaction Request Guide

Use this guide to ask project AI assistants for focused implementation work, review, planning, and release follow-through.

## Request Pattern

- Start with the page, feature, branch, or document that needs work.
- State the current behavior you want.
- Include release actions such as commit, push, PR, deploy review, or Railway checks when needed.
- Ask for docs, requirements, changelog, TODO, and prompt updates when the instruction changes durable project behavior.
- Keep broad requests grouped by outcome: review, implement, validate, document, release.

## Response Preference

- Prefer concise progress updates.
- Prefer action and validation over long explanations.
- Prefer direct success, failure, and next-action statements.
- Ask for a longer plan only when the work is broad or risky.

## Broad Request Checklist

- Scope: page, feature, docs folder, branch, deploy target, or provider.
- Current state: what the product or document should say now.
- Boundaries: branches, deploys, files, or hosts to avoid.
- Validation: typecheck, lint, docs checks, build, or deploy status.
- Release: commit, push, PR, auto-merge, dist publish, or Railway verification.

## Git Workflow Request

Use this shape when the task includes release work:

```text
Review current changes first.
Implement <current behavior>.
Run focused validation.
Update requirements, changelog, TODO, and docs where needed.
Commit on beta, push beta, and open a PR to main.
Stay on beta locally.
```

## Long-Running Work

Ask for one-line status updates that state:

- current command or phase
- current result
- next action

Example:

```text
While validation or deployment runs, give compact updates: command, phase, next action.
```
