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

- T-438. Add Next.js middleware for centralized auth and route protection.
- T-439. Configure test framework (Vitest, Playwright) and add unit tests for `src/lib/` modules.
- T-440. Fix dashboard consistency issues: settings/business double AppPageHeader, upload breadcrumbs referencing datasets, settings breadcrumbs hiding sub-page, missing metadata titles on client pages, and missing empty states.

## Suggestions

- T-441. Consolidate 6+ duplicate metric display components (ProfileMetric, ContextItem, FinancialItem, TaxItem, ReportMetric, etc.) into a shared StatCard component.
- T-442. Error page template duplicated in 7 feature sections — extract shared ErrorScreen component.
- T-443. Loading page template duplicated in 7 feature sections — extract shared LoadingScreen component.
- T-444. Fix legacy constants in csv-upload.tsx — UPLOAD_QUEUE_KEY and LEGACY_UPLOAD_QUEUE_KEY resolve to the same string.
- T-445. Upload route retry helper uses in-memory Map that resets on serverless restart — replace with persistent retry tracking.
- T-446. Consolidate heavy client dependencies (canvg, html2canvas, qrcode, jspdf) — lazy-load or move PDF generation server-side.
- T-447. OAuth user ID generation uses Date.now() + Math.random() — switch to uuid for collision resistance.
- T-448. Accessibility: Select component lacks keyboard navigation, aria attributes, and disabled state handling.
- T-449. Data processing flow uses external placeholder images — add fallback and alt text.
- T-450. LLM client (antigravity-client.ts) uses raw fetch with no deduplication or timeout — use Next.js extended fetch or dedicated client.
- T-451. Align build tooling: tsconfig target should be ES2022 (not ES6), and decide between Turbopack and webpack in next.config.mjs.
