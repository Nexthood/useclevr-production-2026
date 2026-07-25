import { getAiMode, getUseClevrCloudFallbackAllowed, setAiMode, toPublicAiMode, type AiMode } from "@/lib/ai/byoai-provider";
import { requireHybridAiFeature } from "@/lib/hybrid-ai/feature-gate";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const modeSchema = z.object({
  mode: z.enum(["automatic", "local", "byok", "useclevr_cloud", "auto", "local-only", "cloud-only"]),
  allow_useclevr_cloud_fallback: z.boolean().optional(),
});

export async function GET() {
  const gate = await requireHybridAiFeature("aiProviderManagement");
  if (!gate.success) return gate.error;
  const userId = gate.session?.user?.id;
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const [mode, allowUseclevrCloudFallback] = await Promise.all([
    getAiMode(userId),
    getUseClevrCloudFallbackAllowed(userId),
  ]);
  return NextResponse.json({
    success: true,
    mode: toPublicAiMode(mode),
    allow_useclevr_cloud_fallback: allowUseclevrCloudFallback,
  });
}

export async function PUT(request: NextRequest) {
  const gate = await requireHybridAiFeature("aiProviderManagement");
  if (!gate.success) return gate.error;
  const userId = gate.session?.user?.id;
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  let parsed: z.infer<typeof modeSchema>;
  try {
    parsed = modeSchema.parse(await request.json());
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message || "Invalid AI mode." : "Invalid AI mode.";
    return NextResponse.json({ success: false, code: "VALIDATION_ERROR", error: message }, { status: 400 });
  }

  await setAiMode(userId, parsed.mode as AiMode, {
    allowUseclevrCloudFallback: parsed.allow_useclevr_cloud_fallback,
  });
  return NextResponse.json({ success: true });
}
