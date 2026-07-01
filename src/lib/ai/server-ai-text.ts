import { google } from "@ai-sdk/google";
import { generateText } from "ai";

import {
  generateWithUniversalAiAdapter,
  isLocalAiUnavailableError,
  logDefaultCloudFallback,
  logUniversalAiResponse,
} from "@/lib/ai/universal-ai-adapter";
import { debugLog, debugWarn } from "@/lib/utils/debug";

export interface ServerAiTextResult {
  text: string;
  providerName: string;
  modelName: string;
  fallbackUsed: boolean;
  source: "user-provider" | "default-cloud";
  statusMessage?: string;
}

export async function generateServerAiText(
  prompt: string,
  options: {
    userId?: string;
    context: string;
  }
): Promise<ServerAiTextResult | null> {
  if (options.userId) {
    try {
      const result = await generateWithUniversalAiAdapter(options.userId, prompt);

      if (result) {
        logUniversalAiResponse(result);
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
        };
      }

      debugLog(`[${options.context}] No user AI provider configured; using default cloud AI`);
    } catch (error) {
      if (isLocalAiUnavailableError(error)) {
        debugWarn(`[${options.context}] Offline mode blocked cloud fallback`, {
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
      logDefaultCloudFallback(options.userId, error);
      debugWarn(`[${options.context}] User AI provider failed; using default cloud AI`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  try {
    const { text } = await generateText({
      model: google("gemini-2.5-flash"),
      prompt,
    });
    const normalizedText = text.trim();
    if (!normalizedText) return null;

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
    };
  } catch (error) {
    debugWarn(`[${options.context}] Default cloud AI failed`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
