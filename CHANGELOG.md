# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- MCP subdomain exposes tool schemas with scoped access for service tokens.
- Database-backed MCP tokens support creation, listing, and revocation for service authentication.
- MCP audit trail records tool invocations, authentication failures, and token management events for compliance.
- MCP tool invocations appear in AI interaction traces for unified analytics across chat and tool interactions.
- FAQ content management is available through the content admin with field validation.
- Reduced motion accessibility toggle in the theme switcher disables CSS transitions for users sensitive to animation.
- Give new Free accounts a 14-day analyst trial while preserving two free analyst credits for use after the trial.
- Business Mentoring feature: book expert sessions for fundraising, growth strategy, operations, financial planning, and product development.
- Business mentoring public landing page highlighting mentor expertise and session types for founders and SMEs.
- Business mentoring dashboard widget showing next scheduled session and booking options.
- Business mentoring user guide with session types, pricing, and booking process.
- Business mentoring developer guide with API routes and schema for mentoring sessions.
- Business mentoring sales documentation with target segments and pricing tiers.
- Account linking: users who signed up via Google or LinkedIn can add a password via the signup form without creating duplicate accounts.
- OAuth user ID format standardized to `user_{uuid}` for consistency with credentials signup.
- Company setup persistence: wizard data can be saved and loaded via API, with missing-field warnings on the business overview page.
- Company Calculation Context computes adjusted KPIs (profit margin, net profit, tax estimate, cash flow) with confidence labels based on profile completeness.
- File size check, rate limiting, and improved dirty-CSV error messages added to the upload API route.
- Rate limiting added to the analyze API route (30 requests/minute).

### Changed

- Show built-in demo accounts as compact lines under the sign-in form.
- Keep the login footer focused on the terms link in the signup notice.
- Use simple login card styling without backdrop blur.
- Publish production only from the verified release branch instead of synchronizing beta during production deployment.

### Fixed

- Restore required Next.js runtime files during Railway image creation and startup so generated deployments boot successfully.
- Payload admin workspace requires explicit login instead of auto-authenticating on first load.
- Keep successful administrator login on the public UseClevr host and confirm the authenticated session before showing a credential error.
- Complete email registration only when both account and profile setup succeed, then sign the new user into the dashboard.
- Keep signed-out dashboard requests from rendering account data or loading another user's datasets as demo content.
- Let signed Stripe webhooks update subscriptions while unavailable paid checkout returns a clear setup error instead of a false success.
- Remove unused comparison, alert, and live-refresh endpoints that returned non-persistent or no-op production behavior.
- Keep uploaded datasets, analysis, dashboards, predictions, suggestions, and queries scoped to the signed-in owner.
- Classify CSV dates, text, numbers, booleans, and identifiers without treating unique business values as IDs.
- Leave profit, margin, ROAS, net profit, and LTV unavailable when required source columns are missing instead of inventing proxy values.
- Complete production middleware packaging without splitting the protected route entry into incompatible build chunks.
- Keep Payload admin pages on the Payload root runtime so the admin login and content workspace open instead of failing during boot.
- Keep local app login, Payload admin login, and signed-in MCP checks reachable by allowing the required auth endpoints before a session exists.
- Keep Payload Phase 0 local startup from attempting destructive automatic schema push during normal admin access.
- Stripe service initialization now matches the current Stripe SDK constructor so checkout, webhook, and replay paths compile and run.
- Runtime install routes now require development mode or explicit super-admin access, and server secret validation no longer accepts legacy auth aliases or hardcoded fallback tokens.
- Business profile row links open the matching business profile and new business creation opens a blank profile.
- AI Assistant feedback attaches to the saved answer history so helpful and not-helpful ratings are recorded on the right response.
- Dashboard topbar items stay compact, one-line, and visually consistent across search, setup progress, help, display controls, notices, and account actions.
- Hybrid AI local testing uses Mock AI responses for local runtime status, model list, pull, verification, chat, and analysis flows.
- Project controls approach now documents sales tolerances and quality review cycles for sales materials.
- Search popup local storage key uses consistent underscore naming and "FAQ" label renders correctly.
- Onboarding auto-open re-opens when completion drops below the minimum threshold.
- FAQ link added to the desktop public header navigation.
- AI interaction traces redact credential-like values before prompts, answers, and errors are stored or exported.
- Development debug endpoints return 404 in production so request and dataset diagnostics stay local.
- Dist publish workflow uses an allowlist-based staging directory instead of the working tree, preventing large build artifacts and node_modules from leaking into the dist branch.
- Public help chat answers public FAQ, dashboard help chat answers public and dashboard FAQ, and super-admin help chat includes operator FAQ.
- Topbar panels use clean popover backgrounds without backdrop blur for consistent UI styling.
- Sidebar toggle moved from topbar to the AppSidebar for desktop view, keeping mobile toggle in the header.
- Login uses compact inner labels, short tab flow, and forgot-password access directly under the password input.
- Signup creates account and shows success message; users sign in separately.
- Chat inputs use larger composing areas with clearer send actions.
- Floating help chat keeps the launcher aligned to the right while the panel is open.
- Private report search, listing, deletion, and downloads stay scoped to the owning user while super-admins keep operational access.
- Stripe checkout redirects verify payment success with a signed server token that survives local and deployed server restarts.
- MCP access stays scoped to signed-in users and their own datasets while super-admins keep full platform access.
- Railway health checks keep the test app deployable while database readiness is reported separately.
- Dashboard route guards avoid Edge runtime crashes by keeping full authentication checks in server code.
- Railway packaged output points Edge route guard manifests at the generated middleware bundle.
- Railway test login stays on the active test host instead of using a fixed live-app host.
- Railway test deploy starts through a portable shell entrypoint across Railpack runtime images.
- Production package builds run the full standalone build before packaging.
- Production package builds clean generated output before rebuilding standalone artifacts.
- Railway test deployment builds without attempting dependency install on prebuilt standalone bundle.
- Railpack config uses documented `provider` field format and custom install/build steps.
- Railway deploy resolves `"/app/node_modules": not found` — `node_modules/` with pnpm symlink structure
  committed to deployment branch, `cp -a` preserves relative symlinks, `.gitignore` allows
  `node_modules/` on deployment branches.
