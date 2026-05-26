# Requirements — UseClevr

> This file captures product-facing requirements. Each entry describes what a user
> experiences or needs, not how the system is implemented. Updated after each
> completed task cycle.

## User-Facing Requirements

### Upload & Analysis

- Users can upload CSV or Excel files and receive instant AI-generated analysis.
- Uploaded datasets render in a structured data table with row-count metadata.
- Users can ask AI questions about their uploaded dataset and get structured answers.
- Dashboard users can open the AI Assistant from the sidebar, select one of their datasets, and ask
  business questions without leaving the assistant workspace.
- AI analysis uses a two-pass discovery + query pipeline so questions stay within data scope.
- Business KPI analysis maps quantity, product, country/region, and revenue columns by explicit
  semantic matches so country values are not counted as quantities.
- Hybrid AI Lite lets Pro-tier users pose crowd-level questions against their own data.
- Hybrid AI MEGA lets Business-tier users run large-scale federated queries at scale.
- Hybrid AI public plan copy explains plan access without exposing runtime download sizes.

### Downloads & Reports

- Pro and Business tier users can generate and download PDF reports from analysis results.
- Downloads are tracked per dataset and entry, supporting click-action logging.
- PDF export packages charting output and tabular detail into a shared downloadable file.

### Subscriptions & Billing

- Users can view available plans (Free, Pro Monthly, Pro Annual, Business Monthly) and upgrade directly.
- A two-step checkout flow requires plan review before terms acceptance before any payment is taken.
- Annual Pro subscriptions receive an automatic discount at checkout.
- Subscriptions stay in sync with the payment provider so plan access and billing status update
  immediately after any payment-event change.
- Users can manage their subscription, view usage, and downgrade or cancel without leaving the app.
- Free tier users receive a limited analyst-credit allowance and are prompted to subscribe when it
  is exhausted.
- Mistyped dashboard settings links should land on Profile settings instead of a missing page.

### Business Profile

- Dashboard onboarding uses account data to show setup progress, reopen automatically while users
  are below 25% completion, and send each panel to the relevant setup or workflow page.
- Setup progress counts completed profile fields, completed business profile fields, first upload
  and analysis actions, and key dashboard pages visited at least once.
- Dashboard users can open a setup progress panel from the topbar and start a guided tour through
  incomplete setup items.
- Dashboard users open Business as a top-level workspace with a businesses listing table before
  editing profile, location, tax, financial, or review details.
- Business records support subscription-tier limits, primary profile storage, archive and restore
  states, operating entities, and cached country tax profiles.
- Users fill in company name, industry, location, website, and description in Business Profile.
- Business Profile shows identity, contact, and operations sections with review flags that explain
  which missing details lower AI confidence.
- A live completion percentage is shown in the topbar so users can see how complete their
  business profile is.
- Incomplete business profile fields are surfaced in the topbar with a direct link to Business
  Profile.
- Dashboard users can switch between English, German, Hungarian, and Romanian languages from
  the language selector in the topbar.
- Language preference persists across sessions and page reloads.

### Support

- Social login and registration create usable local account and profile records before users enter
  the dashboard.
- Dashboard users can reach coming-soon mobile app buttons, social placeholders, account controls,
  and Terms from the sidebar footer.
- Dashboard sidebar app buttons use App Store and Google Play icons, and social buttons open the
  current external pages in a new tab.
- Dashboard notices appear in a topbar inbox with a persistent count so users can review and clear
  notices when they are ready.
- Dashboard notices and activity feeds show high-value account, billing, and dataset events without
  recording routine page changes, clicks, or repeated login noise.
- Dashboard activity surfaces saved product actions including profile, business, upload, analysis,
  deletion, registration, and subscription events.
- Dashboard users can submit support tickets and track their resolution status from the Tickets page.
- Dashboard tickets use a row-first table with separate pages for creating a ticket and editing each
  ticket.
- Public visitors can request a demo or contact the team from the Contact page without signing in.
- Super-admins have a ticket queue for reviewing customer issues, adding support notes,
  and marking tickets resolved.
- Support tickets, support notes, billing settings, and referral events persist in the database when
  production database access is configured.
