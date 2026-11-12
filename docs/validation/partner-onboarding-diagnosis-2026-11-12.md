# Partner onboarding diagnosis and correction — 2026-11-12

## Confirmed defects and production status

At reviewed source revision 636585cb, unknown tokens, unapproved applications, expiry and email mismatch share one error. The lookup excludes used records and completion clears the hash, preventing reliable replay classification. The signed-in form provides no account-switching recovery. The correction replaces these confirmed behaviors with the distinct errors and recovery flow below; regression tests verify the result.

The specific predicate rejecting the affected production invitation remains unconfirmed. The operator reports a newly approved, delivered invitation within seven days; production database state and the authenticated user's verified email have not been inspected. Do not claim the production incident resolved from local tests.

## Lifecycle and database behavior

1. Public submission validates input, normalizes application email, and persists the application, audit and mail queue.
2. Superadmin approval atomically generates 32 random bytes encoded as base64url, persists their SHA-256 hash, sets approved status and a seven-day expiry, and queues the token in an encrypted mail payload.
3. Delivery decrypts the payload and emails an encoded onboarding URL. The email explains that an account with the same verified email is required. Mail origin uses AUTH_URL, then NEXT_PUBLIC_APP_URL, then the production default.
4. Anonymous onboarding offers a fixed same-origin login URL carrying the invitation return path. Metadata suppresses referrer transmission. No anonymous invitation lookup occurs.
5. The POST route requires a session, valid write origin, well-formed input and explicit acceptance. It reads email and verification from the database user identified by the authenticated session ID, rather than trusting session email claims.
6. Only then does it retrieve the hash, compare the verified email, and classify invitation use, approval and expiry. It uses the same validation again under the application advisory lock, including a repeat hash comparison.
7. Completion links the user and pending partner account, writes use/onboarding timestamps and an audit record, and retains only the one-way hash for accurate replay rejection. Commercial activation and contract signing remain separate.

Submission, approval, mail delivery and onboarding share getDb(). Runtime prefers DATABASE_URL and falls back to DIRECT_URL. Predeploy prefers DIRECT_URL and falls back to DATABASE_URL. Different variables can represent pooled/direct aliases of one database; the precedence difference does not prove a defect. No connection selection or deployment configuration is changed.

## Safe error contract

| Outcome                     | HTTP | Condition and recovery                                                                                                                |
| --------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------- |
| authentication_required     | 401  | Sign in; the same response applies regardless of invitation existence.                                                                |
| email_verification_required | 403  | Verify email through sign-in; no invitation lookup or state disclosure occurs.                                                        |
| incorrect_account           | 403  | The verified database email differs; explicitly sign out and sign in with the invited account. No recipient address is returned.      |
| expired_invitation          | 410  | A matching, unused approved invitation is at or beyond its expiry; request a new invitation.                                          |
| used_invitation             | 409  | A matching invitation has a use or onboarding timestamp; reject replay, including concurrent completion.                              |
| invalid_invitation          | 403  | Unknown hash, changed hash under lock, unapproved state or missing expiry; use the complete email link or contact the partner team.   |
| onboarding_unavailable      | 503  | Database lookup or completion fails; retry or contact the partner team. Log only error type, never token, query or connection string. |

Authentication and verification precede state disclosure. Invalid input and write-origin errors remain separate. Error responses use no-store. Recovery links preserve the invitation through same-origin authentication; account switching uses Auth.js sign-out and CSRF handling.

Previously used invitations whose hashes are already cleared remain invalid: their tokens cannot safely be associated with records. The implementation does not reconstruct or backfill existing records. New completions retain the irreversible hash and remain unusable because both use/onboarding timestamps are checked before completion and again inside the transaction.

## Production evidence and remaining checks

The earlier source revision 107e5c66 publishes successfully through Actions run 43248673453 to distribution commit d27937f62b8287808e5dbcac7f56f0e782ca3ecc. Its GitHub Railway integration status reports a successful useclevr app deployment. PR 421 merges the baseline regression coverage; this correction starts from merged source 636585cb. Publisher/deployment success does not verify invitation state or runtime database identity.