- Railway deploy resolves `node: command not found` — remove custom install/build steps from
  `railpack.json` so Railpack sets up Node.js runtime; npm install is instant (empty dependencies).

### Dev

- Add Railway environment-variable management without printing variable values, and expose the
  configured MCP server URL in authenticated MCP discovery responses.
- Separate reusable prompts and project logs from AI guidance, and require current changelog,
  interaction, activity, and AI-status records before each commit.
- Skip deployment schema synchronization when a build container has no database connection, while retaining runtime schema synchronization in configured environments.
- Move lightweight AI-governance checks (TODO, changelog, secrets, package lint) to pre-commit while tests stay in pre-push
- Generate an isolated authentication secret for validation and deployment builds so required environment checks and generated-server smoke tests complete.
- Add Git-tracked REST Client API request files and shared VS Code environments for health, auth, upload, analyze, business profile, billing, Railway smoke, and MCP checks.
- Add a workflow check-name golden file, local pre-push validation, and a non-blocking GitHub refresh workflow so branch protection cannot wait on stale required job names.
- Add Payload Phase 0 migration scripts, generated types, and PostgreSQL migration files for the new admin content schema.
- Record that the AI agent already follows task-close and post-interaction capture automatically, while user reminders sharpen the wording standard into actor-action-destination precision.
- Record AI-interaction correction patterns and future-developer notes in the smallest matching files.
- Rename sales project guidance around project controls and keep founder docs ready for a future branch split.
- Add generic TODO labels and done-task commit markers so task queues are easier to scan and audit.
- Add development-only Mock AI responses for local chat, streaming chat, and analysis flows.
- Consolidate Payload migration planning into one current migration plan and prompt reference.
- Clarify local AI, mock-mode, and API route access audit guidance so developer docs match current controls.
- Keep the mentoring booking page out of the server database bundle so production builds compile.
- Add secret-leak linting for docs and source text so credential examples stay placeholder-only.
- Retire the MCP implementation plan into the MCP developer guide, AI tracing structure, and active MCP hardening tasks.
- Retire the MCP and FAQ prompt plan into MCP docs, user guidance, requirements, and a reusable scope-check prompt.
- Retire the project evaluation prompt plan into reusable AI evaluation prompts, project learning controls, and the project audit guide.
- Retire the Business Profile planning prompt into the developer planning guide with calculation-context, setup payload, and review-flag rules.
- Add AI tracing structure guidance for prompt versions, user history, feedback, export, analytics, and trace-safe examples.
- Add AI interaction guidance for compact workflow updates, git release prompts, and memory collection from visible external chat summaries.
- Clarify documentation structure and retire duplicate AI interaction folders into the current AI knowledge base.
- Add Sales project documents and marketing planning.
- Reorganize AI interaction docs by audience, prompt library, learning traces, sales guidance, and project governance.
- Split reusable AI prompts into dedicated prompt files, including an interaction-trace prompt for user learning and problem markers.
- Move heavy local validation from pre-commit to pre-push while commit messages continue to validate at commit time.
- Add local Railway CLI shortcuts for browserless login, linking, status, and logs.
- Publish `dist/node_modules/` in deployment branch output for Railpack build graph checksum.
- Use `cp -a` instead of `fs.cpSync` for standalone copy to preserve relative pnpm symlinks.
- Remove `node_modules/` cleanup from all publish workflows and `.gitignore` on deployment branches.
- Add Next.js middleware for centralized auth and route protection.
- Add null guards for missing business details in locations and tax pages.
- Add error handling for dataset rows query failure in dataset detail page.
- Add metadata exports (page titles) to settings, tickets, FAQ, and dataset pages.

