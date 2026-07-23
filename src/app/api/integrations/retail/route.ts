import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/auth";
import { listRetailConnectionSummaries } from "@/integrations/retail/core/connection.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const connections = await listRetailConnectionSummaries(session.user.id);
    return NextResponse.json({
      providers: [
        { provider: "square", label: "Square", available: true },
        { provider: "shopify", label: "Shopify POS", available: false },
        { provider: "lightspeed", label: "Lightspeed Retail", available: false },
        { provider: "clover", label: "Clover", available: false },
      ],
      connections,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load retail integrations.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
