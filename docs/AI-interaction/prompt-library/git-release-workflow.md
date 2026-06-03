# Git Release Workflow Prompt

Use this prompt when a task includes commit, push, PR, deploy review, or branch follow-through.

```text
Review current branch, staged changes, unstaged changes, and recent commits first.

Preserve existing user and agent changes.
Implement the requested current behavior.
Update requirements, changelog, TODO queues, and docs where the behavior changes.
Run focused validation.

Release flow:
- Commit the completed changes with a conventional commit message.
- Push beta unless the user names another source branch.
- Open a PR to main when requested.
- Stay on beta locally after release work.
- Report validation, commit, push, PR link, and remaining risks.
```

## Guardrails

- Do not push directly to main.
- Do not edit generated deployment output on source branches.
- Do not trigger production deploy branches when the user names only beta or dist-test.
- Do not include secrets or tokens in commit messages, PR text, TODO files, or docs.