### Added

- Select dashboard language in English, German, Hungarian, or Romanian.
- View bookkeeping cards, queue, and monthly close readiness in Accountancy overview.
- Open AI Assistant from sidebar, select dataset, and ask follow-up questions in one workspace.
- View profile sections, completion metrics, and review flags in Business Profile.
- Access Business workspace with listing table, profile, location, tax, financial, and review subpages.
- Business records stored securely with profiles, entity details, archival status, limits, and tax context.
- Track setup progress via profile fields, business profile fields, first data actions, and key dashboard pages visited.
- View guided tour for incomplete setup items in setup progress panel.
- Dashboard FAQ displays quick actions for feedback, chat, and support tickets.
- Manage dashboard tickets with table-first queue, separate pages for new tickets and row-level editing.

### Changed

- Help content explains how users and operators get clearer AI answers and review answer quality.
- Use a more compact default text scale across public and dashboard pages.
- Display settings show accessibility states and explain contrast and larger-text controls.
- Front page sections use the same compact public-page rhythm and call-to-action treatment as the affiliate page.
- Access sign-in and sign-up in tabs with demo account, Google, and LinkedIn options.
- View business review readiness in Business overview.
- Manage dataset and downloads rows with clear action columns.
- Navigate account settings via horizontal subpage bar.
- Use dashboard topbar controls with improved click and hover areas.
- View dataset preview, customer level, and discount rule tables with consistent design.
- Dashboard search opens as a full-page overlay with direct links to pages, datasets, reports, and
  role-appropriate FAQ results.
- Sign out reliably to the login page.
- View dataset, business, and ticket listings with consistent title links, edit links, and row-end actions.
- AI Assistant keeps dataset selection, suggested questions, and the chat input visible while
  messages scroll.
- View user and operator help separately in Dashboard FAQ with clear section bar.
- Access profile settings, sign-out, and notices via hover panels in global topbar.
- Collapse dashboard sidebar to focus on primary navigation on desktop.
- View footer links, social links, and coming-soon app badges in one global footer row.
- Select light, dark, system, high-contrast, or larger-text display modes from dashboard topbar.

### Dev

- Remove pnpm metadata from generated Railway deployment packages so Railpack can use npm.
- Reuse pnpm store cache in GitHub validation and dist publish jobs. Retain install metadata in generated Railway output for faster dependency layers.
- Include pnpm build-script approvals in generated deployment packages so local and Railway installs can run required native dependency setup.
- Add Mermaid sitemap for dashboard routes to developer documentation.
- Activate and locate pnpm via Corepack in Railway builds by including package manager definition in generated package manifest.
- Persist language preference in localStorage and apply across application.
- Add translation service with 24-hour caching layer to minimize API calls to Google Translation.

### Changed

