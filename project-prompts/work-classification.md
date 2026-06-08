# Work Classification Prompt

Use this prompt when a broad request mixes product work, developer maintenance, deployment work, docs, TODO cleanup, or release tasks.

```text
Classify the request before editing.

Separate work into:
- user-visible product behavior
- developer-only maintenance
- deployment or infrastructure behavior
- documentation-only updates
- sales or project-management updates
- TODO queue movement
- AI instruction, prompt, or trace-guidance updates

For each category:
- list the files or areas to inspect
- identify required validation
- identify required docs, requirements, changelog, or TODO updates
- identify whether AI tracing structure changes

Then implement only the confirmed current behavior and preserve unrelated worktree changes.
```
