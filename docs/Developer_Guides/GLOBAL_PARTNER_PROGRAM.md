# Global Partner Program

Applicants use `/partners/apply` and the existing verified-email login with a return URL. Partners use `/app/partners`; superadmins use `/app/admin/partners`. Customer referral credit rewards remain in the Referral Center. Commercial attribution grants no customer referral credits, including when the partner is pending, rejected, suspended, or terminated.

## Financial rules

Verified collected subscription invoices supply the payment evidence. Net revenue excludes tax and reflects invoice discounts. Active subscriptions alone, failed payments, out-of-band collections, and self-purchases cannot earn commissions. Mixed-balance and partial collections require review.

New configuration versions require these v1 levels and rates:

| Level    | Qualification                                       | Rate |
| -------- | --------------------------------------------------- | ---- |
| Bronze   | Approved partner                                    | 15%  |
| Silver   | 25 active paying customers                          | 15%  |
| Gold     | 100 active paying customers                         | 20%  |
| Platinum | $100,000 rolling twelve-month collected net revenue | 20%  |
| Diamond  | $300,000 rolling twelve-month collected net revenue | 20%  |

Revenue levels take precedence over customer levels. An active paying customer has an active, unexpired subscription and a collected payment with remaining positive net revenue. Each customer counts once. Commissions use a twelve-calendar-month eligibility window with an exclusive end date.

Each commission stores its earned rate, level, payment, currency, and configuration version. Integer minor-unit arithmetic rounds half up. Refunds and disputes reconcile cumulative loss against the original commission, cap overlapping loss at the original payment amount, and retain immutable adjustments. A won dispute restores the amount supported by current evidence. Cancellation changes active customer counts without inventing a payment reversal.

Balances remain separate by payment currency. Non-USD payments require an operator-recorded daily ratio of USD minor units to source minor units with a source URL. Missing FX evidence holds the event. Delayed payments that cannot safely reconstruct historical level state remain held for review.

## Approved v1 policies

The program configuration defaults to disabled. Superadmins save the approved v1 terms as a prospective version with an audit reason:

- Eligibility begins at the first successful payment and ends twelve calendar months later.
- Suspension holds payment evidence. Reinstatement requires an explicit historical payment recovery review before held earnings accrue.
- Termination stops accrual and new commercial attribution. Its effective date and status are immutable; an automatic payout hold requires evidenced release before eligible pre-termination earnings settle.
- Related-party purchases are excluded. Unknown relationships require an evidenced classification before accrual or settlement.
- Downgrades apply after 30 continuous days below the current level. Changing the lower candidate does not restart the grace period; qualification recovery clears the shortfall.
- Commission approval and settlements require 30 days after the earned date.
- Settlements require USD 50 or EUR 50 in their own currency. Other currencies remain blocked without an explicit minimum.
- Refunds after settlement produce visible negative balances and offset later eligible settlements in the same currency.

Unresolved historical decisions hold dependent operations. Configuration versions apply by payment date; new versions cannot be backdated or rewrite a stored earned rate. A historical event held under an unresolved policy requires an explicit event review rather than a simple retry.

For historical recovery, a superadmin selects an effective approved policy version and the historically evidenced level, records payment, eligibility, and level evidence, and supplies an audit reason. Recovery requires an active partner, cleared payout holds, and an unrelated attribution. It creates a pending commission; approval and manual settlement are separate actions. Replaying the event remains idempotent. Fraud holds and unresolved payment disputes block financial approval and settlement.

Superadmins record an already completed manual settlement for the exact eligible statement balance and a unique payment reference. This action records the settlement and its allocations; it does not call a bank or transfer money. Negative post-settlement balances remain visible.

## Deployment and access

Railway predeploy includes additive migrations `0038_global_partner_program.sql`, `0039_partner_policy_controls.sql`, and `0040_partner_applications.sql`. They select one stable historical referral code per account, retain historical codes and attributions, and add effective policy dates, termination controls, and immutable event reviews. Operators review the migrations and database backup before applying them. The Stripe partner handler runs only when `PARTNER_PROGRAM_ENABLED=true`; operators enable this gate after migration and policy review. This runtime gate and the database program configuration are separate controls.