- See App Store and Google Play icons in dashboard sidebar app panel; social links open external pages in new tab.
- Track setup progress from account data, route to relevant setup pages, and reopen for accounts below 25% completion.
- Open business setup links in the Business workspace.
- Social login buttons start with configured Google and LinkedIn sign-in or registration.
- See dashboard sidebar with coming-soon mobile app buttons, social placeholders, user panel stack, and bottom Terms link.
- Dashboard opens directly on datasets; admin customer, level, and discount lists use read-first rows with focused row edit.
- Use expandable answers in Dashboard FAQ and let super-admins filter customer and operator notes from one page.
- See dashboard tables and page headers with denser shared layout, title icons, and clearer row actions.
- Hybrid AI and subscription plan buttons go through checkout review before payment.
- See dashboard notices in topbar inbox with persistent count and recent product activity.
- Focus dashboard notices and activity on rare, useful events instead of frequent background interactions.
- See billing and payment settings with more customer-operations language and list-style history layouts.
- Open subscription settings from topbar credits button.
- See public pricing and FAQ copy describing Hybrid AI access without exposing runtime download sizes.
- See public pages outside homepage sharing one title section design.
- See dashboard help links under topbar Help menu; sidebar focuses on primary app areas.
- See customer level and discount rule management using horizontal table rows for faster editing.

### Fixed

- View business overview when no business profile exists, with add-business action visible in top-level workspace.
- Upload datasets using valid persisted demo account path with clearer file-size handling.
- View business overview metrics even when business storage tables are unavailable.
- Open dashboard notifications from topbar notices sidebar.
- See project favicon resolved from app route with broken duplicate favicon assets removed.
- Keep local and live login redirects on active app host.
- See Stripe checkout return users through verifiable checkout session to reopen billing portal for linked customers.
- Use chat with dashboard search context to point users to relevant pages and FAQ answers.
- See ticket tables with selectable rows, title edit links, and bulk resolution controls.
- Sign out to app login page instead of stale host URL.
- Open checkout to secure payment step after terms acceptance to activate subscriptions from provider confirmations.
- Load business workspace with saved profile details even when dedicated business records are not ready.
- See dashboard notices identify failed request or page error more directly.
- See AI Assistant answer from stored dataset analysis context when selected dataset has saved metrics.
- See help chat clear of footer with stronger message contrast.
- See setup progress include business subpage visits in completion checklist.
- See mistyped dashboard settings links redirect to Profile settings.
- Keep paid download access for Business and super-admin accounts.
- See checkout action labels render plain text instead of encoded HTML entities.
- See dashboard activity popup use shared overlay showing clear loading or unavailable states for recent activity.
- See payment provider settings require super-admin access when opened by direct URL.
- See super-admin dashboard pages require super-admin access when opened by direct URL.
- See dashboard notices dismiss selected notice reliably when multiple notices arrive together.
- See contact visitors submit demo and sales requests from Contact page.
- See product-update waitlist signup succeed during local development when production database unavailable.
- See Hybrid AI popup open reliably from dashboard topbar.
- See ticket creation on Tickets page.
- See super-admin customer lists show built-in demo and super-admin accounts when database customer rows cannot load.
- See local generated-output start using localhost for authentication while Railway keeps server binding.
- See login errors stay inside login page instead of appearing as global notice.
- See public legal pages and authentication screens expose Terms and Privacy links consistently.
- See mobile public navigation open as compact menu while keeping mode and theme controls visible.
- See referral signup and paid events support idempotency keys and block self-referral rewards.

### Dev

- Pre-commit validation checks GitHub workflow syntax, approved action refs, and Corepack pnpm
  activation before changes are committed.
- GitHub workflows use current reviewed GitHub-owned action major tags while pnpm stays activated
  through Corepack.
- Activate pnpm through Corepack in GitHub workflows.
- Treat beta sync branch-permission failures as non-blocking during dist publishing.
- Publish dist-test Railway output without pnpm workspace metadata so Railpack uses the prebuilt bundle.
- TODO validation reports active and retired queue states while preserving existing task metadata.
- Changelog linting checks Unreleased entries for active-change wording.
- Maintenance scripts share repository path and package-manager settings from one script config.
- CommonJS tooling uses the same repository settings as ESM maintenance scripts while runtime helpers
  keep their deployment-safe format.
- TODO management uses stable task numbers, a single active queue, retired dist/audit queues, and
  dedicated project audit and testing guides.
- TODO management docs document migration records, retirement rules, and temporary TODO handling.
- GitHub workflow docs cover issues, projects, versioning, releases, and workflow artifacts.
- Developer docs include a GitHub issue template, release artifact checklist, git command
  patterns, long-running command handling, common prompt templates, and AI collaboration guides.
