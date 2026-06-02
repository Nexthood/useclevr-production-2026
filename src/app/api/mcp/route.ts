import { auth } from "@/lib/auth/auth";
import { getResource, invokeTool, listResources, listTools } from "@/lib/mcp/server";
import { debugError } from "@/lib/utils/debug";
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

export async function GET(request: NextRequest) {
  const session = await requireSession();
  if (!session) return unauthorized();

  const datasetId = request.nextUrl.searchParams.get("datasetId");
  const resourceUri = request.nextUrl.searchParams.get("resource");

  try {
    if (resourceUri) {
      return NextResponse.json({ resource: getResource(resourceUri) });
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
  const result = await invokeTool({
    name: body.name,
    input: input as Record<string, unknown>,
  });

  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
