plan mcp implementation

MCP security rule:
Keep MCP internal under `/api/mcp/*` for now. Do not create `mcp.useclevr.com` yet. MCP endpoints must not expose public discovery. Unauthenticated requests should return 404 or 401 and must never reveal available tools, schemas, dataset names, file paths, or business IDs.

Every MCP request must require one of:
- authenticated user session,
- signed service token,
- admin-only token for internal tools.

Every MCP tool must enforce:
- user ownership,
- business/workspace ownership,
- dataset access permission,
- role-based tool allowlist,
- rate limiting,
- audit logging.

Do not rely on hidden URLs as security. Hidden endpoints are allowed only as an extra layer, never as the main protection.
