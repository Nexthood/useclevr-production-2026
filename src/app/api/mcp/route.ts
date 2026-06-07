import { auth } from "@/lib/auth/auth";
import { config as appConfig } from "@/lib/config";
import { getDb } from "@/lib/db";
import { datasets } from "@/lib/db/schema";
import { getResource, invokeTool, listResources, listTools } from "@/lib/mcp/server";
import { debugError, debugLog } from "@/lib/utils/debug";
import { checkRateLimit } from "@/lib/utils/rate-limiter";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

const ADMIN_ONLY_TOOLS = ["compareDatasets", "getCostBreakdown"];

// ============================================================================
// MCP AUDIT LOGGER
// ============================================================================
function logMCPAudit(action: string, details: Record<string, unknown>) {
  // Ensure we do NOT log any raw data or full datasets
  const safeDetails = { ...details };
  delete safeDetails.data;
  delete safeDetails.results;
  delete safeDetails.rows;
  delete safeDetails.result;
  debugLog(`[MCP-AUDIT] Action: ${action} | Details: ${JSON.stringify(safeDetails)}`);
}

// ============================================================================
// TOKEN AND SESSION AUTHENTICATION
// ============================================================================
async function validateMCPAuth(request: NextRequest) {
  // 1. Check for token headers
  const serviceToken = request.headers.get("x-mcp-service-token");
  const adminToken = request.headers.get("x-mcp-admin-token");

  const envServiceToken = appConfig.MCP_SERVICE_TOKEN;
  const envAdminToken = appConfig.MCP_ADMIN_TOKEN;

  if (adminToken && envAdminToken && adminToken === envAdminToken) {
    return { authenticated: true, role: "admin", clientId: "internal-admin-client" };
  }

  if (serviceToken && envServiceToken && serviceToken === envServiceToken) {
    return { authenticated: true, role: "service", clientId: "internal-service-client" };
  }

  // 2. Fall back to standard session auth
  const session = await auth();
  if (session?.user?.id) {
    return {
      authenticated: true,
      role: session.user.role === "superadmin" ? "admin" : "user",
      userId: session.user.id,
      clientId: `user-${session.user.id}`,
    };
  }

  return { authenticated: false, role: "guest", clientId: null };
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

async function canAccessDataset(authContext: { authenticated: boolean; role: string; userId?: string }, datasetId: string) {
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
  if (!authContext.authenticated) return unauthorized();

  // Rate limit: 50 requests per minute per client
  const rateLimitKey = `mcp:${authContext.clientId || "anonymous"}`;
  if (!checkRateLimit(rateLimitKey, 50, 60_000)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const datasetId = request.nextUrl.searchParams.get("datasetId");
  const resourceUri = request.nextUrl.searchParams.get("resource");

  try {
    if (resourceUri) {
      const resourceDatasetId = datasetIdFromResource(resourceUri);
      if (resourceDatasetId && !(await canAccessDataset(authContext, resourceDatasetId))) {
        return forbidden();
      }

      logMCPAudit("read_resource", { clientId: authContext.clientId, resource: resourceUri });
      return NextResponse.json({ resource: getResource(resourceUri) });
    }

    if (datasetId && !(await canAccessDataset(authContext, datasetId))) {
      return forbidden();
    }

    logMCPAudit("list_tools_and_resources", { clientId: authContext.clientId, datasetId });

    return NextResponse.json({
      tools: listTools(),
      resources: datasetId ? listResources(datasetId) : [],
    });
  } catch (error) {
    debugError("[MCP] GET failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "MCP request failed" },
      { status: 400 },
    );
  }
}

export async function POST(request: NextRequest) {
  const authContext = await validateMCPAuth(request);
  if (!authContext.authenticated) return unauthorized();

  // Rate limit: 50 requests per minute per client
  const rateLimitKey = `mcp:${authContext.clientId || "anonymous"}`;
  if (!checkRateLimit(rateLimitKey, 50, 60_000)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  let body: { name?: unknown; input?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.name !== "string") {
    return NextResponse.json({ error: "Tool name is required" }, { status: 400 });
  }

  const toolName = body.name;
  if (!isToolAllowedForRole(toolName, authContext.role)) {
    return forbidden();
  }

  const input = body.input && typeof body.input === "object" ? body.input : {};
  const datasetId = datasetIdFromInput(input as Record<string, unknown>);
  if (datasetId && !(await canAccessDataset(authContext, datasetId))) {
    return forbidden();
  }

  logMCPAudit("invoke_tool", { clientId: authContext.clientId, tool: toolName, datasetId });

  const result = await invokeTool({
    name: toolName,
    input: input as Record<string, unknown>,
  });

  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
