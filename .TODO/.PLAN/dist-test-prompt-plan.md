# Dist-Test Deployment Plan

Status: planning only. Do not create branches, publish generated output, change Railway services, or touch DNS until this plan is explicitly approved for execution.

---

# Goal

Create a safe test deployment environment for UseClevr using:

* `dist-test` generated deployment branch
* dedicated Railway test service
* `test.useclevr.com`
* isolated deployment flow from production

Production deployment must remain stable and unchanged.

---

# Current Architecture

* `beta` = active development branch
* `main` = stable source branch
* `dist` = generated production deployment branch
* Railway production deploys from:

  * Branch: `dist`
  * Root Directory: `/dist`
* Generated deploy output lives inside `/dist`
* `dist-root` contains permanent root-level deployment branch files

---

# Required New Setup

Add support for:

* `dist-test` generated deployment branch
* dedicated Railway test deployment
* `test.useclevr.com`

Production must continue using:

* Branch: `dist`
* Root Directory: `/dist`

Test deployment must use:

* Branch: `dist-test`
* Root Directory: `/dist`

Do not break production deployment behavior.

Do not change app UI or application logic.

---

# Deployment Philosophy

Use generated deployment branches only:

* `dist`
* `dist-test`

Source branches remain:

* `main`
* `beta`

Generated branches must never be merged back into source branches.

---

# Workflow Requirements

## Production Flow

```text
main
→ validate
→ publish generated output
→ dist branch
→ Railway production
```

Only `main` may publish production deployment output.

---

## Test Flow

```text
beta
→ validate
→ publish generated output
→ dist-test branch
→ Railway test service
```

Test deploys may also be manually triggered using:

```yaml
workflow_dispatch
```

---

# Workflow Safety Rules

## Production Guard

Production deployment publishing:

* allowed only from `main`
* publishes only to `dist`

Beta must never publish production deployment output.

---

## Test Guard

Test deployment publishing:

* allowed from `beta`
* or manual dispatch
* publishes only to `dist-test`

Main must never automatically publish to `dist-test`.

---

# Generated Branch Rules

## Shared Rules

Both generated deployment branches:

* `dist`
* `dist-test`

must:

* contain generated app runtime inside `/dist`
* contain reusable branch-root files from `dist-root`
* support force-push/orphan history cleanup
* preserve maximum 1–2 commits where practical

---

## Forbidden Files

Never commit:

* `.env`
* `.env.*`
* `node_modules`
* `.next/cache`
* `.cache`
* `.turbo`
* `.vercel`
* invalid `pnpm-workspace.yaml`
* oversized GitHub files

---

# Required Generated Runtime Contract

Generated `/dist` must contain:

* `package.json`
* `pnpm-lock.yaml`
* `railway.json`
* `.next/standalone`
* `.next/static`
* `public`

Generated `/dist` must NOT contain:

* `node_modules`
* `.next/cache`
* source repository files
* invalid workspace files

---

# Large File Protection

Before publish:

* remove caches
* remove dependencies
* scan for large files
* fail workflow before push if GitHub size limits are exceeded

---

# dist-root Requirements

`dist-root` must support both:

* production deployment
* test deployment

It should contain reusable root-level files such as:

* `.gitignore`
* `README.md`
* optional Railway notes

Do not hardcode production-only wording.

README should describe generated deployment branch behavior generically.

---

# Railway Requirements

## Production

Production Railway service:

* branch: `dist`
* root directory: `/dist`

---

## Test

Test Railway service:

* branch: `dist-test`
* root directory: `/dist`

---

# Railway Runtime Mode

Railway should deploy prebuilt standalone Next.js output.

Railway must NOT rebuild the full application from source during deployment.

Preferred runtime:

```text
node .next/standalone/server.js
```

If pnpm is required:

```bash
corepack enable
corepack prepare pnpm@11.1.2 --activate
```

Avoid runtime dependency installation unless explicitly required.

---

# Domain Setup

Test deployment domain:

```text
test.useclevr.com
```

DNS should use:

* CNAME
* or Railway-provided DNS target

Do not change nameservers unless explicitly required.

Do not modify production domain configuration.

---

# Environment Variable Rules

Environment variables must remain outside the repository.

Test Railway service should use separate test-safe variables.

Important:

* test URLs must point to `https://test.useclevr.com`
* Stripe test/live keys must never mix
* use Stripe test mode for test deployment

---

# Validation Requirements

Before publish:

```bash
node ./scripts/server/railway/sync-config.cjs --check
```

Before branch publish:

```bash
pnpm prod:build
```

---

# Smoke Test Requirements

After deployment:

* check `/api/health`
* verify sign-in flow
* verify protected dashboard access
* upload small dataset
* verify datasets table
* verify analysis flow
* verify Reports & Downloads
* review Railway logs

---

# Rollback Safety

Test deployment failures must never block:

* production deployment
* production dist publishing

Production and test deployment flows must remain isolated.

---

# Documentation Requirements

Document:

* `main → dist = production`
* `beta/manual → dist-test = test`
* Railway production uses `dist /dist`
* Railway test uses `dist-test /dist`
* DNS setup for `test.useclevr.com`
* purpose of `dist-root`
* generated branch restrictions

---

# Non-Goals

Do not:

* deploy during plan review
* merge generated branches into source branches
* modify production Railway service
* introduce UI refactors
* introduce unrelated architectural changes

---

# Acceptance Criteria

* production dist workflow still works
* test dist-test workflow works
* generated branches contain valid `/dist`
* shared root files are preserved
* forbidden files are excluded
* Railway test service deploys successfully
* `test.useclevr.com` connects successfully
* no unrelated app changes occur
