# AI Interaction Knowledge Base

This folder stores project learning, AI collaboration guidance, prompt patterns, and trace-learning rules. It is organised by audience so current AI agents know where each instruction belongs.

For the full documentation map, use [Documentation structure](../DOCS_STRUCTURE.md).

## Folder Map

| Folder | Audience | Purpose |
| --- | --- | --- |
| [user-guides](user-guides/README.md) | Users | How users ask, understand, review, and learn from AI interactions. |
| [developer-guides](developer-guides/README.md) | Developers and AI agents | How agents work in the repo, preserve scope, and implement AI-related behavior. |
| [prompt-library](prompt-library/README.md) | Users, developers, AI agents | Reusable prompts split by task type. |
| [learning-traces](learning-traces/README.md) | Users, developers, AI agents | How interactions leave useful learning traces, problem markers, and improvement suggestions. |
| [governance](governance/README.md) | Project management and AI agents | Controls for lessons, risks, issues, decisions, and durable instruction updates. |
| [sales](sales/README.md) | Sales and marketing | Sales, marketing, presentation, research, and analysis guidance. |

## Current-State Text Rule

- Write text files in direct current-state language.
- Describe current behavior, current rules, and current user outcomes.
- Avoid past-state comparisons, removed-option notes, speculative possibilities, and future blockages.
- Mention past or future states only when the detail prevents a concrete risk.
- Keep examples in the [Prompt Library](prompt-library/README.md).

## Trace Learning Rule

- Use interaction traces to educate the user, mark concrete problems, and capture improvement suggestions.
- Link trace findings to lessons, risks, issues, decisions, or follow-up tasks when the finding changes project direction.
- Keep sensitive data, secrets, tokens, credential values, raw uploaded files, and private keys out of trace text.
- Classify broad audit findings before turning them into TODO work or durable guidance.
- Use [AI memory collection](prompt-library/ai-memory-collection.md) to bring useful learning from other AI chats into the project record.
- Use [AI tracing structure](developer-guides/ai-tracing-structure.md) when trace storage, feedback, search, export, analytics, or prompt versions change.

## Maintenance Rule

- Update this folder after every durable AI instruction change.
- Update the folder that matches the audience first.
- Update [governance/instruction-maintenance.md](governance/instruction-maintenance.md) when the maintenance rule changes.
- Keep implementation tasks in `.TODO/` queue files, not in this folder.
