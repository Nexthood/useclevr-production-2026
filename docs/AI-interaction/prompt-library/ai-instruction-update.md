# AI Instruction Update Prompt

Use this prompt when a user changes durable AI-agent behavior, prompt style, documentation rules, TODO wording, or collaboration guidance.

```text
Update durable AI instructions for this project.

Apply the instruction in:
- AGENTS.md
- .TODO/config.json when task wording or task workflow changes
- docs/AI-interaction/README.md
- docs/AI-interaction/user-guides/ when user-facing guidance changes
- docs/AI-interaction/developer-guides/ when agent or developer guidance changes
- docs/AI-interaction/governance/ when maintenance, PRINCE2 learning, or trace-control rules change
- docs/AI-interaction/prompt-library/ when prompt examples change

Rules:
- Use current-state language in every text file.
- Keep user guidance separate from developer guidance.
- Keep reusable prompts in the prompt collection.
- Update requirements.md only when the instruction changes product behavior.
- Update CHANGELOG.md only when the change affects users or developer workflow.

Validation:
- Run focused docs/TODO checks for touched files.
- Preserve unrelated worktree changes.
```
