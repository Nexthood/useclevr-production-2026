# MCP Developer Guide

UseClevr exposes a small authenticated MCP interface for trusted dataset analysis tools and resources. The interface gives internal clients a consistent way to list available tools, read cached analysis resources, and invoke deterministic analysis helpers.

## File Structure

```
src/lib/mcp/
├── tools.ts       # Zod schemas and tool definitions
├── handlers.ts    # Deterministic metric handlers
├── resources.ts   # Dataset resource URIs
├── server.ts      # Tool invocation endpoint
└── integration.ts # Helper for external tool registration
```

## Access Model

Use the same visibility rules as the dashboard:

- Public FAQ content is readable without exposing private account data.
- Authenticated users can access their own dashboard pages, datasets, reports, tickets, settings, and business profile data.
- Superadmin users can access operator-wide dashboard views and customer administration data.
- MCP responses must never include another user's private data for a standard authenticated user.
- Tool inputs must be validated before execution.

## API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/mcp` | List available tools; add `datasetId` for resources |
| GET | `/api/mcp?resource=dataset://...` | Read one MCP resource |
| POST | `/api/mcp` | Invoke a named MCP tool |

### POST Request Body

```json
{
  "name": "getPrecomputedKpis",
  "input": {
    "datasetId": "dataset-id"
  }
}
```

## Available Tools

| Tool | Description | Input Schema |
|------|-------------|------------|
| `getDatasetSchema` | Dataset structure with columns, types, business field mappings | `datasetId: string` |
| `getPrecomputedKpis` | KPI values: revenue, expenses, profit, margin, top performers | `datasetId: string` |
| `getTopRegions` | Ranked region/country data with totals and shares | `datasetId, metric, limit` |
| `getRevenueTrends` | Revenue-over-time data with trend metadata | `datasetId, dateGrain, metric` |
| `getProfitabilitySummary` | Profitability analysis with breakdowns | `datasetId: string` |

## Available Resources

Resource URIs use the format `dataset://<datasetId>/<resource>`:

| URI | Description |
|-----|-------------|
| `dataset://<id>/schema` | Column names, types, business field mappings |
| `dataset://<id>/kpis` | Precomputed KPI values |
| `dataset://<id>/top-regions` | Ranked region data |
| `dataset://<id>/revenue-trends` | Time-series revenue data |
| `dataset://<id>/profitability` | Full profitability breakdown |

## Implementation Rules

- Keep MCP handlers deterministic and read-only.
- Keep raw dataset rows out of MCP responses unless a future access-controlled tool explicitly requires them.
- Check ownership before adding MCP tools that load database-backed user records.
- Scope standard users to their own records.
- Scope superadmin users to operator-wide records only when the feature is explicitly administrative.
- Keep public FAQ data separate from authenticated user data.
- Return clear errors for invalid JSON, unknown tools, invalid resources, missing analysis cache, and unauthorized access.

## Cache Integration

Analysis results are cached via `setAnalysisCache` from `handlers.ts`. MCP tools read from this in-memory cache populated after dataset analysis completes.
