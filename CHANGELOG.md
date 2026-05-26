# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Dashboard language selector with four options: English, German, Hungarian, and Romanian.

### Changed

- Migrated Railway deployment from Nixpacks to Railpack builder for improved build control and smaller images.

### Dev

- Pre-commit validation now checks GitHub workflow syntax, approved action refs, and Corepack pnpm
   activation before changes are committed.
- Create-dist script now copies nixpacks.toml only if present, supporting Railpack migration.
- Language preference persists in localStorage and applies across the application.
- Translation service with 24-hour caching layer to minimize API calls to Google Translation.
- Dashboard users can open the AI Assistant from the sidebar, select a dataset, and ask follow-up
  questions from one workspace.
- Business Profile now shows profile sections, completion metrics, and review flags that explain
  which company details improve AI confidence.
- Business now opens as a top-level workspace with a businesses listing table and profile, location,
  tax, financial, and review subpages.
- Business records now use dedicated storage for business profiles, operating entities, archived
  status, subscription-tier limits, and cached country tax context.
- Setup progress now counts profile fields, business profile fields, first data actions, and key
  dashboard pages visited at least once.
- The setup progress panel now includes a guided tour through incomplete setup items.
- Dashboard FAQ now starts with quick actions for feedback, chat support, and support tickets.
- Dashboard tickets now use a table-first queue with separate pages for new tickets and row-level
  ticket editing.

### Changed

- The dashboard sidebar app panel now uses App Store and Google Play icons, and social links open
  the current external pages in a new tab.
- Dashboard onboarding now tracks setup progress from account data, routes users to the relevant
  setup pages, and keeps reopening for accounts below 25% completion.
- Business setup links now open the Business workspace instead of sending users through Settings.
- Social login buttons now start configured Google and GitHub sign-in or registration flows.
- The dashboard sidebar now includes coming-soon mobile app buttons, social placeholders, a user
  panel stack, and a bottom Terms link.
- The dashboard now opens directly on datasets, while admin customer, level, and discount lists use
  read-first rows with focused row edit pages.
- Dashboard FAQ now uses expandable answers and lets super-admins filter customer help and operator
  notes from one page.
- Hybrid AI and subscription plan buttons now go through checkout review before any payment action.
- Dashboard notices now live in a topbar inbox with a persistent count and recent product activity.
- Dashboard notices and activity now focus on rare, useful events instead of frequent background
  interactions.
- Billing and payment settings now use more customer-operations language and list-style history
  layouts.
- The topbar credits button now opens subscription settings instead of sending users to public plans.
- Public pricing and FAQ copy now describes Hybrid AI access without exposing runtime download sizes.
- Public pages outside the homepage now share one title section design.
- Dashboard help links now live under the topbar Help menu, while the sidebar focuses on primary
  app areas.
- Customer level and discount rule management now uses horizontal table rows for faster editing.

### Fixed

- Mistyped dashboard settings links now redirect to Profile settings.
- Business and super-admin accounts now keep paid download access instead of falling back to the free
  download limit.
- Checkout action labels now render plain text instead of encoded HTML entities.
- The dashboard activity popup now uses the shared overlay and shows clear loading or unavailable
  states for recent activity.
- Payment provider settings now require super-admin access even when opened by direct URL.
- Super-admin dashboard pages now require super-admin access even when opened by direct URL.
- Dashboard notices now dismiss the selected notice reliably when multiple notices arrive together.
- Contact visitors can now submit demo and sales requests from the Contact page.
- Product-update waitlist signup now succeeds during local development when the production database
  is unavailable.
- The Hybrid AI popup now opens reliably from the dashboard topbar.
- Dashboard FAQ now includes an inline ticket form.
- Super-admin customer lists now show built-in demo and super-admin accounts even when database
  customer rows cannot load.
- Local generated-output starts now use localhost for authentication while Railway keeps its server
  binding.
- Login errors now stay inside the login page instead of appearing as a global notice.
- Public legal pages and authentication screens now expose Terms and Privacy links consistently.
- Mobile public navigation now opens as a compact menu while keeping mode and theme controls visible.
- Referral signup and paid events now support idempotency keys and block self-referral rewards.

### Dev

- Pre-commit validation now checks GitHub workflow syntax, approved action refs, and Corepack pnpm
  activation before changes are committed.
