# Task Queue — Done

## Completed

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
