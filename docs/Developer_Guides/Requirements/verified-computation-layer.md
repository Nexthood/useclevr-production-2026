# Verified Computation Layer Requirements

Goal: prevent AI from inventing numbers by routing numeric questions through validated computation.

## Current Files

| Area | File |
| --- | --- |
| DB schema | [`../../../lib/db/schema.ts`](../../../lib/db/schema.ts) |
| Chat route | [`../../../app/api/chat/route.ts`](../../../app/api/chat/route.ts) |
| Upload route | [`../../../app/api/upload/route.ts`](../../../app/api/upload/route.ts) |
| CSV analyzer | [`../../../lib/csv-analyzer.ts`](../../../lib/csv-analyzer.ts) |
| Query engine | [`../../../lib/queryEngine.ts`](../../../lib/queryEngine.ts) |
| Query API | [`../../../app/api/query/route.ts`](../../../app/api/query/route.ts) |

## Required Behavior

| Requirement | Detail |
| --- | --- |
| Intent generation | AI may generate structured query intent only. |
| Operation whitelist | Only approved operations can execute. |
| Column validation | Columns must exist in stored schema. |
| Type validation | Numeric operations require numeric columns. |
| Safe execution | Query execution must avoid arbitrary SQL. |
| Provenance | Responses should include operation, column, row count, and timing. |
| Explanation | AI explains computed result without changing values. |

## Operations

| Operation | Validation |
| --- | --- |
| `count` | Dataset exists and user can access it. |
| `count_distinct` | Column exists. |
| `sum` | Column exists and is numeric. |
| `avg` | Column exists and is numeric. |
| `min` | Column exists and is numeric/date-compatible. |
| `max` | Column exists and is numeric/date-compatible. |
| `group_by` | Group and metric columns exist; metric is valid. |
| `top_n` | Column exists; limit is bounded. |

## API Contract

Endpoint:

```text
POST /api/query
```

Request:

```json
{
  "datasetId": "string",
  "question": "string"
}
```

Response should include:

```json
{
  "success": true,
  "result": {
    "computed_value": 123,
    "operation": "sum",
    "column": "Revenue",
    "row_count": 1000,
    "execution_time_ms": 10
  },
  "explanation": "string"
}
```

## Tests

- count rows
- count distinct
- sum numeric column
- average numeric column
- group by category
- reject unknown column
- reject numeric operation on text
- reject unauthorized dataset access

## Related

- [Deterministic pipeline](../Architecture/DETERMINISTIC_PIPELINE.md)
- [Verified computation operations](../Architecture/VERIFIED_COMPUTATION_OPERATIONS.md)
