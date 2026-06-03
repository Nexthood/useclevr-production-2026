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

- Run `pnpm lint:secrets` and search for accidental secrets, trace examples, and direct environment-variable exposure.
- Review authentication guards on dashboard, admin, billing, payment, and API routes.
- Maintain an API route access matrix covering public, signed-in, owner-scoped, super-admin, webhook, and development-only routes.
- Verify upload validation covers size, format, and malformed input.
- Review CORS, trusted-host, and security-header configuration.
- Check rate limiting on public write endpoints and webhook endpoints.
- Confirm development-only debug endpoints return 404 in production.

## 4. Data And AI

- Confirm AI responses depend on deterministic query results and uploaded dataset scope.
- Confirm AI traces store prompt, answer, provider, model, prompt version, latency, error state, and feedback without secrets, credential-like values, or raw uploaded files.
- Confirm AI trace history, search, export, feedback, and super-admin analytics match `docs/AI-interaction/developer-guides/ai-tracing-structure.md`.
- Confirm broad audit findings are classified as lesson, issue, risk, decision, or improvement before they move into TODO queues.
- Review database queries for injection risk and expensive dashboard/report work.
- Check fallback behavior when database, billing, or AI providers are unavailable.

## 4A. AI Interaction Evaluation

- Use [Work classification](../AI-interaction/prompt-library/work-classification.md) for broad mixed requests.
- Use [Feature restoration check](../AI-interaction/prompt-library/feature-restoration-check.md) for restored features.
- Use [TODO retirement check](../AI-interaction/prompt-library/todo-retirement-check.md) before moving tasks between queues.
- Use [AI memory collection](../AI-interaction/prompt-library/ai-memory-collection.md) for visible learning from other AI chats.

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

## Current Audit Snapshot

- `pnpm validate` passes.
- `pnpm lint` passes with warnings only.
- `pnpm test:all` passes.
- `pnpm build` passes and reports the known middleware convention warning.
- `pnpm lint:secrets` passes.
- `pnpm docs:check` passes.
- Active follow-up work is tracked in `.TODO/todo-next.md` under route access, public API exposure, local runtime actions, CSP, and lint cleanup.
