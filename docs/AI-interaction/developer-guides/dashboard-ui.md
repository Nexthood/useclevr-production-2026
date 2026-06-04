# Dashboard UI Reference

Current dashboard layout for AI agents and developers working on UI changes.

## Layout Structure

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

## Follow-Up Audit Tasks

- T-394: Dashboard table consistency audit — verify list pages use title links, supporting edit links, and row-end actions before new list pages ship.
- T-395: Setup progress audit — verify every business profile field and required setup action contributes to the topbar completion panel.
- T-396: AI Assistant layout smoke test — confirm fixed sidebars, scrollable messages, and the fixed chat footer stay usable on desktop and mobile widths.

## Related

- Dashboard page source: `src/app/(auth)/app/page.tsx` — dashboard overview with stat cards, status cards, and quick actions
- [Setup progress component](../../../src/components/ui/onboarding-process-button.tsx) — topbar progress panel implementation
- [requirements.md](../../../requirements.md) — product requirements covering dashboard behavior
- Follow-up tasks tracked in `.TODO/todo-future.md`
