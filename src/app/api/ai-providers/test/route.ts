import { auth } from "@/lib/auth/auth";
import {
  type AiProviderType,
  classifyProviderError,
  safeProviderErrorMessage,
  testAiProviderConfig,
  testSavedAiProviderConfig,
  updateAiProviderTestStatus,
} from "@/lib/ai/byoai-provider";
import { debugError, debugWarn } from "@/lib/utils/debug";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    id?: unknown;
    providerName?: unknown;
    providerType?: unknown;
    baseUrl?: unknown;
    modelName?: unknown;
    apiKey?: unknown;
    useSavedKey?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
  }

  const input = {
    id: typeof body.id === "string" ? body.id : undefined,
    providerName: String(body.providerName || ""),
    providerType: String(body.providerType || "openai-compatible") as AiProviderType,
    baseUrl: String(body.baseUrl || ""),
    modelName: String(body.modelName || ""),
    apiKey: typeof body.apiKey === "string" && body.apiKey.trim() ? body.apiKey : undefined,
  };

  try {
    const result =
      input.apiKey || body.useSavedKey !== true
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
      baseUrl: input.baseUrl,
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
