# Task Queue — Active Work

> Items in this file are the leading edge of work. When all marks a task done,
> move it here as completed, then refresh `.TODO/todo-next.md`. Never reopen a completed
> item without a new requirement.

## In Progress 🔄

No active leading-edge items.

## Completed ✅

- Railway runtime builds now use Nixpacks with explicit Corepack pnpm activation to avoid Railpack
  `mise install` failures.
- PDF export browser dependencies are now explicit production dependencies so publish builds with
  optional installs disabled do not miss bundler-required modules.
- Auto-merged release pull requests now dispatch branch maintenance after merge so beta sync and dist
  publish do not depend on suppressed token-generated events.
- Dist publish now syncs deployment root files from `dist-root/` while keeping generated app output
  inside `/dist`.
- Local pre-commit validation now runs the production publish build so missing bundle dependencies
  fail before deployment.
- Public login and notice behavior now keeps auth errors inline on `/login` and prevents global notices
  from overlaying page layouts.
- Contact page now accepts demo, sales, and support requests from public visitors.
- Generated production starts now separate local, Railway, and Vercel server targets.
- Public marketing/auth pages now expose Terms and Privacy access consistently.
- Production risk items now have database-backed operational storage, referral idempotency and
  self-referral guards, deployment smoke checks, edge-case data tests, and a production readiness
  checklist. Checkout-specific work moved to `.TODO/todo-future.md`.
- Public page headers now share one title treatment, landing waitlist signup falls back when the
  database is unavailable, and dashboard support/admin pages now use responsive shared support UI.

## Blocked 🚧