- GitHub workflows now activate pnpm through Corepack instead of downloading the third-party pnpm
  setup action.
- TODO management now uses `T-` task numbers, a single active queue, retired dist/audit queues, and
  dedicated project audit and testing guides.
- TODO management docs now document how retired audit and dist tasks moved into the regular queues.
- GitHub workflow docs now cover issues, projects, versioning, releases, and workflow artifacts.
- Developer docs now include a GitHub issue template, release artifact checklist, git command
  patterns, long-running command handling, common prompt templates, and AI collaboration guides.
- Dist migration tracking now has no active unresolved items; future publish confirmations moved to
  the dist future queue.
- Admin management lists now share one table pattern before row-level editing.
- Production builds now fail on TypeScript errors, and the App Router shell no longer carries legacy
  document configuration.
- Public FAQ answers now render highlighted values through React instead of injected HTML.
- Local lint scripts now split package metadata, TODO metadata, docs, changelog, commit, link, and
  dependency freshness checks.
- Package scripts are grouped by workflow, with manual dependency freshness checks kept out of the
  pre-commit gate.
- Developer docs now include package-script usage and TODO workflow references.
- Railway predeploy now uses an idempotent schema sync so existing databases with empty migration
  history do not block startup.
- Railway and Vercel deployment docs now own their host-specific commands, settings, and
  troubleshooting notes.
- Railway generated-output builds now use Railpack for improved build control and smaller images.
- Railway generated-output packages no longer mix explicit build approvals with the runtime install
  flag that allows dependency build scripts.
- Railway runtime installs now tolerate generated deployment packages without a committed lockfile.
- Railway generated-output packages now include migration tooling required by the pre-deploy schema
  step.
- Railway generated-output deploys now restore the Next.js build directory at runtime when the host
  snapshot omits dot-directories.
- Repository text formatting is now normalized with UTF-8 and LF rules for local and CI consistency.
- Dist publishing now keeps the previous deployment commit visible while reducing workflow log noise.
- Dist deployments now keep host config files in the deployment config folder only, preventing
  Railway from building the branch root by mistake.
- Railway generated-output builds now use a generated Railpack plan for deployment installs.
- PDF export browser dependencies are now explicit production dependencies so publish builds with
  optional installs disabled do not miss bundler-required modules.
- Auto-merged release pull requests now dispatch branch maintenance after merge so beta sync and dist
  publish do not depend on suppressed token-generated events.
- Dist publishing now syncs deployment config files from the source branch while keeping generated
  app output inside `/dist`.
- Local pre-commit validation now runs the production publish build so missing bundle dependencies
  fail before deployment.
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
- Fixed source validation so beta-to-main pull requests and the resulting main-branch merge both run
  the required CI check, while beta pushes stay quiet.
- Added a dist publish guard so host config stays in the deployment config folder and never lands at
  the deployment branch root.
- Added source validation inside the dist publish workflow so generated deployment output is not
  published from a dirty type or lint baseline.
- Fixed the auto-merge workflow trigger so beta-to-main pull requests are matched by base branch
  `main` and filtered by head branch `beta`.
- Replaced the auto-merge helper action with an explicit `gh pr merge <PR number> --auto` command so
  the workflow does not depend on local branch detection.
- Optimized dist publishing so lockfile generation runs before final cleanup and the GitHub size gate
  checks staged deployment files instead of leftover build workspace files.
- Cleaned root-level build workspace leftovers after orphan checkout so untracked `.next/cache` and
  `node_modules` files cannot fail dist publishing.
- Disabled optional dependency installs for the generated Railway runtime package so Next.js SWC
  compiler binaries are kept in the source build phase only.
- Aligned deployment template paths with the current deployment settings folder and added a Vercel
  target placeholder for future host-specific settings.
- Added Vercel source-branch deployment settings alongside the Railway generated-output target.
- Added database-backed operational storage for support tickets, referral events, and billing
  settings with local file fallback.
- Added a generated deployment manifest and a dist server smoke test before publishing Railway output.
- Added CSV edge-case coverage for empty uploads, malformed rows, mixed currencies, and time zones.
- Added a production readiness checklist for deployment, accounts, access, data, AI, and billing
  operations.

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
