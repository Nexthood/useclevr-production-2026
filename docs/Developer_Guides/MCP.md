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
- Current global proxy behavior keeps the MCP route protected, but leaves app-auth routes and
  Payload CMS auth routes reachable before login.
- In the current app state, a local positive MCP ping succeeds only when the client already has a
  signed-in app session cookie.

## Local Ping Process

Use this ping to verify that the UseClevr app MCP route is reachable and enforcing the current auth
boundary.

1. Start the app locally:

```bash
pnpm dev
```

2. In a second terminal, call the MCP list route without a session cookie:

```bash
curl -i http://127.0.0.1:3000/api/mcp
```

3. Current expected result:

```text
HTTP/1.1 401 Unauthorized
{"error":"Unauthorized"}
```

This result confirms three things:

- the UseClevr MCP route exists at `/api/mcp`
- the request reaches the application
- the current auth boundary rejects unauthenticated MCP access

4. For a positive tools-list ping, repeat the request from a signed-in browser session or an HTTP
client that reuses a valid UseClevr session cookie:

```bash
curl -b cookies.txt http://127.0.0.1:3000/api/mcp
```

Expected signed-in result shape:

```json
{
  "tools": [
    { "name": "getFaqs", "description": "..." }
  ],
  "resources": []
}
```

Do not place raw session cookies, service tokens, or admin tokens into docs, prompts, logs, or
screenshots.

## Terminal Test Process

Use terminal testing for the current internal UseClevr MCP route.

### Route Reachability Test

This test proves that the app exposes the MCP route and enforces the current auth boundary:

```bash
curl -i http://127.0.0.1:3000/api/mcp
```

Expected result:

```text
HTTP/1.1 401 Unauthorized
{"error":"Unauthorized"}
```

### Signed-In Tool Listing Test

This test proves that a signed-in client can list UseClevr MCP tools:

1. Sign in to the local app in a browser.
2. Export the session cookie into a cookie jar your terminal client can reuse.
3. Re-run the MCP list call with that cookie jar:

```bash
curl -b cookies.txt http://127.0.0.1:3000/api/mcp
```

Expected result shape:

```json
{
  "tools": [
    { "name": "getFaqs", "description": "..." },
    { "name": "getDatasetSchema", "description": "..." }
  ],
  "resources": []
}
```

### Signed-In Tool Invocation Test

After you know a dataset ID that belongs to the signed-in user, invoke one deterministic tool:

```bash
curl -b cookies.txt \
  -H "content-type: application/json" \
  -d '{"name":"getDatasetSchema","input":{"datasetId":"<dataset-id>"}}' \
  http://127.0.0.1:3000/api/mcp
```

Expected result shape:

```json
{
  "success": true,
  "result": {
    "columns": ["..."],
    "rowCount": 123
  }
}
```

If the signed-in terminal test still returns `401`, the cookie jar is missing the active Auth.js
session cookie.

## Shared API Test Files

Use Git-tracked REST Client files under [docs/api-tests](../api-tests/README.md)
as the shared MCP and API testing path.

- Use `docs/api-tests/mcp.http` for route reachability, signed-in tool listing, dataset resource listing, and tool invocation.
- Keep secrets manual and temporary.
- Keep Thunder Client as a personal manual tool only, not the shared project source of truth.

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

## ChatGPT Web MCP Support

OpenAI's ChatGPT web supports MCP in two modes. Documentation here is for reference when building or testing MCP servers that work across platforms.

### Developer Mode (Full Read/Write)

- **Availability:** Plus, Pro, Business, Enterprise, Edu accounts (web only).
- **Enable:** Settings → Connectors → Advanced → Developer mode.
- **Usage:** Add a remote MCP server URL in Settings → Connectors → Create. ChatGPT discovers tools and offers them in conversation. Write actions require user confirmation by default.
- **Transport:** Streamable HTTP or SSE. Server must be publicly accessible via HTTPS.
- **Auth:** OAuth 2.1 (recommended), API key via headers, or none.

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

### Security

- Never embed API keys, tokens, or secrets in tool responses or widget state.
- Enforce auth inside your MCP server — do not rely on ChatGPT-side hints for authorization.
- For production, deploy to low-latency HTTPS hosts (Cloudflare Workers, Fly.io, Vercel, AWS).

## Local MCP in OpenCode

