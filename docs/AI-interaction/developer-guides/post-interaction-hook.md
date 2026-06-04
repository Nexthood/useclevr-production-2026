# Post-Interaction Hook

Use this guide to keep post-interaction capture precise.

## Hook Files

- `AGENTS.md`
- `.kilo/agent/changelog.md`
- `ai-chat-behavior.config.ts`
- `gemini-behavior.config.ts`

These files tell future agents that post-interaction capture exists and runs after each completed request/response cycle.

## Evaluation Rule

Evaluation means recognizing the correction pattern, not adding more documentation. Capture only the durable lesson.

Current correction pattern:

- The user wants precise, minimal correction capture.
- The AI tends to over-document when a short distributed update is enough.
- The right response is to update the smallest matching files, not create a large summary.
- Good evaluation records what pattern was recognized and where it was recorded.

## Destinations

- Developer expectation: [Dev persona](dev-persona.md)
- AI-agent behavior: [AI agent guide](ai-agent-guide.md)
- User AI usage: [User guide](../user-guides/user-guide.md)
- Operator-facing AI usage: dashboard FAQ content
- Active or deferred work: `.TODO/`

Skip the hook when there is no durable learning.
