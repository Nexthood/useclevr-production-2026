# Dashboard Feature Work Prompt

Use this prompt for dashboard UI, data, access, table, topbar, sidebar, search, chat, settings, or business workspace changes.

```text
Review the current dashboard implementation and preserve existing worktree changes.

Implement the requested page behavior using existing components and patterns.

Check:
- Access scope for public users, signed-in users, and superadmin users.
- Shared table layout, row title links, supporting edit links, and row-end actions.
- Page headers, action rows, empty states, loading states, and error states.
- Search popup behavior and role-aware results.
- Help chat scope and FAQ source.
- Sidebar and topbar consistency.
- Business Profile, setup progress, and Accountancy requirements when affected.

Update:
- requirements.md for user-visible product behavior.
- CHANGELOG.md for release-facing user or developer changes.
- .TODO queue files when tasks move between active, done, future, or ignored states.

Validate:
- Run TypeScript and focused lint checks.
- Run production packaging when deployment output can be affected.
```
