# Requirements — UseClevr

> This file captures product-facing requirements. Each entry describes what a user
> experiences or needs, not how the system is implemented. Updated after each
> completed task cycle.

## User-Facing Requirements

### Upload & Analysis

- Users can upload CSV or Excel files and receive instant AI-generated analysis.
- Uploaded datasets render in a structured data table with row-count metadata.
- Users can ask AI questions about their uploaded dataset and get structured answers.
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

### Business Profile

- Users fill in company name, industry, location, website, and description in Settings.
- A live completion percentage is shown in the topbar so users can see how complete their
  business profile is.
- Incomplete business profile fields are surfaced in the topbar with a direct link to Settings.

### Support

- Dashboard notices appear in a topbar inbox with a persistent count so users can review and clear
  notices when they are ready.
- Dashboard users can submit support tickets and track their resolution status from the Tickets page.
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
- Dashboard FAQ includes an inline ticket form so users can open a support request without leaving
  the FAQ page.
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
- Super-admins always see built-in demo and super-admin accounts at the top of the customer list.
- Totals cards show total customers, Pro / Business count, free tier count, and active-in-last-30-days
  count at a glance.

### Customer Levels & Discount Rules

- Super-admins can define five customer tiers (Explorer through Champion) with independent thresholds
  for interactions, page visits, uploads, credits used, and logins, each rewarding a configurable
  number of analyst credits.
- Super-admins can create, edit, enable, and disable discount rules covering free-plan discounts,
  percentage discounts, referral rewards, and stacking behaviour — all stored in the same
  billing settings object.
- Super-admins edit customer levels and discount rules in horizontal table rows so related fields
  stay visible while scanning.

### Hybrid AI

- The hybrid AI popup uses the shared modal component so body scroll lock, Escape key handling,
  and backdrop behaviour are consistent with every other dialog.
- The hybrid AI popup opens reliably from the dashboard topbar.
- Free tier users see Pro and Business plan options inside the hybrid AI popup, guiding them to
  checkout with a single click.

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
- CSV analyzer business smoke tests must produce successful business KPIs without hidden
  multi-currency fallback errors.
