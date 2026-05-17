# Changelog

All notable project changes are tracked here.

## Unreleased

- Added this changelog.
- Kept the source cleanup that moves business logic out of root `src/lib` into logical folders:
  - `src/lib/ai`
  - `src/lib/auth`
  - `src/lib/business`
  - `src/lib/data`
  - `src/lib/reports`
  - `src/lib/utils`
- Verified the staged root `src/lib/*` deletions are one-line compatibility exports, with active implementations still present in the new folders.
- Updated MCP imports to the new folder layout.
- Rebuilt `dist` and verified `dist/railway.json` is copied from `ci-settings/railway.dist.json`.
- Improved Hybrid AI dashboard flow:
  - Pro users get Hybrid AI Lite.
  - Business users get Hybrid AI MEGA.
  - Super admins can see both.
  - Download opens the full installer popup.
- Updated plan links in the dashboard topbar to point to `/pricing`.
- Added visible "Log out" wording in the topbar.
- Simplified the subscription settings plan overview and linked it to `/pricing`.
- Increased contrast in touched billing, topbar, pricing, and Hybrid AI controls.

## 2026-05-17

- Added front-end billing/profile/settings improvements.
- Added editable billing/package settings for super admins.
- Added Hybrid AI popup and local download flow.
- Added dashboard subscription and billing pages.
- Updated checkout and payment-provider fallback behavior.
- Refreshed production `dist` artifacts.

## 2026-05-16

- Reworked source structure for Next.js app layout.
- Added minimal working versions of previously placeholder features:
  - Referral tracking and signup routes.
  - Referral QR code route.
  - Forecast API route.
  - Data table component.
- Added checkout, settings, QR, subscription, billing, and credit-management features.
- Added CI settings folder for deploy provider files.
- Moved Railway dist config generation into the dist build flow.
- Updated docs for dist-based Railway deployment.
- Rebuilt production distribution.

## 2026-05-13

- Updated pricing:
  - Pro to 40 euro/month.
  - Business custom to 420 euro/month.

## 2026-05-08

- Fixed dashboard React errors.
- Fixed upload analysis flow.
- Added a checkpoint before dashboard crash inspection.

## 2026-05-06

- Synced beta changes through the Railway dist work.

## 2026-05-03

- Iterated Railway deployment and dist packaging.
- Added/updated notice bar behavior.
- Added credit, user admin role, demo login, and Railway auth updates.
- Rebuilt fresh deploy artifacts.

## 2026-05-02

- Updated Railway URL/configuration and Gemini configuration.
- Improved dark/light theme behavior.
- Added app bar, app header, credit display, and contrast updates.
- Added account-management work.
- Added AI agent config files.
- Cleaned root-level project files.
- Fixed login and error-management flows.
- Updated dist commands and deployment scripts.

## 2026-05-01

- Moved project into `src`.
- Updated source structure.
- Added production dist generation with `pnpm prod`.
- Added production build output into `dist`.
- Updated package scripts and Railway-related start/build commands.
- Added public assets and docs updates.
- Removed unused parts.
- Added documentation flowchart/info updates.

## 2026-04-29

- Upgraded the project to pnpm.
- Removed Docker/dependency paths no longer needed for Node-only deployment.
- Fixed Railway ports and webpack build behavior.
- Removed unused DeepSeek/OpenAI packages.
- Restored needed dev dependencies.
- Added architecture notes, README updates, and cleanup.
- Added Railway CI start command updates.
- Cleaned console/debug output.

## 2026-04-27

- Created the clean UseClevr production version.
- Removed local-only, obsolete, backup, Prisma, Kilo, and temporary files from the production repo.
- Added and iterated Railway deployment configuration.
- Added debug routes for request headers and homepage HTML.
- Added GitHub Actions CI/CD workflows and documentation.
- Added reverse proxy security headers.
- Hardened deployment/resource configuration.
- Restored middleware after Railway testing.
