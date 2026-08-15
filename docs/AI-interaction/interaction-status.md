# AI Interaction Status

Update this file after every completed AI interaction.

## Current Interaction

- **Date**: 2026-08-15
- **Goal**: Trace the exact Retail Average Order Value denominator source for `01_local_retail.xlsx`, prove the PDF runtime path, and remove remaining row-count AOV fallback behavior.
- **Durable change**: Retail report replay invalidates pre-AOV-semantics generated reports by using a new report runtime version, and dataset chat AOV refuses missing reliable order identifiers instead of using row count. Current PDF generation keeps AOV unavailable when no approved order identifier exists.
- **Verification**: `pnpm exec node -r tsx/esm scripts/analysis/test-dataset-aware-report-profiles.ts` passes with the 180-row retail PDF rejecting `$443`; `pnpm exec node -r tsx/esm scripts/analysis/test-question-intent-metric-resolver.ts` passes with no-order AOV unsupported; `pnpm validate:types` passes.
- **Detailed record**: [Interactive log](../../project-logs/interactive-log.md)
- **Activity summary**: [Activity log](../../project-logs/activity-log.md)
