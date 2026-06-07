# MCP User Guide

## Table of Contents

- [Available MCP Tools](#available-mcp-tools)
- [Access Levels](#access-levels)
- [Subdomain Access](#subdomain-access)
- [Usage Examples](#usage-examples)

MCP lets connected tools use trusted dashboard data for analysis support. It reads the same prepared metrics that the dashboard shows: dataset schema, KPIs, top regions, revenue trends, and profitability summaries.

**Current access:** Signed-in users only. Requests from `mcp.useclevr.com` are supported when the subdomain is configured.

## Available MCP Tools

| Tool                      | Description                                        | Input                              |
| ------------------------- | -------------------------------------------------- | ---------------------------------- |
| `getFaqs`                 | FAQ entries by category or keyword search            | `category?`, `query?`, `limit?`     |
| `getDatasetSchema`        | Dataset structure: columns, types, business fields | `datasetId`                        |
| `getPrecomputedKpis`      | KPI values: revenue, expenses, profit, margin      | `datasetId`                        |
| `getTopRegions`           | Ranked region data with totals and shares          | `datasetId`, `metric`, `limit`     |
| `getRevenueTrends`        | Revenue-over-time with trend direction             | `datasetId`, `dateGrain`, `metric` |
| `getProfitabilitySummary` | Profitability with breakdowns                      | `datasetId`                        |
| `getCostBreakdown`        | Cost categories and percentages                    | `datasetId`                        |
| `getProfitMarginTrend`    | Profit margin and growth analysis                  | `datasetId`                        |
| `compareDatasets`         | Compare two datasets for metric differences        | `datasetIdA`, `datasetIdB`         |
| `getTopProducts`          | Ranked products with revenue/profit shares         | `datasetId`, `metric`, `limit`     |

## Access Levels

| Level          | Access                                   |
| -------------- | ---------------------------------------- |
| Signed-in user | Own datasets, reports, tickets, settings |
| Superadmin     | All user data plus admin views           |

## Subdomain Access

The MCP route `/api/mcp` responds to requests from the `mcp.useclevr.com` subdomain when:
- Railway DNS is configured for the subdomain (T-807)
- The request includes valid service/admin token auth via `x-mcp-token` header, or a session cookie

## Usage Examples

**Get dataset KPIs:**

```
POST /api/mcp
{ "name": "getPrecomputedKpis", "input": { "datasetId": "your-id" } }
```

**Get top regions:**

```
POST /api/mcp
{ "name": "getTopRegions", "input": { "datasetId": "your-id", "metric": "revenue", "limit": 10 } }
```

**Read a resource:**

```
GET /api/mcp?resource=dataset://your-id/schema
```
