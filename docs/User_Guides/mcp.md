# MCP User Guide

## Table of Contents

- [Available MCP Tools](#available-mcp-tools)
- [Access Levels](#access-levels)
- [Subdomain Access](#subdomain-access)
- [Usage Examples](#usage-examples)

MCP lets connected tools use trusted dashboard data and published UseClevr content. It reads the
same prepared metrics that the dashboard shows and published news stored in Payload.

**Access:** Signed-in users for read tools (datasets, FAQ, news). Admin tokens or superadmin sessions required for write tools (create/update/delete FAQ and news). Token scopes control available tools.

## Subdomain Verification

After Railway DNS is configured for `mcp.useclevr.com`, verify:

1. **Unsigned request returns 401:**
   ```bash
   curl -i https://mcp.useclevr.com/api/mcp
   ```
   Expected: `HTTP/1.1 401 Unauthorized`

2. **With service token returns tools:**
   ```bash
   curl -H "x-mcp-service-token: $TOKEN" https://mcp.useclevr.com/api/mcp
   ```
   Expected: JSON with `tools` array

3. **CORS header is present:**
   ```bash
   curl -I https://mcp.useclevr.com/api/mcp -H "Origin: https://mcp.useclevr.com"
   ```
   Expected: `Access-Control-Allow-Origin: https://mcp.useclevr.com`

## Available MCP Tools

| Tool                      | Description                                        | Input                              |
| ------------------------- | -------------------------------------------------- | ---------------------------------- |
| `getFaqs`                 | FAQ entries by category or keyword search            | `category?`, `query?`, `limit?`     |
| `getNews`                 | Published news by slug or keyword                   | `slug?`, `query?`, `limit?`, `includeContent?` |
| `getDatasetSchema`        | Dataset structure: columns, types, business fields | `datasetId`                        |
| `getPrecomputedKpis`      | KPI values: revenue, expenses, profit, margin      | `datasetId`                        |
| `getTopRegions`           | Ranked region data with totals and shares          | `datasetId`, `metric`, `limit`     |
| `getRevenueTrends`        | Revenue-over-time with trend direction             | `datasetId`, `dateGrain`, `metric` |
| `getProfitabilitySummary` | Profitability with breakdowns                      | `datasetId`                        |
| `getCostBreakdown`        | Cost categories and percentages                    | `datasetId`                        |
| `getProfitMarginTrend`    | Profit margin and growth analysis                  | `datasetId`                        |
| `compareDatasets`         | Compare two datasets for metric differences        | `datasetIdA`, `datasetIdB`         |
| `getTopProducts`          | Ranked products with revenue/profit shares         | `datasetId`, `metric`, `limit`     |
| `listDatasets`            | List your datasets with metadata                   | *(none)*                            |
| `createFaq`               | Create a FAQ entry (admin only)                    | `category`, `question`, `answer`, `tag?` |
| `updateFaq`               | Update a FAQ entry (admin only)                    | `id`, `category?`, `question?`, `answer?`, `tag?` |
| `deleteFaq`               | Delete a FAQ entry (admin only)                    | `id`                                |
| `createNews`              | Create a news post (admin only)                    | `title`, `slug`, `summary`, `content?` |
| `updateNews`              | Update a news post (admin only)                    | `id`, `title?`, `slug?`, `summary?`, `content?` |
| `deleteNews`              | Delete a news post (admin only)                    | `id`                                |

## Access Levels

| Level          | Access                                   |
| -------------- | ---------------------------------------- |
| Token (read scopes)    | Datasets (own), FAQ, news                     |
| Token (write scopes)   | Datasets (own), FAQ, news, create/update/delete FAQ and news |
| Superadmin session     | All user data, admin views, write FAQ/news    |

## Subdomain Access

The MCP route `/api/mcp` responds to requests from `mcp.useclevr.com` and `mcp-test.useclevr.com` when configured:
- Configure CNAME records pointing subdomains to the Railway hostnames
- DNS points to hostnames only, not URL paths — backend routing sends subdomain requests to `/api/mcp`
- Requests require valid service/admin token auth via `x-mcp-token` header or a session cookie

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

**Search published news:**

```
POST /api/mcp
{ "name": "getNews", "input": { "query": "launch", "limit": 5, "includeContent": false } }
```

**Read a resource:**

```
GET /api/mcp?resource=dataset://your-id/schema
```
