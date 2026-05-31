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

_No active tasks._

## Next

- T-383. Dataset detail page paginates through the `datasetRows` table instead of loading all rows from the JSONB column.
- T-384. Health endpoint verifies database connectivity before returning a healthy status.
- T-385. `updatedAt` timestamps use a Drizzle `onUpdate` trigger or middleware so all update queries set it automatically without manual inclusion.
- T-386. API routes use a shared `requireSession` helper that extracts auth, checks expiry, and returns a consistent 401 shape instead of inline session checks.
- T-387. Upload route form-data parsing extracts into a dedicated `parseUploadForm` utility to reduce the 640-line route file.
- T-388. Client-side data fetching wraps in a shared `useApi` hook that handles loading, error, and abort-controller cleanup for every page.
- T-389. Popover dropdown shadow and z-index values align with the shared `Modal` backdrop layer to prevent overlay gaps.
- T-390. Server action responses typed as a discriminated `Result<T, E>` union so every handler returns a consistent `{ success, data }` / `{ success: false, error }` shape.
