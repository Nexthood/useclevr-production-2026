# AI Instruction Update Prompt

Use this prompt when a user changes durable AI-agent behavior, prompt style, documentation rules, TODO wording, or collaboration guidance.

```text
Update durable AI instructions for this project.

This AI agent must apply the instruction in:
- AGENTS.md
- .TODO/config.json when task wording or task workflow changes
- docs/AI-interaction/README.md
- docs/AI-interaction/user-guides/ when user-facing guidance changes
- docs/AI-interaction/developer-guides/ when agent or developer guidance changes
- docs/AI-interaction/governance/ when maintenance, project learning, or trace-control rules change
- project-prompts/ when prompt examples change
- project-logs/interactive-log.md for the detailed session record
- project-logs/activity-log.md for the current activity summary
- docs/AI-interaction/interaction-status.md for the latest AI interaction

Rules:
- This AI agent must use current-state language in every text file.
- This AI agent must use super-precise wording that names the actor, the required action, and the target file or target outcome.
- This AI agent must keep user guidance separate from developer guidance.
- This AI agent must keep reusable prompts in the prompt collection.
- This AI agent must update requirements.md only when the instruction changes product behavior.
- This AI agent must update CHANGELOG.md only when the change affects users or developer workflow.

Validation:
- Run focused docs/TODO checks for touched files.
- Preserve unrelated worktree changes.
```
