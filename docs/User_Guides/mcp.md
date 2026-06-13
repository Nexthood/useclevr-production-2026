# MCP User Guide

## Table of Contents

- [Access Levels](#access-levels)
- [Subdomain Access](#subdomain-access)
- [Available Payload MCP Tools](#available-payload-mcp-tools)
- [Usage Examples](#usage-examples)

Payload MCP is the documented connector for trusted UseClevr content and locked demo-account dataset metadata. Payload owns the MCP surface, API-key permissions, and tool discovery.

**Access:** Payload MCP API keys access the tools explicitly enabled for each key. The test connector uses a server-held Payload MCP key and never receives uploaded rows or customer-owned datasets.

## Access Levels

| Level | Access |
| --- | --- |
| Payload MCP API key | Explicitly enabled News, FAQ, and locked demo-account read tools |
| Test connector key | Locked demo-account metadata and stored insights only |
| Content editor key | Payload News and FAQ content tools allowed by key permissions |

## Subdomain Access

The MCP route responds through Payload at `/api/payload/mcp`:

- Configure CNAME records pointing `mcp.useclevr.com` and `mcp-test.useclevr.com` to the Railway hostnames.
- DNS points to hostnames only, not URL paths.
- `mcp.useclevr.com/api/payload/mcp` uses the production Payload MCP surface.
- `mcp-test.useclevr.com/api/payload/mcp` uses the test Payload MCP surface.
- The test connector never returns uploaded rows or customer-owned datasets.
- Private ChatGPT dataset access requires OAuth and remains unavailable until that migration is complete.

## Available Payload MCP Tools

| Tool | Description | Input |
| --- | --- | --- |
| `listDashboardDatasets` | List locked demo-account dataset metadata through the test connector | _(none)_ |
| `getDashboardDatasetInsights` | Read stored locked demo-account insights through the test connector | `datasetId` |

Payload also discovers News and FAQ collection tools dynamically from the Payload MCP API key permissions.

## Usage Examples

**List tools:**

```http
POST /api/payload/mcp
Authorization: Bearer <payload-mcp-api-key>
Content-Type: application/json
Accept: application/json, text/event-stream

{"jsonrpc":"2.0","id":"1","method":"tools/list","params":{}}
```

**Initialize the MCP session:**

```http
POST /api/payload/mcp
Authorization: Bearer <payload-mcp-api-key>
Content-Type: application/json
Accept: application/json, text/event-stream

{"jsonrpc":"2.0","id":"2","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"UseClevr REST Client","version":"1.0.0"}}}
```

**Call a locked demo-account read tool:**

```http
POST /api/payload/mcp
Authorization: Bearer <payload-mcp-test-api-key>
Content-Type: application/json
Accept: application/json, text/event-stream

{"jsonrpc":"2.0","id":"3","method":"tools/call","params":{"name":"listDashboardDatasets","arguments":{}}}
```

**Read a resource through Payload MCP:**

```http
GET /api/payload/mcp?resource=dataset://<locked-demo-dataset-id>/insights
Authorization: Bearer <payload-mcp-api-key>
```
