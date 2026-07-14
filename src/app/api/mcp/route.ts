import { auth } from "@/lib/auth/auth";
import { isSuperAdminUserId } from "@/lib/auth/builtin-users";
import { normalizePublicAuthBaseUrl } from "@/lib/auth/redirect-origin";
import { config as appConfig } from "@/lib/config";
import { getDb } from "@/lib/db";
import { datasets, mcpAuditLogs, mcpTokens } from "@/lib/db/schema";
import { recordMCPTrace } from "@/lib/ai/ai-trace";
import { getResource, invokeTool, listResources, listToolsByScope } from "@/lib/mcp/server";
import type { MCPScope } from "@/lib/mcp/tools";
import { debugError, debugLog } from "@/lib/utils/debug";
import { checkRateLimit } from "@/lib/utils/rate-limiter";
import { checkActionEnforcement } from "@/lib/billing/usage-enforcement";
import { and, eq } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

const ADMIN_ONLY_TOOLS = ["compareDatasets", "getCostBreakdown"];

const ALLOWED_ORIGINS = [
  normalizePublicAuthBaseUrl(process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:8080"),
  process.env.NEXT_PUBLIC_APP_URL
    ? normalizePublicAuthBaseUrl(process.env.NEXT_PUBLIC_APP_URL)
    : "",
  "http://localhost:3000",
  "http://localhost:8080",
].filter(Boolean);

function addCorsHeaders(response: NextResponse, request: NextRequest): NextResponse {
  const origin = request.headers.get("origin") || "";
  if (ALLOWED_ORIGINS.includes(origin) || origin.endsWith(".useclevr.com")) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-mcp-service-token, x-mcp-admin-token, x-mcp-token");
    response.headers.set("Access-Control-Max-Age", "86400");
  }
  return response;
}

export async function OPTIONS(request: NextRequest) {
  const response = NextResponse.json({}, { status: 204 });
  return addCorsHeaders(response, request);
}

// ============================================================================
// MCP AUDIT LOGGER (DB-backed)
// ============================================================================
async function logMCPAudit(
  action: string,
  details: {
    tokenId?: string;
    tokenName?: string;
    userId?: string;
    toolName?: string;
    datasetId?: string;
    success?: boolean;
    errorMessage?: string;
    durationMs?: number;
  },
) {
  const db = getDb();
  if (!db) return;

  const safe = { ...details };
  delete (safe as Record<string, unknown>).data;
  delete (safe as Record<string, unknown>).results;
  delete (safe as Record<string, unknown>).rows;

  try {
    await db.insert(mcpAuditLogs).values({
      id: randomUUID(),
      action: action as any,
      ...safe,
      createdAt: new Date(),
    });
  } catch (err) {
    debugError("[MCP] Audit log insert failed:", err);
  }

  debugLog(`[MCP-AUDIT] Action: ${action} | ${JSON.stringify(safe)}`);
}

// ============================================================================
// TOKEN AND SESSION AUTHENTICATION (DB-backed + env fallback)
// ============================================================================
interface MCPAuthContext {
  authenticated: boolean;
  role: string;
  userId?: string;
  clientId: string | null;
  scopes: MCPScope[];
  tokenId?: string;
  tokenName?: string;
}

async function validateMCPAuth(request: NextRequest): Promise<MCPAuthContext> {
  const db = getDb();

  // 1. Check for token header
  const tokenHeader =
    request.headers.get("x-mcp-token") ||
    request.headers.get("x-mcp-service-token") ||
    request.headers.get("x-mcp-admin-token");

  if (tokenHeader && db) {
    const hash = createHash("sha256").update(tokenHeader).digest("hex");
    const storedToken = await db.query.mcpTokens.findFirst({
      where: and(eq(mcpTokens.tokenHash, hash), eq(mcpTokens.status, "active")),
    });

    if (storedToken) {
      const isExpired = storedToken.expiresAt && new Date(storedToken.expiresAt) < new Date();
      if (isExpired) {
        await db.update(mcpTokens)
          .set({ status: "expired", updatedAt: new Date() })
          .where(eq(mcpTokens.id, storedToken.id));
        return {
          authenticated: false,
          role: "guest",
          clientId: null,
          scopes: [],
        };
      }

      await db.update(mcpTokens)
        .set({ lastUsedAt: new Date(), updatedAt: new Date() })
        .where(eq(mcpTokens.id, storedToken.id));

      const role = storedToken.scopes.includes("admin") ? "admin" : "service";
      return {
        authenticated: true,
        role,
        clientId: `token-${storedToken.tokenPrefix}`,
        scopes: storedToken.scopes as MCPScope[],
        tokenId: storedToken.id,
        tokenName: storedToken.name,
      };
    }
  }

  // 2. Fallback to env var tokens
  const serviceToken = request.headers.get("x-mcp-service-token");
  const adminToken = request.headers.get("x-mcp-admin-token");
  const envServiceToken = appConfig.MCP_SERVICE_TOKEN;
  const envAdminToken = appConfig.MCP_ADMIN_TOKEN;

  if (adminToken && envAdminToken && adminToken === envAdminToken) {
    return {
      authenticated: true,
      role: "admin",
      clientId: "internal-admin-client",
      scopes: ["dataset:read", "dataset:write", "admin"],
    };
  }

  if (serviceToken && envServiceToken && serviceToken === envServiceToken) {
    return {
      authenticated: true,
      role: "service",
      clientId: "internal-service-client",
      scopes: ["dataset:read"],
    };
  }

  // 3. Fall back to session auth
  const session = await auth();
  if (session?.user?.id) {
    const role = String(session.user.role ?? "")
    const isSuperAdmin = role === "superadmin" || role === "admin" || isSuperAdminUserId(session.user.id)
    
    return {
      authenticated: true,
      role: isSuperAdmin ? "admin" : "user",
      userId: session.user.id,
      clientId: `user-${session.user.id}`,
      scopes: isSuperAdmin
        ? ["dataset:read", "dataset:write", "admin"]
        : ["dataset:read"],
    };
  }

  return {
    authenticated: false,
    role: "guest",
    clientId: null,
    scopes: [],
  };
}

