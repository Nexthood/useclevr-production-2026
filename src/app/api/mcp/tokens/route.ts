import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db";
import { mcpTokens, type McpTokenScope } from "@/lib/db/schema";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function generateToken(): { raw: string; hash: string; prefix: string } {
  const raw = "mcp_" + randomBytes(24).toString("hex");
  const hash = createHash("sha256").update(raw).digest("hex");
  const prefix = raw.slice(0, 10);
  return { raw, hash, prefix };
}

async function requireAdmin(): Promise<{ userId: string } | NextResponse> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "superadmin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 }) as NextResponse;
  }
  return { userId: session.user.id };
}

export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const db = getDb();
  if (!db) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const tokens = await db.query.mcpTokens.findMany({
    columns: {
      id: true,
      name: true,
      tokenPrefix: true,
      scopes: true,
      status: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
    },
    orderBy: (tokens, { desc }) => [desc(tokens.createdAt)],
  });

  return NextResponse.json({ tokens });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const db = getDb();
  if (!db) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  let body: { name?: unknown; scopes?: unknown; expiresInDays?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.name !== "string" || body.name.trim().length === 0) {
    return NextResponse.json({ error: "Token name is required" }, { status: 400 });
  }

  if (!Array.isArray(body.scopes) || body.scopes.length === 0) {
    return NextResponse.json({ error: "At least one scope is required" }, { status: 400 });
  }

  const validScopes: McpTokenScope[] = ["dataset:read", "dataset:write", "admin", "faq:read"];
  const scopes: McpTokenScope[] = body.scopes.filter((s: string) =>
    validScopes.includes(s as McpTokenScope),
  ) as McpTokenScope[];

  if (scopes.length === 0) {
    return NextResponse.json({ error: "No valid scopes provided" }, { status: 400 });
  }

  const expiresInDays = typeof body.expiresInDays === "number" ? body.expiresInDays : 90;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const { raw, hash, prefix } = generateToken();

  await db.insert(mcpTokens).values({
    id: randomUUID(),
    name: body.name.trim(),
    tokenHash: hash,
    tokenPrefix: prefix,
    scopes,
    status: "active",
    expiresAt,
    createdByUserId: admin.userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return NextResponse.json({
    token: raw,
    name: body.name.trim(),
    prefix,
    scopes,
    expiresAt: expiresAt.toISOString(),
  });
}
