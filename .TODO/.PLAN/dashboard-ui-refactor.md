# Dashboard UI Refactor Resolution

Status: resolved as current-state audit.

## Current Dashboard Layout

- Global topbar spans the dashboard above the sidebar and content area.
- Topbar sections show logo, Hybrid AI, search, setup progress, help, business workspace, mentoring, admin tools, credits, account, notices, display settings, and sign-out.
- Sidebar uses one primary navigation list, expands for super-admin tools, and supports desktop collapse plus mobile drawer.
- Dashboard footer holds legal links, copyright, social links, and coming-soon app store links.
- Main pages use page headers, action rows, shared table shells, row title links, supporting edit links, and row-end actions where the page has listing behavior.
- Business workspace opens as a top-level listing and uses subpages for profile, location, tax, financial, and review.
- Dashboard FAQ uses a user/operator section bar and quick action links.
- AI Assistant keeps dataset selection, messages, suggestions, history, search, feedback, and chat input in a fixed workspace structure.
- Notices describe page errors, failed requests, and important product events directly.
- Setup progress includes account setup, business profile actions, uploads, analysis, and key dashboard visits.

## Existing Follow-Up Coverage

- T-394 covers future dashboard table consistency audits.
- T-395 covers future setup-progress coverage audits.
- T-396 covers future AI Assistant layout smoke testing.

## Resolution Rule

- Add new dashboard UI work to `.TODO/todo-next.md` only when a concrete current behavior is missing.
- Keep this file as the resolved audit note for the dashboard UI refactor scope.