OpenCode supports MCP servers as tools alongside built-in tools. Configure them in `opencode.jsonc`:

### Local MCP Server

```jsonc
{
  "mcp": {
    "my-server": {
      "type": "local",
      "command": ["npx", "-y", "my-mcp-command"],
      "enabled": true,
      "environment": {
        "MY_ENV_VAR": "my_env_var_value",
      },
    },
  },
}
```

**Options:**

| Option | Type | Required | Description |
| ------ | ---- | -------- | ----------- |
| `type` | string | Y | Must be `"local"` |
| `command` | array | Y | Command + args to run the MCP server |
| `environment` | object | | Env vars for the server process |
| `enabled` | boolean | | Enable/disable on startup |
| `timeout` | number | | Timeout in ms for tool fetch (default 5000) |

### Remote MCP Server

```jsonc
{
  "mcp": {
    "my-remote": {
      "type": "remote",
      "url": "https://my-mcp-server.com",
      "enabled": true,
      "headers": {
        "Authorization": "Bearer {env:MY_API_KEY}"
      }
    }
  }
}
```

### OAuth for Remote Servers

OpenCode auto-detects OAuth (RFC 7591 DCR). Or configure explicitly:

```jsonc
{
  "mcp": {
    "my-oauth-server": {
      "type": "remote",
      "url": "https://mcp.example.com/mcp",
      "oauth": {
        "clientId": "{env:MY_CLIENT_ID}",
        "clientSecret": "{env:MY_CLIENT_SECRET}",
        "scope": "tools:read tools:execute"
      }
    }
  }
}
```

Authenticate via CLI: `opencode mcp auth my-server`.

### Per-Agent Scoping

Disable globally, enable per agent:

```jsonc
{
  "tools": { "my-mcp*": false },
  "agent": {
    "my-agent": {
      "tools": { "my-mcp*": true }
    }
  }
}
```

## VS Code Native MCP Support

VS Code has built-in MCP client support (v1.85+) with full stdio, Streamable HTTP, and SSE transports.

### UseClevr Current-State Note

The current UseClevr `/api/mcp` route is an internal authenticated JSON API. It is not yet exposed
as a native MCP transport server for VS Code's built-in MCP client.

Current result:

- Use VS Code native MCP for real MCP servers that speak stdio, Streamable HTTP, or SSE.
- Use HTTP request tooling inside VS Code to test the current UseClevr `/api/mcp` route.
- Do not point `.vscode/mcp.json` directly at `/api/mcp` and expect native MCP discovery yet.

### VS Code Local Test Process

Use one of these two current-state paths:

#### Option A: REST Client Extension

1. Install the `REST Client` VS Code extension.
2. Create a file such as `tmp/useclevr-mcp-test.http`.
3. Add a route reachability request:

```http
GET http://127.0.0.1:3000/api/mcp
```

4. Send the request.

Expected result:

```text
401 Unauthorized
```

5. After signing in locally, repeat the request with the active session cookie copied from browser
devtools into the request header:

```http
GET http://127.0.0.1:3000/api/mcp
Cookie: <paste active auth session cookie pair>
```

Expected result shape:

```json
{
  "tools": [
    { "name": "getFaqs", "description": "..." }
  ],
  "resources": []
}
```

#### Option B: Thunder Client Or Similar HTTP Tool

1. Open a new request to `GET http://127.0.0.1:3000/api/mcp`.
2. Confirm the unsigned request returns `401 Unauthorized`.
3. Add the active session cookie from the local signed-in browser session.
4. Re-run the request and confirm the tool list appears.

#### Option C: VS Code Integrated Browser + Manual Cookie Reuse

Use this path when you sign in through the VS Code integrated browser and want to verify the
current internal UseClevr MCP route without leaving VS Code.

1. Open the local app in the VS Code integrated browser.
2. Sign in with a valid local account.
3. Open browser devtools inside VS Code.
4. Open the cookie storage view for `http://127.0.0.1:3000` or `http://localhost:3000`.
5. Copy the active Auth.js session cookie pair:
   - `authjs.session-token=...`
   - or `__Secure-authjs.session-token=...`
6. Reuse that cookie in a terminal request:

```bash
curl -i \
  -H 'Cookie: authjs.session-token=<paste-value>' \
  http://127.0.0.1:3000/api/mcp
```

If the secure cookie name is the active one, use:

