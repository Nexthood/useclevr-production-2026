import { healthCheckEnabledAiProviders } from "@/lib/ai/byoai-provider";
import { auth } from "@/lib/auth/auth";
import { debugError } from "@/lib/utils/debug";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await healthCheckEnabledAiProviders(userId);
    return NextResponse.json({ success: true, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Provider health check failed.";
    debugError("[BYOAI] Enabled provider health check failed", { userId, message });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
