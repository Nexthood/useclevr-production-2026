# Partner program v2 readiness

## Scope

Source branch: `feat/partner-portal-v2`, based on merged PRs #420, #421 and #422. Implementation commit: `26be67d9`; review: [draft PR #423](https://github.com/Nexthood/useclevr-production-2026/pull/423) targeting `beta`. Changes remain in the application repository. No merge, deployment, production migration, live signing enablement, environment change or external payment is authorized by this implementation.

## Implemented behavior

- Public invitations verify email independently and issue an application-scoped cookie for agreement access.
- Registration returns safe temporary failures for unavailable storage and retains successful submissions after delivery failures.
- Applicants can supply a distinct optional company website; the hidden website field remains a spam trap.
- Audited invitation renewal replaces token hashes, revokes scoped sessions and retains individual delivery history.
- Commission accrual binds new commissions to immutable signed policies and optional contract rates; absent entitlements stay held.
- The portal exposes partner-scoped customer, sale, monthly performance and contact projections without customer emails, datasets or documents.

Local implementation evidence does not establish the cause of the reported individual's hosted registration failure. Hosted request, application and runtime evidence are unavailable in this session.

## Migration and security

Migration `0044_partner_invitation_access.sql` extends existing tables and adds verification/session tables without deleting application or financial records. The existing Railway predeploy list includes the migration. Deployment targets, service identities, workflows and host configuration remain unchanged.

Tokens and scoped sessions use cryptographically random values with SHA-256 storage. Verification codes use keyed hashes, ten-minute expiry, five committed attempts, resend cooldown and database-backed request limits. Email payloads are encrypted. Origin checks protect mutations. Scoped agreement authorization ignores unrelated authenticated identity and limits documents to the invited application. Renewal revokes older sessions and prevents stale-link delivery. Credential setup reads the archived signed PDF and audit artifact and never sets commercial activation.

Provider callbacks, ordered signatures, encrypted artifacts, audit evidence and manual activation retain the existing contract lifecycle. Signing initiation uses Dropbox Sign's secure emailed signing invitation. Mock and test execution remain non-binding.

## Validation evidence

On 14 November 2026, local checks pass partner unit tests (19 financial cases and nine contract groups), 43 disposable PostgreSQL checks, 16 contract integration groups, 18 browser acceptance groups, TypeScript, changed-source ESLint (zero errors; six ignored-script warnings), repository-wide lint (zero errors; 453 warnings), auth redirects, 27 referral automation checks, mocked Railway policy/auth checks, secret scan, TODO/changelog/package checks and deployment configuration validation.

The initial production build identifies an invalid optional request argument on the agreement GET route. The route and its integration invocation use a required Request; all 16 contract integration groups pass after correction. The corrected production build passes type validation, generates all 105 pages and packages the distribution. Packaged-runtime acceptance passes public applications, invitation-code entry, no-referrer metadata, partner login return URLs and anonymous private-API rejection using synthetic credentials and an unreachable local database. Compiler warnings and the expected unreachable-database diagnostic remain visible. Documentation links pass across 170 files. Historical interaction-log Markdown findings match HEAD (973 interactive, two activity and 11 status findings); the edited program guide and readiness report pass Markdown checks. Automated provider fixtures intercept external calls; local success does not verify a live provider account, delivery to an applicant, or hosted data health.

## Required external acceptance

- The operator verifies runtime and predeploy database targets, applies the reviewed migration through the existing deployment process, and confirms backups and hosted persistence. Local PostgreSQL fixtures do not prove production database health.
- The owner supplies approved company identity, signer references, legal template and schedule approval, provider configuration approval, Dropbox Sign credentials and authenticated callback configuration, artifact encryption keys and retention policy. Live acceptance requires explicit owner authorization before signing is enabled.
- The operator verifies Resend sender/domain, administrative recipient, delivery status and invitation/code receipt using an authorized applicant mailbox.
- An authorized hosted test applicant completes application, review, invitation, code verification, identity review, both provider signatures, archive downloads, credential setup, login, explicit admin activation and dashboard access. A verified Stripe test payment and refund exercise commission review and manual settlement with the signed policy.
- Existing commissions with no agreement reference require owner investigation. The implementation retains those records and does not fabricate contract entitlement or automatically approve them.

## Public landing page compatibility

The browsing tool cannot retrieve `https://useclevr.com/resellers.html` or `https://app.useclevr.com/partners/apply` in this session. Hosted availability and the current landing-page link remain unverified. The separate landing-page repository receives no edits.

The landing-page maintainer sets each application CTA to `https://app.useclevr.com/partners/apply`. An Authorized Reseller CTA may use `https://app.useclevr.com/partners/apply?program=reseller_enterprise&partnershipType=Authorized%20Reseller`; other categories must use existing form values. CTAs must not point to customer signup or login. Invitation links use `/partners/onboard` from the application emails.

## Operational limits

The system records manually approved payouts; it does not move money. Bank instruction updates require the partner team. Unsupported partner categories require an owner-reviewed agreement classification. Existing accounts with ambiguous case-insensitive email identities require review. Missing FX evidence, payout policy, signed terms or provider evidence produces a held state. These states require explicit configuration or review rather than invented revenue or entitlement.