```bash
curl -i \
  -H 'Cookie: __Secure-authjs.session-token=<paste-value>' \
  http://127.0.0.1:3000/api/mcp
```

Expected signed-in result shape:

```json
{
  "tools": [
    { "name": "getFaqs", "description": "..." }
  ],
  "resources": []
}
```

Current limitation:

- The coding agent can document this process and run the terminal half.
- The coding agent cannot click the VS Code integrated browser or extract its live cookies directly.
- Treat the cookie copy step as a manual local operator step.

### Future Native VS Code MCP Test

Use native `.vscode/mcp.json` testing only after UseClevr exposes a real MCP transport endpoint
instead of the current internal JSON route.

### Configuration

Create `.vscode/mcp.json` in your workspace (or use global user config via `MCP: Open User Configuration`):

```jsonc
{
  "servers": {
    "my-server": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
    }
  }
}
```

For HTTP servers:

```jsonc
{
  "servers": {
    "my-http-server": {
      "type": "http",
      "url": "https://mcp.example.com/mcp"
    }
  }
}
```

### Supported Features

- **Tools:** Extend Copilot agent mode with custom tools
- **Prompts:** Reusable prompts as slash commands in chat
- **Resources:** Data context via `MCP: Browse Resources`
- **MCP Apps:** Interactive UI components rendered inline in chat
- **Sampling:** Servers can make LLM requests using the user's configured models
- **OAuth:** Built-in auth for GitHub, Microsoft Entra, and OAuth 2.1 IdPs via DCR
- **Authentication:** Full OAuth flow with token management

### Configuration Methods

| Method | Description |
| ------ | ----------- |
| `.vscode/mcp.json` | Per-workspace config (shareable via source control) |
| User profile | Cross-workspace via `MCP: Open User Configuration` |
| Command palette | `MCP: Add Server` guided flow |
| Extensions view | Search `@mcp` in marketplace for installable servers |
| Install URL | `vscode:mcp/install` links on websites |
| CLI | `code --add-mcp '{"name":"s","command":"npx ..."}'` |
| Autodiscovery | Auto-discovers from Claude Desktop via `chat.mcp.discovery.enabled` |
| Dev containers | Configured via `devcontainer.json` |

### Management

Use the Extensions view (`@mcp` filter), `mcp.json` inline actions, or the Command Palette:

- `MCP: List Servers` — start/stop/restart/view logs
- `MCP: Browse MCP Servers` — open gallery
- `MCP: Browse Resources` — attach resources to chat
- `chat.mcp.autoStart` (experimental) — auto-restart on config change
- `chat.mcp.apps.enabled` (experimental) — enable MCP Apps UI

### Extension-Bundled MCP Servers

Extensions can register MCP servers programmatically via `vscode.lm.registerMcpServerDefinitionProvider()`. Declare in `package.json` under `contributes.mcpServerDefinitionProviders`, then implement the provider. The server ships inside the VSIX — no separate config needed.

### Development Mode

Enable debugging by adding a `dev` key to the MCP server config:

```jsonc
{
  "servers": {
    "my-server": {
      "type": "stdio",
      "command": "node",
      "args": ["server.js"],
      "dev": {
        "watch": "src/**/*.ts",
        "debug": true
      }
    }
  }
}
```

Supports Node.js and Python debugger attachment.

## Terminal MCP Clients

Standalone CLI tools for interacting with MCP servers from the terminal.

### mcpc (Apify)

