# Native partner electronic signing

Status: implementation for owner review. Production signing requires separate release authorization,
legal review and recorded owner approvals. Native signing uses the existing email service and
PostgreSQL; it requires no paid signature-provider account. Dropbox Sign remains a supported mode.

## Workflow and evidence

1. The administrator reviews the applicant's email-verified identity and signing authority, creates
   the commercial schedule and selects the current financial policy. The owner approves the exact
   native 2.0.0 template, schedule checksum and native runtime fingerprint after legal/security review.
2. Agreement preparation stores an immutable snapshot and encrypted source PDF. A native send
   reserves the existing monthly request budget once and queues an encrypted email invitation.
3. The partner opens `/partners/sign` with a random 256-bit token in the URL fragment. The browser
   clears the fragment; HTTP request URLs contain no token. Opening the page consumes nothing.
4. The signer requests a code sent only to the invitation's approved email. The code expires after
   ten minutes, has five total verification attempts and three total sends per invitation, with a
   one-minute resend cooldown. Budgets persist across processes and code resends.
5. Successful verification atomically consumes the invitation/code and issues a random, HttpOnly,
   Secure-in-production, SameSite=Strict cookie. It grants only the exact signing ceremony for
   at most thirty minutes; it grants no customer, partner-portal or administrator session.
6. The server presents the complete immutable agreement and commercial schedule, plus a private PDF
   download and source SHA-256. The signer separately confirms review and electronic-record/signature
   consent, types the approved signer's legal name and selects **Sign agreement**.
7. A transaction records the action and an Ed25519 platform attestation of its receipt: contract and
   snapshot hashes, verified email/reference, typed name, email verification/document presentation/
   signing UTC times, exact consent text/version, affirmative action and hashed browser/network context.
8. Only after partner signing does the system invite the exact owner-authorized company signer.
   This signer independently verifies that approved email and takes the same explicit steps. The
   company receipt includes the partner receipt's SHA-256. Matching email addresses are rejected.
9. The final PDF retains the source pages and appends a certificate. It also embeds the exact source
   PDF and signed receipts as attachments. A separately signed manifest binds both receipts, snapshot,
   source hash and final PDF hash. Source/signed PDFs and manifest use existing AES-256-GCM storage.
10. Both parties receive the final PDF and signed evidence manifest through the existing email outbox.
    A separate, explicit audited superadmin decision remains mandatory for commercial activation.
    Signed financial terms, program enablement, accrual, waiting periods and payout controls apply.

Invitations expire after forty-eight hours or the agreement expiry, whichever occurs first. The
administrator uses **Renew signing invitation**, explicit confirmation and an audit reason of at
least ten characters to replace a lost, expired or exhausted invitation. Renewal permanently revokes
its old token and signing session. It cannot replace an existing signature. Cancellation prevents
all further signing; a new agreement revision requires fresh invitations and signatures.

## Required production configuration

Set these variables on the existing production Railway web service **useclevr app**. Store secret
values privately, apply staged changes through an authorized redeployment, and retain historical
verification/encryption keys. No new worker service or Dropbox webhook is required for native mode.

