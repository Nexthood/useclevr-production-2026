# Production partner onboarding diagnosis — 2026-11-12

## Result

The production root cause is unconfirmed. The production incident remains open. Local PostgreSQL invitation regressions pass against source revision `107e5c66a7910f1ea4b4812bcee25d5671e85f33`. No runtime correction is justified by the available evidence.

## Verified lifecycle

| Stage                  | Source behavior                                                                                                                                                                                                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public submission      | The public application endpoint validates and normalizes application email to lowercase, persists the application, audit and email queue, and sends receipts.                                                                                                                            |
| Administrator approval | The administrator endpoint uses a transaction to change a pending/reviewed application to approved, generate a 32-byte random base64url token, store its SHA-256 hex hash with a seven-day expiry and unused state, and queue the token in an encrypted email payload.                   |
| Delivery               | The email worker decrypts the queued payload and builds the onboarding URL from AUTH_URL, then NEXT_PUBLIC_APP_URL, then the production default. The token is carried as a URL-encoded query parameter.                                                                                  |
| Authentication         | The onboarding page preserves the invitation in the login callback. The POST endpoint requires a session, valid write origin, token length and explicit acceptance.                                                                                                                      |
| Verified identity      | The endpoint retrieves the user by the authenticated session user ID and checks the database email and emailVerified value. Session email claims cannot substitute for verified database identity.                                                                                       |
| Invitation retrieval   | The endpoint queries PartnerProgramApplication for the SHA-256 token hash, approved status and null invitationUsedAt, then requires a future expiry and a case-insensitive match to the verified database email.                                                                         |
| Completion             | A transaction locks the application, rechecks eligibility, creates a pending partner account if needed, links the user/account, records onboarding and use timestamps, clears the hash, writes an audit record, and optionally queues contract preparation. Activation remains separate. |

Source files: `src/app/api/partner-applications/route.ts`, `src/app/api/admin/partner-applications/route.ts`, `src/lib/partners/public-applications.ts`, `src/app/(public)/partners/onboard/page.tsx`, `src/app/api/partner-applications/onboard/route.ts`.

## Error interpretation

The reported message is returned by the initial invitation eligibility check. It indicates no matching approved/unused hash, missing/past expiry, or a mismatch with the authenticated user's database email. The message deliberately does not reveal which condition failed.

An absent session returns 401. An unverified or absent database user email returns a separate verification error. Transaction/contract-preparation failures return a separate 503 completion error. A missing table or column would normally throw a database error rather than produce the reported invitation rejection. These distinctions identify the source branch of failure; they do not prove the deployed revision or the failed production predicate.

## Database consistency

- Application submission, approval, delivery and onboarding all import the shared `getDb()` client. Runtime prefers DATABASE_URL and falls back to DIRECT_URL.
- Railway predeploy prefers DIRECT_URL and falls back to DATABASE_URL. Different variables can legitimately represent pooled/direct connections to one database; the precedence difference alone does not prove a configuration defect.
- The regression sets DATABASE_URL to the disposable PostgreSQL schema and DIRECT_URL to an unreachable, different loopback target. It verifies database/schema identity, persisted emailed-token hash, approval, onboarding and replay rejection through the actual APIs using that runtime database.
- No Railway runtime variables, production database identity, invitation row, authenticated production user, or private runtime logs are accessible in this session. The project wrapper reports no token; native Railway status reports Unauthorized. Do not interpret absent local access as missing production configuration. Plugin discovery also finds Railway available but not installed; a connection suggestion is pending user action.
- Operators must compare authoritative Railway/provider database identities for the deployed approval service, onboarding service and migration connection. Hostname equality is insufficient for pooled/direct aliases; database-name equality alone is insufficient across different servers.

## Migration and deployment evidence

Invitation columns and the unique hash index are introduced by migration 0042. Migration 0043 adds contract infrastructure. Both are referenced by Railway predeploy; this establishes source inclusion, not successful production execution.

Migration 0043 source SHA-256: `3d70dc4a6cd7d3cb21b86d732dc8dd193d7f02347988be4f81341d1fcd372d75`.

GitHub Actions run 43248673453 successfully publishes source `107e5c66` to distribution commit `d27937f62b8287808e5dbcac7f56f0e782ca3ecc`. The GitHub commit status `useclevr-web - useclevr app` reports success for that distribution commit and points to the existing production service and environment. This confirms the integration-reported deployment result, not runtime database identity or end-to-end acceptance.