Railway CLI still reports Unauthorized, and no connected Railway tools are available. Retrying the project wrapper through the existing application environment loader also finds no Railway token. Authorized read-only connection attempts through both locally configured DATABASE_URL and DIRECT_URL fail with PostgreSQL code 28P01; no schema or invitation rows can be read. These are local configuration findings, not proof of deployed Railway database configuration. The affected application ID and an authorized matching verified test identity are not supplied. No database diagnostic SQL completes and no production mutation is executed. Existing production records, service IDs, environments, workflows and signing configuration remain unchanged.

The operator must provide approved read-only runtime access and the affected application reference. Inspect status, invitation expiry/use/onboarding state, mail delivery result, token-hash match and verified-email match privately, returning only diagnostic booleans/codes and no raw tokens or recipient details. Compare authoritative runtime/migration database identities on the deployed approval and onboarding services; neither hostname equality nor database-name equality alone proves backend identity.

Migration 0042 owns invitation columns and its unique hash index. Migration 0043 adds contracts; its absence normally causes a database/completion failure rather than the old invitation eligibility message. Both are present in predeploy source. Hosted application of either migration remains unverified; do not run migrations to diagnose this incident.

After review and deployment through the existing GitHub Actions to Railway flow, perform a hosted browser test with a dedicated approved invitation: sign in with its verified account, complete onboarding, confirm the application/account link and pending partner state, and confirm replay rejection. Also verify wrong-account recovery without enabling signing or changing existing partner records. Until that passes, production acceptance remains open.

## Validation

- Unit regressions: distinct invitation outcomes, changed/missing hash, status, missing expiry, exclusive expiry boundary, completed-state defense, email case matching and fixed same-origin callback.
- PostgreSQL integration: actual submission, approval, intercepted email, persisted hash, anonymous page/login callback, auth redirect resolver, verified identity, invitation rejection cases, used and legacy-used behavior, pending account completion, concurrent single-use completion, and simulated lookup failure classification. DATABASE_URL targets a private disposable schema while DIRECT_URL points to a different unreachable loopback target.
- Browser regressions: actual onboarding component and Auth.js client recovery with synthetic HTTP responses for account mismatch, verification and expired session; all preserve the invitation through login. Success keeps commercial activation separate.
- Production-equivalent persistence uses PostgreSQL 17, real Drizzle queries and transactions. Auth-provider sign-in and external mail/contract calls are mocked. These checks are not hosted end-to-end acceptance.
- Passed: partner unit suite (19 rule checks, eight contract groups and invitation-domain regressions), 42 partner PostgreSQL checks, 14 contract integration groups, and all 13 browser acceptance groups.
- Passed: authentication redirect tests, standalone type checking, deployment configuration validation, focused source ESLint, TODO validation, report Markdown lint and secret scanning. Focused source ESLint reports no warnings or errors.
- Full production build and distribution packaging: pass, including final TypeScript validation and all 100 static pages. Compilation reports warnings and the deliberately unreachable local database emits an expected connection-refused log. The isolated build uses synthetic credentials and disabled signing.
- Local commands use pnpm with verify-deps-before-run disabled to reuse the private dependency copy. No production fix is claimed while hosted acceptance remains open.

## Files modified

- Runtime: `src/lib/partners/onboarding.ts`, `src/app/api/partner-applications/onboard/route.ts`, `src/components/partners/partner-onboarding.tsx`, `src/app/(public)/partners/onboard/page.tsx`, and `src/lib/partners/public-applications.ts`.
- Regression coverage: `scripts/partners/test-public-applications.ts`, `scripts/partners/test-integration.ts`, `scripts/partners/browser-fixture.tsx`, and `scripts/partners/test-browser.mjs`.
- Requirements and evidence: `requirements.md`, `CHANGELOG.md`, `.TODO/todo-next.md`, this report, `project-logs/activity-log.md`, `project-logs/interactive-log.md`, and `docs/AI-interaction/interaction-status.md`.