Partner APIs derive ownership from the signed-in session. Superadmin APIs require the existing superadmin guard, and writes require an accepted origin and audit reason. Partners do not receive customer identities, internal notes, or audit records. Database triggers protect financial snapshots, event evidence, audit records, attribution ownership, and reward exclusion.

## Local verification

Run `pnpm test:partners` and `pnpm test:referral-automation` for deterministic rules and referral contracts. The integration runner uses only a disposable PostgreSQL fixture at `127.0.0.1:55438`, database `partner_tests`, PostgreSQL user `postgres`, with local trust authentication. It creates a fresh schema per run, does not clear existing schemas, replaces database configuration before loading application modules, and uses synthetic Stripe objects without external requests.

If the fixture is absent, create it with:

```bash
docker run --detach --name useclevr-partner-v1-tests --network bridge --publish 127.0.0.1:55438:5432 --env POSTGRES_HOST_AUTH_METHOD=trust --env POSTGRES_DB=partner_tests postgres:16-alpine
```

Wait for `docker exec useclevr-partner-v1-tests pg_isready -U postgres -d partner_tests`, then run `pnpm test:partners:integration`. Unit rules run in `test:all`; PostgreSQL integration runs separately. Use [shared REST requests](../api-tests/partners.http) for authenticated endpoint checks against a local application.

Run `node scripts/partners/test-browser.mjs` for real partner/admin components against synthetic HTTP responses in headless Chrome at desktop and mobile widths in both themes. Screenshots stay in its temporary artifact directory. This fixture checks component behavior; it does not exercise application login or production hosting.

Run `node scripts/partners/run-safe-build.mjs` for isolated production compilation and packaging in a temporary source copy under the ignored `build/` directory, with a system-temporary-directory fallback when the checkout has less than 4 GiB free. The runner copies dependencies into that directory so standalone tracing and packaging operate on private files. It excludes repository environment files, clears inherited provider configuration, generates disposable authentication values, sets unreachable loopback databases, and keeps the partner program disabled. It does not publish artifacts or deploy. Use `--regression` to run every declared regression suite sequentially before compilation, with a dedicated database on the fixed local fixture and shared synthetic test files. Repository credential files stay excluded; the tracked Railway/local examples are copied only for configuration contract tests and are not loaded as environment.

## Applicant registration and review

The public Work With Us CTAs use `https://app.useclevr.com/partners/apply`.
The application page redirects visitors through the existing login/signup verification flow and
returns them to the application. Applicants provide their name, country, target market and
experience, and acknowledge the displayed privacy notice and program terms. The server reads
verified identity and email from the database, validates a bounded JSON request, checks write
origin and applies the existing per-account request limiter. A unique account constraint and
transaction lock enforce one application per account across instances and concurrent requests.
The request limiter is per process; persistent uniqueness remains the cross-instance control.

Application details extend `PartnerAccount`; `PartnerAudit` records submission and acknowledgments.
There is no separate application database. Migration 0040 protects submitted evidence and terminal
rejection from updates. The confirmation page and partner dashboard display pending/rejected
status without exposing referral tools. Applicant email and narrative are visible only to superadmins.

Superadmins select a pending application at `/app/admin/partners`, review its details, enter a
reviewed participation agreement reference, and approve or reject with an audit reason. Rejected
applications cannot reactivate or resubmit. Approved partners can be suspended or terminated;
rejected, suspended and terminated partners cannot acquire new referral attributions. Suspended
partners can inspect their own financial history without receiving an active referral link.
Account support handles questions through the existing ticket workflow.

## Coordinated release and rollback

Do not push, deploy, migrate production or activate the program without explicit owner authorization.
Local validation does not establish hosted readiness. Keep T-1103 active until production acceptance
passes. Required existing runtime settings are `DATABASE_URL` (and the deployment's direct migration
connection), `AUTH_SECRET`, the existing email verification provider settings, `AUTH_URL` and
`NEXT_PUBLIC_APP_URL=https://app.useclevr.com`, Stripe secret/signing settings, and the approved
Stripe prices. Never copy secret values into this guide or a release report.

After authorization:

