# AI Memory Collection Prompt

Use this prompt when collecting useful project learning from another AI chat, previous assistant session, exported transcript, or pasted conversation notes.

```text
Collect useful project learning from this AI interaction.

Source:
- Use only the visible chat history, exported transcript, pasted notes, or memory summary available in this conversation.
- Do not invent hidden memory.
- Do not include secrets, tokens, private keys, raw uploaded files, private customer data, or environment values.
- Redact sensitive details before summarizing.

Write the result as current project learning with these sections:

1. Interaction title
2. Date or approximate period
3. User goal
4. Current product or project state learned
5. Changes made or decisions confirmed
6. Problems marked
   - blocker:
   - risk:
   - improvement:
   - observation:
7. User learning
8. AI-agent learning
9. Follow-up tasks
10. Suggested destination
    - docs/AI-interaction/
    - requirements.md
    - CHANGELOG.md
    - .TODO/todo-next.md
    - .TODO/todo-future.md
    - .TODO/todo-ignore.md

Keep the summary concise, searchable, and useful for future project work.
Use direct current-state language.
```

## Use Pattern

- Paste this prompt into the other AI chat.
- Ask the other AI chat to summarize only what it can see.
- Bring the returned summary back to this project.
- Convert durable findings into docs, TODO queues, requirements, changelog, or prompt-library entries.
