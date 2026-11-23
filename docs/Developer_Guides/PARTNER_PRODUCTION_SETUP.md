# Partner contracts: production setup

For provider-independent signing without a paid signature-provider account, follow
[Native partner electronic signing](PARTNER_NATIVE_SIGNING.md). It documents `native` mode,
the three native attestation-key variables, native 2.0.0 legal drafts, migration 0045 and staged
owner acceptance. The Dropbox account/callback steps below apply only to Dropbox modes.

## Diagnosis and scope

The owner reports no partner/signing configuration on Railway. With that configuration,
`PARTNER_CONTRACTS_ENABLED` is unset and `featureEnabled()` returns false. The participant
agreement API calls `requireFeature()`, which raises `contract_management_disabled` with HTTP
404. `contractError()` replaces underscores with spaces, producing **contract management disabled**.
This message identifies the feature gate, not a Dropbox, webhook, encryption or database failure.

Enabling that flag exposes contract management. It does not configure signing or approve a contract.
Missing downstream prerequisites keep generation, signing, credential setup or activation blocked.
This audit establishes the source behavior and uses the owner's configuration report; it does not
independently inspect Railway variables, production tables or a real Dropbox Sign account.

The audit starts from `origin/main` revision `f5f69a92` and reviews merged PRs
[#420](https://github.com/Nexthood/useclevr-production-2026/pull/420) (contracts),
[#421](https://github.com/Nexthood/useclevr-production-2026/pull/421) (invitation regressions),
[#422](https://github.com/Nexthood/useclevr-production-2026/pull/422) (invitation errors),
[#423](https://github.com/Nexthood/useclevr-production-2026/pull/423) (public verification/portal), and
[#424](https://github.com/Nexthood/useclevr-production-2026/pull/424) (promotion to main).

Configure the existing production Railway web service **useclevr app**, which serves
`https://app.useclevr.com` from `dist`. Do not put these values only in GitHub Actions, the PostgreSQL
service, the landing-page host, or **useclevr TEST**. Its existing `dist-test` artifact deliberately
forces contracts, live sends and the worker off and skips hosted migrations. This task changes no
deployment workflow and does not authorize a deployment or hosted configuration write.

## Source of truth

- [Feature, mode and live policy](../../src/lib/partners/contracts/domain.ts)
- [Dropbox adapter and callback verification](../../src/lib/partners/contracts/provider.ts)
- [Webhook endpoint](../../src/app/api/webhooks/partner-contracts/dropbox-sign/route.ts)
- [PDF generation](../../src/lib/partners/contracts/pdf.ts), [encryption/storage](../../src/lib/partners/contracts/storage.ts)
- [Generation, sending and execution](../../src/lib/partners/contracts/lifecycle.ts)
- [Owner approvals](../../src/lib/partners/contracts/records.ts), [activation](../../src/lib/partners/contracts/activation.ts)
- [Invitation verification](../../src/lib/partners/invitation-access.ts), [credentials](../../src/lib/partners/credentials.ts)
- [Worker startup](../../scripts/runtime/partner-contract-worker.cjs), [internal worker endpoint](../../src/app/api/internal/partner-contracts/run/route.ts)
- [Application email](../../src/lib/partners/public-applications.ts), [contract email](../../src/lib/partners/contracts/mail.ts)
- [Runtime database selection](../../src/lib/db/index.ts), [predeploy migrations](../../scripts/runtime/railway-predeploy.cjs)

## Railway variables

Every example below is public or a placeholder. Replace angle-bracket placeholders privately;
never deploy the placeholder itself. Preserve existing authentication and encryption secrets.
The service column names the **web service**, including its predeploy and worker processes.
**Redeploy** means apply staged Railway variable changes and redeploy that service after owner
approval; changing a variable does not update an already running process. Public build variables
also require a source rebuild. No provider secrets belong in `NEXT_PUBLIC_*` variables.

| Exact variable | Purpose and default | Required or optional | Safe example | Obtain the real value from | Railway service | Redeployment | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `PARTNER_CONTRACTS_ENABLED` | Exact `true` enables management; default off. | Required for contracts. | `true` | Owner's enablement decision. | useclevr app | Redeploy. | Authenticated participant API stops returning `contract_management_disabled`; admin view has `enabled: true`. |
| `PARTNER_CONTRACT_SIGNING_MODE` | `draft`, `mock`, `dropbox_test`, `dropbox_live`, `native`; unset/unknown selects draft. Runtime fingerprint labels unset mode `disabled`. | Explicit mode required operationally. | `draft` | Owner's staged rollout decision. | useclevr app | Redeploy; policy change needs new runtime approval and contract revision. | Inspect admin runtime policy and each agreement's stored mode. |
| `PARTNER_CONTRACT_LIVE_ENABLED` | Exact `true` permits live sends subject to all approvals; default off. | Required for live, keep false for draft/test. | `false` | Explicit owner authorization after sandbox acceptance. | useclevr app | Redeploy. | Off blocks live runtime approval/sends; on still requires recorded owner approvals. |
| `DROPBOX_SIGN_API_KEY` | Account API key for Basic authentication and both callback HMAC checks; no default. | Required for Dropbox test/live. | `<private-dropbox-api-key>` | Owner-controlled Dropbox Sign API Settings → API key. | useclevr app | Redeploy; verify callback signing key after rotation. | Private authenticated account lookup succeeds and authenticated callback test succeeds. |
| `DROPBOX_SIGN_ACCOUNT_ID` | Expected provider account binding; default empty. | Required for Dropbox test/live. | `<dropbox-account-id>` | Authenticated Dropbox account response `account.account_id`. | useclevr app | Redeploy; changes invalidate runtime approval. | Adapter account check matches; callback account matches. |
| `DROPBOX_SIGN_CLIENT_ID` | API App binding; default empty. | Required by this integration for Dropbox test/live. | `<dropbox-api-app-client-id>` | API Settings → selected API App. | useclevr app | Redeploy; changes invalidate runtime approval. | App settings, outgoing `client_id` and callback app identity agree. |
| `PARTNER_CONTRACT_TEST_RECIPIENTS` | Comma-separated allowed sandbox signer emails; unset permits neither signer. | Required for Dropbox test; unused for live. | `partner-qa@example.invalid,company-qa@example.invalid` | Two explicitly authorized, independently controlled QA mailboxes. | useclevr app | Redeploy. | Both test signers are allowlisted; an unrelated address is rejected. |
| `PARTNER_CONTRACT_OWNER_USER_IDS` | Comma-separated internal user IDs permitted to approve/revoke legal versions and runtime; default none. | Required for owner approvals. | `<verified-superadmin-user-id>` | Existing verified superadmin's `User.id`, inspected through authorized account administration. | useclevr app | Redeploy. | Owner controls appear for that superadmin; another superadmin cannot record owner approval. |
| `PARTNER_CONTRACT_COMPANY_SIGNER_REFS` | Sorted comma-separated allowed company signer references; default none. | Required for live. | `atlas-authorized-signer-1` | Owner-approved signing-authority register; use the same reference in each commercial schedule. | useclevr app | Redeploy; changes invalidate runtime approval. | Runtime list contains the schedule's exact `companySigner.reference`. |
| `PARTNER_CONTRACT_PUBLIC_ORIGIN` | Private portal/email origin; falls back to `AUTH_URL`, then `NEXT_PUBLIC_APP_URL`, then empty. | Explicit value recommended; effective HTTPS origin required for live/production mail. | `https://app.useclevr.com` | Existing canonical production domain. | useclevr app | Redeploy; changes invalidate runtime approval. | Runtime policy and notification links show this exact HTTPS origin. |
| `PARTNER_CONTRACT_ENCRYPTION_KEY_ID` | Active document key version; default empty. | Required for every generated PDF, including drafts/tests. | `partner-docs-v1` | Secret-manager key-version label. | useclevr app | Redeploy; changes invalidate runtime approval. | New artifact records contain this key ID and decrypt successfully. |
| `PARTNER_CONTRACT_ENCRYPTION_KEYS` | Secret JSON object mapping key IDs to base64-encoded, random 32-byte AES keys; default `{}`. | Required for generation and every archived artifact read. | `{"partner-docs-v1":"<base64-of-32-random-bytes>"}` | Owner's approved cryptographic generator/secret manager; back up every retained version. | useclevr app | Redeploy. | Active key decodes to exactly 32 bytes; new and existing documents pass authenticated decryption/checksum verification. |
| `PARTNER_CONTRACT_RETENTION_DAYS` | Artifact retention floor; default 0. Live accepts integer 1–36500. | Required for live; select before any document generation. | `365` (illustration; owner/counsel must choose) | Approved retention/hold policy. | useclevr app | Redeploy; changes invalidate runtime approval. | Runtime policy is correct and new artifacts have the approved `retainUntil`. |
| `PARTNER_CONTRACT_MONTHLY_SEND_LIMIT` | Positive integer application live-send cap; default 0 blocks live. | Required for live. | `1` (controlled acceptance cap) | Approved budget and provider account quota. | useclevr app | Redeploy; changes invalidate runtime approval. | Runtime policy is positive and conservative send reservations enforce it. |
| `PARTNER_CONTRACT_SIGNATURE_TTL_DAYS` | Request expiry; default 7, integer 2–90. Provider submission rounds to the hour. | Optional with safe default. | `7` | Owner-approved expiry policy. | useclevr app | Redeploy; changes invalidate runtime approval. | Contract expiry/provider expiry match policy. |
| `PARTNER_CONTRACT_REMINDER_HOURS` | Reminder age; default 72, integer at least 24. | Optional with safe default. | `72` | Owner-approved reminder policy. | useclevr app | Redeploy; changes invalidate runtime approval. | Reminder jobs respect the configured age and 24-hour attempt floor. |
| `PARTNER_CONTRACT_WORKER_ENABLED` | Exact `true` starts loopback processing and enables the worker route; default off. | Required for unattended processing; optional with manual admin processing. | `false` during setup; `true` after authorization | Owner's processing decision. | useclevr app | Redeploy. | Worker logs show no repeated batch failures; queued jobs/deliveries progress. |
| `PARTNER_CONTRACT_WORKER_SECRET` | Separate internal bearer secret, at least 32 characters; default empty. | Required when enabling the worker. | `<private-random-secret-at-least-32-characters>` | Approved secret manager/cryptographic generator. | useclevr app | Redeploy. | Worker route rejects missing/wrong token; authorized loopback batches succeed without browser cookies. |
| `RESEND_API_KEY` | Existing application-code and contract-confirmation email provider key; no default. | Required for invitation codes and real notifications. | `<private-resend-api-key>` | Existing approved Resend project API keys. | useclevr app | Redeploy. | Outbox records become sent, provider returns delivery IDs and authorized recipients receive mail. |
| `EMAIL_FROM` | Sender; default `UseClevr <auth@useclevr.com>`. | Optional only if the default sender is verified in the configured Resend account. | `UseClevr <auth@useclevr.com>` | Verified Resend sender/domain. | useclevr app | Redeploy; review pending frozen notification payloads. | Resend accepts mail and delivery status confirms sender/domain health. |
| `PARTNER_ADMIN_EMAIL` | Application-review notice recipient. | Operationally required unless an approved fallback is present. | `partners@example.invalid` | Owner-approved partner operations mailbox. | useclevr app | Redeploy. | Synthetic approved-recipient application notice reaches partner operations. |
| `RESEND_STATUS_TO` | Existing notice recipient fallback after `PARTNER_ADMIN_EMAIL`. | Optional; prefer the explicit partner recipient. | `operations@example.invalid` | Existing operations configuration. | useclevr app | Redeploy. | Notice outbox recipient matches the intended fallback when no partner recipient is set. |
| `AUTH_SECRET` | Existing session secret; also encrypts application-email payloads and keys verification-code hashes. | Required existing secret, or supported `NEXTAUTH_SECRET` fallback. | `<existing-private-auth-secret>` | Existing production secret manager. | useclevr app | Redeploy; coordinate rotation separately. | Existing login, invitation delivery and code verification pass. |
| `NEXTAUTH_SECRET` | Legacy fallback for authentication/application protection. | Optional when `AUTH_SECRET` is set. | `<existing-private-auth-secret>` | Existing production configuration, if used. | useclevr app | Redeploy. | Supported fallback works; do not configure conflicting secrets. |
| `AUTH_URL` | Existing canonical authentication and application-email origin. | Explicit production value recommended. | `https://app.useclevr.com` | Existing production domain. | useclevr app | Redeploy. | Login returns and invitation links use the production host. |
| `NEXTAUTH_URL` | Legacy authentication URL fallback; auth normalization aligns it with `AUTH_URL`. | Optional when `AUTH_URL` is correct. | `https://app.useclevr.com` | Existing authentication configuration. | useclevr app | Redeploy. | No authentication redirect uses an obsolete host. |
| `NEXT_PUBLIC_APP_URL` | Public app origin used by application links/origin checks; not a secret. | Existing public build/runtime setting; keep consistent with `AUTH_URL`. | `https://app.useclevr.com` | Existing build configuration. | useclevr app and existing source build configuration | Rebuild and redeploy if changed. | Browser links and same-origin writes resolve to the production host. |
| `DATABASE_URL` | Runtime database target; preferred over `DIRECT_URL`. | Required existing PostgreSQL configuration, unless only supported direct fallback is used. | `<private-postgresql-connection-string>` | Existing managed PostgreSQL provider. | useclevr app | Redeploy. | Authorized read-only identity/schema checks and application persistence succeed. |
| `DIRECT_URL` | Predeploy target preferred over `DATABASE_URL`; runtime fallback. | Required only when the deployment needs a separate direct connection. | `<private-direct-postgresql-connection-string>` | Same existing database's direct endpoint. | useclevr app | Redeploy/predeploy after authorization. | Runtime and migration connections identify the same intended database/schema. |
| `NEON_USE_SERVERLESS` | Exact `true` selects Neon HTTP; default false for a normal PostgreSQL URL. | Optional existing setting; do not enable HTTP for transaction-dependent contract work. | `false` | Existing transaction-capable database configuration. | useclevr app | Redeploy. | Contract transactions/advisory locks work; normal `pg` is used when both Neon flags are false. |
| `NEON_USE_WS_POOL` | Exact `true` selects Neon WebSocket pool before other driver modes; default false. | Optional existing transaction-capable Neon alternative. | `false` | Existing database driver policy. | useclevr app | Redeploy. | If enabled deliberately, transactional integration works on the configured Neon connection. |
| `PARTNER_PROGRAM_ENABLED` | Independent Stripe commercial-event gate; default off. It does not enable contracts. | Required only for authorized commercial accrual, not signing/setup. | `false` during signing acceptance | Separate owner commercial-program activation decision. | useclevr app | Redeploy. | Signing works independently; financial accrual also requires the approved database program policy. |

`ADMIN_AUTH_BYPASS_EMAIL` is another existing application-notice fallback, followed by
`superadmin@useclevr.com`. Do not configure an authentication bypass as a mail-routing solution;
set `PARTNER_ADMIN_EMAIL`. Railway supplies existing `PORT` and `NODE_ENV=production`; the worker
uses that port. `AUTH_TRUST_HOST` is an existing authentication setting, initialized to `true` by
the app; this task does not change host trust or authentication policy.

There is **no** separate contract webhook-secret variable, webhook-URL variable, Dropbox client
secret requirement, S3 key or public document bucket in this implementation. Configure the callback
URL in the Dropbox **API App**; the same `DROPBOX_SIGN_API_KEY` authenticates provider calls and
webhook signatures. Dropbox OAuth and embedded signing are not used.

## Owner setup sequence

### 1. Prepare the existing service and database

1. Confirm the production **useclevr app** service, canonical app host and currently deployed source.
   Check only variable presence through approved tooling; never export values into a report.
2. Obtain an encrypted database backup and test restoration with all document key versions.
   An authorized operator compares runtime `DATABASE_URL` and predeploy `DIRECT_URL` targets
   privately. A successful health check alone does not establish schema readiness.
3. Verify migrations 0038–0045 through the existing migration process. Migration 0042 creates
   public application, audit, email and request-limit storage. Migration 0043 creates `PartnerContract`, `PartnerContractTemplate`, `PartnerContractProfile`,
   `PartnerContractSchedule`, `PartnerContractProviderApproval`, `PartnerContractArtifact`,
   `PartnerContractAudit`, `PartnerContractWebhook`, `PartnerContractJob` and `PartnerContractDelivery`. It installs
   immutable-evidence, version, executed-contract and unsigned-activation guards. Migration 0044
   adds `PartnerOnboardingChallenge`, `PartnerOnboardingSession`, website and commission agreement
   references, and invitation/code delivery history. Existing `User`, `Account`, `Profile`, `EmailVerificationCode` and partner/referral tables remain
   dependencies. Password login consumes an existing email-verification proof; verify that storage and mail path too. Check table/column/index/trigger presence, not only migration filenames.
4. Confirm the runtime database supports interactive transactions and advisory/row locks.
   The Neon HTTP driver is not a replacement for the transaction-capable `pg`/Neon pool path.
   Run no production predeploy command merely to discover schema state. Apply reviewed migrations
   only after explicit owner authorization, using the existing transactional predeploy sequence.

### 2. Enable private draft management

1. Keep live sends and the worker off. Set `PARTNER_CONTRACTS_ENABLED=true`,
   `PARTNER_CONTRACT_SIGNING_MODE=draft`, the versioned encryption map/active ID, approved retention,
   canonical origin, owner user IDs, and existing database/authentication/mail configuration.
   The owner authorizes and applies the configuration redeployment separately.
2. Sign in as the verified, allowlisted superadmin. Open `/app/admin/partners` → Contract Management.
   `enabled: true` confirms the management gate; it does not prove provider readiness.
3. Approve an applicant, verify their invited email, review their submitted legal identity and
   authority, and create their commercial schedule. Enter the complete approved company identity,
   independent company signer name/email/title/reference, actual commercial clauses and an existing
   reviewed financial-policy version. No environment variable substitutes for those database records.
4. Use **Prepare agreement** and **Process pending work**. Download the source PDF privately and
   review its parties, clauses, commission schedule, version and non-binding banner. Missing
   encryption, unsupported legal glyphs or missing identity/terms must block generation.

### 3. Configure Dropbox Sign account, app and callback

1. The owner signs in to the existing approved Dropbox Sign **API** account. Verify that its plan
   supports the intended API usage; authorize any live plan/budget separately. In
   [API Settings](https://app.hellosign.com/home/myAccount#api), create or retrieve an account API key
   and store it privately as `DROPBOX_SIGN_API_KEY`. The adapter uses Basic authentication with
   the API key as username and an empty password. See [Dropbox authentication](https://developers.hellosign.com/api/api-reference-authentication).
2. Obtain `account.account_id` through a private authenticated
   [account lookup](https://developers.hellosign.com/api/account/get) and configure
   `DROPBOX_SIGN_ACCOUNT_ID`. Confirm the intended account/quota; do not use a team member's
   unrelated account reference.
3. Create/select the owner-controlled [API App](https://developers.hellosign.com/api/api-app) in
   API Settings and copy its Client ID into `DROPBOX_SIGN_CLIENT_ID`.
4. Set that API App's **event callback URL** to exactly
   `https://app.useclevr.com/api/webhooks/partner-contracts/dropbox-sign`. Do not use an OAuth
   redirect URL, the landing-page host, `/api/webhooks/stripe`, or an account-only callback.
   This handler requires an authenticated account ID and at least one matching app identifier;
   every supplied app identifier must match.
5. After the owner applies the matching server configuration, use the API App callback test.
   Expect HTTP 200 and the text `Hello API Event Received`. The handler accepts multipart with
   a `json` field or JSON, verifies `Content-Sha256` over the exact JSON string and the event HMAC
   over `event_time + event_type`, and checks account/app identity. It rejects stale events beyond
   72 hours and timestamps more than two minutes ahead. Dropbox documents its test/acknowledgment
   behavior and signature headers in the [callback walkthrough](https://developers.hellosign.com/docs/guides/events-and-callbacks/walkthrough).
6. Check provider delivery status. A browser GET or unsigned POST is not a callback test. Never
   remove HMAC verification to make a failing callback pass. Diagnose a mismatch using delivery
   status and safe error codes, without copying callback bodies, keys or signer data into logs.
7. Verify that completed documents retain Dropbox's audit trail. The adapter retrieves the merged
   PDF from the [authenticated files endpoint](https://developers.hellosign.com/api/signature-request/files).
   File preparation can return 409; reconciliation must retry without marking execution complete.
   Inspect the actual completed PDF during authorized provider acceptance: the app checks PDF
   structure/checksums but does not independently parse the provider audit pages.

### 4. Prove sandbox signing with authorized recipients

1. Use a reviewed non-production environment with the existing infrastructure and explicit
   recipient authorization. The existing `dist-test` validation artifact cannot perform signing;
   do not try to override its forced-off policy or change workflows as part of this setup guide.
   An owner-authorized local instance with a reachable HTTPS callback is an alternative.
   Running `dropbox_test` on the production service can enqueue test requests for existing approved
   applications; authorize scope explicitly before doing so.
2. Set `PARTNER_CONTRACT_SIGNING_MODE=dropbox_test`, keep `PARTNER_CONTRACT_LIVE_ENABLED=false`,
   configure the provider identifiers/key, encryption and mail, and allowlist **both** independent
   QA signers in `PARTNER_CONTRACT_TEST_RECIPIENTS`. Use only synthetic application/legal terms.
3. Prepare the test agreement and process/send it through the admin controls. This sends
   `test_mode=1`; the PDF and messages are marked non-binding. The partner's public **Sign agreement**
   control is live-only; sandbox initiation uses admin processing, then Dropbox's test invitation.
4. Open the partner email, review the complete PDF and sign. The independent company signer signs
   second. Dropbox hosts the ceremony and sends signing invitations. The current send request has
   no positioned fields, so Dropbox appends the required signature page as documented in
   [Send Signature Request](https://developers.hellosign.com/api/signature-request/send).
5. Verify authenticated callback receipt and process reconciliation. Provider GET must confirm
   exact contract/checksum metadata, both signer identities, distinct signature IDs, signing order
   and timestamps. Only then may the app archive the signed PDF/evidence and record test execution.
6. Verify confirmation mail, private completed-PDF access and encrypted artifact records. Verify
   that the account stays pending and both commercial activation and credential establishment
   reject the non-binding test agreement. Do not treat this as a binding partner contract.

### 5. Authorize live signing and separate commercial activation

1. Complete actual sandbox acceptance first. Owner/counsel approve the exact legal template and
   per-applicant schedule, company registration/address/notice details, signing authority,
   commercial/financial policy alignment, retention, processing terms and required signature
   assurance. The implemented hosted email ceremony is not represented as qualified signing.
2. Keep unattended processing off during review. Configure `dropbox_live`, the approved positive
   cap, allowed company signer reference and other live policy values. Live runtime approval
   requires `PARTNER_CONTRACT_LIVE_ENABLED=true`; the owner must explicitly authorize that gate
   before applying it. No request can pass live gates without the database owner approvals.
3. In Contract Management, the allowlisted owner records exact template and schedule checksum
   approvals with legal-review references, plus the displayed **provider configuration SHA-256**
   approval. The owner must also be a real superadmin. Changing runtime policy invalidates the
   fingerprint; changed identity, terms or mode require preparation of the correct revision.
4. Treat **Process pending work** and worker enablement as send-capable actions. Preparation queues
   sending automatically for a sendable mode. Once runtime approval is recorded, a worker can
   prepare/send eligible approved applications; review the eligible queue before enabling it.
   Use the existing manual admin processing initially. Enable the loopback worker only after
   authorizing the queue and setting its separate secret. No new worker service is required.
5. Authorize one controlled live agreement. Verify the complete journey below with two actual
   independent authorized signers and verify provider emails, callbacks, signed PDF and evidence.
   The application sends `test_mode=0`; this is a binding-provider ceremony, not a mock test.
6. After verified live execution, the partner sets a password through their valid scoped invitation
   session or retains their existing verified login. Existing passwords/OAuth logins are not
   overwritten. No customer signup, paid subscription or checkout is required. The partner may
   sign in at `/partner/login` through the existing password plus login-code flow (or their existing
   OAuth method) and inspect their pending status/contracts. The login code is separate from the
   invitation code and uses the existing Resend configuration.
7. A superadmin separately records explicit activation confirmation and an audit reason of at least
   ten characters. Activation rechecks current owner/runtime/template/schedule/identity/financial
   policy approvals, latest live execution, both signatures and readable source/signed/audit artifacts.
   The database activation trigger also rejects unsigned activation. Signing never activates an account.
8. Keep commercial accrual and payouts under their separate authorization. `PARTNER_PROGRAM_ENABLED`
   and the enabled database program policy are separate financial gates, not contract setup controls.

## Invitation and archive acceptance

| Step | Required observable result |
| --- | --- |
| Approved invitation | Application approval persists; encrypted outbox issues a single-use, seven-day invitation. No customer account is required to apply. |
| Email ownership | Invited email receives a six-digit code; ten-minute expiry, five committed attempts and resend cooldown apply. Verified ownership issues a hashed, seven-day, application-scoped HttpOnly session, not a customer/admin session. |
| Legal identity | Verified applicant submits authority and electronic-record consent; administrator reviews it. Email verification alone does not replace legal-identity/authority review. |
| Agreement review | The exact applicant can download the private personalized PDF; unrelated users cannot. |
| Sequential signatures | Dropbox confirms partner then company signatures via authoritative API read-back. A callback alone, typed name, local button or mock state never authorizes live execution. |
| Confirmation | Both snapshotted recipients receive a completion notification with the verified PDF; outbox delivery IDs/statuses are visible to administrators. |
| Secure archive | Source PDF, signed PDF and audit JSON are encrypted `bytea` in PostgreSQL using AES-256-GCM, random 12-byte IVs, versioned 32-byte keys, authenticated contract/checksum/key binding and SHA-256 checks on read. There is no public storage URL. |
| Access controls | Source/signed downloads require a valid scoped invitation session or exact authenticated participant/superadmin binding. Audit JSON is superadmin-only. Responses are private/no-store attachments. |
| Portal access | Verified live execution and readable signed/audit archives permit credential setup; existing verified identity is retained. Password login also requires its existing emailed login-code proof. Partner can sign in while still commercially pending. |
| Final activation | Explicit, audited superadmin decision rechecks execution and current approvals. Neither callbacks nor credential setup activate partners or create payouts. |

An expired scoped session requires an administrator-renewed invitation for an approved application;
renewal revokes previous sessions and links without replacing the linked identity. Retain old
`PARTNER_CONTRACT_ENCRYPTION_KEYS` entries for historical artifacts. Changing `AUTH_SECRET` can
invalidate sessions, code hashes and encrypted application-email payloads; do not rotate it as a
contract-setup shortcut. Database append-only/immutability triggers protect evidence, but database
owner access still requires separate restriction. `retainUntil` is a retention floor; no automatic
purge is implemented. Back up provider evidence, database and keys under the approved policy.

## Missing-configuration troubleshooting

| Observation | Meaning and owner/operator action |
| --- | --- |
| `contract management disabled` | Management flag is not exact `true`, or a TEST artifact enforces off. Configure the production web service and verify the correct artifact before redeploying. |
| `provider credentials missing` | Dropbox key/account/app configuration is incomplete. Repair privately; do not change authentication checks. |
| `document encryption key missing` / `document integrity check failed` | Active or historical key is absent/incorrect, or artifact integrity fails. Restore the correct key version and investigate; never overwrite an archived document. |
| `live provider configuration not approved` | A required live setting/gate or numeric policy is invalid. Compare every row above. |
| Draft with `provider configuration owner approval required` | Runtime fingerprint has no current owner approval or changed after approval. Review and approve the exact displayed policy, then prepare the correct revision. |
| Draft with legal-template/schedule/identity/policy error | Resolve the named database approval/version; more environment variables cannot replace legal review. |
| `invalid callback signature` / `callback account mismatch` | Verify the API key, exact app/account and API App callback configuration. Preserve both HMAC checks. |
| Generated agreement does not progress | Inspect due jobs and process manually, or authorize/configure the existing worker. Confirm mail configuration for completion delivery. |
| `send_uncertain` | An external creation outcome may be unknown. Reconcile by exact provider metadata. An allowlisted owner can perform the existing audited provider-absence review; never blindly resend or edit database status. |
| HTTP 503 temporary unavailability | Inspect authorized runtime diagnostics for database/transaction/schema/configuration health. The disabled-feature message alone proves none of those failures. |

Local preflight verifies provider construction and encrypted source availability **before** reserving
a live send or recording `sending`. A missing local credential/key therefore keeps a generated
agreement retryable after configuration repair. Failures after the external operation begins retain
the conservative uncertain-request recovery controls.

## Validation and remaining owner actions

Run `pnpm test:partners`, `pnpm test:partners:integration`, `pnpm test:partners:browser`,
`pnpm test:auth`, `pnpm test:referral-automation`, `pnpm test:railway-auth`, `pnpm validate:types`,
`pnpm validate:dist`, focused ESLint, `pnpm lint:secrets`, `pnpm lint:todos`, and `pnpm docs:check`.
Use `node scripts/partners/run-safe-build.mjs --runtime` for isolated production compilation,
packaging and local acceptance. The runner removes its snapshot when it finishes. Pass
`--keep-snapshot` to retain local evidence. [Shared read-only requests](../api-tests/partner-contract-readiness.http) verify
API boundaries without storing credentials or initiating signing.

Local verification passes 19 financial rules, 12 contract unit groups, 43 PostgreSQL checks,
17 contract integration groups, 18 browser groups, authentication redirects, 27 referral
regressions, mocked Railway checks, TypeScript, deployment configuration and 171 documentation
links. Clean-source lint reports zero errors and 448 warnings; secret and project-record checks
pass. Isolated production compilation, all 105 pages, packaging and packaged-runtime acceptance
pass. The login-proof regression asserts a non-null fixture email before calling authentication
helpers. Build diagnostics include the deliberately unreachable loopback database.

All automated provider/email
calls use safe mocks; local completion is not live provider acceptance. Remaining owner actions:
configure the existing service, verify schema/backups, authorize real QA recipients and sandbox
acceptance, approve legal/commercial/provider versions, authorize the live send gate/processing,
verify one actual live execution and archive/delivery, then explicitly activate that partner.
No merge, deployment, hosted migration, real signing request or commercial activation occurs in
this audit. No remaining code defect is waived by configuration or by passing mocked tests.