1. Confirm source commits, current deployment revisions, database backup/restore capability, and
   owner-approved participation/settlement arrangements. Confirm Railway and cPanel access.
2. Follow the existing application workflow: PR to `beta`, CI validation, `beta-maintenance.yml`
   publishes generated output to `dist-test`; verify the test service. PR `beta` to `main` follows
   project review gates; `branch-maintenance.yml` builds and publishes the production `dist` branch.
   Railway service root is `/dist`, config is `/server-config/railway.json`, and predeploy applies
   migrations 0038–0040. Container image builds do not run migrations. Never hand-edit generated deployment branches.
3. Keep both financial gates off during schema/startup checks. Verify `/api/health`, application
   login/return, submission, pending confirmation and superadmin review on the hosted application.
   Verify required Stripe webhook event subscriptions and raw-body signature validation.
4. With explicit activation authorization, save an enabled approved policy version through the
   superadmin interface and set `PARTNER_PROGRAM_ENABLED=true` on the intended Railway service.
   Redeliver skipped provider events through authenticated Stripe webhook delivery, then reconcile
   receipts from any disabled interval through evidenced administrative event review;
   do not invent historic revenue or backdate policy versions.
5. Dispatch the landing repository's existing `deploy.yml` with real `deploy` mode and `all` scope
   on the approved branch/revision. The allowlist includes `.htaccess`, page, CSS/JS and sitemap;
   homepage-only scope is insufficient. Preserve protected server-side files and pinned SSH host keys.
6. Verify `https://useclevr.com/work-with-us` and `https://www.useclevr.com/work-with-us`, direct HTML
   canonical redirect, asset responses, both CTAs, and the authenticated application return URL.
   Complete the visitor-to-approved-partner journey and verify an owner-approved Stripe payment,
   ledger entry, related-party review, waiting-period enforcement and manual settlement record.
   Check provider evidence and production runtime logs; a local synthetic receipt is not live evidence.

Rollback order: stop public recruitment by restoring the previous landing revision through the same
manual workflow; disable `PARTNER_PROGRAM_ENABLED` and save a disabled prospective policy version;
restore the previous known-good Railway deployment if needed. Retain additive columns, application
records and immutable financial evidence. Do not drop migrations, delete receipts, or edit earned
rates. Capture and reconcile Stripe events spanning the disabled interval before reactivation.
Database restore requires a separate reviewed recovery procedure because restoring a backup can
lose new payments and applications. No automatic bank transfers are configured.

The source workflow runs partner PostgreSQL integration against a dedicated loopback fixture.
Run `node scripts/partners/test-native-packaging.mjs` to verify cached native packages and idempotent symlinks without downloads. The packaging helper inspects existing musl packages as well as downloaded ones to resolve libvips.
A successful glibc build does not establish Alpine runtime compatibility: verify the generated
artifact loads `sharp` and completes an image transformation in the actual Railway runtime before
release acceptance. Treat missing native dependencies as a release blocker.

Run `node scripts/partners/test-production-runtime.mjs <isolated-snapshot-directory>` after
packaging to verify startup, the applicant login return URL and anonymous API restrictions using
synthetic secrets and an unreachable database. It does not verify hosted authentication or health.
The 8 November 2026 dependency audit passes the existing Critical/High gate and reports three
Moderate advisories (`@hono/node-server`, `qs`, `minimatch`) and one Low advisory (`deepmerge`).
These residual dependencies remain visible to release review; no audit allowlist is expanded.

Production settlement acceptance uses genuine unrelated customer receipts and an eligible balance
that satisfies the 30-day wait and currency threshold. If no qualifying mature balance exists,
settlement verification stays pending until it does. Do not shorten waiting periods, relabel
related-party test purchases, fabricate transfer references or record an uncompleted payout to
produce release evidence. Local fixtures advance time only inside the test process.

For an isolated regression failure caused by fixture/environment setup, correct the runner and
use `node scripts/partners/run-safe-build.mjs --retry-regression <isolated-snapshot-directory>`.
It restores shared test fixtures and the two tracked example templates, reruns only failed suites
with a new disposable database, and retains initial failures in `regression-results.json`.
