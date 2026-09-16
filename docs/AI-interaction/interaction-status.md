# AI Interaction Status

Update this file after every completed AI interaction.

## Current Interaction

- **Date**: 2026-09-16
- **Goal**: Find the root cause of the production Pro profile with a persisted 0-credit account and 402 upload failures, fix it minimally and self-healing, and record the Google ClevrSync OAuth redirect issue separately.
- **Durable change**: The Railway predeploy registers migrations 0030-0032 and runs `0032_widen_credit_ledger_transaction_type.sql`, which replaces the legacy `CreditLedger_transactionType_check` (16 lowercase transaction types created by `0012`) with a widened check that accepts every transaction type the credit engine writes; both 0012 and 0032 add the constraint `NOT VALID` so legacy rows cannot fail the predeploy. `initializeUserCredits` reconciles existing accounts (plan mismatch through `processPlanChange`, never-used zeroed accounts to the full plan grant) instead of returning the broken state unchanged, idempotently through the `grant:initial` ledger key, and `ensureSubscriptionPlanSeeded` verifies the plan row exists after seeding. Plan-limit fallback reporting in `getAnalystCreditUsage` and the sidebar account sync log their failures. Google ClevrSync OAuth consent redirecting to `0.0.0.0:8080` is recorded as `.TODO` task T-1058.
- **Verification**: `pnpm test:pro-credit-selfheal` (10 behavioral and contract checks against the configured database), `pnpm test:upload-credit-reservation` (8 checks), `test-subscription-lifecycle` life cycle passes, `pnpm exec tsc --noEmit` exits clean, `pnpm lint:secrets` passes, `pnpm validate:dist` passes, and `pnpm lint:todos` validates 23 queued tasks. The behavioral test reproduced the production constraint violation on the development database before the widening and passes after applying 0032.
- **Residual risk**: Production verification requires the next Railway deploy: predeploy must apply 0012/0032, and one Pro upload must show the `[CREDIT_ENGINE]` grant and a successful reservation instead of `UPLOAD_CREDITS_EXHAUSTED`.
- **Detailed record**: [Interactive log](../../project-logs/interactive-log.md)
- **Activity summary**: [Activity log](../../project-logs/activity-log.md)
