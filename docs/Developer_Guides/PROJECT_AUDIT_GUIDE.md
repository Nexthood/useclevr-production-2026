# Project Audit Guide

Use this guide when auditing UseClevr from a clean checkout through production readiness.

## 1. Prepare

- Read `AGENTS.md`, `.TODO/config.json`, `.TODO/todo-next.md`, and `docs/Developer_Guides/TODO_MANAGEMENT.md`.
- Run `git status --short` and identify unrelated local changes before editing.
- Confirm ignored/generated folders are not inspected unless the task explicitly requires it.

## 2. Source Health

- Run `pnpm validate`.
- Run `pnpm lint`.
- Run `pnpm build`.
- Record failures as `T-` tasks in `.TODO/todo-next.md` unless you fix them immediately.

## 3. Security

- Search for accidental secrets and direct environment-variable exposure.
- Review authentication guards on dashboard, admin, billing, payment, and API routes.
- Verify upload validation covers size, format, and malformed input.
- Review CORS, trusted-host, and security-header configuration.
- Check rate limiting on public write endpoints and webhook endpoints.

## 4. Data And AI

- Confirm AI responses depend on deterministic query results and uploaded dataset scope.
- Review database queries for injection risk and expensive dashboard/report work.
- Check fallback behavior when database, billing, or AI providers are unavailable.

## 5. Billing And Admin

- Verify checkout review, payment provider readiness, subscription pages, and admin-only pages.
- Test customer, level, discount, billing, activity, and support admin pages in read and edit modes.
- Confirm super-admin-only operations redirect non-admin users.

## 6. Deployment

- Run `pnpm validate:dist`.
- Confirm `dist-root/server-config/railway.json` and `dist-root/server-config/vercel.json` remain source of truth.
- Confirm no generated host config appears at the dist branch root or inside generated `/dist`.
- Review Railway, Vercel, Neon, Gemini, Stripe, and upload-storage environment requirements.

## 7. Documentation

- Update `requirements.md` for product-facing behavior changes.
- Update `CHANGELOG.md` for user-visible or developer-facing release changes.
- Move completed TODO work to `.TODO/todo-done.md`, deferred work to `.TODO/todo-future.md`, and no-fix decisions to `.TODO/todo-ignore.md`.
