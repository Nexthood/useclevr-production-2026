# Post-Interaction Hook

Use this guide to keep post-interaction capture precise.

## Instruction Sources

- `AGENTS.md`
- `.kilo/agent/changelog.md`
- `ai-chat-behavior.config.ts`
- `gemini-behavior.config.ts`

These files are the post-interaction manual. They tell future agents that post-interaction capture
exists, when it runs, and how to decide the right destination after each completed
request/response cycle or code-change cycle.

## Evaluation Rule

Evaluation means recognizing the correction pattern, not adding more documentation. Capture only the durable lesson.

Current correction pattern:

- The user wants precise, minimal correction capture.
- The AI tends to over-document when a short distributed update is enough.
- The AI must separate instruction sources from destination files before writing any follow-up.
- The right response is to update the smallest matching files, not create a large summary.
- Good evaluation records what pattern was recognized and where it was recorded.
- Good evaluation also leaves a short note for future developers about the pattern, not the full transcript.
- Record the branch or document split only when it changes durable project structure.

## Destination Files

These files receive the outcome. They are not the instruction source.

- Developer expectation: [Dev persona](dev-persona.md)
- AI-agent behavior: [AI agent guide](ai-agent-guide.md)
- User AI usage: [User guide](../user-guides/user-guide.md)
- Operator-facing AI usage: dashboard FAQ content
- Product rules: `requirements.md`
- Release notes: `CHANGELOG.md`
- Active or deferred work: `.TODO/`

## Immediate Actions After Docs Changes

- Update the smallest matching docs instead of adding a duplicate summary file.
- Update `requirements.md` when docs clarify durable product rules.
- Update `CHANGELOG.md` only when the change affects current product or developer behavior.
- Update `.TODO/` only when the docs change reveals active work, deferred work, or a deliberate
  no-fix decision.

Skip the hook when there is no durable learning.
