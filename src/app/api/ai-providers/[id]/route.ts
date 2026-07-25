import { deleteAiProviderConfig, listPublicAiProviderConfigs, saveAiProviderConfig, type AiProviderType } from "@/lib/ai/byoai-provider";
import { requireHybridAiFeature } from "@/lib/hybrid-ai/feature-gate";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const providerUpdateSchema = z.object({
  display_name: z.string().trim().min(1).max(120).optional(),
  provider_name: z.string().trim().min(1).max(120).optional(),
  provider_type: z.string().trim().min(1).max(40).optional(),
  providerType: z.string().trim().min(1).max(40).optional(),
  base_url: z.string().trim().max(2048).optional(),
  baseUrl: z.string().trim().max(2048).optional(),
  default_model: z.string().trim().min(1).max(160).optional(),
  modelName: z.string().trim().min(1).max(160).optional(),
  api_key: z.string().trim().max(4096).optional(),
  apiKey: z.string().trim().max(4096).optional(),
  is_enabled: z.boolean().optional(),
  enabled: z.boolean().optional(),
  is_default: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  priority: z.number().int().min(0).max(999).optional(),
});

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireHybridAiFeature("aiProviderManagement");
  if (!gate.success) return gate.error;
  const userId = gate.session?.user?.id;
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  let parsed: z.infer<typeof providerUpdateSchema>;
  try {
    parsed = providerUpdateSchema.parse(await request.json());
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message || "Invalid provider request." : "Invalid provider request.";
    return NextResponse.json({ success: false, code: "VALIDATION_ERROR", error: message }, { status: 400 });
  }

  try {
    const { id } = await params;
    const existing = (await listPublicAiProviderConfigs(userId)).find((provider) => provider.id === id);
    if (!existing) {
      return NextResponse.json({ success: false, code: "PROVIDER_NOT_FOUND", error: "Provider was not found." }, { status: 404 });
    }
    const provider = await saveAiProviderConfig(userId, {
      id,
      providerName: parsed.display_name || parsed.provider_name || existing.providerName,
      providerType: (parsed.provider_type || parsed.providerType || existing.providerType) as AiProviderType,
      baseUrl: parsed.base_url || parsed.baseUrl || existing.baseUrl,
      modelName: parsed.default_model || parsed.modelName || existing.modelName,
      apiKey: parsed.api_key ?? parsed.apiKey,
      enabled: parsed.is_enabled ?? parsed.enabled ?? existing.enabled,
      isDefault: parsed.is_default ?? parsed.isDefault ?? existing.isDefault,
      isFallback: existing.isFallback,
      priority: parsed.priority ?? existing.priority,
    });
    return NextResponse.json({ success: true, provider });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI provider was not saved.";
    return NextResponse.json({ success: false, code: "PROVIDER_SAVE_FAILED", error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireHybridAiFeature("aiProviderManagement");
  if (!gate.success) return gate.error;
  const userId = gate.session?.user?.id;
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const provider = await deleteAiProviderConfig(userId, id);
    return NextResponse.json({ success: true, provider });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI provider was not deleted.";
    return NextResponse.json({ success: false, code: "PROVIDER_DELETE_FAILED", error: message }, { status: 400 });
  }
}
