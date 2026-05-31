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

- T-401. dashboard: topbar - sidebar after credit panel without border
- T-402. dashboard: topbar - show app version from package.json
- T-403. dashboard: topbar - superadmin menu is before the credit panel
- T-404. dashboard: topbar - bring back notifications sidebar feature
- T-405. dashboard: topbar - search popup full feature
- T-406. dashboard: topbar - convert dark/light switcher to multi-theme switcher (dark, light) with accessibility icons
- T-407. dashboard: reduce whole page font and layout sizes slightly
- T-408. dashboard faq: remove issue form (move to tickets page)
- T-409. dashboard: fix dataset upload (broken)
- T-410. dashboard: ensure business page works correctly
- T-411. dashboard: fix table design on all pages (make shared)
- T-412. dashboard: add page icon for title in header
- T-413. project: add page favicon
- T-414. project: fix asset duplication issues

## Next

- T-383. Dataset detail page paginates through the `datasetRows` table instead of loading all rows from the JSONB column.
- T-384. Health endpoint verifies database connectivity before returning a healthy status.
- T-385. `updatedAt` timestamps use a Drizzle `onUpdate` trigger or middleware so all update queries set it automatically without manual inclusion.
- T-386. API routes use a shared `requireSession` helper that extracts auth, checks expiry, and returns a consistent 401 shape instead of inline session checks.
- T-387. Upload route form-data parsing extracts into a dedicated `parseUploadForm` utility to reduce the 640-line route file.
- T-388. Client-side data fetching wraps in a shared `useApi` hook that handles loading, error, and abort-controller cleanup for every page.
- T-389. Popover dropdown shadow and z-index values align with the shared `Modal` backdrop layer to prevent overlay gaps.
- T-390. Server action responses typed as a discriminated `Result<T, E>` union so every handler returns a consistent `{ success, data }` / `{ success: false, error }` shape.
