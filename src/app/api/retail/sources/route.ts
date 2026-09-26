import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/auth";
import { listRetailAnalyticsSources } from "@/integrations/retail/analytics/square-analytics.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Retail analytics sources available to the signed-in user: uploaded retail
 * datasets plus connected POS connections. Every entry is owner-scoped
 * server-side, so the selector can only ever list the user's own sources.
 */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { datasets: retailDatasets, connections } = await listRetailAnalyticsSources(userId);
    return NextResponse.json(
      { datasets: retailDatasets, connections },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Retail sources could not be loaded.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