- A built-in FAQ answers account, billing, dataset, report, credits, and Hybrid AI questions.
- A protected operator FAQ covers support operations, payments, billing recovery, security,
  and incident handling for authorised platform staff only.
- Dashboard users can search FAQ answers from a floating help chat, then send a support request
  when no answer matches their question.
- Dashboard FAQ uses expandable answers and includes an inline ticket form so users can open a
  support request without leaving the FAQ page.
- Dashboard FAQ offers one-line actions for feedback, chat support, and ticket creation before the
  FAQ list.
- Super-admins can filter operator notes from the same dashboard FAQ page instead of opening a
  separate FAQ page.
- Product-update waitlist signup remains usable during local development even when production
  database access is unavailable.

### Payment Provider Setup

- Platform operators can confirm whether the payment provider is connected before customers
  reach checkout.
- Payment provider configuration is gated to super-admin role only.
- The payment setup page shows the current status of secret key and webhook secret.

### Credit Rules & Referrals

- Super-admins can configure how many successful referrals are needed to earn one analyst credit
  and can toggle referral credits on or off from the Credit Rules settings page.
- Referral rewards are idempotent and do not reward self-referrals.
- Referral rules, customer levels, and discount rules are all managed from the super-admin sidebar
  under dedicated pages for Credit Rules, Customers, Customer Levels, and Discount Rules.

### Customer Management

- Users can review their last 100 account, subscription, and dataset activity events from Settings.
- Super-admins can review recent product activity across all users from a protected settings page.
- Super-admins can view a full customer list with plan, signup date, last login, referral source,
  login count, and dataset count in a single admin page.
- Super-admins can queue an invite from the customer list for existing customer rows.
- Super-admins always see built-in demo and super-admin accounts at the top of the customer list.
- Totals cards show total customers, Pro / Business count, free tier count, and active-in-last-30-days
  count at a glance.
- Super-admins review customers in a read-first table and open focused edit pages for individual
  customer rows.

### Customer Levels & Discount Rules

- Super-admins can define five customer tiers (Explorer through Champion) with independent thresholds
  for interactions, page visits, uploads, credits used, and logins, each rewarding a configurable
  number of analyst credits.
- Super-admins can create, edit, enable, and disable discount rules covering free-plan discounts,
  percentage discounts, referral rewards, and stacking behaviour — all stored in the same
  billing settings object.
- Super-admins review customer levels and discount rules in read-first tables before opening focused
  edit pages for individual rows.

### Hybrid AI

- The hybrid AI popup uses the shared modal component so body scroll lock, Escape key handling,
  and backdrop behaviour are consistent with every other dialog.
- The hybrid AI popup opens reliably from the dashboard topbar.
- Free tier users see Pro and Business plan options inside the hybrid AI popup, guiding them to
  checkout review with a single click.

### Release & Deployment

- Developers can test source changes on a beta branch before opening a pull request into the stable
  branch.
- Platform operators receive deployments from generated production output without requiring local
  build files to be committed to source branches.
- The hosting platform deploys from generated output while keeping runtime secrets in the hosting
  environment.
- Production deployments use a generated deployment folder with its own runtime package,
  hosting config, and dependency build approvals.
- Production deployments include a manifest with source commit, build timestamp, runtime version,
  and healthcheck path.
- Developers can use documented package scripts and TODO workflows to keep local checks, deployment
  checks, and dependency reviews consistent.
- Developers can run focused checks for package metadata, TODO metadata, docs, changelog, commit
  history, links, and dependency freshness.
- Server-host settings are grouped by host so Railway and future secondary destinations can
  keep separate templates.
- Railway and Vercel deployment operations have separate guides so host-specific CLI, dashboard,
  runtime, and troubleshooting steps stay easy to replace.
- Vercel can deploy the source branch with its own synced host template while Railway continues to
  deploy generated output.
- Application source remains independent from hosting-specific files, so server targets can change
  without pushing deployment details into product code.
- Production packaging scripts remain in tracked source paths that do not conflict with ignored
  generated output folders.
