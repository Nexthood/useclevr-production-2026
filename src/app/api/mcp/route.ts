import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db";
import { datasets } from "@/lib/db/schema";
import { getResource, invokeTool, listResources, listTools } from "@/lib/mcp/server";
import { debugError } from "@/lib/utils/debug";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

type McpInvocationBody = {
  name?: unknown;
  input?: unknown;
};

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

async function requireSession() {
  const session = await auth();
  return session?.user?.id ? session : null;
}

function datasetIdFromResource(resourceUri: string) {
  const match = resourceUri.match(/^dataset:\/\/([^/]+)\//);
  return match?.[1] ?? null;
}

function datasetIdFromInput(input: Record<string, unknown>) {
  return typeof input.datasetId === "string" ? input.datasetId : null;
}

async function canAccessDataset(session: NonNullable<Awaited<ReturnType<typeof requireSession>>>, datasetId: string) {
  if (session.user.role === "superadmin") return true;

  const db = getDb();
  if (!db) return false;

  const record = await db.query.datasets.findFirst({
    where: and(eq(datasets.id, datasetId), eq(datasets.userId, session.user.id)),
    columns: { id: true },
  });

  return Boolean(record);
}

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function GET(request: NextRequest) {
  const session = await requireSession();
  if (!session) return unauthorized();

  const datasetId = request.nextUrl.searchParams.get("datasetId");
  const resourceUri = request.nextUrl.searchParams.get("resource");

  try {
    if (resourceUri) {
      const resourceDatasetId = datasetIdFromResource(resourceUri);
      if (resourceDatasetId && !(await canAccessDataset(session, resourceDatasetId))) {
        return forbidden();
      }

      return NextResponse.json({ resource: getResource(resourceUri) });
    }

    if (datasetId && !(await canAccessDataset(session, datasetId))) {
      return forbidden();
    }

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
  const session = await requireSession();
  if (!session) return unauthorized();

  let body: McpInvocationBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.name !== "string") {
    return NextResponse.json({ error: "Tool name is required" }, { status: 400 });
  }

  const input = body.input && typeof body.input === "object" ? body.input : {};
  const datasetId = datasetIdFromInput(input as Record<string, unknown>);
  if (datasetId && !(await canAccessDataset(session, datasetId))) {
    return forbidden();
  }

  const result = await invokeTool({
    name: body.name,
    input: input as Record<string, unknown>,
  });

  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
