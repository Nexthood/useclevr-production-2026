# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Added developer-friendly script aliases for validation, CI, preview, release, docs, audit, and health checks.
- Added local release and documentation check helpers.
- Added Prettier-backed format and format-check scripts.
- Added Stripe SDK (`stripe@^14`) to the project dependencies.
- Added Stripe billing columns (`stripeCustomerId`, `stripeSubscriptionId`, `stripePriceId`, `stripeStatus`, `stripeCurrentPeriodEnd`) to the `profiles` table schema.
- Added business details columns (`businessName`, `businessEmail`, `industry`, `location`, `website`, `businessDescription`) to the `profiles` table schema.
- Added `tscAndConditionsUrl` field to billing plans and set it to `https://useclevr.com/terms` on all paid plans.
- Added `GET /api/checkout/options` — returns plan list with `tscAndConditionsUrl`, `status`, and `paymentProviderConnected`.
- Added `GET /api/me/business` — returns the current user's business profile details.
- Added 2-step checkout flow (Step 1 "Review plan" → Step 2 "Terms & conditions" with required checkbox acceptance).
- Added Business settings page (`/app/settings/business`) with a six-field form, completion percentage, and save feedback.
- Added Payment settings page (`/app/settings/payment`) showing STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET env-var status.
- Added `updateBusinessDetails` server action to persist business profile fields to the database.
- Added Stripe webhook handler (`POST /api/webhooks/stripe`) with raw-body signature verification.

### Changed

- Standardized visible product branding as UseClevr across UI, docs, metadata, and generated package naming.
- Moved checkout into settings as `/app/settings/checkout` while keeping `/app/checkout` as a redirect.
- Improved UI contrast across public pages, dashboard cards, Hybrid AI controls, and status badges.
- Simplified Hybrid AI setup copy so the popup uses product language instead of model/runtime commands.
- Added Business entry (all users) and Payment entry (superadmin) to the settings navigation sidebar.
- Updated `/app/api/checkout/confirm` to honour `?form=review-accepted` and return Stripe-ready status when the payment provider is connected.
- Updated topbar to show the full plan name (e.g. `Pro · Pro`) and a business profile completion badge linking to `/app/settings/business`.
- Updated checkout to redirect to step 2 immediately after plan review, and to disable the submit button until T&C are accepted.

## [5.1.0] - 2026-05-17

### Added

- Added profile, billing, and dashboard settings improvements.
- Added Hybrid AI popup and local download entry points.
- Added a project changelog.

### Changed

- Improved dashboard settings and front-end subscription flows.
- Updated billing and Hybrid AI UI behavior.

### Refactored

- Continued developer/source-structure cleanup for dashboard settings and project organization.

## [5.0.0] - 2026-05-16

### Added

- Added minimal working versions of previously planned features, including subscriptions, billing, credits, checkout, settings, referral QR, and related app pages.
- Added configurable CI/deploy settings with Railway as the current provider.
- Added dist-oriented Railway deployment support.

### Changed

- Updated Railway deployment configuration so deploys can run from the generated `dist` output.
- Updated documentation for the CI and dist deployment workflow.
- Rebuilt production distribution artifacts.

### Fixed

- Fixed Railway config issues and marked unfinished features more clearly before replacing them with minimal working flows.

### Refactored

- Reworked the Next.js project structure and source layout.

## [4.3.2] - 2026-05-13

### Changed

- Updated plan pricing to the current Pro and Business amounts.

## [4.3.1] - 2026-05-08

### Fixed

- Fixed a dashboard React error.
- Fixed the upload analysis flow.

## [4.3.0] - 2026-05-06

### Changed

- Synced beta changes into the main deployment line.

## [4.2.0] - 2026-05-03

### Added

- Added credit handling, user admin role support, demo login behavior, and Railway authentication updates.
- Added a notice bar for deployment/runtime messaging.

### Changed

- Refreshed Railway deployment artifacts and dist output.

### Fixed

- Fixed deployment notices and Railway dist deployment behavior.

## [4.1.0] - 2026-05-02

### Added

- Added account-management work.
- Added AI agent configuration files.
- Added app bar, app header, and credit UI updates.
- Added Gemini configuration updates.

### Changed

- Updated Railway URL/configuration and pre-deploy settings.
- Improved dark/light theme behavior and front-end contrast.
- Updated dist commands and Node-based deployment setup.

### Fixed

- Fixed login behavior.
- Fixed error-management flow.
- Fixed logo navigation to home.

### Refactored

- Cleaned root-level project files and deployment configuration.

## [4.0.0] - 2026-05-01

### Added

- Added production dist generation with `pnpm prod`.
- Added production build output under `dist`.
- Added public assets.
- Added build scripts and package script updates.
- Added documentation updates and a project flowchart.

### Changed

- Updated Railway JSON and start/build command flow.
- Updated package metadata and dist upload flow.

### Removed

- Removed unused parts from the production project.

### Refactored

- Moved the application into the `src` structure.
- Reworked the source structure and production artifact layout.

## [3.0.0] - 2026-04-29

### Added

- Added skills configuration.
- Added architecture audit notes.
- Added Railway CI start command support.

### Changed

- Upgraded the project to pnpm.
- Updated package versions and dependency layout for Railway.
- Updated npm scripts for Railway start behavior.
- Updated documentation and README content.

### Fixed

- Fixed Node dependency issues.
- Fixed package versions for Railway deployment.
- Fixed ports and Railway runtime behavior.
- Fixed Next.js build with webpack.

### Removed

- Removed Docker-based deployment files.
- Removed Stripe integration code that was not part of the active deployment path.
- Removed unused dependencies and old debug output.
- Removed unused DeepSeek/OpenAI packages.

### Refactored

- Reworked deployment to a Node-only Railway setup.

## [2.0.0] - 2026-04-27

### Added

- Added Railway deployment configuration with health checks.
- Added Railway reverse proxy security headers.
- Added GitHub Actions CI/CD workflows for pre-deployment validation.
- Added debug routes for request headers and homepage HTML diagnostics.
- Added VS Code and metadata settings.

### Changed

- Switched Railway deployment experiments across Node, Nixpacks, Docker, and clean Docker paths.
- Updated Railway build/start command behavior and `$PORT` handling.
- Hardened deployment configuration, resource limits, and package pinning.
- Updated GitHub Actions documentation.
- Improved `.gitignore` organization and documented critical files.

### Fixed

- Fixed Railway build command behavior.
- Fixed request header handling in the debug route.
- Fixed HTML header/head handling.
- Restored middleware after Railway deployment testing.

### Removed

- Removed local Kilo files.
- Removed local-only, obsolete, Prisma, temporary, and backup files from the production repository.
- Removed Docker files from the Railway Next.js build path.
- Removed standalone output from the Railway deployment path.

### Refactored

- Moved old layout backups out of the app router.
- Reworked deployment configuration around Railway hosting.

## [1.0.0] - 2026-04-27

### Added

- Added the initial clean UseClevr production version.
