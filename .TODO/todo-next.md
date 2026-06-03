# Active TODO Queue

This file is the only active queue. Add confirmed implementation work here before it starts.

Get the T-number from `.TODO/config.json` before adding new tasks. Keep task numbers stable when
moving work between states.

## Links

- [TODO-next.md](todo-next.md)
- [TODO-done.md](todo-done.md)
- [TODO-ignore.md](todo-ignore.md)
- [TODO-future.md](todo-future.md)
- [.TODO/config.json](config.json)

## Active

- T-544. Review Sales risk, issue, and lessons registers after the next Railway test deploy and move actionable findings into the regular TODO queues.
- T-560. Expand Business Profile from basic company details into the first practical pre-accounting setup. Add business type, revenue streams, fixed costs, variable costs, VAT/tax basics, insurance, loans/leasing, employees, cash-flow dates, and missing-data warnings.
- T-561. Connect Business Profile data to the analysis calculation context. Build `CompanyCalculationContext`, apply it to KPI/profit/cash-flow outputs, and label low-confidence results when required profile data is missing.
- T-562. Harden upload and analysis safety. Add file size limits, dirty CSV handling, clearer parsing errors, basic rate limits, and checks that uploaded files/prompts/exports do not leak into public/static paths.
- T-563. Refactor topbar panels to icons-only with tooltips. Replace Popover backgrounds with transparent overlays and add tooltip labels that appear on hover for narrow icon buttons.
- T-564. Move sidebar toggle from topbar to the AppSidebar component. Relocate the TopbarSidebarToggle button into the sidebar header for desktop view and keep mobile toggle in place.
- T-565. Verify and refine role-based FAQ filtering. Confirm super-admin exclusive sections (Payments and subscriptions, Key pages) are only shown to super-admin users, not all dashboard users.

## Deferred

## Suggestions
