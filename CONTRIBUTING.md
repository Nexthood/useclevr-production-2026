# Contributing to UseClevr

Thank you for considering a contribution to UseClevr. This guide covers the full developer workflow
from setup to pull request.

## Prerequisites

- Node.js 26 or later
- pnpm 11 (use `corepack enable && corepack prepare pnpm@11.1.2 --activate`)
- A Neon PostgreSQL connection string in `DATABASE_URL`
- Environment variables documented in `env.example` / the hosting docs

## Local Development

```bash
# clone and install
pnpm install

# start the dev server
pnpm dev

# run the type checker
pnpm validate:types

# run lints
pnpm lint

# run tests
pnpm test:all

# full validation (types + build + release check)
pnpm validate
```

## Project Structure

```
src/
  app/           Next.js App Router pages and API routes
  components/    React components and UI library
  lib/           Shared libraries (db, billing, AI, usage, auth)
  assets/        Static files and generated report assets
scripts/         Node/CJS helper scripts (CI, release, docs)
docs/            Project documentation
```

## Commit Messages

Use the imperative mood ("Add / Fix / Refactor / Remove") and describe the motivation in the body
when the change is non-trivial.

```
<type>(<scope>): <short summary>

[optional body — motivation, trade-offs, side effects]
```

Examples: `Add(Billing): Stripe webhook handler`, `Fix(Checkout): missing T&C step`.

## Pull Requests

1. Branch from `main`.
2. Make focused, targeted changes.
3. Update `CHANGELOG.md` under the `[Unreleased]` section.
4. Confirm `pnpm exec tsc --noEmit` is clean.
5. Open a PR with a clear description of what, why, and how.

## Code of Conduct

Be kind. Constructive discussion and shared curiosity are always welcome — do not tolerate
harassment in any form.
