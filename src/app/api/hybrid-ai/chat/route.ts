import { z } from "zod";

import {
  generateWithUniversalAiAdapter,
  getAiMode,
  getUseClevrCloudFallbackAllowed,
  isLocalAiUnavailableError,
  logDefaultCloudFallback,
  logUniversalAiResponse,
} from "@/lib/ai/universal-ai-adapter";
import { listPrivateAiProviderConfigs, isCloudProvider } from "@/lib/ai/byoai-provider";
import { auditInputFromAdapterResult, recordAiRequestAudit } from "@/lib/ai/ai-request-audit";
import { debugError, debugLog, debugWarn } from "@/lib/utils/debug";
import { requireHybridAiFeature } from "@/lib/hybrid-ai/feature-gate";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type HybridProviderStatus = {
  label: string;
  state: "connection_healthy" | "fallback_active" | "provider_unavailable" | "offline_active" | "local_unavailable";
  message: string;
  fallbackActive: boolean;
  route: "local" | "cloud" | "none";
};

const chatMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]).default("user"),
  content: z.string().min(1),
});

const hybridChatSchema = z.object({
  message: z.string().optional(),
  messages: z.array(chatMessageSchema).optional(),
});

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const gate = await requireHybridAiFeature("privateChat");
  if (!gate.success) return gate.error;
  const userId = gate.session?.user?.id;
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  let parsed: z.infer<typeof hybridChatSchema>;
  try {
    parsed = hybridChatSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ success: false, error: "Send a message to chat with Hybrid AI." }, { status: 400 });
  }

  const messages = normalizeMessages(parsed);
  if (messages.length === 0) {
    return NextResponse.json({ success: false, error: "Send a message to chat with Hybrid AI." }, { status: 400 });
  }

  const prompt = buildHybridChatPrompt(messages);
  const [aiMode, allowUseclevrCloudFallback] = await Promise.all([
    getAiMode(userId),
    getUseClevrCloudFallbackAllowed(userId),
  ]);
  let userProviderFailed = false;

  try {
    const result = await generateWithUniversalAiAdapter(userId, prompt, { mode: aiMode });
    if (result) {
      logUniversalAiResponse(result);
      recordAiRequestAudit(auditInputFromAdapterResult(userId, result, "chat"));
      debugLog("[HYBRID_AI_CHAT] User provider response generated", {
        userId,
        providerName: result.providerName,
        providerType: result.providerType,
        modelName: result.modelName,
        fallbackUsed: result.fallbackUsed,
        mode: result.mode,
        route: result.route,
      });

      return NextResponse.json({
        success: true,
        answer: result.text,
        content: result.text,
        providerName: result.providerName,
        modelName: result.modelName,
        mode: result.mode,
        route: result.route,
        providerStatus: providerStatusFromAdapterResult(
          result.providerType,
          result.providerName,
          result.fallbackUsed,
          result.mode,
          result.route,
        ),
      });
    }
  } catch (error) {
    if (isLocalAiUnavailableError(error)) {
      const message = "Offline mode is enabled, but your local AI provider is not reachable.";
      recordAiRequestAudit({
        userId,
        providerName: "Offline mode",
        providerType: "offline-mode",
        modelName: "none",
        mode: aiMode,
        executionLocation: "none",
        fallbackUsed: false,
        purpose: "chat",
        success: false,
        errorReason: error instanceof Error ? error.message : String(error),
      });
      debugWarn("[HYBRID_AI_CHAT] Offline mode blocked cloud fallback", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({
        success: false,
        code: "AI_PROVIDER_ERROR",
        message,
        requestId,
        error: message,
        answer: message,
        content: message,
        providerName: "Offline mode",
        modelName: "",
        mode: "local-only",
        route: "none",
        providerStatus: {
          label: "Offline mode",
          state: "local_unavailable",
          message: "Local provider unavailable",
          fallbackActive: false,
          route: "none",
        } satisfies HybridProviderStatus,
      }, { status: 503 });
    }

    logDefaultCloudFallback(userId, error);
    userProviderFailed = true;
    debugWarn("[HYBRID_AI_CHAT] User provider failed; trying configured cloud AI", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const configuredProviders = await listPrivateAiProviderConfigs(userId);
  const hasCloudProvider = configuredProviders.some((p) => p.enabled && isCloudProvider(p.providerType));

  if (!allowUseclevrCloudFallback && userProviderFailed) {
    const message = "UseClevr Cloud fallback is disabled. Please check AI provider settings.";
    debugWarn("[HYBRID_AI_CHAT] Cloud fallback disabled by user preference", { userId, mode: aiMode });
    recordAiRequestAudit({
      userId,
      providerName: "UseClevr Cloud fallback disabled",
      providerType: "default-cloud",
      modelName: "none",
      mode: aiMode,
      executionLocation: "none",
      fallbackUsed: false,
      purpose: "chat",
      success: false,
      errorReason: "Cloud fallback disabled",
    });
    return NextResponse.json({
      success: false,
      code: "AI_PROVIDER_ERROR",
      message,
      requestId,
      error: message,
      answer: message,
      content: message,
      providerName: "Hybrid AI",
      modelName: "",
      mode: aiMode,
      route: "none",
      providerStatus: {
        label: "Hybrid AI",
        state: "provider_unavailable",
        message: "Cloud fallback disabled",
        fallbackActive: false,
        route: "none",
      } satisfies HybridProviderStatus,
    }, { status: 503 });
  }

  if (!hasCloudProvider) {
    const message = "AI provider is not configured yet. Please check AI provider settings.";
    debugWarn("[HYBRID_AI_CHAT] No cloud provider configured", { userId });
    recordAiRequestAudit({
      userId,
      providerName: "No provider configured",
      providerType: "none",
      modelName: "none",
      mode: aiMode,
      executionLocation: "none",
      fallbackUsed: userProviderFailed,
      purpose: "chat",
      success: false,
      errorReason: "No cloud provider configured",
    });
    return NextResponse.json({
      success: false,
      code: "AI_PROVIDER_ERROR",
      message,
      requestId,
      error: message,
      answer: message,
      content: message,
      providerName: "UseClevr Hybrid AI",
      modelName: "",
      mode: aiMode,
      route: "none",
      providerStatus: {
        label: "Hybrid AI",
        state: "provider_unavailable",
        message: "Provider not configured",
        fallbackActive: false,
        route: "none",
      } satisfies HybridProviderStatus,
    }, { status: 503 });
  }

  try {
    const result = await generateWithUniversalAiAdapter(userId, prompt, { mode: "cloud-only" });
    if (result) {
      logUniversalAiResponse(result);
      recordAiRequestAudit(auditInputFromAdapterResult(userId, result, "chat"));
      debugLog("[HYBRID_AI_CHAT] Cloud fallback provider response generated", {
        userId,
        providerName: result.providerName,
        providerType: result.providerType,
        modelName: result.modelName,
        fallbackUsed: true,
        mode: result.mode,
        route: result.route,
      });

      return NextResponse.json({
        success: true,
        answer: result.text,
        content: result.text,
        providerName: result.providerName,
        modelName: result.modelName,
        mode: result.mode,
        route: result.route,
        providerStatus: providerStatusFromAdapterResult(
          result.providerType,
          result.providerName,
          true,
          result.mode,
          result.route,
        ),
      });
    }
    throw new Error("Cloud fallback provider returned no response.");
  } catch (cloudError) {
    const message = "AI provider is not configured yet. Please check AI provider settings.";
    debugError("[HYBRID_AI_CHAT] Cloud fallback failed", {
      userId,
      error: cloudError instanceof Error ? cloudError.message : String(cloudError),
    });
    recordAiRequestAudit({
      userId,
      providerName: "Cloud fallback",
      providerType: "cloud",
      modelName: "none",
      mode: aiMode,
      executionLocation: "cloud",
      fallbackUsed: true,
      purpose: "chat",
      success: false,
      errorReason: cloudError instanceof Error ? cloudError.message : String(cloudError),
    });
    return NextResponse.json({
      success: false,
      code: "AI_PROVIDER_ERROR",
      message,
      requestId,
      error: message,
      providerStatus: {
        label: "Hybrid AI",
        state: "provider_unavailable",
        message: "Provider unavailable",
        fallbackActive: false,
        route: "none",
      } satisfies HybridProviderStatus,
    }, { status: 503 });
  }
}

function normalizeMessages(input: z.infer<typeof hybridChatSchema>) {
  if (Array.isArray(input.messages) && input.messages.length > 0) return input.messages;
  const message = input.message?.trim();
  return message ? [{ role: "user" as const, content: message }] : [];
}

function buildHybridChatPrompt(messages: Array<{ role: "system" | "user" | "assistant"; content: string }>) {
  const transcript = messages
    .slice(-16)
    .map((message) => `${message.role.toUpperCase()}: ${message.content.trim()}`)
    .join("\n\n");

  return [
    "You are UseClevr Hybrid AI, a concise business analysis assistant.",
    "Answer the latest user message clearly. If the user asks about private/local AI, explain the current answer uses the configured UseClevr AI provider routing.",
    "Do not mention API keys or internal secrets.",
    "",
    transcript,
    "",
    "ASSISTANT:",
  ].join("\n");
}

function providerStatusFromAdapterResult(
  providerType: string,
  providerName: string,
  fallbackUsed: boolean,
  mode?: string,
  route?: string,
): HybridProviderStatus {
  const isLocalRoute = route === "local";
  return {
    label: providerStatusLabel(providerType, providerName),
    state: mode === "local-only" ? "offline_active" : fallbackUsed ? "fallback_active" : "connection_healthy",
    message: mode === "local-only" ? "Offline mode active" : isLocalRoute ? "Local AI active" : fallbackUsed ? "Cloud fallback active" : "Connected",
    fallbackActive: fallbackUsed,
    route: isLocalRoute ? "local" : "cloud",
  };
}

function providerStatusLabel(providerType: string, providerName: string) {
  if (providerType === "ollama") return "Ollama";
  if (providerType === "lm-studio") return "LM Studio";
  if (providerType === "openai-compatible") return "OpenAI Compatible";
  if (providerType === "azure-openai") return "Azure OpenAI";
  if (providerType === "google-gemini") return "Google Gemini";
  if (providerType === "openai") return "OpenAI";
  if (providerType === "anthropic") return "Anthropic";
  return providerName || "AI Provider";
}
