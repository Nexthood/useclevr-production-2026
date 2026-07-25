import { setAiProviderRouting } from "@/lib/ai/byoai-provider";
import { requireHybridAiFeature } from "@/lib/hybrid-ai/feature-gate";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const routingSchema = z.object({
  default_provider_id: z.string().trim().optional(),
  fallback_provider_id: z.string().trim().optional(),
});

export async function PUT(request: NextRequest) {
  const gate = await requireHybridAiFeature("aiProviderManagement");
  if (!gate.success) return gate.error;
  const userId = gate.session?.user?.id;
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  let parsed: z.infer<typeof routingSchema>;
  try {
    parsed = routingSchema.parse(await request.json());
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message || "Invalid routing request." : "Invalid routing request.";
    return NextResponse.json({ success: false, code: "VALIDATION_ERROR", error: message }, { status: 400 });
  }

  try {
    await setAiProviderRouting(userId, {
      defaultProviderId: parsed.default_provider_id,
      fallbackProviderId: parsed.fallback_provider_id,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI provider routing was not saved.";
    return NextResponse.json({ success: false, code: "ROUTING_UPDATE_FAILED", error: message }, { status: 400 });
  }
}
