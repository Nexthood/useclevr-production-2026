import { auth } from "@/lib/auth/auth";
import { isSuperAdminUserId } from "@/lib/auth/builtin-users";
import { getDb } from "@/lib/db";
import { mcpTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = String(session.user.role ?? "");
  const hasSuperAdminRole = role === "superadmin" || role === "admin" || isSuperAdminUserId(session.user.id);
  if (!hasSuperAdminRole) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
