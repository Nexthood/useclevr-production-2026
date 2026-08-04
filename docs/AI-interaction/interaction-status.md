# AI Interaction Status

Update this file after every completed AI interaction.

## Current Interaction

- **Date**: 2026-08-04
- **Goal**: Fix Railway predeploy failure caused by a PostgreSQL `ON CONFLICT` target without a matching uniqueness rule.
- **Durable change**: The upload-credit persistence migration ensures the Credit Ledger idempotency-key partial unique index exists and uses the matching `ON CONFLICT ("idempotencyKey") WHERE "idempotencyKey" IS NOT NULL DO NOTHING` target.
- **Verification**: Local Railway predeploy, focused Credit Engine regression tests, TypeScript, Railway config validation, TODO lint, changelog lint, and secret lint passed.
- **Detailed record**: [Interactive log](../../project-logs/interactive-log.md)
- **Activity summary**: [Activity log](../../project-logs/activity-log.md)
