# Payload MCP Guide

Payload MCP is the documented MCP surface for UseClevr content tools and the locked demo-account dataset connector. Payload owns tool discovery, API-key permissions, JSON-RPC transport, and test-connector scoping.

## Table of Contents

- [Access Levels](#access-levels)
- [Subdomain Verification](#subdomain-verification)
- [Available Tools](#available-tools)
- [ChatGPT Web MCP Support](#chatgpt-web-mcp-support)
- [Local And Client Configuration](#local-and-client-configuration)
- [Security](#security)

## Access Levels

| Level | Access |
| --- | --- |
| Payload MCP API key | Explicitly enabled Payload tools |
| Test connector key | Locked demo-account metadata and stored insights only |
| Content editor key | Payload News and FAQ tools allowed by key permissions |

Payload MCP API keys must use the narrowest tool set required for the caller. The test connector key must not expose uploaded rows, customer-owned datasets, or write tools.

## Subdomain Verification

After Railway DNS is configured for `mcp.useclevr.com` and `mcp-test.useclevr.com`, verify the Payload MCP endpoint:

1. **Unsigned request is rejected:**

   ```bash
   curl -i https://mcp.useclevr.com/api/payload/mcp \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":"1","method":"tools/list","params":{}}'
   ```

   Expected: `HTTP/1.1 401 Unauthorized` or a JSON-RPC error response without tool data.

2. **API-key request returns tools:**

   ```bash
   curl -i https://mcp.useclevr.com/api/payload/mcp \
     -H "Authorization: Bearer $PAYLOAD_MCP_API_KEY" \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -d '{"jsonrpc":"2.0","id":"1","method":"tools/list","params":{}}'
   ```

   Expected: JSON-RPC response with a `result.tools` array.

3. **CORS header is present for web clients:**

   ```bash
   curl -I https://mcp.useclevr.com/api/payload/mcp \
     -H "Origin: https://mcp.useclevr.com"
   ```

   Expected: `Access-Control-Allow-Origin: https://mcp.useclevr.com`.

## Available Tools

The test connector exposes only locked demo-account read tools:

| Tool | Description | Input |
| --- | --- | --- |
| `listDashboardDatasets` | List locked demo-account dataset metadata | _(none)_ |
| `getDashboardDatasetInsights` | Read stored locked demo-account insights | `datasetId` |

Payload also discovers News and FAQ collection tools dynamically from `/api/payload/mcp`. Payload MCP API-key permissions determine which find, create, update, and delete tools each client receives.

## ChatGPT Web MCP Support

After T-841 deploys the source and configures the Railway test service, the test connector at
`https://mcp-test.useclevr.com/api/payload/mcp` exposes Payload MCP. Railway supplies
`PAYLOAD_MCP_TEST_API_KEY` as a server-held credential; ChatGPT never receives that key.

The Payload API key must enable only `listDashboardDatasets` and `getDashboardDatasetInsights`.
Both tools are read-only, hard-scoped to the locked demo account, and omit uploaded dataset rows.
Private customer dataset access remains disabled until T-840 adds OAuth.

### Developer Mode (Full Read/Write)

- **Availability:** Business and Enterprise/Edu workspaces for admins, owners, and authorised developers on ChatGPT web.
- **Enable:** Settings → Apps → Advanced settings → Developer mode.
- **Usage after T-841:** Add `https://mcp-test.useclevr.com/api/payload/mcp` in Settings → Apps → Create, scan tools, and create the draft app.
- **Transport:** Streamable HTTP or SSE. Server must be publicly accessible via HTTPS.
- **Test auth:** The public test host injects its restricted Payload API key server-side.
- **Private auth:** Use OAuth for customer datasets. ChatGPT does not present custom service API keys.

### Connectors (Read-Only)

- **Availability:** Pro, Business, Enterprise, Edu (not Plus).
- **Capability:** Read-only `search` and `fetch` tools for deep research across proprietary data sources.
- **Setup:** Workspace admins add custom MCP server in Settings → Connectors.
- **Required tools:** Server must expose `search(query: string)` and `fetch(id: string)` tools.

### Key Constraints

- MCP servers must be remote (HTTPS). Stdio (local process) servers are not supported.
- Use `ngrok` or similar for local development to expose localhost via HTTPS.
- Developer mode requires explicit tool selection: specify the connector and tool name in prompts.
- MCP tools add to context window — be selective about which servers are enabled.

## Local And Client Configuration

OpenCode supports MCP servers as tools alongside built-in tools. Configure them in `opencode.jsonc`.

### Remote MCP Server

```jsonc
{
  "mcp": {
    "useclevr-payload": {
      "type": "remote",
      "url": "https://mcp-test.useclevr.com/api/payload/mcp",
      "enabled": true,
      "headers": {
        "Authorization": "Bearer {env:PAYLOAD_MCP_TEST_API_KEY}",
      },
    },
  },
}
```

Authenticate via CLI when the client requires it:

```bash
opencode mcp auth useclevr-payload
```

### Per-Agent Scoping

Disable globally, enable per agent:

```jsonc
{
  "tools": { "useclevr-payload*": false },
  "agent": {
    "research-agent": {
      "tools": { "useclevr-payload*": true },
    },
  },
}
```

### VS Code Native MCP Support

VS Code has built-in MCP client support with stdio, Streamable HTTP, and SSE transports. Use
`.vscode/mcp.json` only for real MCP servers that speak one of those transports.

```jsonc
{
  "servers": {
    "useclevr-payload": {
      "type": "http",
      "url": "https://mcp-test.useclevr.com/api/payload/mcp",
      "headers": {
        "Authorization": "Bearer ${env:PAYLOAD_MCP_TEST_API_KEY}",
      },
    },
  },
}
```

Use the Extensions view (`@mcp` filter), `mcp.json` inline actions, or the Command Palette to manage servers:

- `MCP: List Servers` — start, stop, restart, or view logs.
- `MCP: Browse MCP Servers` — open gallery.
- `MCP: Browse Resources` — attach resources to chat.
- `chat.mcp.autoStart` — auto-restart on config change.
- `chat.mcp.apps.enabled` — enable MCP Apps UI.

## Security

- Never embed API keys, tokens, or secrets in tool responses, widget state, docs, prompts, traces, TODOs, or logs.
- Configure the test Payload key with only the two locked demo-account read tools.
- Enforce auth inside Payload MCP — do not rely on ChatGPT-side hints for authorization.
- Keep uploaded rows and customer-owned datasets out of the public test connector.
- Require OAuth before private customer datasets become available through ChatGPT.
- For production, deploy to low-latency HTTPS hosts such as Cloudflare Workers, Fly.io, Vercel, or AWS.
