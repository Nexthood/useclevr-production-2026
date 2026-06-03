# MCP User Guide

MCP lets approved UseClevr tools use trusted dashboard data for analysis support. It helps connected tools read the same prepared metrics that the dashboard shows, such as dataset schema, KPIs, top regions, revenue trends, and profitability summaries.

## Available MCP Tools

| Tool | Description | Input | Output |
|------|-------------|-------|--------|
| `getDatasetSchema` | Returns dataset structure with columns, types, and business field mappings | `datasetId` | columns, inferredTypes, rowCount, dateColumns, businessFields |
| `getPrecomputedKpis` | Returns KPI values: revenue, expenses, profit, margin, top performers | `datasetId` | totalRevenue, totalExpenses, grossProfit, netProfit, margin, topRegion, topProduct |
| `getTopRegions` | Returns ranked region/country data with totals and share percentages | `datasetId`, `metric`, `limit` | rankedRows with rank/name/value, totals, sharePercentages |
| `getRevenueTrends` | Returns revenue-over-time data with trend metadata | `datasetId`, `dateGrain`, `metric` | trendRows, firstPeriod, lastPeriod, growthDirection, peak/trough |
| `getProfitabilitySummary` | Returns profitability analysis with breakdowns | `datasetId` | totalRevenue, totalExpenses, netProfit, profitMargin, topCostCategories, revenueByRegion |

## What MCP Can Use

- Public FAQ answers are available as public help content.
- Your signed-in dashboard pages use your own account data.
- Your datasets, reports, tickets, settings, and business profile stay scoped to your account.
- Superadmin accounts can review operator-wide customer and administration information.

## What MCP Does Not Do

- MCP does not share another user's private dashboard data with your account.
- MCP does not expose raw uploaded files through the current analysis tools.
- MCP does not invent new totals; it uses the prepared metrics from UseClevr analysis.

## Access Levels

| Access level | Available information |
|--------------|----------------------|
| Public visitor | Public FAQ help content |
| Signed-in user | Own pages, own datasets, own reports, own tickets, own settings, own business profile |
| Superadmin | User information plus operator-wide administration views |

Use a superadmin demo account only when you need to review administration features.

## Example Usage

**Get dataset KPIs:**
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
