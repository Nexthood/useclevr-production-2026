# Global Partner Program

Partners use `/app/partners`; superadmins use `/app/admin/partners`. Customer referral credit rewards remain in the Referral Center. Commercial attribution grants no customer referral credits, including when the partner is pending, suspended, or terminated.

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

Railway predeploy includes additive migrations `0038_global_partner_program.sql` and `0039_partner_policy_controls.sql`. They select one stable historical referral code per account, retain historical codes and attributions, and add effective policy dates, termination controls, and immutable event reviews. Operators review the migrations and database backup before applying them. The Stripe partner handler runs only when `PARTNER_PROGRAM_ENABLED=true`; operators enable this gate after migration and policy review. This runtime gate and the database program configuration are separate controls.

Partner APIs derive ownership from the signed-in session. Superadmin APIs require the existing superadmin guard, and writes require an accepted origin and audit reason. Partners do not receive customer identities, internal notes, or audit records. Database triggers protect financial snapshots, event evidence, audit records, attribution ownership, and reward exclusion.

## Local verification

Run `pnpm test:partners` and `pnpm test:referral-automation` for deterministic rules and referral contracts. The integration runner uses only a disposable PostgreSQL fixture at `127.0.0.1:55438`, database `partner_tests`, PostgreSQL user `postgres`, with local trust authentication. It creates a fresh schema per run, does not clear existing schemas, replaces database configuration before loading application modules, and uses synthetic Stripe objects without external requests.

If the fixture is absent, create it with:

```bash
docker run --detach --name useclevr-partner-v1-tests --network bridge --publish 127.0.0.1:55438:5432 --env POSTGRES_HOST_AUTH_METHOD=trust --env POSTGRES_DB=partner_tests postgres:16-alpine
```

Wait for `docker exec useclevr-partner-v1-tests pg_isready -U postgres -d partner_tests`, then run `pnpm test:partners:integration`. Unit rules run in `test:all`; PostgreSQL integration runs separately. Use [shared REST requests](../api-tests/partners.http) for authenticated endpoint checks against a local application.

Run `node scripts/partners/test-browser.mjs` for real partner/admin components against synthetic HTTP responses in headless Chrome at desktop and mobile widths in both themes. Screenshots stay in its temporary artifact directory. This fixture checks component behavior; it does not exercise application login or production hosting.

Run `node scripts/partners/run-safe-build.mjs` for isolated production compilation and packaging in a temporary source copy under the ignored `build/` directory. The runner copies dependencies into that directory so standalone tracing and packaging operate on private files. It excludes repository environment files, clears inherited provider configuration, generates disposable authentication values, sets unreachable loopback databases, and keeps the partner program disabled. It does not publish artifacts or deploy.
