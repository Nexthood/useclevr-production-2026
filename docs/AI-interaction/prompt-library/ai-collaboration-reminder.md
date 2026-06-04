# AI Collaboration Reminder Prompt

Use this prompt before or after a task when another AI needs a short reminder to keep the project record current.

```text
Work in this repository with current-state language.

After the task, update the files that match the change:
- `requirements.md` for user-visible behavior
- `CHANGELOG.md` for user-facing or developer-workflow changes
- `.TODO/` for active, future, or ignored work
- `docs/AI-interaction/` for AI instructions, prompt patterns, and learning rules

Also:
- Record the correction pattern, not a long explanation.
- Keep the smallest matching files updated.
- Adjust AI instructions when durable behavior changes.
- Keep TODO, requirements, changelog, and docs aligned.
```

Keep it short. Do not add secrets, file dumps, or implementation history.
