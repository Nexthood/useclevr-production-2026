import { NextResponse, type NextRequest } from "next/server";

import { receiveRetailWebhook } from "@/integrations/retail/core/webhook-engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const headers = Object.fromEntries(
    [...request.headers.entries()].map(([key, value]) => [key.toLowerCase(), value]),
  );

  try {
    const result = await receiveRetailWebhook({ provider: "square", headers, rawBody });
    if (!result.accepted) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ received: true, duplicate: Boolean(result.duplicate) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
