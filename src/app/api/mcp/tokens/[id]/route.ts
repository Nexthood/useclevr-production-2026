import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db";
import { mcpTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "superadmin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  if (!db) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;

  const existing = await db.query.mcpTokens.findFirst({
    where: eq(mcpTokens.id, id),
    columns: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }

  await db.update(mcpTokens)
    .set({ status: "revoked", updatedAt: new Date() })
    .where(eq(mcpTokens.id, id));

  return NextResponse.json({ success: true });
}