- **Repo:** [apify/mcp-cli](https://github.com/apify/mcp-cli)
- **Type:** TypeScript, 500+ stars
- **Transports:** stdio, HTTP/SSE
- **Features:** Persistent sessions, OAuth 2.1, async tasks, JSON code mode, tool search, proxy mode for AI sandboxing, x402 payments
- **Install:** `npm install -g @apify/mcpc`
- **Quick start:**
  ```bash
  mcpc connect npx -y @modelcontextprotocol/server-filesystem /tmp @fs
  @fs tools-list
  @fs tools-call read_file path:=/tmp/test.txt
  ```

### mcpx

- **Repo:** [lydakis/mcpx](https://github.com/lydakis/mcpx)
- **Type:** Go, 40+ stars
- **Transports:** stdio, HTTP/SSE
- **Features:** Auto-discovers configs from Claude Code, Cursor, Codex, Kiro. Schema-aware `--help`. Cache support. Command shims. Skill installer.
- **Install:** `brew install lydakis/tap/mcpx`
- **Quick start:**
  ```bash
  mcpx                              # list servers
  mcpx my-server                    # list tools
  mcpx my-server my-tool --help     # inspect schema
  mcpx my-server my-tool '{"a":1}'  # call tool
  ```

### mcp-cli (philschmid)

- **Repo:** [philschmid/mcp-cli](https://github.com/philschmid/mcp-cli)
- **Type:** TypeScript/Bun, 1100+ stars
- **Transports:** stdio, HTTP
- **Features:** Connection pooling daemon, tool filtering (allow/deny globs), server instructions, actionable errors. Reads Claude/Gemini/VS Code config formats.
- **Install:** `npm install -g @philschmid/mcp-cli`
- **Quick start:**
  ```bash
  mcp-cli                            # list servers + tools
  mcp-cli info my-server             # show server tools
  mcp-cli info my-server my-tool     # show tool schema
  mcp-cli call my-server my-tool '{}' # call tool
  mcp-cli grep "*file*"              # search tools across servers
  ```

### mcp2cli (knowsuchagency)

- **Repo:** [shark-hunt/mcp2cli](https://github.com/shark-hunt/mcp2cli)
- **Type:** Python
- **Transports:** stdio, HTTP/SSE
- **Features:** Also supports OpenAPI specs and GraphQL endpoints directly. TOON encoding for token-efficient output. OAuth baked in. Bake mode for saved connection configs.
- **Install:** `uv tool install mcp2cli`
- **Quick start:**
  ```bash
  mcp2cli --mcp https://mcp.example.com/sse --list
  mcp2cli --mcp-stdio "npx @modelcontextprotocol/server-filesystem /tmp" --list
  mcp2cli --spec https://petstore3.swagger.io/api/v3/openapi.json --list
  ```

### mcp-gateway-cli

- **Repo:** [VincentK1991/mcp-gateway-cli](https://github.com/VincentK1991/mcp-gateway-cli)
- **Type:** TypeScript
- **Features:** Schema cache, auto-generated CLI flags from tool schemas, jq-compatible JSON output, config in `~/.gateway-cli/config.yaml`
- **Install:** `npm install -g mcp-gateway-cli`

### mcp-proxy-cli

- **Repo:** [alfonsograziano/mcp-proxy-cli](https://github.com/alfonsograziano/mcp-proxy-cli)
- **Type:** TypeScript
- **Features:** Server-client architecture with persistent background daemon. Multi-transport (stdio, HTTP, SSE). Dual Cursor/VS Code config format support.
- **Quick start:**
  ```bash
  mcp-proxy-cli-server start
  mcp-proxy-cli /list/tools
  mcp-proxy-cli /tool/call echo '{"message":"hello"}'
  ```

### mcpmu (multiplexer)

- **Repo:** [Bigsy/mcpmu](https://github.com/Bigsy/mcpmu)
- **Type:** Go
- **Features:** Meta-server that aggregates multiple MCP servers into a single endpoint. Namespace profiles, tool permissions, registry browser, interactive TUI. Single entry in any MCP client config exposes all servers.
- **Quick start:**
  ```json
  { "mcpmu": { "command": "mcpmu", "args": ["serve", "--stdio"] } }
  ```

## VS Code MCP Extensions (Marketplace)

Popular VS Code extensions that expose IDE capabilities as an MCP server to external AI coding agents.

### VSCode MCP (tjx666)

- **Marketplace:** `YuTengjing.vscode-mcp-bridge` (76 stars, 44 releases)
- **Tools:** `get_symbol_lsp_info`, `get_diagnostics`, `get_references`, `rename_symbol`, `execute_command`, `health_check`, `list_workspaces`, `open_files`
- **Transport:** Stdio via npx
- **Install:**
  ```bash
  claude mcp add vscode-mcp -- npx -y @vscode-mcp/vscode-mcp-server@latest
  ```
- Config for Gemini CLI / OpenCode:
  ```json
  { "command": "npx", "args": ["-y", "@vscode-mcp/vscode-mcp-server@latest"] }
  ```

### VSCode-MCP Server (JuehangQin)

- **Marketplace:** `JuehangQin.vscode-mcp-server` (5,600+ installs)
- **Tools:** File ops (list, read, write, move, rename, copy), symbols (search, definition, document outline), diagnostics, shell commands in integrated terminal
- **Transport:** Streamable HTTP on configurable port (default 3000, binds to 127.0.0.1)
- **Config:**
  ```jsonc
  // .vscode/mcp.json
  { "servers": { "vscode-mcp": { "type": "http", "url": "http://127.0.0.1:3000/mcp" } } }
  ```

### VSC-MCPServer (CodingWithCalvin)

- **Marketplace:** `CodingWithCalvin.VSC-MCPServer`
- **Tools:** 19 tools covering symbols, definitions, references, hover, diagnostics, completions, signature help, code actions, formatting, rename, file/text search, call/type hierarchy
- **Transport:** HTTP on port 4000, auto-starts with VS Code. Also supports `vscode://` URI protocol handler.
- **Config:** Set `codingwithcalvin.mcp.autoStart`, `codingwithcalvin.mcp.port`, `codingwithcalvin.mcp.bindAddress`

### VSCode Maestro MCP

- **Marketplace:** `abyo-software.vscode-maestro-mcp` (100+ tools across 25 categories)
- **Free tools:** Files, editing, terminal, editor, diagnostics, debug, git, selection, diff, tasks, notifications, settings, refactor, snippets, testing, tabs/layout
- **Premium tools:** LSP providers (completion, hover, signature, code actions, navigation, symbols, formatting, semantic tokens, document features)
- **Transport:** Streamable HTTP
- **Config:** Category-level enable/disable at runtime via `manage_tool_categories` tool

### VSCode MCP Bridge (jhamama)

- **Marketplace:** `jhamama.vscode-mcp-bridge` (27 tools)
- **Features:** Visual diffs via native VS Code diff editor, live LSP diagnostics, context push (auto-notifies agents on file/selection change), managed terminals
- **Transport:** SSE on port 3333
- **Config:** Bearer token auth, allowlist for VS Code commands, terminal strategy (childProcess vs shellIntegration)

### IDE-LSP for MCP (xzhao4545)

- **Marketplace:** `xzhao4545.ide-lsp-mcp` (15 tools)
- **Focus:** LSP intelligence — definition, references, hover, symbols, diagnostics, rename, call hierarchy, file search, code actions
- **Transport:** HTTP on port 53221, auto-start. Pagination, context lines, debug panel.

### MCP Tool Explorer (jurgen178)

- **Marketplace:** `jurgen178.mcp-tool-explorer` (not a server — an inspector/browser)
- **Features:** Browse tools, resources, prompts of any MCP server from within VS Code. Form view and JSON view for tool calls. History tab. Auto-discovers from `.vscode/mcp.json`.

## Quick Reference: Which MCP Client to Use

| Need | Recommendation |
| ---- | -------------- |
| Add MCP tools to your AI coding agent | **OpenCode** — configure in `opencode.jsonc` |
| Use MCP tools in VS Code Copilot Chat | **VS Code native** — `.vscode/mcp.json` or `@mcp` in extensions |
| Call MCP tools from the terminal | **mcpc** (most features) or **mcpx** (lightweight, auto-discovery) |
| Pipe MCP tool results into jq/shell scripts | **mcp-cli** (Bun, fast) or **mcpc** (JSON code mode) |
| Connect MCP to ChatGPT web | **Remote HTTPS server** + Developer Mode in settings |
| Debug/inspect MCP servers in VS Code | **MCP Tool Explorer** extension |
| Aggregate multiple MCP servers into one | **mcpmu** (multiplexer) |
| Test MCP server connectivity | `mcpx my-server my-tool --help` or `echo $?` |
| Expose VS Code LSP to external agents | **VSCode MCP** (tjx666) or **VSC-MCPServer** |

## Implementation Rules

- Keep MCP handlers deterministic and read-only.
- Use in-memory cache populated after dataset analysis (`setAnalysisCache`).
- Check ownership before adding MCP tools that load database-backed user records.
- Enforce user ownership, business or workspace ownership, dataset access permission, and role-based tool allowlists for every tool.
- Add rate limiting and audit logging before MCP expands beyond the current internal session-based route.
- Return clear errors for invalid JSON, unknown tools, unauthorized access.
- Update AI tracing structure when MCP tools change the AI context, prompt inputs, provider-visible metadata, or trace fields.
