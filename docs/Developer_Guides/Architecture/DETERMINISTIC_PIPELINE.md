# Deterministic Pipeline

Purpose: compute metrics in code first, then let AI explain verified results.

## Flow

```text
CSV upload
-> parse rows
-> normalize columns
-> detect business fields
-> compute KPIs/segments/forecasts
-> store or return verified data
-> AI explains verified data
```

## Rules

| Rule | Reason |
| --- | --- |
| Compute numbers in TypeScript/query logic. | Prevent numeric hallucinations. |
| Treat AI as explanation layer. | AI should not be source of truth for metrics. |
| Keep schema/column mapping explicit. | Avoid wrong column assumptions. |
| Return provenance where possible. | Make answers auditable. |
| Fail clearly when data is missing. | Avoid fake confidence. |

## Main Files

| Area | Files |
| --- | --- |
| CSV/data analysis | `lib/csv-analyzer.ts`, `lib/dataset-analyzer.ts`, `lib/full-analysis-engine.ts` |
| Pipeline | `lib/pipeline-orchestrator.ts`, `lib/pipeline-types.ts`, `lib/pipeline/` |
| Column mapping | `lib/column-mapper.ts`, `lib/business-columns.ts`, `lib/dataset-type-detector.ts` |
| Forecasting | `lib/forecast/`, `lib/forecast.ts` |
| Query/verified computation | `lib/queryEngine.ts`, `lib/queryIntentPrompt.ts`, `app/api/query/route.ts` |
| AI explanation | `app/api/chat/route.ts`, `lib/llmAdapter.ts`, `lib/ai-*` |

## Output Expectations

- KPIs use parsed dataset rows, not AI-generated values.
- Forecasts include input columns and assumptions.
- Query answers expose operation, column, row count, and computed value.
- AI text must align with the computed result.

## Checkpoints

```bash
pnpm dev
pnpm db:studio
```

Manual checks:

- Upload a CSV.
- Confirm parsed row/column counts.
- Confirm dashboard KPIs match source data.
- Ask a numeric question through `/api/query` or chat.
- Confirm AI explanation repeats the computed value exactly.

## Related

- [Verified computation operations](VERIFIED_COMPUTATION_OPERATIONS.md)
- [Verified computation requirements](../Requirements/verified-computation-layer.md)
