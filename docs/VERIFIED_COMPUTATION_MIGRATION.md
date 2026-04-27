# Verified Computation Layer - Migration Guide

## Overview

This document provides step-by-step instructions for migrating existing datasets to use the new verified computation layer. The migration is designed to be **non-breaking** and **incremental**.

---

## Migration Phases

### Phase 1: Deploy New Components (Non-Breaking)

The following new components have been added without modifying existing functionality:

| Component | Location | Purpose |
|-----------|----------|---------|
| Query Engine | [`lib/queryEngine.ts`](lib/queryEngine.ts) | Core computation engine |
| Query Intent Prompts | [`lib/queryIntentPrompt.ts`](lib/queryIntentPrompt.ts) | LLM prompt templates |
| Query API Route | [`app/api/query/route.ts`](app/api/query/route.ts) | New API endpoint |
| Chat Route Integration | [`app/api/chat/route.ts`](app/api/chat/route.ts) | Updated with verified computation |

**Action Required:**
1. Deploy the new code to your environment
2. Verify the new `/api/query` endpoint is accessible
3. Test with a sample dataset

### Phase 2: Enable Verified Computation

The chat route now automatically detects computational questions and routes them through the verified computation layer.

**How it works:**
1. User asks a question (e.g., "How many currencies do we have?")
2. System detects it requires computation via `requiresComputation()`
3. LLM generates structured query intent JSON
4. Query Engine validates and executes the query
5. Verified result is passed back to LLM for explanation
6. LLM generates explanation text only (no computation)

**Action Required:**
1. Monitor logs for `[QueryEngine]` entries
2. Verify computational questions are being routed correctly
3. Check that responses include `verified: true` flag

### Phase 3: Schema Enhancement (Optional)

For improved performance on large datasets, consider adding a computed cache:

```sql
-- Add computed cache column (optional)
ALTER TABLE "Dataset" ADD COLUMN "computedCache" JSONB DEFAULT '{}';
ALTER TABLE "Dataset" ADD COLUMN "schemaVersion" INTEGER DEFAULT 1;
```

**Benefits:**
- Caches frequently computed values
- Reduces query execution time
- Enables pre-computation during upload

### Phase 4: Performance Optimization

For datasets with >10,000 rows:

1. **Add Indexes:**
   ```sql
   CREATE INDEX idx_dataset_user_id ON "Dataset"("userId");
   CREATE INDEX idx_dataset_created ON "Dataset"("createdAt");
   ```

2. **Enable Query Caching:**
   - Implement Redis caching for query results
   - Cache TTL: 5 minutes for dynamic data, 1 hour for static data

3. **Query Timeout Configuration:**
   - Default: 30 seconds
   - Adjustable via `QUERY_TIMEOUT_MS` in queryEngine.ts

---

## Testing the Migration

### Test Case 1: Count Distinct

**Request:**
```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "datasetId": "your-dataset-id",
    "question": "How many unique countries are in the dataset?"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "result": {
    "success": true,
    "computed_value": 12,
    "column": "Country",
    "operation": "count_distinct",
    "row_count": 1000,
    "execution_time_ms": 5
  },
  "explanation": "The dataset contains 12 unique countries based on the Country column."
}
```

### Test Case 2: Sum Aggregation

**Request:**
```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "datasetId": "your-dataset-id",
    "question": "What is the total revenue?"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "result": {
    "success": true,
    "computed_value": 1234567.89,
    "column": "Revenue_USD",
    "operation": "sum",
    "row_count": 1000,
    "execution_time_ms": 8
  },
  "explanation": "The total revenue is $1,234,567.89."
}
```

### Test Case 3: Group By

**Request:**
```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "datasetId": "your-dataset-id",
    "question": "Show revenue by country"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "result": {
    "success": true,
    "computed_value": [
      { "name": "USA", "value": 500000 },
      { "name": "Germany", "value": 300000 },
      { "name": "UK", "value": 200000 }
    ],
    "column": "Revenue_USD",
    "operation": "group_by",
    "row_count": 1000,
    "execution_time_ms": 15
  },
  "explanation": "Revenue breakdown by country: USA leads with $500,000, followed by Germany at $300,000, and UK at $200,000."
}
```

---

## Rollback Plan

If issues arise, the verified computation layer can be disabled by:

1. **Quick Disable:** Set environment variable `DISABLE_VERIFIED_COMPUTATION=true`
2. **Code Rollback:** Revert to previous version of `app/api/chat/route.ts`
3. **Fallback:** The system automatically falls back to the original chat flow if query execution fails

---

## Monitoring

### Key Metrics to Track

| Metric | Description | Target |
|--------|-------------|--------|
| `query_execution_time_ms` | Time to execute verified query | <100ms |
| `llm_intent_generation_ms` | Time for LLM to generate query intent | <2000ms |
| `verified_response_rate` | % of computational questions using verified layer | >90% |
| `fallback_rate` | % of queries falling back to original flow | <5% |
| `error_rate` | % of queries resulting in error | <1% |

### Log Entries to Monitor

```
[QueryEngine] Starting pipeline for dataset: <dataset_id>
[QueryEngine] Schema loaded: <n> columns
[QueryEngine] Validation passed, executing query...
[QueryEngine] Query completed: success=true, operation=count_distinct
[CHAT] Question requires verified computation
[CHAT] Executing verified query: count_distinct
```

---

## Troubleshooting

### Issue: "Dataset not found"

**Cause:** Dataset ID is invalid or dataset was deleted.

**Solution:** Verify the dataset ID exists in the database.

### Issue: "Column not found"

**Cause:** LLM generated a column name that doesn't match the schema.

**Solution:** The system will attempt pattern matching fallback. If that fails, rephrase the question using exact column names.

### Issue: "Column not numeric"

**Cause:** User requested sum/avg on a text column.

**Solution:** The LLM should detect this and suggest alternative operations. Rephrase the question to use a numeric column.

### Issue: Query timeout

**Cause:** Dataset is too large or query is too complex.

**Solution:** 
1. Increase `QUERY_TIMEOUT_MS` in queryEngine.ts
2. Consider implementing pagination for large datasets
3. Pre-compute values during upload for very large datasets

---

## Support

For issues or questions:
1. Check the logs for `[QueryEngine]` and `[CHAT]` entries
2. Review the architecture documentation in [`plans/verified-computation-layer.md`](plans/verified-computation-layer.md)
3. Contact the development team with the dataset ID and question that caused the issue