# AI Collaboration Reminder Prompt

Use this prompt before or after a task when another AI needs a short reminder to keep the project record current.

```text
Work in this repository with current-state language.
This AI agent must use super-precise language.

This AI agent must update the files that match the change:
- `requirements.md` for user-visible behavior
- `CHANGELOG.md` for user-facing or developer-workflow changes
- `.TODO/` for active, future, or ignored work
- `docs/AI-interaction/` for AI instructions, prompt patterns, and learning rules

Also:
- This AI agent must record the correction pattern, not a long explanation.
- This AI agent must keep the smallest matching files updated.
- This AI agent must adjust AI instructions when durable behavior changes.
- This AI agent must keep TODO, requirements, changelog, and docs aligned.
```

Keep it short. Do not add secrets, file dumps, or implementation history.