The deployment architecture remains GitHub Actions to Railway: dist-test to useclevr TEST, dist to useclevr app, within the existing production environment. This investigation changes no workflows, environment, service ID, deployment branch or production signing configuration.

## Unverified hypotheses and required evidence

| Hypothesis                                        | Evidence needed                                                                                                                                                                                                                        |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wrong/old invitation or encrypted payload failure | Compare the failed link's locally computed SHA-256 to the approved application's stored hash inside an authorized diagnostic; disclose only the comparison boolean. Check delivery status/error code without logging payloads or URLs. |
| Expiry, reuse or status change                    | Read the affected application's status, expiry, use timestamp, onboarding state and audit actions.                                                                                                                                     |
| Wrong authenticated account/email                 | Read authenticated user ID from the authorized request context; compare its verified database email to application email and recipient inside the diagnostic, returning only match/verification booleans.                              |
| Database or service mismatch                      | Compare deployed Railway service/revision and authoritative runtime/migration database identities for both approval and onboarding.                                                                                                    |
| Missing 0042 or 0043 schema                       | Read information_schema and relevant index/trigger metadata on the actual runtime and migration databases; inspect sanitized predeploy error codes. Do not run migrations as a diagnostic.                                             |

No hypothesis above is a confirmed cause. Do not reset invitations, change email matching, alter databases, or disable verification based only on the generic error.

## Validation and acceptance

The new regression exercises valid and missing invitations, altered token, expired invitation, retained-hash used invitation, actual replay after hash clearing, wrong approval state, unauthenticated/unverified users, wrong origin, wrong verified database email despite a matching session email claim, and correct verified email with case differences. It asserts rejected requests leave onboarding fields and partner-account creation untouched.

The existing partner suite covers commercial activation restrictions and financial/audit security. Contract integration exercises additive 0043 migration, repeatability, rollback and existing record preservation using disposable fixtures and intercepted provider calls.

Production acceptance requires an owner-authorized test invitation and matching verified account on the deployed revision. Complete onboarding through the hosted UI, confirm pending partner state and the application/account link, then confirm reuse is rejected. Use dedicated test records; do not modify existing production partner records or enable signing. Local tests do not satisfy this acceptance criterion.

## Executed validation

- `pnpm test:partners`: pass; public application/hash validation, 19 partner rules, native packaging and eight contract unit groups.
- `pnpm test:partners:integration`: pass; new invitation regressions plus 42 partner PostgreSQL checks and 14 contract integration groups.
- `pnpm test:auth`: pass; authentication redirect origin checks.
- `pnpm validate:types`: pass.
- `pnpm validate:dist`: pass; Railway configuration valid and Vercel template synchronized.
- `pnpm lint:todos` and `pnpm lint:secrets`: pass.
- `pnpm prod:build`: pass, including standalone distribution packaging. The sandbox attempt cannot fetch Google Fonts and is stopped; the network-enabled retry completes. Compilation reports warnings and the synthetic loopback database emits an expected connection-refused log. Build configuration uses synthetic secrets, unreachable loopback databases and disabled partner contracts/signing.

Commands use `--config.verify-deps-before-run=false` with a private copy of the existing dependency installation, avoiding pnpm automatically purging or reinstalling the shared workspace dependencies. Integration connections require the executor's loopback network permission. The PostgreSQL 17 fixture is local, disposable, and accepts no production target. Auth-provider calls are mocked by the existing integration hook; route guards, database verification and persistence execute the actual application code. These tests do not perform a hosted browser sign-in.

- Focused ESLint: zero errors and seven console warnings in the integration runner. Report Markdown lint/format and `git diff --check` pass.

## Files modified

- `scripts/partners/test-integration.ts`: invitation and runtime database consistency regressions.
- `docs/validation/partner-onboarding-diagnosis-2026-11-12.md`: diagnosis, evidence, validation and remaining acceptance work.
- `CHANGELOG.md`: developer test-coverage entry.
- `.TODO/config.json` and `.TODO/todo-next.md`: active investigation T-1107.
- `project-logs/activity-log.md`, `project-logs/interactive-log.md`, and `docs/AI-interaction/interaction-status.md`: required project interaction records.
