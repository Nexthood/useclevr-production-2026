# MCP User Guide

MCP lets connected tools use trusted dashboard data for analysis support. It reads the same prepared metrics that the dashboard shows: dataset schema, KPIs, top regions, revenue trends, and profitability summaries.

## Available MCP Tools

| Tool | Description | Input |
|------|-------------|-------|
| `getDatasetSchema` | Dataset structure: columns, types, business fields | `datasetId` |
| `getPrecomputedKpis` | KPI values: revenue, expenses, profit, margin | `datasetId` |
| `getTopRegions` | Ranked region data with totals and shares | `datasetId`, `metric`, `limit` |
| `getRevenueTrends` | Revenue-over-time with trend direction | `datasetId`, `dateGrain`, `metric` |
| `getProfitabilitySummary` | Profitability with breakdowns | `datasetId` |
| `getCostBreakdown` | Cost categories and percentages | `datasetId` |
| `getProfitMarginTrend` | Profit margin and growth analysis | `datasetId` |
| `compareDatasets` | Compare two datasets for metric differences | `datasetIdA`, `datasetIdB` |
| `getTopProducts` | Ranked products with revenue/profit shares | `datasetId`, `metric`, `limit` |

## Access Levels

| Level | Access |
|-------|--------|
| Public visitor | Public FAQ help content only |
| Signed-in user | Own datasets, reports, tickets, settings |
| Superadmin | All user data plus admin views |

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
POST /api/mcp
{
  "name": "getPrecomputedKpis",
  "input": { "datasetId": "your-dataset-id" }
}
```

**Get top regions:**
```
POST /api/mcp
{
  "name": "getTopRegions",
  "input": { "datasetId": "your-dataset-id", "metric": "revenue", "limit": 10 }
}
```

**Read a resource:**
```
GET /api/mcp?resource=dataset://your-dataset-id/schema
```