| Variable | Value and purpose | Mandatory / source |
| --- | --- | --- |
| `PARTNER_CONTRACTS_ENABLED` | Exact `true` enables management. | Required; owner decision. |
| `PARTNER_CONTRACT_SIGNING_MODE` | `native` selects native signing; `draft` permits private draft review. | Required; owner decision. |
| `PARTNER_CONTRACT_LIVE_ENABLED` | Exact `true` permits live gates; default off. | Required for native signing; explicit owner authorization. |
| `PARTNER_CONTRACT_NATIVE_KEY_ID` | Active platform-attestation key version. | Required; secret-manager version label. |
| `PARTNER_CONTRACT_NATIVE_PRIVATE_KEY` | Base64-encoded DER PKCS8 Ed25519 private key. | Required secret; owner generates an Ed25519 pair using an approved cryptographic generator. |
| `PARTNER_CONTRACT_NATIVE_PUBLIC_KEYS` | JSON map of key IDs to base64 DER SPKI Ed25519 public keys. Active ID must match the private key. | Required; export from the same key pair. Retain all historical public versions. |
| `PARTNER_CONTRACT_OWNER_USER_IDS` | Comma-separated real superadmin user IDs allowed to record owner approvals. | Required; existing verified account administration. |
| `PARTNER_CONTRACT_COMPANY_SIGNER_REFS` | Allowed company-signer references; must include the schedule's exact reference. | Required; owner-reviewed signing-authority register. |
| `PARTNER_CONTRACT_PUBLIC_ORIGIN` | Canonical HTTPS app origin, normally `https://app.useclevr.com`. | Explicit setting recommended; effective HTTPS origin required. Fallbacks: `AUTH_URL`, then `NEXT_PUBLIC_APP_URL`. |
| `PARTNER_CONTRACT_ENCRYPTION_KEY_ID` | Active document-encryption key version. | Required; existing secret-manager version label. |
| `PARTNER_CONTRACT_ENCRYPTION_KEYS` | JSON map of encryption IDs to base64 random 32-byte AES keys. | Required secret; existing encryption/key-management process. Retain historical keys. |
| `PARTNER_CONTRACT_RETENTION_DAYS` | Integer 1–36500 retention floor for archived artifacts. | Required; owner-approved retention/hold policy. |
| `PARTNER_CONTRACT_MONTHLY_SEND_LIMIT` | Positive integer cap; one reservation per native agreement's initial send. Renewal does not reserve a new agreement. | Required; owner-approved operational budget. |
| `PARTNER_CONTRACT_SIGNATURE_TTL_DAYS` | Agreement expiry, integer 2–90; default 7. | Optional; owner expiry policy. |
| `PARTNER_CONTRACT_REMINDER_HOURS` | Reminder age, integer at least 24; default 72. | Optional; owner reminder policy. |
| `PARTNER_CONTRACT_WORKER_ENABLED` | Exact `true` enables unattended existing loopback processing. | Optional with manual administrator processing; enable only after queue authorization. |
| `PARTNER_CONTRACT_WORKER_SECRET` | Independent random bearer secret of at least 32 characters. | Required when enabling the worker; approved secret generator/manager. |
| `RESEND_API_KEY` | Existing invitation, code and completion-email service key. | Required; existing Resend project. |
| `EMAIL_FROM` | Verified sender; default `UseClevr <auth@useclevr.com>`. | Override if the default sender is not verified; Resend domain/sender administration. |
| `AUTH_SECRET` | Existing authentication secret also protects email payloads and code hashes. | Required unless the supported `NEXTAUTH_SECRET` fallback is used; existing secret manager. |
| `DATABASE_URL` | Transaction-capable runtime PostgreSQL connection. | Required unless the supported `DIRECT_URL` fallback is used; existing database provider. |
| `DIRECT_URL` | Preferred migration connection and runtime fallback, targeting the intended database/schema. | Conditional; existing direct database endpoint. |
| `AUTH_URL` | Canonical authentication and invitation origin. | Existing production setting; keep consistent with the app origin. |
| `NEXT_PUBLIC_APP_URL` | Public app origin for links and origin checks. | Existing source-build/runtime setting; rebuild and redeploy if changed. |

The existing legacy `NEXTAUTH_SECRET` and `NEXTAUTH_URL` fallbacks, administrator-notice variables
`PARTNER_ADMIN_EMAIL`/`RESEND_STATUS_TO`, and database-driver choices are documented in the
[production setup matrix](PARTNER_PRODUCTION_SETUP.md). Native work requires interactive transactions
and advisory locks: keep `NEON_USE_SERVERLESS=false`; use normal PostgreSQL with both Neon flags off
or the existing transaction-capable `NEON_USE_WS_POOL=true` alternative.

`DROPBOX_SIGN_API_KEY`, `DROPBOX_SIGN_ACCOUNT_ID`, `DROPBOX_SIGN_CLIENT_ID` and
`PARTNER_CONTRACT_TEST_RECIPIENTS` are not native-mode requirements. Dropbox modes retain their
existing configuration and authenticated callback requirements. `PARTNER_PROGRAM_ENABLED` controls
commercial accrual independently and is not required to collect signatures.

Do not print private keys, codes, invitation tokens or signing cookies. Generate keys directly into
the approved secret manager or permission-restricted files outside the repository. Publish the
trusted public-key fingerprint through an independently controlled channel for external verification.
Changing the active native public key, key ID, consent version or runtime policy changes the owner
approval fingerprint and requires review and a new agreement revision for in-progress contracts.
Retain released consent text/version mappings when extending the signing protocol so archived
receipts remain verifiable.

## Authorized release and acceptance order

1. The owner authorizes source publication/deployment and migration separately. Verify encrypted
   backups, key recovery, runtime/predeploy database identity and all dependency migrations through
   **0045**. Apply reviewed migrations through the existing predeploy process; never run hosted
   migrations merely to discover schema state. Migration 0045 adds native proof tables, immutable
   signature guards and native-aware activation checks; it activates no accounts.
