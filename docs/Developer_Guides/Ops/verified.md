# Verified Computation Operations

Operates and verifies the code path where deterministic logic computes numbers and AI explains them.

## Files

| Area | File |
| --- | --- |
| Query engine | `lib/queryEngine.ts` |
| Query prompt | `lib/queryIntentPrompt.ts` |
| Query API | `app/api/query/route.ts` |
| Chat route | `app/api/chat/route.ts` |
| Requirements | ../Setup/SETUP.md#verified-computation-layer |

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
