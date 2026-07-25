import { setDefaultAiProvider } from "@/lib/ai/byoai-provider";
import { requireHybridAiFeature } from "@/lib/hybrid-ai/feature-gate";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireHybridAiFeature("aiProviderManagement");
  if (!gate.success) return gate.error;
  const userId = gate.session?.user?.id;
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    await setDefaultAiProvider(userId, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Default provider was not saved.";
    return NextResponse.json({ success: false, code: "DEFAULT_PROVIDER_FAILED", error: message }, { status: 400 });
  }
}