- Project planning lives under one root TODO folder with separate active, next, completed, and dist
  migration files so follow-up work is easier to audit.
- Dist migration planning distinguishes active work, completed work, future requests, and deliberate
  no-fix decisions.
- Developer machines use Husky-managed Git hooks instead of custom local `.git/hooks` scripts.
- Dist deployment commits use short pull request titles so deployment history is readable.
- Dist deployment history keeps the previous deployment commit visible in the branch graph.
- The deployment branch keeps permanent host config in `/server-config` while the app runs from
  `/dist`.
- The deployment branch never publishes Railway or Vercel config files at the branch root or inside
  `/dist`.
- Auto-merged release pull requests dispatch branch maintenance after merge so beta sync and dist
  publishing run even when token-generated events are suppressed.
- Developers can run the generated production server locally with shared development environment
  values that apply across branch checkouts.
- Local generated-output starts use localhost for authentication, while Railway and Vercel starts
  use explicit server-target commands.
- Database migrations run as part of the hosting platform pre-deploy phase so schema changes are
  applied in the target environment before the new web process starts.
- Hosting pre-deploy and runtime commands use pnpm-backed generated scripts, and old dashboard-level
  npm command overrides are not part of the supported deployment path.
- Railway runtime builds use Corepack-managed pnpm through Nixpacks so deployment no longer depends
  on Railpack `mise install`.
- Railway runtime builds use a current Corepack setup and a Node-compatible pnpm release so
  package-manager signature updates and Node engine checks do not block deploys.
- Railway runtime packages avoid conflicting pnpm build-approval settings during generated-output
  installation.
- Railway runtime installs can run from generated deployment packages without a committed lockfile.
- Railway generated deployment packages include the migration tooling needed for the pre-deploy schema
  step.
- Railway generated deployments restore the Next.js build output during runtime start so host
  snapshot handling of dot-directories cannot block boot.
- Source validation runs with a zero-warning lint baseline and TypeScript validation before release
  or generated deployment output is trusted.
- Project text files use UTF-8 and LF formatting so local checks and CI read the same file content.
- Local pre-commit validation runs the production publish build so missing bundle dependencies are
  caught before deployment.
- Publish builds install PDF export browser dependencies as explicit production packages, even when
  optional dependency installs are disabled.
- Public pages include legal links in their bottom navigation so users can reach Terms and Privacy
  from authentication and marketing screens.
- Public pages outside the homepage share a consistent title section so navigation feels stable
  across FAQ, pricing, contact, security, privacy, and terms.
- Payment provider settings require super-admin access from navigation and direct URLs.
- Super-admin dashboard pages require super-admin access from navigation and direct URLs.
- Dashboard notices dismiss the selected notice reliably when several notices arrive close together.

### Reference Files

- Terms & Conditions are at `https://useclevr.com/terms`
- Privacy Policy is at `https://useclevr.com/privacy`
- Public plans page at `/pricing`

### Developer Requirements

- Commit messages follow conventional commit format (feat, fix, docs, etc.) enforced by commitlint.
- Pull request titles start with `PR:` for deployment tracking
- Source files stay free of unused imports, unused values, and type-only import warnings so CI output
  remains readable.
- Production builds fail when TypeScript validation fails, so generated deployment output cannot hide
  source type errors.
- App Router pages use the root layout and metadata APIs for the document shell instead of legacy
  document configuration.
- Public FAQ content renders emphasis without injecting HTML, keeping shared content safer to reuse.
- Admin management tables use the shared table pattern so customer, customer level, discount, and
  future activity rows scan consistently before editing.
- Dist migration tracking keeps active work separate from future post-merge confirmations, so
  deployment follow-up items do not remain in the active migration queue.
- TODO management uses `T-` task numbers and one active queue so agents can triage next, completed,
  future, and ignored work consistently.
- Developers have start-to-finish project audit and testing guides for repeatable review and release
  checks.
- Developers can use GitHub issues, projects, releases, and workflow artifacts with documented
  boundaries between collaborative planning and local TODO tracking.
- CSV analyzer business smoke tests must produce successful business KPIs without hidden
  multi-currency fallback errors.
