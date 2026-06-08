# TODO Retirement Check Prompt

Use this prompt when closing, deferring, or ignoring TODO tasks after implementation or review.

```text
Review the TODO task and decide its correct final state.

Check:
- The requested behavior is implemented before moving a task to done.
- Deferred work remains valid and belongs in todo-future.md.
- Deliberate no-fix decisions include a clear rationale in todo-ignore.md.
- Task numbers remain stable when tasks move.
- requirements.md reflects user-visible behavior changes.
- CHANGELOG.md reflects release-facing user or developer workflow changes.
- Docs and AI interaction guidance update when durable instructions change.
- AI trace guidance updates when the task changes AI prompts, user history, feedback, search, export, or analytics.

Validate:
- Run pnpm lint:todos after queue changes.
- Run docs or changelog checks when touched.
```
