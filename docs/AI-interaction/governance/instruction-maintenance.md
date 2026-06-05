# Instruction Maintenance

Update this folder whenever durable AI instructions change.

## Current Rule

- Store shared AI instructions in `AGENTS.md`.
- Store TODO wording and task-number rules in `.TODO/config.json`.
- Store user-facing collaboration guidance in [../user-guides/user-guide.md](../user-guides/user-guide.md).
- Store AI-agent collaboration guidance in [../developer-guides/ai-agent-guide.md](../developer-guides/ai-agent-guide.md).
- Store reusable prompt files and the prompt index in [../prompt-library/](../prompt-library/README.md).
- Run post-interaction memory capture after each completed request/response cycle and keep only durable learning in project records.
- Store bookkeeping user and developer mirrors in this folder when bookkeeping guidance changes.

## Text Language Rule

- Write every text file as current behavior and current rules.
- Use direct verbs and short user-observable statements.
- Use super-precise instruction language that sharpens wording from current-state and concise into
  naming the actor, the required action, and the target file or target outcome with no vagueness.
- Record when the active AI agent already follows the rule automatically, and record separately when a user reminder improves the wording standard.
- Avoid notes about past states, removed options, speculative possibilities, and future blockages.
- Include past or future context only when it prevents a concrete risk.

## Update Checklist

- Update `AGENTS.md`.
- Update `.TODO/config.json` suggestions when the rule affects task wording.
- Update `docs/AI-interaction/README.md`.
- Update user guidance when the instruction changes how users should ask.
- Update AI-agent guidance when the instruction changes how agents should work.
- Update prompt examples when the instruction changes prompt style.
- Update individual prompt files when a durable prompt pattern changes.
- Update bookkeeping guides when the instruction changes accounting or bookkeeping behavior.