// ============================================================================
// DATASET SCOPING & SECURITY
// ============================================================================
function datasetIdFromResource(resourceUri: string) {
  const match = resourceUri.match(/^dataset:\/\/([^/]+)\//);
  return match?.[1] ?? null;
}

function datasetIdFromInput(input: Record<string, unknown>) {
  return typeof input.datasetId === "string" ? input.datasetId : null;
}

async function canAccessDataset(authContext: MCPAuthContext, datasetId: string) {
  if (!authContext.authenticated) return false;
  if (authContext.role === "admin") return true;

  const db = getDb();
  if (!db) return false;

  const record = await db.query.datasets.findFirst({
    where: authContext.userId
      ? and(eq(datasets.id, datasetId), eq(datasets.userId, authContext.userId))
      : eq(datasets.id, datasetId),
    columns: { id: true },
  });

  return Boolean(record);
}

function isToolAllowedForRole(toolName: string, role: string): boolean {
  if (ADMIN_ONLY_TOOLS.includes(toolName)) {
    return role === "admin";
  }
  return true;
}

function hasRequiredScopes(authContext: MCPAuthContext, toolName: string): boolean {
  const toolList = listToolsByScope(authContext.scopes);
  return toolList.some((t) => t.name === toolName);
}

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// ============================================================================
// ROUTE HANDLERS
// ============================================================================

export async function GET(request: NextRequest) {
  const authContext = await validateMCPAuth(request);
  if (!authContext.authenticated) {
    await logMCPAudit("auth_failure", { success: false, errorMessage: "Unauthorized" });
    return addCorsHeaders(unauthorized(), request);
  }

  const rateLimitKey = `mcp:${authContext.clientId || "anonymous"}`;
  if (!checkRateLimit(rateLimitKey, 100, 60_000)) {
    await logMCPAudit("auth_failure", {
      tokenId: authContext.tokenId,
      tokenName: authContext.tokenName,
      success: false,
      errorMessage: "Rate limit exceeded",
    });
    return addCorsHeaders(NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 }), request);
  }

  const datasetId = request.nextUrl.searchParams.get("datasetId");
  const resourceUri = request.nextUrl.searchParams.get("resource");

  try {
    if (resourceUri) {
      const resourceDatasetId = datasetIdFromResource(resourceUri);
      if (resourceDatasetId && !(await canAccessDataset(authContext, resourceDatasetId))) {
        return addCorsHeaders(forbidden(), request);
      }

      await logMCPAudit("read_resource", {
        tokenId: authContext.tokenId,
        tokenName: authContext.tokenName,
        userId: authContext.userId,
        datasetId: resourceDatasetId || undefined,
        success: true,
      });
      return addCorsHeaders(NextResponse.json({ resource: getResource(resourceUri) }), request);
    }

    if (datasetId && !(await canAccessDataset(authContext, datasetId))) {
      return addCorsHeaders(forbidden(), request);
    }

    await logMCPAudit("list_tools", {
      tokenId: authContext.tokenId,
      tokenName: authContext.tokenName,
      userId: authContext.userId,
      datasetId: datasetId || undefined,
      success: true,
    });

    const mcpUrl = appConfig.MCP_URL || undefined;

    return addCorsHeaders(
      NextResponse.json({
        tools: listToolsByScope(authContext.scopes),
        resources: datasetId ? listResources(datasetId) : [],
        ...(mcpUrl && { serverUrl: mcpUrl }),
      }),
      request,
    );
  } catch (error) {
    debugError("[MCP] GET failed:", error);
    await logMCPAudit("auth_failure", {
      tokenId: authContext.tokenId,
      tokenName: authContext.tokenName,
      success: false,
      errorMessage: error instanceof Error ? error.message : "MCP request failed",
    });
    return addCorsHeaders(
      NextResponse.json(
        { error: error instanceof Error ? error.message : "MCP request failed" },
        { status: 400 },
      ),
      request,
    );
  }
}

