# Setup

## Requirements

- Node.js 22+
- pnpm 10+
- Neon PostgreSQL
- Gemini API key

## Install

```bash
pnpm install
cp .env.local.example .env.local
pnpm dev
```

## Environment

Required:

```env
DATABASE_URL=
DIRECT_URL=
AUTH_SECRET=
GEMINI_API_KEY=
```

Optional:

| Variable | Purpose |
| --- | --- |
| `PORT` | Local dev port. |
| `AUTH_URL` | Auth URL override when host inference fails. |
| `LOCAL_UPLOAD_DIR` | Runtime upload path. |
| `LOCAL_UPLOAD_URL` | Runtime upload URL prefix. |
| `UPLOAD_PROVIDER` | Storage provider (`s3` or `r2`). |

## Database

Neon configuration:

| Field | Value |
| --- | --- |
| Project ID | `withered-star-79790747` |
| Branch ID | `br-crimson-sun-ai49oqj4` |
| Database | `neondb` |
| Role | `neondb_owner` |

Set `DATABASE_URL` and `DIRECT_URL` in `.env.local`.

Commands:

```bash
pnpm db:push    # Sync schema
pnpm db:migrate # Run migrations
pnpm db:studio  # Open Drizzle Studio
```

Never commit `.env`, `.env.local`, or real connection strings.

Key files:

- `lib/db/schema.ts`
- `lib/db/index.ts`
- `lib/db/migrations/`

## Production Build

```bash
pnpm prod:build  # Output: dist/server.js, dist/.next/, dist/assets/
pnpm prod:start
```

## Troubleshooting

| Issue | Check |
| --- | --- |
| AI fails | `GEMINI_API_KEY`, restart server |
| Auth fails | `AUTH_SECRET`, optional `AUTH_URL` |
| DB fails | `DATABASE_URL`, `DIRECT_URL`, Neon SSL |
| Railway fails | env vars, `/api/health`, `railway.json` |

## Verified Computation Layer

Prevents AI from inventing numbers by routing numeric questions through validated computation.

### Files

| Area | File |
| --- | --- |
| DB schema | `lib/db/schema.ts` |
| Chat route | `app/api/chat/route.ts` |
| Upload route | `app/api/upload/route.ts` |
| CSV analyzer | `lib/csv-analyzer.ts` |
| Query engine | `lib/queryEngine.ts` |
| Query API | `app/api/query/route.ts` |

### Behavior

| Requirement | Detail |
| --- | --- |
| Intent generation | AI generates structured query intent only. |
| Operation whitelist | Only approved operations execute. |
| Column validation | Columns exist in stored schema. |
| Type validation | Numeric operations require numeric columns. |
| Safe execution | Query execution avoids arbitrary SQL. |
| Provenance | Responses include operation, column, row count, and timing. |
| Explanation | AI explains computed result without changing values. |

### Operations

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

### API

**Endpoint:** `POST /api/query`

**Request:**

```json
{
  "datasetId": "string",
  "question": "string"
}
```

Response:

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

### Tests

- count rows
- count distinct
- sum numeric column
- average numeric column
- group by category
- reject unknown column
- reject numeric operation on text
- reject unauthorized dataset access

### Related

- [Verified computation operations](verified-computation.md)

## Testing & Verification

### Quick checks

```bash
pnpm build
pnpm exec tsc --noEmit
pnpm db:studio
curl http://localhost:3000/api/health
```

### Smoke tests

1. Run `pnpm dev`.
2. Open the public home page.
3. Sign in or create a test account.
4. Upload a sample CSV.
5. Confirm dashboard KPIs and charts render.
6. Ask a dataset question in the assistant.
7. Generate or download a report.

### Verified computation checks

See [verified-computation.md](verified-computation.md) for query tests.

### Deployment checks

1. Confirm Railway environment variables are set.
2. Confirm `/api/health` responds after deployment.
3. Confirm the app binds to Railway `$PORT`.
4. Review Railway logs for build or runtime errors.

Full deployment guide: [deployment-guide.md](deployment-guide.md)
