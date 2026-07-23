import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth/auth";
import { getOwnedRetailConnection } from "@/integrations/retail/core/connection.service";
import { hasActiveRetailSync, queueRetailSync } from "@/integrations/retail/core/sync-engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { connectionId } = await params;
  const connection = await getOwnedRetailConnection({ userId: session.user.id, connectionId });
  if (!connection) return NextResponse.json({ error: "Connection not found." }, { status: 404 });
  if (connection.connectionStatus === "disconnected") {
    return NextResponse.json({ error: "Reconnect Square before syncing." }, { status: 400 });
  }
  if (await hasActiveRetailSync(connection.id)) {
    return NextResponse.json({ status: "queued", message: "A sync is already queued or running." });
  }
  const run = await queueRetailSync(connection, "manual");
  return NextResponse.json({ status: run.status, syncRunId: run.id });
}
