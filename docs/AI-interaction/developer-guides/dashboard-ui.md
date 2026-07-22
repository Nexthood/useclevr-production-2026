# Dashboard UI Reference

Current dashboard layout for AI agents and developers working on UI changes.

## Layout Structure

- Global topbar spans the dashboard above the sidebar and content area.
- Topbar sections stay on one line and show logo, Hybrid AI, search, help, business workspace, mentoring, admin tools, credits, display settings, notices, account, and sign-out. Popovers render outside the topbar without horizontal-scroll clipping.
- Sidebar uses one primary navigation list, expands for super-admin tools, and supports desktop collapse plus mobile drawer. Credit panel shows usage for regular accounts and unlimited for pro, and sidebar-footer shows copyright, terms, and privacy links.
- Route layouts render the page title, breadcrumbs, and subpage navigation before the page body.
- Page bodies use a center workspace with optional left and right sidebars. AI Assistant uses both sidebars; listing pages place summaries and supporting information in the right sidebar.
- Listing pages use shared selectable table shells with bulk controls and create, upload, or refresh actions in the table header.
- Business workspace opens as a top-level listing with profile information in the right sidebar and uses subpages for profile, location, tax, financial, and review.
- Dashboard FAQ uses a user/operator section bar and quick action links.
- AI Assistant keeps dataset selection, messages, suggestions, history, search, feedback, and chat input in a fixed workspace structure.
- Notices describe page errors, failed requests, and important product events directly.
- Onboarding indicators stay lightweight and focus on Business Profile, Accountancy, Dataset Upload, and Analysis completion.

## Follow-Up Audit Tasks

- T-394: Dashboard table consistency audit — verify list pages use title links, supporting edit links, and row-end actions before new list pages ship.
- T-395: Completion indicator audit — verify Business Profile and Accountancy completion values match the sidebar and account control-center indicators.
- T-396: AI Assistant layout smoke test — confirm fixed sidebars, scrollable messages, and the fixed chat footer stay usable on desktop and mobile widths.

## Related

- Dashboard page source: `src/app/(auth)/app/page.tsx` — dashboard overview with stat cards, status cards, and quick actions
- [requirements.md](../../../requirements.md) — product requirements covering dashboard behavior
- Follow-up tasks tracked in `.TODO/todo-future.md`
