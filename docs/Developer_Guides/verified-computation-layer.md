# Verified Computation Operations

Operates and verifies the code path where deterministic logic computes numbers and AI explains them.

## Deterministic Pipeline

Compute metrics in code first, then let AI explain verified results.

### Flow

```text
CSV upload
-> parse rows
-> normalize columns
-> detect business fields
-> compute KPIs/segments/forecasts
-> store or return verified data
-> AI explains verified data
```

### Rules

| Rule | Reason |
| --- | --- |
| Compute numbers in TypeScript/query logic. | Prevent numeric hallucinations. |
| Treat AI as explanation layer. | AI is not source of truth for metrics. |
| Keep schema/column mapping explicit. | Avoid wrong column assumptions. |
| Return provenance where possible. | Make answers auditable. |
| Fail clearly when data is missing. | Avoid fake confidence. |

### Main Files

| Area | Files |
| --- | --- |
| CSV/data analysis | `lib/csv-analyzer.ts`, `lib/dataset-analyzer.ts`, `lib/full-analysis-engine.ts` |
| Pipeline | `lib/pipeline-orchestrator.ts`, `lib/pipeline-types.ts`, `lib/pipeline/` |
| Column mapping | `lib/column-mapper.ts`, `lib/business-columns.ts`, `lib/dataset-type-detector.ts` |
| Forecasting | `lib/forecast/`, `lib/forecast.ts` |
| Query/verified computation | `lib/queryEngine.ts`, `lib/queryIntentPrompt.ts`, `app/api/query/route.ts` |
| AI explanation | `app/api/chat/route.ts`, `lib/llmAdapter.ts`, `lib/ai-*` |

## Outputs

- KPIs use parsed dataset rows, not AI-generated values.
- Forecasts include input columns and assumptions.
- Query answers expose operation, column, row count, and computed value.
- AI text aligns with the computed result.

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

- [Verified computation requirements](technical-requirements.md#verified-computation-layer)

## Files

| Area | File |
| --- | --- |
| Query engine | `lib/queryEngine.ts` |
| Query prompt | `lib/queryIntentPrompt.ts` |
| Query API | `app/api/query/route.ts` |
| Chat route | `app/api/chat/route.ts` |
| Requirements | technical-requirements.md#verified-computation-layer |

## Runtime Flow

```text
question
-> detect computation need
-> generate query intent
-> validate operation/columns
-> compute result
-> ask AI to explain computed result
```

## Manual Checks

```bash
pnpm dev
```

```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{"datasetId":"your-dataset-id","question":"What is the total revenue?"}'
```

Expected:

- operation is explicit
- column matches schema
- result is computed
- explanation matches result

## Logs

```
[QueryEngine]
[CHAT] Question requires verified computation
[CHAT] Executing verified query
```

## Rollback

1. Set `DISABLE_VERIFIED_COMPUTATION=true` if supported.
2. Confirm chat falls back.
3. Revert chat/query route changes if needed.

## Issues

| Issue | Check |
| --- | --- |
| Dataset not found | Dataset ID and user/workspace scope. |
| Column not found | Generated name vs stored schema. |
| Column not numeric | Use numeric column for numeric operations. |
| Timeout | Dataset size, query complexity, timeout. |
| AI changes number | Final prompt must treat computed result as source of truth. |