export async function POST(request: NextRequest) {
  const authContext = await validateMCPAuth(request);
  if (!authContext.authenticated) {
    await logMCPAudit("auth_failure", { success: false, errorMessage: "Unauthorized" });
    return addCorsHeaders(unauthorized(), request);
  }

  const rateLimitKey = `mcp:${authContext.clientId || "anonymous"}`;
  if (!checkRateLimit(rateLimitKey, 100, 60_000)) {
    await logMCPAudit("auth_failure", {
      tokenId: authContext.tokenId,
      tokenName: authContext.tokenName,
      success: false,
      errorMessage: "Rate limit exceeded",
    });
    return addCorsHeaders(NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 }), request);
  }

  let body: { name?: unknown; input?: unknown };
  try {
    body = await request.json();
  } catch {
    return addCorsHeaders(NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }), request);
  }

  if (typeof body.name !== "string") {
    return addCorsHeaders(NextResponse.json({ error: "Tool name is required" }, { status: 400 }), request);
  }

  const toolName = body.name;
  if (!isToolAllowedForRole(toolName, authContext.role)) {
    await logMCPAudit("auth_failure", {
      tokenId: authContext.tokenId,
      tokenName: authContext.tokenName,
      toolName,
      success: false,
      errorMessage: "Forbidden: insufficient role",
    });
    return addCorsHeaders(forbidden(), request);
  }

  if (!hasRequiredScopes(authContext, toolName)) {
    await logMCPAudit("auth_failure", {
      tokenId: authContext.tokenId,
      tokenName: authContext.tokenName,
      toolName,
      success: false,
      errorMessage: "Forbidden: missing required scopes",
    });
    return addCorsHeaders(forbidden(), request);
  }

  const input = body.input && typeof body.input === "object" ? body.input : {};
  const datasetId = datasetIdFromInput(input as Record<string, unknown>);
  if (datasetId && !(await canAccessDataset(authContext, datasetId))) {
    await logMCPAudit("auth_failure", {
      tokenId: authContext.tokenId,
      tokenName: authContext.tokenName,
      toolName,
      datasetId,
      success: false,
      errorMessage: "Forbidden: cannot access dataset",
    });
    return addCorsHeaders(forbidden(), request);
  }

  const isMcpSuperAdmin = authContext.role === "admin"
  const enforcementCheck = authContext.userId && !isMcpSuperAdmin
    ? await checkActionEnforcement(authContext.userId, "mcp_tool_invocation", authContext.role, null)
    : { allowed: true }
  if (!enforcementCheck.allowed) {
    await logMCPAudit("auth_failure", {
      tokenId: authContext.tokenId,
      tokenName: authContext.tokenName,
      userId: authContext.userId,
      toolName,
      success: false,
      errorMessage: enforcementCheck.upgradeMessage || enforcementCheck.reason || "Usage limit reached",
    });
    return addCorsHeaders(
      NextResponse.json(
        { error: enforcementCheck.upgradeMessage || enforcementCheck.reason || "Usage limit reached", upgradeRequired: true, usage: enforcementCheck.currentUsage },
        { status: 402 },
      ),
      request,
    );
  }

  const startMs = Date.now();
  const result = await invokeTool(
    {
      name: toolName,
      input: input as Record<string, unknown>,
    },
    { userId: authContext.userId, role: authContext.role },
  );
  const durationMs = Date.now() - startMs;

  await logMCPAudit("invoke_tool", {
    tokenId: authContext.tokenId,
    tokenName: authContext.tokenName,
    userId: authContext.userId,
    toolName,
    datasetId: datasetId ?? undefined,
    success: result.success,
    errorMessage: result.success ? undefined : result.error,
    durationMs,
  });

  recordMCPTrace({
    userId: authContext.userId,
    tokenId: authContext.tokenId,
    tokenName: authContext.tokenName,
    toolName,
    input: JSON.stringify(input).slice(0, 10000),
    output: result.success ? JSON.stringify(result.result).slice(0, 50000) : "",
    latencyMs: durationMs,
    error: result.success ? null : (result.error || "Unknown error"),
  });

  return addCorsHeaders(
    NextResponse.json(result, { status: result.success ? 200 : 400 }),
    request,
  );
}
