# Task Queue — Done

## Completed

- **GitHub Actions workflow steps** — Renamed steps in branch-maintenance.yml to descriptive names.
- **Dist packaging lockfile** — Distribution packaging script now includes pnpm-lock.yaml for deterministic Railway installs.
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
