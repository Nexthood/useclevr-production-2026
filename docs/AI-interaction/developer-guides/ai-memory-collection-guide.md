# AI Memory Collection Guide

Use this guide to collect useful project learning from current and external AI chats and turn it into durable project records.

## Collection Flow

1. After each completed request/response cycle, run the [post-interaction memory prompt](../prompt-library/ai-memory-collection-post-interaction.md) in the working AI chat and capture durable learning.
2. When collecting from external AI chats, paste the [AI memory collection prompt](../prompt-library/ai-memory-collection.md) into the other AI chat.
3. Ask the other AI chat to summarize only visible chat history, exported content, pasted notes, or explicit memory summary.
4. Bring the returned summary back into this repository.
5. Classify each durable finding as current behavior, active work, deferred work, ignored decision, risk, issue, lesson, or prompt pattern.
6. Update the matching destination:
   - `docs/AI-interaction/` for durable AI behavior, prompt, trace, and learning rules.
   - `requirements.md` for user-visible product behavior.
   - `CHANGELOG.md` for release-facing behavior or developer workflow changes.
   - `.TODO/todo-next.md` for active implementation.
   - `.TODO/todo-future.md` for deferred valid work.
   - `.TODO/todo-ignore.md` for deliberate no-fix decisions.

## Quality Rules

- Use direct current-state language in all records.
- Keep summaries concise and searchable.
- Preserve task numbers when moving TODO items.
- Add a new task number from `.TODO/config.json` only when creating a new queue item.
- Never include secrets, tokens, private keys, raw uploaded files, private customer data, or environment values.
- Run docs and TODO validation after updates.
- Skip empty memory updates when the cycle contains no durable project learning.

## Current Sources

- [Post-interaction memory collection prompt](../prompt-library/ai-memory-collection-post-interaction.md)
- [AI memory collection prompt](../prompt-library/ai-memory-collection.md)
- [AI agent guide](ai-agent-guide.md)
- [AI tracing structure](ai-tracing-structure.md)
- [Interaction trace guide](../learning-traces/interaction-trace-guide.md)
- [AI interaction request guide](../user-guides/interaction-request-guide.md)
- [AI interaction workflow guide](interaction-workflow-guide.md)

## Related

- [AI agent guide](ai-agent-guide.md) — operating rules for AI agents working in this repo
- [Instruction maintenance](../governance/instruction-maintenance.md) — durable instruction update checklist
