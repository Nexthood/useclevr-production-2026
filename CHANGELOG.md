# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Dev

- Restructured Migrate to Payload.md for clear AI implementation steps.
- Added GitHub Action to auto-merge PRs from beta → main.
- Updated branch-maintenance workflow to include PR number in dist commit messages (e.g., PR-28:).
- Fixed workflow YAML indentation and added cache cleanup before size check to prevent false positives.
- Updated todo files to reflect completed work and current in-progress items.
- Cleaned repo-wide ESLint warnings so `pnpm lint` now runs with zero warnings.
- Verified TypeScript validation after the lint cleanup.
- Fixed CSV business KPI analysis so multi-currency normalization no longer reads a missing
  `monetaryColumns` field or maps `country` as `quantity`.
- Hardened Railway pre-deploy by routing migrations through a generated pnpm-backed
  `railway:predeploy` script and documenting that old dashboard npm overrides must be cleared.
- Added GitHub deployment strategy notes covering dist branch limits, Railway source builds, Docker
  image deployment, and GitHub Actions artifacts.
- Optimized CI triggers so beta pushes do not duplicate the pull request validation workflow.
- Fixed the auto-merge workflow trigger so beta-to-main pull requests are matched by base branch
  `main` and filtered by head branch `beta`.
- Replaced the auto-merge helper action with an explicit `gh pr merge <PR number> --auto` command so
  the workflow does not depend on local branch detection.
- Optimized dist publishing so lockfile generation runs before final cleanup and the GitHub size gate
  checks staged deployment files instead of leftover build workspace files.

## [7.2.0] - 2026-05-20

### Dev

- Commit messages are now enforced to follow conventional commit format via commitlint and Husky hooks.
- Deployment automation now syncs the test branch before publishing generated Railway output, while
  keeping source branches free of committed build artefacts.
- Deployment output now installs runtime dependencies directly on Railway and keeps the deployment
  branch root free of generated framework files.
- Local production starts can now share one development env file across multiple checkouts while
  still allowing checkout-specific overrides.
- Generated Railway packages now include dependency build approvals so pnpm can install production
  runtime dependencies without manual approval.
- Deployment target settings are now documented as reusable host templates, separate from GitHub
  workflow definitions.
- Generated hosting config now has one source of truth, preventing branch metadata from overriding
  the deployment folder config.
- Database migrations now stay in the hosting pre-deploy phase for the current single-service
  deployment path.
- Deployment templates now live under a target-focused folder with an explicit Railway sync command,
  leaving room for additional deployment destinations.
- Railway deployment settings now live in a dedicated target subfolder and force pnpm dependency
  build approvals during install.
- Server-host settings and Railway-specific helper scripts now live in clearly named folders, keeping
  application source and local scripts separate from host-specific deployment details.
- The generated-output packaging script now lives outside any ignored `dist/` path, so it can be
  staged normally.
- Todo tracking now lives under one root `.TODO/` folder with separate active, next, done, and dist
  migration files.
- Generated dist commits now use the merged pull request title with a `PR:` prefix instead of long
  source commit ids.
- Todo tracking now separates done, future, no-fix, and dist migration records inside `.TODO/`.
- Local Git hooks now use Husky with commit-message validation, and lint auto-fix uses ESLint
  directly.

## [7.1.0] - 2026-05-18

### Added

- A customer management page gives super-admins a full overview of every registered user, including plan, signup date, last login, referral source, login count, and dataset count.
- An admin page for managing customer levels lets super-admins define five tiers with interaction goals, page visits, uploads, credit use, login goals, and level rewards — all configurable without touching code.
- A discount management page lets super-admins create, edit, enable, and disable discount rules covering free-plan discounts, percentage discounts, referral rewards, and stacking behaviour in one place.
- Credit rule settings are now configurable from the admin panel — the number of successful referrals needed to earn one analyst credit can be adjusted, and referral credits can be toggled on or off.

### Changed

- The "Start free trial" button on the public pricing page now routes new users to the sign-up page instead of the paid checkout flow.
- The Hybrid AI button uses the shared modal component so body scroll lock, Escape key handling, and backdrop behaviour are consistent with every other dialog in the app.
- The app dashboard home page now uses the larger tinted icon boxes and gradient primary CTA from the public landing page, and a Downloads quick-action has been added alongside Datasets and AI Analyst.
- Subscription and billing settings pages now carry the rounded-xl icon box and tinted-card styling used on the public pages.
- The Credits settings card has been upgraded with gradient icon boxes and the Referral Config status block is visible inline.
- The Super-admin sidebar now surfaces Customers, Customer Levels, and Discount Rules links directly under the existing super-admin block.

### Dev

- Super-admin sidebar links for Customers, Customer Levels, and Discount Rules are registered in the app sidebar component under the existing super-admin conditional block, keeping all three pages discoverable from one place.
- Admin credit rule settings are now stored in the billing settings file under `referralConfig` (`referralsPerCredit`, `enabled`).
- Customer levels and discount rules are stored in the billing settings file under `levels` and `discountRules` respectively, keeping all super-admin configuration in one persisted settings object with merge-safe defaults.
- New API routes serve the three admin pages: GET `/api/admin/customers`, GET/POST `/api/admin/levels`, and GET/POST `/api/admin/discounts` — all gated to the super-admin role.

## [7.0.0] - 2026-05-18

### Added

- Support tickets are now built into the dashboard, so customers can request help and track
  resolution without leaving the app.
- Super-admins now have a ticket queue for reviewing customer issues, adding support notes, and
  marking tickets resolved.
