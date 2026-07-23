import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth/auth";
import { getRetailConnector } from "@/integrations/retail/core/connector.factory";
import {
  getOwnedRetailConnection,
  markConnectionDisconnected,
} from "@/integrations/retail/core/connection.service";

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

  await getRetailConnector(connection.provider).revokeConnection(connection).catch(() => undefined);
  await markConnectionDisconnected(connection);

  return NextResponse.json({
    status: "disconnected",
    message: "Square is disconnected. Imported analytics data remains until deleted separately.",
  });
}
