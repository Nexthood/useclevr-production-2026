# Partner agreement lifecycle

Status: implementation for review; production signing is disabled by default. The owner must explicitly approve the exact legal templates, commercial schedules and provider configuration following qualified legal review. Do not merge or deploy production signing before those approvals. No provider subscription is purchased by this implementation.

## Architecture

Application approval → verified single-use onboarding → partner legal identity and electronic-record consent → administrator identity/authority review → versioned commercial schedule → personalized PDF → external provider invitation → partner signature → authorized Atlas Mega Ventures LLC countersignature → authoritative provider verification → encrypted signed PDF and evidence archive → confirmation copies → eligible for explicit administrator activation.

Application status, contract status and PartnerAccount status are independent. Signature jobs never activate accounts or create commissions or payouts. The existing administrator activation APIs and the database trigger require a fully executed production agreement and an explicit audited manual decision. Active-to-active edits and existing active partners remain operational. New activation and reinstatement fail closed, including while contract flags are disabled. Coordinate migration 0043 with the signed-agreement rollout: deploying it before approvals pauses new commercial activations, although applications, approvals and onboarding remain available.

`src/lib/partners/contracts` contains the domain validators, template catalog, PDF generator, external provider interface, Dropbox Sign adapter, non-binding mock, private storage, records, lifecycle, activation policy, email outbox and durable worker. Admin controls extend `/app/admin/partners`; participants use `/partners/contracts`, linked from completed onboarding while contract management is enabled. Native hosted provider signing supplies the signing ceremony; typing a name or advancing the local mock is never a production signature.

The generated agreement snapshots the two legal parties, verified applicant/user/partner binding, company signer reference, exact template/profile/schedule hashes, current financial policy hash and approved runtime fingerprint. Version changes produce a new contract revision. Cancel a pending external signing request before replacing it. Executed versions cannot be modified. Contract schedules document owner-approved commercial terms; they do not modify commission calculations or configuration.

## Draft agreements and legal approval

Human-readable drafts:

- [Independent Sales Partner draft](../Legal/partner-agreements/independent_sales-v1-draft.md)
- [Authorized Reseller draft](../Legal/partner-agreements/authorized_reseller-v1-draft.md)

Runtime templates are `src/lib/partners/contracts/templates/independent_sales.v1.json` and `authorized_reseller.v1.json`. Both start unapproved. The owner approves the exact displayed SHA-256 with a legal-review reference; only allowlisted owner user IDs can approve/revoke templates, schedules or provider configuration. Revocations are permanent for that version. New text requires a new template ID and semantic version plus a reviewed Markdown copy. Never overwrite a signed template version.

The commercial schedule requires explicit scope, commission rates/calculation, qualifying received revenue, eligibility, exclusions, payment terms, taxes/invoicing, refunds/chargebacks, territory, exclusivity, duration/renewal, termination notice, liability/indemnity, governing law, dispute resolution and data-protection terms. No rates or binding commercial defaults are supplied. An administrator confirms alignment with the selected current financial policy; the owner approves the schedule after legal review. A changed financial policy requires a new reviewed schedule and agreement before a new activation.

Counsel must confirm Atlas's registration jurisdiction, registration identifier, address, notice contact and signing authority; worker/agency classification and mandatory local sales-representative protections; CPA/professional referral restrictions; enforceable commission/payment/refund rules; tax and withholding; sanctions/export and anti-bribery rules; privacy roles, DPA, cross-border transfers and retention; liability limits and indemnities; termination, governing law, forum and dispute mechanisms; language, witnessing/notarization, excluded transactions and required signature assurance. Resolve all jurisdiction-specific issues before approval.

