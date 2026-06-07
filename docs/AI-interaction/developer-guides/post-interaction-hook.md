# Post-Interaction Hook

Use this guide to keep post-interaction capture precise.

## Instruction Sources

- `AGENTS.md`
- `.kilo/agent/changelog.md`
- `ai-chat-behavior.config.ts`
- `gemini-behavior.config.ts`

These files are the post-interaction manual. The active AI agent must read them as instructions for
itself before ending a work cycle, sending a final reply, or closing a code-change cycle.

## Evaluation Rule

Evaluation means recognizing the correction pattern, not adding more documentation. Capture only the durable lesson.

Write the evaluation with super-precise language that names the active actor, the required action,
and the smallest correct destination.

Current correction pattern:

- The user wants precise, minimal correction capture.
- The AI tends to over-document when a short distributed update is enough.
- The AI already follows task-close and post-interaction capture without a reminder when the instruction sources are current.
- User reminders still matter when they sharpen the wording standard into naming the actor, the required action, and the destination with no vagueness.
- The AI must separate instruction sources from destination files before writing any follow-up.
- The right response is to update the smallest matching files, not create a large summary.
- Good evaluation records what pattern was recognized and where it was recorded.
- Good evaluation also leaves a short note for future developers about the pattern, not the full transcript.
- Record the branch or document split only when it changes durable project structure.
- Record public-doc and operator-doc audience separation when a docs-host or docs-branch plan changes durable information architecture.

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

- This AI agent must update the smallest matching docs instead of adding a duplicate summary file.
- This AI agent must update `requirements.md` when docs clarify durable product rules.
- This AI agent must update `CHANGELOG.md` only when the change affects current product or
  developer behavior.
- This AI agent must update `.TODO/` only when the docs change reveals active work, deferred work,
  or a deliberate no-fix decision.
- This AI agent must update the planning document that owns the docs structure when the change is a
  future docs-branch or docs-host rule, instead of duplicating the same rule in active TODO files.

Skip the hook when there is no durable learning.
