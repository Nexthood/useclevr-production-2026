import {
  type AiProviderType,
  classifyProviderError,
  safeProviderErrorMessage,
  sanitizeProviderBaseUrlForLog,
  testAiProviderConfig,
  testSavedAiProviderConfig,
  updateAiProviderTestStatus,
} from "@/lib/ai/byoai-provider";
import { requireHybridAiFeature } from "@/lib/hybrid-ai/feature-gate";
import { debugError, debugWarn } from "@/lib/utils/debug";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const testProviderSchema = z.object({
  id: z.string().trim().optional(),
  providerName: z.string().trim().min(1).max(120).optional(),
  provider_name: z.string().trim().min(1).max(120).optional(),
  display_name: z.string().trim().min(1).max(120).optional(),
  providerType: z.string().trim().min(1).max(40).optional(),
  provider_type: z.string().trim().min(1).max(40).optional(),
  baseUrl: z.string().trim().max(2048).optional(),
  base_url: z.string().trim().max(2048).optional(),
  modelName: z.string().trim().min(1).max(160).optional(),
  default_model: z.string().trim().min(1).max(160).optional(),
  apiKey: z.string().trim().max(4096).optional(),
  api_key: z.string().trim().max(4096).optional(),
  useSavedKey: z.boolean().optional(),
  use_saved_key: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const gate = await requireHybridAiFeature("providerHealthChecks");
  if (!gate.success) return gate.error;
  const userId = gate.session?.user?.id;
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  let body: z.infer<typeof testProviderSchema>;

  try {
    body = testProviderSchema.parse(await request.json());
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message || "Invalid provider test request." : "Invalid provider test request.";
    return NextResponse.json({ success: false, code: "VALIDATION_ERROR", error: message }, { status: 400 });
  }

  const input = {
    id: body.id,
    providerName: body.display_name || body.provider_name || body.providerName || "",
    providerType: String(body.provider_type || body.providerType || "openai_compatible") as AiProviderType,
    baseUrl: body.base_url || body.baseUrl || "",
    modelName: body.default_model || body.modelName || "",
    apiKey: body.api_key || body.apiKey || undefined,
  };

  try {
    const result =
      input.apiKey || (body.use_saved_key ?? body.useSavedKey) !== true
        ? await testAiProviderConfig(input)
        : await testSavedAiProviderConfig(userId, input);

    if (input.id) {
      await updateAiProviderTestStatus(userId, result.status, result.message, {
        providerId: input.id,
        latencyMs: result.latencyMs,
        availableModels: result.availableModels,
      }).catch((error) => {
        debugWarn("[BYOAI] Failed to update provider test success status", error);
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = safeProviderErrorMessage(error);
    const status = classifyProviderError(error);
    debugError("[BYOAI] Provider test failed", {
      message,
      status,
      providerName: input.providerName,
      providerType: input.providerType,
      baseUrl: sanitizeProviderBaseUrlForLog(input.baseUrl),
      modelName: input.modelName,
      hasApiKey: Boolean(input.apiKey),
    });

    if (input.id) {
      await updateAiProviderTestStatus(userId, status, message, { providerId: input.id }).catch((updateError) => {
        debugWarn("[BYOAI] Failed to update provider test failure status", updateError);
      });
    }

    return NextResponse.json({ success: false, status, error: message, modelConfirmed: false }, { status: 400 });
  }
}
