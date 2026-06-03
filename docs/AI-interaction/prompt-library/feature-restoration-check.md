# Feature Restoration Check Prompt

Use this prompt when restoring or reviewing a feature that previously existed in project history.

```text
Review the requested restored feature against the current implementation.

Check:
- Route exists and loads for the correct user roles.
- Sidebar, topbar, search, FAQ, or dashboard links point to the feature where users expect it.
- API routes, server actions, database access, and access checks support the feature.
- Empty, loading, error, and permission states use current UI patterns.
- Requirements describe the current user-visible behavior.
- Changelog describes release-facing behavior.
- TODO queues move completed, deferred, or ignored follow-ups to the correct files.
- AI traces, prompt versions, or trace guidance update when the restored feature changes AI behavior.

Report:
- implemented behavior
- missing links or access checks
- validation run
- docs/TODO/changelog updates
```
