# MCP Developer Guide

UseClevr exposes a small authenticated MCP interface for trusted dataset analysis tools and resources. The interface gives internal clients a consistent way to list available tools, read cached analysis resources, and invoke deterministic analysis helpers.

## Access Model

Use the same visibility rules as the dashboard:

- Public FAQ content is readable without exposing private account data.
- Authenticated users can access their own dashboard pages, datasets, reports, tickets, settings, and business profile data.
- Superadmin users can access operator-wide dashboard views and customer administration data.
- MCP responses must never include another user's private data for a standard authenticated user.
- Tool inputs must be validated before execution.

## App Route

`GET /api/mcp`

Returns the available tool list. Add `datasetId` to include resources for a cached dataset analysis.

`GET /api/mcp?resource=dataset://<datasetId>/<resource>`

Returns one MCP resource when the resource URI is valid and the caller has access to it.

`POST /api/mcp`

Invokes a named MCP tool.

```json
{
  "name": "getPrecomputedKpis",
  "input": {
    "datasetId": "dataset-id"
  }
}
```

## Tool Contract

Current tools read from cached deterministic analysis output:

- `getDatasetSchema`
- `getPrecomputedKpis`
- `getTopRegions`
- `getRevenueTrends`
- `getProfitabilitySummary`

Tools return computed metrics from the analysis cache. They do not read raw uploaded files, recalculate business totals, or generate AI estimates.

## Resource Contract

Current dataset resources use `dataset://<datasetId>/<resource>` URIs:

- `schema`
- `kpis`
- `top-regions`
- `revenue-trends`
- `profitability`

Resources return JSON only. Missing cached analysis returns an error or an empty resource list.

## Implementation Rules

- Keep MCP handlers deterministic and read-only.
- Keep raw dataset rows out of MCP responses unless a future access-controlled tool explicitly requires them.
- Check ownership before adding MCP tools that load database-backed user records.
- Scope standard users to their own records.
- Scope superadmin users to operator-wide records only when the feature is explicitly administrative.
- Keep public FAQ data separate from authenticated user data.
- Return clear errors for invalid JSON, unknown tools, invalid resources, missing analysis cache, and unauthorized access.
