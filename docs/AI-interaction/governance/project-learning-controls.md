# Project Learning Controls For AI Interactions

Use this guide to turn AI interactions into useful project learning without confusing user guidance, developer guidance, and task management.

## Purpose

- Capture lessons from AI work.
- Mark problems in a way that supports project control.
- Feed useful findings into risks, issues, decisions, and TODO queues.
- Educate users and developers about better prompts, better tests, and better project decisions.

## Trace Categories

| Category    | Use                                                                         |
| ----------- | --------------------------------------------------------------------------- |
| Lesson      | A reusable learning that improves future work.                              |
| Issue       | A current problem that needs action or ownership.                           |
| Risk        | A possible future problem that needs prevention or monitoring.              |
| Decision    | A chosen direction or boundary that prevents rework.                        |
| Improvement | A practical suggestion for prompts, docs, tests, data, or product behavior. |

## Interaction Trace Flow

1. Summarize the user goal and outcome.
2. Mark concrete problems with severity.
3. Capture user learning in plain language.
4. Capture AI-agent learning as operational improvements.
5. Link the trace to a TODO, requirement, changelog entry, or guide only when the finding changes durable project state.
6. Write the learning with super-precise language that names who must act, what must change, and where the durable update belongs.
7. Run post-interaction memory capture after each completed request/response cycle, update the
   required interaction records, and skip extra durable-guide changes when the interaction adds no
   durable rule.

## Evaluation Prompts

- Use [Work classification](../../../project-prompts/work-classification.md) when a request mixes product work, developer maintenance, deployment work, docs, TODO cleanup, or release tasks.
- Use [Feature restoration check](../../../project-prompts/feature-restoration-check.md) when bringing back or auditing a restored feature.
- Use [TODO retirement check](../../../project-prompts/todo-retirement-check.md) when moving tasks to done, future, or ignore.
- Use [Post-interaction memory collection](../../../project-prompts/ai-memory-collection-post-interaction.md) after each completed request/response cycle.
- Use [AI memory collection](../../../project-prompts/ai-memory-collection.md) when project learning comes from another visible AI chat or exported transcript.

## Project Control Alignment

- Interactive log: Store detailed session learning in `project-logs/interactive-log.md`.
- Activity log: Store the compact current summary in `project-logs/activity-log.md`.
- Issue register: Move actionable problems into `.TODO/todo-next.md`.
- Risk register: Move valid deferred risk prevention work into `.TODO/todo-future.md`.
- Decision log: Move deliberate no-fix or boundary decisions into `.TODO/todo-ignore.md`.
- Change control: Update requirements and changelog when product behavior changes.
- Audit record: Keep validation evidence, concrete findings, and follow-up task IDs in the relevant developer guide.

## Safety

- Do not store secrets, tokens, credential values, private keys, raw uploaded files, full prompts containing sensitive business data, or personal data that is not needed for learning.
- Redact user-identifying details unless the trace needs account ownership context.
- Mark uncertainty clearly.
- Keep advice boundaries clear for tax, legal, insurance, financing, and medical topics.