- Dist migration tracking has no active unresolved items, and future publish confirmations move to
  the future queue.
- Admin management lists share one table pattern before row-level editing.
- Production builds fail on TypeScript errors, and the App Router shell no longer carries legacy
  document configuration.
- Public FAQ answers render highlighted values through React instead of injected HTML.
- Local lint scripts split package metadata, TODO metadata, docs, changelog, commit, link, and
  dependency freshness checks.
- Package scripts are grouped by workflow, and dependency freshness checks run manually outside the
  pre-commit gate.
- Developer docs include package-script usage and TODO workflow references.
- Railway predeploy uses an idempotent schema sync so existing databases with empty migration
  history do not block startup.
- Railway and Vercel deployment docs own their host-specific commands, settings, and
  troubleshooting notes.
- Railway generated-output builds use Railpack for improved build control and smaller images.
- Railway generated-output packages no longer mix explicit build approvals with the runtime install
  flag that allows dependency build scripts.
- Railway runtime installs tolerate generated deployment packages without a committed lockfile.
- Railway generated-output packages include migration tooling required by the pre-deploy schema
  step.
- Railway generated-output deploys restore the Next.js build directory at runtime when the host
  snapshot omits dot-directories.
- Repository text formatting is normalized with UTF-8 and LF rules for local and CI consistency.
- Dist publishing keeps the previous deployment commit visible while reducing workflow log noise.
- Dist deployments keep host config files in the deployment config folder only, preventing
  Railway from building the branch root by mistake.
- Railway generated-output builds use a generated Railpack plan for deployment installs.
- PDF export browser dependencies are explicit production dependencies so publish builds with
  optional installs disabled do not miss bundler-required modules.
- Auto-merged release pull requests dispatch branch maintenance after merge so beta sync and dist
  publish do not depend on suppressed token-generated events.
- Dist publishing syncs deployment config files from the source branch while keeping generated
  app output inside `/dist`.
- Local pre-push validation runs the production publish build so missing bundle dependencies
  fail before deployment.
- Payload migration planning uses clearer AI implementation steps.
- GitHub automation can auto-merge pull requests from beta into main.
- Branch maintenance includes the pull request number in dist commit messages.
- Workflow formatting and cache cleanup prevent false-positive size check failures.
- TODO files reflect completed work and current in-progress items.
- Repo-wide lint warnings are cleared so local lint runs with zero warnings.
- TypeScript validation passes after the lint cleanup.
- CSV business KPI analysis handles multi-currency normalization without reading missing monetary
  fields or mapping `country` as `quantity`.
- Railway pre-deploy routes migrations through a generated pnpm-backed script and documents that old
  dashboard npm overrides must be cleared.
- GitHub deployment strategy notes cover dist branch limits, Railway source builds, Docker
  image deployment, and GitHub Actions artifacts.
- CI triggers avoid duplicate pull request validation runs on beta pushes.
- Source validation runs for beta-to-main pull requests and the resulting main-branch merge, while
  beta pushes stay quiet.
- Dist publishing guards host config so it stays in the deployment config folder and never lands at
  the deployment branch root.
- Source validation runs inside dist publishing so generated deployment output is not
  published from a dirty type or lint baseline.
- Auto-merge workflow triggers match beta-to-main pull requests by base branch
  `main` and filtered by head branch `beta`.
- Auto-merge uses an explicit CLI command so the workflow does not depend on local branch detection.
- Dist publishing runs lockfile generation before final cleanup and checks staged deployment files
  instead of leftover build workspace files.
- Root-level build workspace leftovers are cleaned after orphan checkout so untracked cache and
  `node_modules` files cannot fail dist publishing.
- Generated Railway runtime packages skip optional dependency installs so Next.js SWC compiler
  binaries remain in the source build phase only.
- Deployment template paths align with the current deployment settings folder and include a Vercel
  target placeholder for future host-specific settings.
- Vercel source-branch deployment settings sit alongside the Railway generated-output target.
- Database-backed operational storage supports tickets, referral events, and billing
  settings with local file fallback.
- Generated deployment manifests and dist server smoke tests run before Railway output publishes.
- CSV edge-case coverage checks empty uploads, malformed rows, mixed currencies, and time zones.
- Production readiness checks cover deployment, accounts, access, data, AI, and billing
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
