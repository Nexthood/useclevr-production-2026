import { google } from "@ai-sdk/google";
import { generateText } from "ai";

import {
  generateWithUniversalAiAdapter,
  getAiMode,
  getUseClevrCloudFallbackAllowed,
  isLocalAiUnavailableError,
  logDefaultCloudFallback,
  logUniversalAiResponse,
  type AiMode,
} from "@/lib/ai/universal-ai-adapter";
import {
  auditInputFromAdapterResult,
  recordAiRequestAudit,
  type AiRequestAuditInput,
} from "@/lib/ai/ai-request-audit";
import type { AiRequestAuditPurpose } from "@/lib/db/schema";
import {
  getHybridAiFeatureAccess,
  logBlockedHybridAiFeatureAttempt,
} from "@/lib/hybrid-ai/feature-gate";
import type { HybridAiFeatureId } from "@/lib/hybrid-ai/features";
import { debugLog, debugWarn } from "@/lib/utils/debug";
import { normalizeProviderUsage, type ProviderUsage } from "@/lib/billing/provider-usage";

export interface ServerAiTextResult {
  text: string;
  providerName: string;
  modelName: string;
  fallbackUsed: boolean;
  source: "user-provider" | "default-cloud";
  statusMessage?: string;
  usage?: ProviderUsage;
}

export async function generateServerAiText(
  prompt: string,
  options: {
    userId?: string;
    context: string;
    datasetId?: string | null;
    purpose?: AiRequestAuditPurpose;
  }
): Promise<ServerAiTextResult | null> {
  const purpose = options.purpose ?? inferAiRequestPurpose(options.context);
  let aiMode: AiMode = "auto";
  let userProviderFailed = false;
  let allowUseclevrCloudFallback = true;

  if (options.userId) {
    [aiMode, allowUseclevrCloudFallback] = await Promise.all([
      getAiMode(options.userId),
      getUseClevrCloudFallbackAllowed(options.userId),
    ]);
    const requiredFeature = featureForAiPurpose(purpose);
    const access = await getHybridAiFeatureAccess(options.userId);
    if (!access.enabledFeatureIds.includes(requiredFeature)) {
      logBlockedHybridAiFeatureAttempt({
        userId: options.userId,
        role: access.role,
        subscriptionTier: access.subscriptionTier,
        featureId: requiredFeature,
        requiredTier: requiredFeature === "aiReports" ? "mega" : "lite",
        source: options.context,
        message: "Hybrid AI provider routing is unavailable for this plan; using default cloud AI.",
      });
    } else {
    try {
      const result = await generateWithUniversalAiAdapter(options.userId, prompt, { mode: aiMode });

      if (result) {
        logUniversalAiResponse(result);
        recordAiRequestAudit(
          auditInputFromAdapterResult(options.userId, result, purpose, options.datasetId),
        );
        debugLog(`[${options.context}] User AI provider response generated`, {
          providerName: result.providerName,
          providerType: result.providerType,
          modelName: result.modelName,
          fallbackUsed: result.fallbackUsed,
        });
        return {
          text: result.text.trim(),
          providerName: result.providerName,
          modelName: result.modelName,
          fallbackUsed: result.fallbackUsed,
          source: "user-provider",
          usage: result.usage,
        };
      }

      debugLog(`[${options.context}] No user AI provider configured; using default cloud AI`);
    } catch (error) {
      if (isLocalAiUnavailableError(error)) {
        recordAiRequestAudit({
          userId: options.userId,
          datasetId: options.datasetId,
          providerName: "Offline mode",
          providerType: "offline-mode",
          modelName: "none",
          mode: aiMode,
          executionLocation: "none",
          fallbackUsed: false,
          purpose,
          success: false,
          errorReason: error instanceof Error ? error.message : String(error),
        });
        debugWarn(`[${options.context}] Offline mode blocked cloud fallback`, {
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
      logDefaultCloudFallback(options.userId, error);
      userProviderFailed = true;
      debugWarn(`[${options.context}] User AI provider failed; using default cloud AI`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    }
  }

  if (options.userId && !allowUseclevrCloudFallback && aiMode !== "cloud-only") {
    recordAiRequestAudit(defaultCloudAuditInput(options.userId, {
      datasetId: options.datasetId,
      mode: aiMode,
      purpose,
      fallbackUsed: false,
      success: false,
      errorReason: userProviderFailed ? "Cloud fallback disabled" : "Cloud fallback disabled with no provider result",
      executionLocation: "none",
    }));
    debugWarn(`[${options.context}] Default cloud fallback disabled by user preference`);
    return null;
  }

  try {
    const { text, usage } = await generateText({
      model: google("gemini-2.5-flash"),
      prompt,
    });
    const normalizedText = text.trim();
    if (!normalizedText) return null;

    if (options.userId) {
      recordAiRequestAudit(defaultCloudAuditInput(options.userId, {
        datasetId: options.datasetId,
        mode: aiMode,
        purpose,
        fallbackUsed: userProviderFailed,
        success: true,
      }));
    }

    debugLog(`[${options.context}] Default cloud AI response generated`, {
      providerName: "gemini-cloud",
      modelName: "gemini-2.5-flash",
      fallbackUsed: Boolean(options.userId),
    });

    return {
      text: normalizedText,
      providerName: "gemini-cloud",
      modelName: "gemini-2.5-flash",
      fallbackUsed: Boolean(options.userId),
      source: "default-cloud",
      usage: normalizeProviderUsage({
        provider: "google",
        model: "gemini-2.5-flash",
        usage: usage as Record<string, unknown> | undefined,
        rawUsageReference: usage ? { source: "ai_sdk_usage" } : { source: "missing_provider_usage" },
      }),
    };
  } catch (error) {
    if (options.userId) {
      recordAiRequestAudit(defaultCloudAuditInput(options.userId, {
        datasetId: options.datasetId,
        mode: aiMode,
        purpose,
        fallbackUsed: userProviderFailed,
        success: false,
        errorReason: error instanceof Error ? error.message : String(error),
      }));
    }
    debugWarn(`[${options.context}] Default cloud AI failed`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function defaultCloudAuditInput(
  userId: string,
  input: {
    datasetId?: string | null;
    mode: AiMode;
    purpose: AiRequestAuditPurpose;
    fallbackUsed: boolean;
    success: boolean;
    errorReason?: string | null;
    executionLocation?: "cloud" | "none";
  },
): AiRequestAuditInput {
  return {
    userId,
    datasetId: input.datasetId,
    providerName: "UseClevr Cloud Analysis",
    providerType: "default-cloud",
    modelName: "gemini-2.5-flash",
    mode: input.mode,
    executionLocation: input.executionLocation || "cloud",
    fallbackUsed: input.fallbackUsed,
    purpose: input.purpose,
    success: input.success,
    errorReason: input.errorReason,
  };
}

function inferAiRequestPurpose(context: string): AiRequestAuditPurpose {
  const normalized = context.toLowerCase();
  if (normalized.includes("report")) return "report_generation";
  if (
    normalized.includes("recommend") ||
    normalized.includes("suggestion") ||
    normalized.includes("predictive") ||
    normalized.includes("next action")
  ) {
    return "recommendation";
  }
  if (normalized.includes("chat") || normalized.includes("query")) return "chat";
  return "dataset_analysis";
}

function featureForAiPurpose(purpose: AiRequestAuditPurpose): HybridAiFeatureId {
  if (purpose === "chat") return "privateChat";
  if (purpose === "report_generation") return "aiReports";
  if (purpose === "recommendation") return "dashboardInsights";
  return "csvExcelAnalysis";
}
