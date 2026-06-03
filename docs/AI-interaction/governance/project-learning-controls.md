# Project Learning Controls For AI Interactions

Use this guide to turn AI interactions into useful project learning without confusing user guidance, developer guidance, and task management.

## Purpose

- Capture lessons from AI work.
- Mark problems in a way that supports project control.
- Feed useful findings into risks, issues, decisions, and TODO queues.
- Educate users and developers about better prompts, better tests, and better project decisions.

## Trace Categories

| Category | Use |
| --- | --- |
| Lesson | A reusable learning that improves future work. |
| Issue | A current problem that needs action or ownership. |
| Risk | A possible future problem that needs prevention or monitoring. |
| Decision | A chosen direction or boundary that prevents rework. |
| Improvement | A practical suggestion for prompts, docs, tests, data, or product behavior. |

## Interaction Trace Flow

1. Summarize the user goal and outcome.
2. Mark concrete problems with severity.
3. Capture user learning in plain language.
4. Capture AI-agent learning as operational improvements.
5. Link the trace to a TODO, requirement, changelog entry, or guide only when the finding changes durable project state.

## Project Control Alignment

- Lessons log: Store reusable AI-work learnings in this folder or relevant guides.
- Issue register: Move actionable problems into `.TODO/todo-next.md`.
- Risk register: Move valid deferred risk prevention work into `.TODO/todo-future.md`.
- Decision log: Move deliberate no-fix or boundary decisions into `.TODO/todo-ignore.md`.
- Change control: Update requirements and changelog when product behavior changes.

## Safety

- Do not store secrets, tokens, private keys, raw uploaded files, full prompts containing sensitive business data, or personal data that is not needed for learning.
- Redact user-identifying details unless the trace needs account ownership context.
- Mark uncertainty clearly.
- Keep advice boundaries clear for tax, legal, insurance, financing, and medical topics.