2. Deploy with live signing and the worker disabled. Prepare the owner-reviewed native key pair,
   encryption, email, canonical origin and verified superadmin identities. Review the exact
   [sales draft](../Legal/partner-agreements/independent_sales-v2-native-draft.md) and
   [reseller draft](../Legal/partner-agreements/authorized_reseller-v2-native-draft.md).
   To generate native PDF drafts, select `native` while keeping
   `PARTNER_CONTRACT_LIVE_ENABLED=false`; preparation uses the native 2.0.0 template and falls back
   to a non-binding draft. The plain `draft` mode selects the Dropbox-compatible 1.0.0 templates.
3. Complete isolated acceptance with synthetic identities and authorized mailboxes. There is no
   native simulation switch: a native signing ceremony records real signing intent. Use only an
   explicitly authorized disposable instance with synthetic legal terms for testing. The existing
   `dist-test` artifact enforces signing off and cannot perform this acceptance.
4. After owner/security/legal approval, authorize `native` mode and the existing live gate, then
   redeploy with the worker off. In Contract Management record the native 2.0.0 template approvals,
   per-applicant schedule/identity review and exact displayed native runtime fingerprint approval.
   Configuration alone does not grant approval. Dropbox 1.0.0 template approvals do not approve the
   native 2.0.0 templates.
5. Review the eligible application/job queue before **Process pending work** or worker enablement:
   processing can prepare and send agreements. Authorize one controlled agreement; verify real
   invitation/code delivery, partner then company signing, replay rejection, archive restoration,
   private downloads and both completion attachments. Then authorize unattended processing if needed.
6. Keep the partner pending until a superadmin explicitly confirms activation with an audit reason.
   Signing and password setup do not activate accounts, accrue commissions or create payouts.

## Verification and recovery

`pnpm test:partner-contracts:integration` runs native and Dropbox regressions against a fixed
disposable local PostgreSQL fixture with intercepted external calls. `pnpm test:partners:browser`
checks the actual signing components with synthetic HTTP responses. Production packaging/runtime
acceptance uses the existing isolated build runner and packaged-runtime acceptance script.
Use the [shared native API requests](../api-tests/partner-native-signing.http) with authorized
disposable fixtures; keep actual tokens, cookies, codes and exported agreements out of tracked files.

Administrators download source PDF, final PDF and execution manifest privately. Each party receives
the final PDF and manifest by email. Retain these exports outside the repository. To independently
verify exports with a previously trusted public-key map:

```bash
node -r tsx/esm scripts/partners/verify-native-evidence.ts /private/manifest.json /private/executed.pdf /private/source.pdf /private/trusted-public-keys.json
```

The command verifies Ed25519 attestations, both source/final SHA-256 values and the receipt chain.
It reads no database and makes no network request. A public key supplied only by an untrusted
document is not a trust anchor. Platform archive access, account setup, native financial-policy
resolution and activation also verify archived bytes and signed evidence before accepting execution.

Signing endpoints enforce same-origin writes, bounded bodies, persisted per-client/action and
per-invitation request budgets, committed failed code attempts and contract transaction locks.
Invitation tokens and verification/session proofs are scoped to one immutable document and signer.
Only hashes are stored in proof fields; raw token/code email payloads use existing authenticated
encryption. Database triggers reject signature/evidence updates, document mutation and proof reuse.
Contextual user-agent and proxy-reported network hashes are not identity verification. Operators
must verify trusted ingress headers and clock synchronization; neither header content nor the
application clock independently proves a person's identity or signing time.
Each API action has a thirty-request hourly client-address budget; requests without a trusted
`x-real-ip` share the conservative unknown-address bucket. Invitation verification budgets apply
independently of client-address headers.

## Remaining release blockers and assurance limits

The owner must authorize release, migration and live enablement; approve exact legal/financial and
native signing versions for the applicable parties/jurisdictions; verify company signing authority;
and complete hosted email, backup/key recovery and acceptance checks. No automated local test
confirms those hosted prerequisites. Preserve incident response, restricted database/key access,
lawful holds and private export procedures. `retainUntil` is a floor, not an automatic purge job.

This workflow records email ownership, reviewed authority declarations and affirmative intent.
It does not provide independent government-ID verification, a qualified electronic signature,
a qualified timestamp, or a PDF-reader/PAdES certificate. Ed25519 signatures are **UseClevr platform
attestations of evidence**, not personal certificates issued to the signers. Possession of both the
attestation private key and privileged database access defeats the platform's trust boundary;
approved key custody and independently retained exports remain necessary. Counsel determines
whether this assurance is sufficient; agreements requiring another assurance method must not use
native signing. No source change authorizes production signing or commercial activation.