- Dashboard users now have a dedicated FAQ for account, billing, datasets, reports, credits, and
  Hybrid AI questions.
- Super-admins now have a protected operator FAQ covering support, payments, billing recovery,
  security, and incident handling.
- The public FAQ now includes clearer customer billing answers for renewals, failed cards, receipts,
  refunds, unexpected charges, and payment security.
- Subscriptions now sync in real time, so plan access and billing status update automatically after
  payment-provider changes.
- Checkout now guides users through plan review and terms acceptance before payment.
- Business settings now show a live completion percentage so users can see how much of their
  business profile is filled in.
- Payment setup visibility now helps platform operators see whether billing is ready before
  customers reach checkout.

### Changed

- The dashboard topbar now prioritizes Tickets & Issues so users can reach support faster.
- The sidebar now includes support, dashboard FAQ, and super-admin FAQ links where relevant.
- Navigation now exposes Business, Billing, and related settings more directly.
- The topbar now displays the full plan name and links users to finish incomplete business-profile
  details.
- Hybrid AI plan prompts now clearly show that Pro includes Lite and Business includes MEGA.

### Fixed

- Business settings no longer pull server-only code into the browser, preventing production build
  failures.
- The homepage FAQ now renders correctly during production builds.
- Deployment settings are regenerated from the source configuration on every build, preventing stale
  hosting values from being deployed.
- The sign-up page now has stronger contrast across form labels, action buttons, and the feature
  panel.
- Payment secrets are no longer loaded before they are needed, so the app can start safely while
  payment setup is incomplete.
- Payment-provider messages are verified before subscription changes are processed.

### Dev

- Development checks now catch formatting, type, and production-build issues before release.
- The project keeps a task backlog in `.TODO/` so work is tracked across AI and human contributors.
- Completed tasks must be recorded in both `requirements.md` (product-facing) and this changelog so
  that user-visible changes and developer context stay in sync from a single source of truth.
- PR instructions now require contributors to update `requirements.md` and the unreleased section of
  this changelog, reducing the chance of undocumented release notes.
- Markdown files are now linted for line length before every docs PR, catching prose-wrap drift
  at CI time instead of after merge.
- A `docs:lint` npm script is available so the markdown style rules can be checked locally or in CI.

## [6.0.1] - 2026-05-17

### Fixed

- The production build artifact is now generated with the correct module type so the application
  starts cleanly on the hosting platform after deploy.
- The checkouts page no longer throws a rendering error when opened by a user.

## [6.0.0] - 2026-05-17

### Added

- Subscriptions are now handled end-to-end through the payment provider: paid plans activate
  immediately, subscription status stays in sync, and users can manage their plan from Settings.
- A dedicated payment setup page lets platform operators confirm the payment provider connection is
  live before users start paying.
- A two-step checkout flow guides users through plan review and terms acceptance before any payment
  is taken.
- Business profile fields (company name, industry, location, website, description) are now collected
  separately in Settings and feed into profile-completion tracking.

### Changed

- The settings sidebar now shows all available pages directly instead of hiding some behind a
  sub-menu.
- The topbar shows the full plan name and links through to the subscription management page.
- Infrastructure and model details have been removed from all user-facing product text so that only
  the intended product information is visible to customers.

## [5.2.0] - 2026-05-17

### Added

- Added developer-friendly script aliases for validation, CI, preview, release, docs, audit, and
  health checks.
- Added local release and documentation check helpers.
- Added Prettier-backed format and format-check scripts.
- Added `SECURITY.md` with a vulnerability disclosure policy.
- Added `CONTRIBUTING.md` with local setup, commit conventions, and PR guidelines.
- Added `.github/workflows/ci.yml` with `paths-ignore` for doc-only commits, a fast CI job (types +
  dist + lint + tests), a full build job, and a docs-only job for PRs that touch markdown.
- Added `.markdownlint.json` for consistent markdown style across the repo.
- Added `docs/Developer_Guides/next.md` — structured post-mortem documenting the ESM / CJS
  module-type mismatch (`"type": "commonjs"` vs `"type": "module"`) that caused Railway startup
  failures, including root-cause analysis, the fix applied to `scripts/package-dist/create-dist.cjs`, and a
  rebuild checklist.

### Changed

- Improved UI contrast across public pages, dashboard cards, Hybrid AI controls, and status badges.
- Improved dashboard settings and front-end subscription flows.
- Updated billing and Hybrid AI UI behavior.
- Continued developer/source-structure cleanup for dashboard settings and project organization.

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

- Added minimal working versions of previously planned features, including subscriptions, billing,
  credits, checkout, settings, referral QR, and related app pages.
- Added configurable CI/deploy settings with Railway as the current provider.
- Added dist-oriented Railway deployment support.

### Changed

- Updated Railway deployment configuration so deploys can run from the generated `dist` output.
- Updated documentation for the CI and dist deployment workflow.
- Rebuilt production distribution artifacts.

### Fixed

- Fixed Railway config issues and marked unfinished features more clearly before replacing them with
  minimal working flows.

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

- Added credit handling, user admin role support, demo login behavior, and Railway authentication
  updates.
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
- Added production build output under `dist/`.
- Added public assets.
- Added build scripts and package script updates.
- Added documentation updates and a project flowchart.

### Changed

- Updated Railway JSON and start/build command flow.
- Updated package metadata and dist upload flow.

### Removed

- Removed unused parts from the production project.

### Refactored

- Moved the application into the `src/` structure.
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
