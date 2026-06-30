import { auth } from "@/lib/auth/auth";
import {
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
    providerName?: unknown;
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
    providerName: String(body.providerName || ""),
    baseUrl: String(body.baseUrl || ""),
    modelName: String(body.modelName || ""),
    apiKey: typeof body.apiKey === "string" && body.apiKey.trim() ? body.apiKey : undefined,
  };

  try {
    const result =
      input.apiKey || body.useSavedKey !== true
        ? await testAiProviderConfig(input)
        : await testSavedAiProviderConfig(userId, input);

    await updateAiProviderTestStatus(userId, "success", result.message).catch((error) => {
      debugWarn("[BYOAI] Failed to update provider test success status", error);
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connection failed.";
    debugError("[BYOAI] Provider test failed", {
      message,
      providerName: input.providerName,
      baseUrl: input.baseUrl,
      modelName: input.modelName,
      hasApiKey: Boolean(input.apiKey),
    });

    await updateAiProviderTestStatus(userId, "failed", message).catch((updateError) => {
      debugWarn("[BYOAI] Failed to update provider test failure status", updateError);
    });

    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
