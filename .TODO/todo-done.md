# Task Queue — Done

## Completed

- **Notice and activity pruning** — Dashboard notices and activity now focus on high-value account,
  billing, and dataset events while suppressing routine login and background request noise.
- **Admin billing polish** — Customer invites, checkout labels, billing history, and payment
  readiness wording now better match operator workflows.
- **Deployment guides** — Railway and Vercel now have dedicated host guides for CLI commands,
  settings, runtime behavior, and troubleshooting.
- **Railway Corepack build fix** — Railway generated-output builds now refresh Corepack on Node 22
  and use a Node-compatible pnpm release to avoid signature and engine failures.
- **Railway pnpm config fix** — Generated runtime packages no longer mix conflicting pnpm
  build-approval settings.
- **Railway lockfile tolerance** — Runtime installs now tolerate generated deployment packages without
  a committed lockfile.
- **Railway migration tooling** — Generated runtime packages now include the tooling needed for the
  pre-deploy schema step.
- **Railway Next build restore** — Generated deployments now restore the Next.js build output during
  runtime start for hosts that omit dot-directories.
- **Railway health binding fix** — Generated starts now force the public host binding so platform
  health checks can reach the app.
- **Railway predeploy schema sync** — Generated deploys now use an idempotent additive schema sync so
  existing databases with empty migration history do not block startup.
- **Package and TODO docs** — Package scripts and developer docs now separate manual dependency
  freshness checks from pre-commit validation.
- **Local lint split** — Package metadata, TODO metadata, docs, changelog, commit, link, and
  dependency freshness checks now have dedicated scripts.
- **Repository text formatting** — Git and editor rules now normalize tracked text files to UTF-8
  with LF endings.
- **Settings and notices hardening** — Payment provider settings and super-admin dashboard pages now
  require super-admin access from direct URLs, and notice dismissal now targets the selected notice
  reliably.
- **Dashboard notices and activity** — Topbar notices now persist in an inbox with recent product
  activity, user activity history, and super-admin total activity.
- **Dist history visibility** — Dist publish keeps the previous deployment commit visible and reduces
  workflow log output.
- **Dist config placement** — Dist branch host config stays only in `/server-config`, and pnpm
  workspace metadata is removed from deployment output.
- **Railway Nixpacks install** — Generated deployment output now carries a Nixpacks plan that installs
  production dependencies with Corepack pnpm instead of default npm.
- **GitHub Actions workflow steps** — Renamed steps in branch-maintenance.yml to descriptive names.
- **Railway lockfile generation** — Publish workflow now generates matching pnpm-lock.yaml from dist package.json for deterministic installs.
- **Railway build fix** — Removed --frozen-lockfile since dist package.json has fewer deps than root.
- **Super-admin credit rule settings** — Referral credit rules can be configured from Credit Rules,
  including referrals needed per credit and whether referral credits are enabled.
- **Super-admin customer dashboard** — Super-admins can review customer totals, plans, signup dates,
  referral source, login count, and dataset count from one admin page.
- **Editable customer levels** — Super-admins can define customer tiers with interaction, page visit,
  upload, credit-use, login, and reward thresholds.
- **Discount management** — Super-admins can manage free, percentage, referral, and stacking discount
  rules from the admin area.
- **Free trial route fix** — Pricing now sends free-trial users to sign-up instead of paid checkout.
- **Hybrid AI popup fix** — Hybrid AI uses the shared modal behavior for scroll lock, Escape, and
  backdrop handling.
- **Home/affiliate design rollout** — Dashboard and settings pages now use the updated quick-action,
  icon, and CTA styling.
- **Sidebar navigation** — Super-admin links for Customers, Customer Levels, and Discount Rules are
  visible in the sidebar.
- **Dist branch deployment cleanup** — Source branches stay source-only while GitHub Actions publishes
  generated output to `dist:/dist`.
- **Railway runtime install fix** — Generated output includes Railway config and pnpm build approvals
  so production dependencies install without manual approval.
- **Shared local production env** — Local production starts can load shared env values from the parent
  checkout folder while allowing checkout-local overrides.
- **Husky commit hooks** — Local Git hooks now run from `.husky/`, commit messages are checked with
  commitlint through pnpm, and generated dist commits may use short `PR:` titles.
- **Repo-wide lint cleanup** — ESLint now reports zero warnings after import cleanup, unused binding
  cleanup, and catch-parameter cleanup across source files.
- **Business KPI mapping fix** — Multi-currency CSV analysis now reads normalized monetary columns
  from the processor result and no longer mistakes `country` for the quantity column.
- **Deployment strategy notes** — GitHub workflow docs now compare the current dist branch flow with
  Railway source builds, Docker image deployment, and GitHub Actions artifact options.
- **Public auth and contact polish** — Login errors stay inline, public contact requests can be
  submitted without sign-in, and legal links are visible from public/auth page footers.
- **Generated runtime target split** — Local generated-output starts use localhost auth defaults,
  while Railway and Vercel have explicit named server targets.
- **Vercel deployment settings** — Vercel now has a source-branch deploy template synced to root
  `vercel.json`, while Railway remains on generated `dist:/dist` output.
- **Operational persistence** — Support tickets, referral stats, referral events, and billing
  settings now use database-backed storage when a database is configured, with local file fallback.
- **Referral reward guards** — Referral signup and paid events now support idempotency keys and block
  self-referral rewards.
- **Production readiness checklist** — Deployment, account, access, data, AI, and billing operations
  checks are documented in one release checklist.
- **CSV edge-case tests** — Empty uploads, malformed rows, and mixed currency/time-zone samples now
  run in the project test suite.
- **Dist root config guard** — The publish workflow now fails if Railway config is missing from
  `/dist` or appears at the deployment branch root.
- **Dist publish source guard** — The publish workflow now validates types, generated config, and
  lint before building deployment output.
- **Waitlist fallback** — Landing page product-update signups now succeed locally even when the
  production database is not available.
- **Shared page headers** — Public legal, FAQ, pricing, contact, and security pages now use one
  shared title section.
- **Dashboard help access** — Support tickets, dashboard FAQ, and admin FAQ now live under the
  topbar Help menu, with a responsive sidebar reserved for primary navigation.
- **Support chat and ticket forms** — Dashboard users can search FAQ answers from a floating help
  chat, send fallback support requests, and open tickets directly from the FAQ page.
- **Admin management tables** — Customer level and discount rule management now use horizontal row
  inputs for faster scanning and editing.
