# MCP Developer Guide

UseClevr exposes a small authenticated MCP interface for trusted dataset analysis tools and resources. The interface gives internal clients a consistent way to list available tools, read cached analysis resources, and invoke deterministic analysis helpers.

MCP stays internal under the app API. The product does not expose a public MCP catalog or a dedicated `mcp.useclevr.com` service.

## File Structure

```
src/lib/mcp/
├── tools.ts       # Zod schemas and tool definitions
├── handlers.ts    # Deterministic metric handlers using in-memory cache
├── resources.ts   # Dataset resource URIs (schema, kpis, top-regions, etc.)
├── server.ts      # Tool invocation endpoint
└── integration.ts # Helper for external tool registration
```

## Access Model

The MCP interface follows the dashboard visibility rules:

- Authenticated users access their own datasets, reports, tickets, settings, and business profile.
- Superadmin users can access operator-wide administration views.
- Public FAQ content stays available through `/faq`, homepage FAQ sections, and public help chat, not through MCP.

## API Routes

| Method | Endpoint                          | Description                                         |
| ------ | --------------------------------- | --------------------------------------------------- |
| GET    | `/api/mcp`                        | List available tools; add `datasetId` for resources |
| GET    | `/api/mcp?resource=dataset://...` | Read one MCP resource                               |
| POST   | `/api/mcp`                        | Invoke a named MCP tool                             |

## Routing Boundary

- Use `/api/mcp` for the current authenticated MCP interface.
- Keep MCP route discovery unavailable to unauthenticated users.
- Do not add `mcp.useclevr.com` until MCP becomes an external customer-facing service with separate auth, rate limits, logs, and service ownership.
- Keep FAQ routes separate from MCP routes.
- Do not rely on hidden URLs as security. Hidden endpoints are only an extra layer.

## Authentication Boundary

- Current MCP requests require a signed-in user session.
- Future service-to-service MCP access uses signed service tokens.
- Future internal operator MCP access uses admin-only tokens.
- Token-based access keeps the same ownership, role, logging, and rate-limit rules as session access.

## Available Tools

| Tool                      | Description                                                    | Input                              |
| ------------------------- | -------------------------------------------------------------- | ---------------------------------- |
| `getDatasetSchema`        | Dataset structure with columns, types, business field mappings | `datasetId`                        |
| `getPrecomputedKpis`      | KPI values: revenue, expenses, profit, margin, top performers  | `datasetId`                        |
| `getTopRegions`           | Ranked region/country data with totals and share percentages   | `datasetId`, `metric`, `limit`     |
| `getRevenueTrends`        | Revenue-over-time data with trend metadata                     | `datasetId`, `dateGrain`, `metric` |
| `getProfitabilitySummary` | Profitability analysis with breakdowns                         | `datasetId`                        |
| `getCostBreakdown`        | Cost categories with amounts and percentages                   | `datasetId`                        |
| `getProfitMarginTrend`    | Profit margin and growth trend analysis                        | `datasetId`                        |
| `compareDatasets`         | Compare two datasets for metric differences                    | `datasetIdA`, `datasetIdB`         |
| `getTopProducts`          | Ranked products with revenue/profit percentages                | `datasetId`, `metric`, `limit`     |

## Available Resources

Resource URIs use the format `dataset://<datasetId>/<resource>`:

| URI                             | Description                                  |
| ------------------------------- | -------------------------------------------- |
| `dataset://<id>/schema`         | Column names, types, business field mappings |
| `dataset://<id>/kpis`           | Precomputed KPI values                       |
| `dataset://<id>/top-regions`    | Ranked region data                           |
| `dataset://<id>/top-products`   | Ranked product data                          |
| `dataset://<id>/revenue-trends` | Time-series revenue data                     |
| `dataset://<id>/profitability`  | Profitability breakdown                      |

## Implementation Rules

- Keep MCP handlers deterministic and read-only.
- Use in-memory cache populated after dataset analysis (`setAnalysisCache`).
- Check ownership before adding MCP tools that load database-backed user records.
- Enforce user ownership, business or workspace ownership, dataset access permission, and role-based tool allowlists for every tool.
- Add rate limiting and audit logging before MCP expands beyond the current internal session-based route.
- Return clear errors for invalid JSON, unknown tools, unauthorized access.
- Update AI tracing structure when MCP tools change the AI context, prompt inputs, provider-visible metadata, or trace fields.
