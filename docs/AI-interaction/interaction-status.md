# AI Interaction Status

Update this file after every completed AI interaction.

## Current Interaction

- **Date**: 2026-09-04
- **Goal**: Correct Investor Portfolio Balanced Scorecard growth semantics without changing working Investor report, Assistant, classification, or KPI behavior.
- **Durable change**: Investor Portfolio scorecards treat `growth_rate` as cross-sectional portfolio-company growth evidence, keep `investment_date` out of generic date-axis detection, preserve investment activity timing elsewhere, and avoid historical growth, revenue, burn, runway, or valuation trends unless a compatible reporting or observation period exists.
- **Verification**: `pnpm test:bbsc`, `pnpm exec tsx scripts/analysis/test-investor-questions.ts`, `pnpm test:investor-portfolio-aggregation`, `pnpm exec tsc --noEmit --pretty false`, `pnpm test:dataset-aware-report-profiles`, `pnpm test:business-semantics`, `pnpm test:question-intent-metric-resolver`, `pnpm test:dataset-ai-assistant`, focused ESLint with ignored script warnings suppressed, and regenerated Investor PDF text inspection pass.
- **Residual risk**: The workspace does not include a raw `05_investor_portfolio` fixture file, so focused chat validation uses the existing synthetic 45-row Investor fixture with the verified `126,384,909.53` annual revenue total.
- **Detailed record**: [Interactive log](../../project-logs/interactive-log.md)
- **Activity summary**: [Activity log](../../project-logs/activity-log.md)