The [ESIGN statute](https://www.law.cornell.edu/uscode/text/15/7001) addresses electronic validity, record retention and consumer disclosures/consent where applicable. Counsel must review the applicable state's UETA enactment and exceptions, rather than assume a uniform national rule; see the [Uniform Law Commission model act](https://www.uniformlaws.org/). The [European Commission eSignature FAQ](https://ec.europa.eu/digital-building-blocks/sites/spaces/DIGITAL/pages/880312429/eSignature+FAQ) explains that only qualified electronic signatures expressly carry handwritten-signature equivalence throughout the EU. The implemented hosted email-signing flow is not represented as an advanced or qualified signature. If local law or counsel requires AES/QES, keep signing disabled and extend the provider integration with the approved assurance mechanism first.

## Provider configuration

See [provider evidence and costs](PARTNER_SIGNATURE_PROVIDERS.md). Production setup requires an owner-controlled Dropbox Sign API account/application, an appropriate approved paid plan, reviewed processing terms and API credentials. Never commit credentials or paste them into tickets, logs or PRs.

| Variable | Required value / purpose |
| --- | --- |
| `PARTNER_CONTRACTS_ENABLED` | `true` exposes contract administration and participant APIs; unset/false disables them. |
| `PARTNER_CONTRACT_SIGNING_MODE` | `draft` (default), `mock` (non-production only), `dropbox_test`, or `dropbox_live`. |
| `PARTNER_CONTRACT_LIVE_ENABLED` | Separate `true` gate for binding production requests. |
| `DROPBOX_SIGN_API_KEY` | Server-only account API credential. |
| `DROPBOX_SIGN_ACCOUNT_ID` | Expected provider account binding. |
| `DROPBOX_SIGN_CLIENT_ID` | Expected API application binding; configure its app callback. |
| `PARTNER_CONTRACT_TEST_RECIPIENTS` | Comma-separated authorized test email allowlist; both sandbox signers must match. |
| `PARTNER_CONTRACT_OWNER_USER_IDS` | Comma-separated verified superadmin user IDs allowed to record owner approvals. |
| `PARTNER_CONTRACT_COMPANY_SIGNER_REFS` | Comma-separated authorized company signer references; schedule names/emails/title require owner review. |
| `PARTNER_CONTRACT_PUBLIC_ORIGIN` | Exact HTTPS app origin used for private portal links and approved runtime fingerprint. |
| `PARTNER_CONTRACT_ENCRYPTION_KEY_ID` | Active versioned document-encryption key identifier. |
| `PARTNER_CONTRACT_ENCRYPTION_KEYS` | Secret JSON map of key identifier to a cryptographically random 32-byte base64 AES key. Retain old keys for old documents. |
| `PARTNER_CONTRACT_RETENTION_DAYS` | Owner/counsel-approved retention minimum, 1–36500 days for live mode. |
| `PARTNER_CONTRACT_MONTHLY_SEND_LIMIT` | Positive owner-approved application cap, no larger than the account's remaining permitted quota. Includes conservatively reserved attempts. |
| `PARTNER_CONTRACT_SIGNATURE_TTL_DAYS` | 2–90 days, default 7. Provider expiration rounds to an hour. |
| `PARTNER_CONTRACT_REMINDER_HOURS` | At least 24, default 72; reminder attempts have a 24-hour floor. |
| `PARTNER_CONTRACT_WORKER_ENABLED` | Explicit `true` starts the optional Railway loopback worker and enables the internal batch route. |
| `PARTNER_CONTRACT_WORKER_SECRET` | Separate cryptographically random server-only secret of at least 32 characters for worker authentication. |
| `RESEND_API_KEY`, `EMAIL_FROM` | Existing email provider configuration; sender must be verified. |

Generate encryption and worker secrets with an approved secret manager or cryptographic random generator; store them in Railway's secret environment, with independently backed-up encryption key versions. The runtime owner approval binds the mode, account/application, HTTPS origin, authorized signer references, encryption key identifier, retention, send cap, expiry and reminder policy. Changing these invalidates approval. Credentials themselves are never displayed or hashed into public logs. Key rotation adds a new key version; keep old decryption keys and encrypted backups. Test restore before production approval.

Set the Dropbox Sign **app callback** to `https://app.useclevr.com/api/webhooks/partner-contracts/dropbox-sign`. Configure the approved account to keep its audit trail appended to the completed PDF. Validate sandbox callbacks, sequential signatures, expiry, signed-file retrieval and appended audit trail with authorized test recipients before live approval. Sandbox and mock agreements are conspicuously non-binding and never eligible for activation. The mock records simulated state, source PDF and mock mail only; it does not create real signatures or external email.

Callback authentication checks the full JSON HMAC, event hash and approved account. The app identifier may appear in event metadata, the signature request or the callback root; at least one must be present and every supplied identifier must match the configured app. See the [Dropbox Sign app callback reference](https://developers.hellosign.com/api/events/api-app-create-event-callback) and [callback verification guide](https://developers.hellosign.com/docs/guides/events-and-callbacks/walkthrough).

## Durable processing and retries

Railway's startup script conditionally starts a separate worker child when both flags are true. It calls the loopback internal batch route every minute after initial startup. Each batch claims at most two jobs and five email deliveries, with bounded leases, `FOR UPDATE SKIP LOCKED`, retry backoff and attempt limits. Multiple web replicas share the same durable queue. External schedulers can POST to `/api/internal/partner-contracts/run` with the separate bearer secret, without browser authentication; the route itself verifies the secret in constant time. Never put that secret in query strings. Run only one scheduling mechanism per environment where possible. Admins can explicitly process pending work and retry failed delivery in Contract Management.

Ready approved/onboarded applications are scanned for required reviewed identity and schedule. Their records also enqueue work after onboarding, identity review and approvals. Draft generation needs a valid encryption key. Missing prerequisites remain blocked; they never roll back application approval or onboarding. Polling reconciles requests even if callbacks are lost. Provider completion and signed-file preparation are separate; a temporary download failure keeps the agreement unexecuted and retryable.

External request creation has no assumed idempotency support. Persist `sending` before the external call. A timeout or crash becomes uncertain; reconcile by exact metadata before doing anything else. Never blindly repeat creation. An allowlisted owner can confirm a provider-account review found no request, after the in-flight lease interval; this is an explicit, audited exception and must include a provider support/dashboard reference. The bounded automatic search covers up to 1000 recent requests; owner absence review must cover the whole account, especially above that volume. Creation reservations enforce the owner cap locally, but account usage outside UseClevr also counts toward provider billing. Monitor that account and disable sends before exhausting its plan.

Resend requests use stable per-delivery idempotency keys and a frozen payload checksum. Sent rows do not resend. Unknown network outcomes may retry only within the conservative 23-hour provider idempotency window. Expired ambiguous deliveries become `uncertain`, require provider evidence review, and cannot be blindly retried from the UI. Known failed responses use bounded backoff and can be manually retried. Signing invitations/reminders are delivered by the signature provider; application emails explain status and link to the authenticated portal. Executed PDFs are attached to confirmation emails to the exact snapshotted partner/company recipients. No public download or bearer-document URL is generated.

## Security and storage

Each source PDF, completed PDF and evidence JSON is AES-256-GCM encrypted in PostgreSQL `bytea`, with a random IV, separate versioned keys, authenticated contract/checksum/key binding, and SHA-256 verification on every read. Records store artifact IDs as private locations. There are no public object-storage buckets or expiring public URLs. Managed PostgreSQL must enforce TLS, encryption at rest, restricted service credentials and encrypted backups. The source font is SIL-OFL licensed Noto Sans; unsupported legal characters fail closed for an approved font extension or legally reviewed transliteration. Source and packaged asset paths are supported.

Download routes require a real session plus superadmin or the exact linked applicant/user/partner binding; unrelated users receive no document. Audit JSON is admin-only. Responses use private/no-store, attachment disposition, no-sniff and sandbox headers. Application APIs validate ownership, email verification, CSRF origin, bounded request sizes and strict schemas. No tokens, API keys or callback bodies are logged.

Dropbox callbacks require the full JSON Content-Sha256 HMAC plus event hash, expected account/app, bounded body and a 72-hour freshness window with two-minute clock skew. A unique event key rejects replay side effects. Callback bodies never directly mark a contract executed: they enqueue an authoritative provider GET, exact contract/checksum and signer-identity/order verification, then private retrieval and archival. Only all verified signatures plus stored PDF/evidence permit `fully_executed`. Owner approval/revocation locks prevent concurrent live sending/activation from crossing an approval decision. Verified completions of previously accepted requests are archived even after approval is revoked; final activation still requires current approval. Requests already accepted by the provider require explicit cancellation; disabling a local flag cannot revoke signatures remotely.

Append-only triggers protect execution audit, callbacks, artifacts and provider approvals. Identity, templates and schedules are versioned and frozen following review/approval; an executed contract is immutable. These controls protect against application updates and ordinary application SQL, not a malicious database owner; restrict privileged database access, export encrypted backups/audit evidence under the approved retention policy, and monitor privileged changes. `retainUntil` is a retention floor, not an automatic deletion promise. Legal holds and authorized erasure/purge require a documented, privileged retention procedure covering the provider, application, replicas and backups. No unattended purge is implemented.

## Migration and rollback

`src/lib/db/migrations/0043_partner_contracts.sql` creates ten additive tables, indexes and immutable evidence/activation triggers. Existing account, application, commission and payout rows are not rewritten. Railway predeploy includes 0043 in its existing transactional migration sequence. Test repeat execution and rollback against a restored staging copy before authorized rollout; hold a managed database backup and deployment checkpoint.

Rollback disables sending/worker flags, cancels incomplete provider requests as separately authorized, and rolls back application code while retaining all contract tables, documents, keys and audit evidence. Do not drop evidence, remove execution guards or convert executed contracts to drafts. The database activation guard intentionally continues to block unsigned new activations after an application rollback. Recovery requires the corrected contract-aware app or an owner/counsel-approved operational plan; a rollback must not create an unsigned activation bypass.

## Test deployment

The existing beta → dist-test GitHub Actions path supports test deployment without local Railway CLI authentication. Its contract validation bundle forces signing/worker controls off and reports its source revision through health-response headers. This build verifies deployment and anonymous access boundaries; actual sandbox signing requires separate environment/recipient authorization and an approved change to that test-only policy. See [test deployment controls](RAILWAY_DEPLOYMENT.md#test-only-github-actions-deployment).

## Validation

- `pnpm validate:types`
- `pnpm test:partners` (public applications, existing financial rules, packaging, contract unit/security cases)
- `pnpm test:partners:integration` (42 legacy partner checks plus contract lifecycle/security fixture groups)
- `pnpm lint:secrets`, `pnpm lint:todos`, `pnpm lint:project-records`, `pnpm lint:package`, `pnpm docs:check`, `pnpm validate:dist`
- `node scripts/partners/run-safe-build.mjs` (isolated production build and deployment packaging without workspace secrets; `USECLEVR_SAFE_BUILD_DIRECTORY` selects a writable disk directory when temporary storage is constrained)

Integration runners accept no configurable production database. They use only the disposable loopback PostgreSQL container on port 55438 and unique empty schemas; signature/email calls in contract tests are intercepted. The live-adapter fixture exercises real serialization, validation and activation code with synthetic responses, not a real provider account. The older financial suite seeds legacy active fixtures after asserting API activation is denied, to isolate existing commission behavior; the contract suite verifies the successful executed-agreement gate under migration 0043. Never run financial fixtures against production.

## Production activation checklist

1. Owner and qualified counsel resolve entity, commercial, jurisdiction, consent, privacy and signature-assurance decisions; explicitly approve exact template and per-partner schedule versions with review references.
2. Owner approves provider/plan, spend cap, processing agreement, transfers/residency, retention/holds, authorized company signer and final account/application configuration. Provision secrets through the secret manager. No credentials are assumed by this PR.
3. Validate sandbox hosted signing, appended provider audit PDF, webhook authentication/replay, failure recovery and verified email deliveries using authorized recipients. Mock simulation is insufficient for this provider acceptance.
4. Back up and restore-test the database and encryption keys; rehearse repeatable migration and rollback in staging. Confirm that pausing new activations during setup is acceptable.
5. Obtain explicit owner authorization to merge/deploy signing. Deploy backend/migration before any landing changes; keep sending/worker flags off while checking administrative and existing partner behavior.
6. Enable contract management in draft/test mode, review generated documents, authenticate download controls and verify the signer identity/authority. Approve the reviewed live runtime fingerprint only after sandbox acceptance.
7. Enable binding sends and the worker only after the recorded approvals. Run one owner-authorized controlled production agreement through both actual provider signatures, private archive, evidence and PDF delivery. Verify that the account is still pending.
8. Separately review and explicitly authorize final commercial activation for that partner. Confirm no synthetic commissions or payouts exist. Monitor durable jobs, delivery failures, provider quota, key backups and audit retention.
