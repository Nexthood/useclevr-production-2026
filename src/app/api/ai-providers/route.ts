import {
  listPublicAiProviderConfigs,
  saveAiProviderConfig,
  type AiProviderType,
} from "@/lib/ai/byoai-provider";
import { requireHybridAiFeature } from "@/lib/hybrid-ai/feature-gate";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const providerSchema = z.object({
  id: z.string().trim().optional(),
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

export async function GET() {
  const gate = await requireHybridAiFeature("aiProviderManagement");
  if (!gate.success) return gate.error;
  const userId = gate.session?.user?.id;
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const providers = await listPublicAiProviderConfigs(userId);
  return NextResponse.json({ success: true, providers });
}

export async function POST(request: NextRequest) {
  return saveFromRequest(request);
}

export async function PUT(request: NextRequest) {
  return saveFromRequest(request);
}

async function saveFromRequest(request: NextRequest) {
  const gate = await requireHybridAiFeature("aiProviderManagement");
  if (!gate.success) return gate.error;
  const userId = gate.session?.user?.id;
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  let parsed: z.infer<typeof providerSchema>;
  try {
    parsed = providerSchema.parse(await request.json());
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message || "Invalid provider request." : "Invalid provider request.";
    return NextResponse.json({ success: false, code: "VALIDATION_ERROR", error: message }, { status: 400 });
  }

  try {
    const provider = await saveAiProviderConfig(userId, {
      id: parsed.id,
      providerName: parsed.display_name || parsed.provider_name || "",
      providerType: (parsed.provider_type || parsed.providerType || "openai-compatible") as AiProviderType,
      baseUrl: parsed.base_url || parsed.baseUrl || "",
      modelName: parsed.default_model || parsed.modelName || "",
      apiKey: parsed.api_key ?? parsed.apiKey,
      enabled: parsed.is_enabled ?? parsed.enabled ?? true,
      isDefault: parsed.is_default ?? parsed.isDefault ?? false,
      priority: parsed.priority,
    });
    return NextResponse.json({ success: true, provider });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI provider was not saved.";
    return NextResponse.json({ success: false, code: "PROVIDER_SAVE_FAILED", error: message }, { status: 400 });
  }
}
