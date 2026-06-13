# MCP User Guide

## Table of Contents

- [Available MCP Tools](#available-mcp-tools)
- [Access Levels](#access-levels)
- [Subdomain Access](#subdomain-access)
- [Usage Examples](#usage-examples)

MCP lets connected tools use trusted dashboard data. Payload provides a separate content connection
for authorised News and FAQ administration.

**Access:** Signed-in users and UseClevr service tokens access dataset tools through `/api/mcp`.
Content editors use a Payload MCP API key through `/api/payload/mcp`.

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
| `getDatasetSchema`        | Dataset structure: columns, types, business fields | `datasetId`                        |
| `getPrecomputedKpis`      | KPI values: revenue, expenses, profit, margin      | `datasetId`                        |
| `getTopRegions`           | Ranked region data with totals and shares          | `datasetId`, `metric`, `limit`     |
| `getRevenueTrends`        | Revenue-over-time with trend direction             | `datasetId`, `dateGrain`, `metric` |
| `getProfitabilitySummary` | Profitability with breakdowns                      | `datasetId`                        |
| `getCostBreakdown`        | Cost categories and percentages                    | `datasetId`                        |
| `getProfitMarginTrend`    | Profit margin and growth analysis                  | `datasetId`                        |
| `compareDatasets`         | Compare two datasets for metric differences        | `datasetIdA`, `datasetIdB`         |
| `getTopProducts`          | Ranked products with revenue/profit shares         | `datasetId`, `metric`, `limit`     |
| `listDatasets`            | List your datasets with metadata                   | _(none)_                           |

## Access Levels

| Level               | Access                                              |
| ------------------- | --------------------------------------------------- |
| UseClevr token      | Permitted dataset tools and owned dataset resources |
| Superadmin session  | Platform dataset tools and administration           |
| Payload MCP API key | Explicitly enabled News and FAQ content tools       |

## Subdomain Access

The MCP route `/api/mcp` responds to requests from `mcp.useclevr.com` and `mcp-test.useclevr.com` when configured:

- Configure CNAME records pointing subdomains to the Railway hostnames
- DNS points to hostnames only, not URL paths.
- `mcp.useclevr.com/api/mcp` uses the authenticated UseClevr dataset service.
- After the test deployment is configured, `mcp-test.useclevr.com/api/mcp` routes to Payload
  Streamable HTTP MCP and exposes only locked demo-account metadata and stored insights.
- The test connector never returns uploaded rows or customer-owned datasets.
- Private ChatGPT dataset access requires OAuth and remains unavailable.

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

**List Payload content tools:**

```http
POST /api/payload/mcp
Authorization: Bearer <payload-mcp-api-key>
Content-Type: application/json
Accept: application/json, text/event-stream

{"jsonrpc":"2.0","id":"1","method":"tools/list","params":{}}
```

**Read a resource:**

```
GET /api/mcp?resource=dataset://your-id/schema
```
