import { updateAiProviderPriority } from "@/lib/ai/byoai-provider";
import { requireHybridAiFeature } from "@/lib/hybrid-ai/feature-gate";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const prioritySchema = z.object({
  priority: z.number().int().min(0).max(999),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireHybridAiFeature("aiProviderManagement");
  if (!gate.success) return gate.error;
  const userId = gate.session?.user?.id;
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  let parsed: z.infer<typeof prioritySchema>;
  try {
    parsed = prioritySchema.parse(await request.json());
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message || "Invalid priority." : "Invalid priority.";
    return NextResponse.json({ success: false, code: "VALIDATION_ERROR", error: message }, { status: 400 });
  }

  try {
    const { id } = await params;
    await updateAiProviderPriority(userId, id, parsed.priority);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Provider priority was not saved.";
    return NextResponse.json({ success: false, code: "PRIORITY_UPDATE_FAILED", error: message }, { status: 400 });
  }
}
