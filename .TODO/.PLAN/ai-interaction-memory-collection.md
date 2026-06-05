# AI Interaction Memory Collection Plan

Use this plan to collect useful project learning from other AI chats and turn it into durable project records.

## Goal

- Collect visible learning from previous AI chats, exported transcripts, pasted notes, and explicit memory summaries.
- Convert durable findings into the correct project records.
- Keep secrets, raw datasets, customer data, private keys, and environment values out of summaries.

## Current Sources

- [AI memory collection prompt](../../docs/AI-interaction/prompt-library/ai-memory-collection.md)
- [Interaction trace guide](../../docs/AI-interaction/learning-traces/interaction-trace-guide.md)
- [AI interaction request guide](../../docs/AI-interaction/user-guides/interaction-request-guide.md)
- [AI interaction workflow guide](../../docs/AI-interaction/developer-guides/interaction-workflow-guide.md)

## Collection Flow

1. Paste the AI memory collection prompt into the other AI chat.
2. Ask the other AI chat to summarize only visible chat history, exported content, pasted notes, or explicit memory summary.
3. Bring the returned summary back into this repository.
4. Classify each finding as current behavior, active work, deferred work, ignored decision, risk, issue, lesson, or prompt pattern.
5. Update the matching destination:
   - `docs/AI-interaction/` for durable AI behavior, prompt, trace, and learning rules.
   - `requirements.md` for user-visible product behavior.
   - `CHANGELOG.md` for release-facing behavior or developer workflow changes.
   - `.TODO/todo-next.md` for active implementation.
   - `.TODO/todo-future.md` for deferred valid work.
   - `.TODO/todo-ignore.md` for deliberate no-fix decisions.

## Quality Rules

- Use direct current-state language.
- Keep summaries concise and searchable.
- Preserve task numbers when moving TODO items.
- Add a new task number from `.TODO/config.json` only when creating a new queue item.
- Run docs and TODO validation after updates.

## Future Implementation

- Add an app-side import assistant for pasted AI memory summaries.
- Add a review screen that lets the user classify findings into docs, TODO queues, requirements, changelog, or prompt-library entries.
- Add redaction checks before saving imported summaries.
