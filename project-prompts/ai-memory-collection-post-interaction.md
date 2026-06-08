# Post-Interaction Memory Collection Prompt

Use this prompt after each completed request/response cycle to capture durable learning from the AI chat that just completed work.

```text
Summarize this completed request/response cycle for the project memory.

Source:
- Use only the visible chat history from this session.

Write the result as current project learning with these sections:

1. Interaction title
2. What was the user goal
3. What changed (files edited, decisions made, findings discovered)
4. Problems marked
   - blocker:
   - risk:
   - improvement:
   - observation:
5. User learning
6. AI-agent learning
7. Follow-up tasks (one per bullet, prefixed with T- when the task is already assigned)
8. Instruction sources
   - AGENTS.md
   - .kilo/agent/changelog.md
   - ai-chat-behavior.config.ts
   - gemini-behavior.config.ts
9. Minimal destination
   - dev expectation: docs/AI-interaction/developer-guides/dev-persona.md
   - agent rule: docs/AI-interaction/developer-guides/ai-agent-guide.md
   - hook routing: docs/AI-interaction/developer-guides/post-interaction-hook.md
   - user/operator usage: user guide or FAQ content
   - active/deferred/no-fix work: .TODO/ queue files only as destinations
   - product requirement updates: requirements.md
   - release notes: CHANGELOG.md
   - detailed session record: project-logs/interactive-log.md
   - activity summary: project-logs/activity-log.md
   - latest interaction status: docs/AI-interaction/interaction-status.md

Keep the summary concise (under 400 words).
Use direct current-state language.
Name the active actor, the required action, and the destination file or destination outcome with no vagueness.
State manual local steps plainly when the AI agent cannot operate the browser, IDE panel, or another user's live session directly.
When the task asks for shared API testing, create Git-tracked REST Client request files under `docs/api-tests/` before suggesting personal-only tools.
Never include secrets, tokens, keys, or customer data.
```

## When to Use

- After each completed request/response cycle.
- When the interaction produced new files, changed existing behavior, or discovered new information about the project.
- When the AI encountered a blocker, risk, or improvement opportunity.
- Before switching to a new topic or closing the session.

## Integration

AI agents run this capture automatically after each completed request/response cycle, unless the
user explicitly says not to. Update the three required interaction records, then route durable
learning to the smallest matching destination files. When another AI agent is working in parallel,
update only the instruction and learning destinations owned by its own completed change.
