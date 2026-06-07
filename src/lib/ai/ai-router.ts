import { isMockAIMode, MOCK_AI_MODEL_NAME, MOCK_AI_PROVIDER_NAME } from "@/lib/ai/mock-ai"
import { fetchOllamaModels, generateOllamaCompletion } from "@/lib/ai/ollama-client"
import { debugError, debugLog } from "@/lib/utils/debug"

/**
 * Hybrid AI Router
 *
 * Provides intelligent failover between Local AI and Cloud AI (Gemini).
 * Priority: Local AI (offline) > Cloud AI (Gemini Flash 2.5)
 *
 * Routing Logic:
 * 1. If Local AI is available → use Local AI (offline mode active)
 * 2. If Local unavailable → use Cloud AI (Gemini Flash 2.5)
 */

import { google } from "@ai-sdk/google"
import type { LanguageModel } from "ai"

// Configuration
const CLOUD_TIMEOUT_MS = 15000 // 15 seconds timeout for cloud AI
const LOCAL_HEALTH_TIMEOUT_MS = 5000 // 5 seconds timeout for health check
const RETRY_INTERVAL_MS = 60000 // Retry cloud every 60 seconds

// Provider type
export type AIProvider = "local" | "cloud" | "mock"
export type CloudProvider = "gemini"

// State tracking
let lastCloudSuccess = Date.now()
let isCloudAvailable = true
let currentProvider: AIProvider = "cloud"
let localAIAvailable: boolean | null = null // null = not checked yet

// Check if local AI is available via health endpoint
export async function checkLocalAIAvailability(): Promise<boolean> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), LOCAL_HEALTH_TIMEOUT_MS)

  try {
    await fetchOllamaModels({ signal: controller.signal })
    localAIAvailable = true
    debugLog("[AI-ROUTER] Local: AVAILABLE ✓")
    return true
  } catch {
    localAIAvailable = false
    debugLog("[AI-ROUTER] Local: NOT AVAILABLE (network error)")
    return false
  } finally {
    clearTimeout(timeoutId)
  }
}

// Get local AI availability status
export function isLocalAIAvailable(): boolean | null {
  return localAIAvailable
}

// Allow request-scoped override from routes (e.g., when user hasn't enabled Hybrid)
export function overrideLocalAvailability(available: boolean | null): void {
  localAIAvailable = available
}

// Call local AI endpoint
export interface LocalAIRequest {
  prompt: string;
  datasetContext?: Record<string, unknown>;
}

export interface LocalAIResponse {
  response: string;
}

// Select verified/installed local model (Standard preferred, then Lite)
async function selectLocalModel(): Promise<string> {
  const models = await fetchOllamaModels()
  const preferred = ['llama3:8b-instruct', 'llama3.2:3b-instruct']
  const found = preferred.find(m => models.some(x => x.name === m))
  if (!found) throw new Error('No supported local model installed')
  return found
}

export async function askLocalAI(request: LocalAIRequest): Promise<LocalAIResponse> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)
  try {
    const model = await selectLocalModel()
    const response = await generateOllamaCompletion(
      { model, prompt: request.prompt, stream: false },
      { signal: controller.signal }
    )
    clearTimeout(timeoutId)
    return { response }
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

// Check if cloud is available (not failed recently)
export function isCloudAIAvailable(): boolean {
  if (!isCloudAvailable) {
    if (Date.now() - lastCloudSuccess > RETRY_INTERVAL_MS) {
      debugLog("[AI-ROUTER] Retrying cloud after cooldown")
      isCloudAvailable = true
    }
  }
  return isCloudAvailable
}

// Get the appropriate AI provider
// Priority: Local > Cloud
export function getAIProvider(): { provider: LanguageModel; type: AIProvider; providerName: string; modelName: string } {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY

  const localIsAvailable = localAIAvailable === true
  const cloudKey = GEMINI_API_KEY

  // Mock AI mode (development shortcut) - short-circuit before any real provider checks
  if (isMockAIMode()) {
    debugLog("[AI-ROUTER] ═══ MOCK AI MODE ENABLED ═══")
    currentProvider = "mock"
    return {
      provider: {
        async doGenerate() {
          throw new Error("Mock AI provider stubs are metadata-only. Use the mock completion helpers for local responses.")
        },
      } as unknown as LanguageModel,
      type: "mock",
      providerName: MOCK_AI_PROVIDER_NAME,
      modelName: MOCK_AI_MODEL_NAME
    }
  }

  // Priority 1: LOCAL AI - use if available (offline/hybrid mode)
  if (localIsAvailable) {
    debugLog("[AI-ROUTER] ═══ SELECTED ═══")
    debugLog("[AI-ROUTER] Provider: LOCAL AI (offline/hybrid)")
    debugLog("[AI-ROUTER] Reason: Local AI is available")
    currentProvider = "local"
    return {
      provider: google("gemini-2.5-flash") as LanguageModel,
      type: "local",
      providerName: "Local AI",
      modelName: "ollama-local"
    }
  }

  // Priority 2: CLOUD AI - use Gemini if API key configured
  if (cloudKey) {
    debugLog("[AI-ROUTER] ═══ SELECTED ═══")
    debugLog("[AI-ROUTER] Provider: CLOUD (Gemini Flash 2.5)")
    debugLog("[AI-ROUTER] Reason: Local AI unavailable → using cloud")
    currentProvider = "cloud"
    return {
      provider: google("gemini-2.5-flash"),
      type: "cloud",
      providerName: "Gemini Flash 2.5",
      modelName: "gemini-2.5-flash"
    }
  }

  // Priority 3: ERROR - no providers available
  debugLog("[AI-ROUTER] ═══ ERROR ═══")
  debugLog("[AI-ROUTER] No AI provider available!")
  debugLog("[AI-ROUTER] Local: NOT AVAILABLE")
  debugLog("[AI-ROUTER] Cloud: NOT CONFIGURED")
  throw new Error("No AI provider. Configure GEMINI_API_KEY in .env.local or start Local AI.")
}

// Mark cloud AI as successful
export function markCloudSuccess(): void {
  lastCloudSuccess = Date.now()
  if (!isCloudAvailable) {
    debugLog("[AI-ROUTER] Cloud AI recovered")
  }
  isCloudAvailable = true
  currentProvider = "cloud"
}

// Mark cloud AI as failed
export function markCloudFailed(): void {
  if (localAIAvailable === true) {
    debugLog("[AI-ROUTER] Cloud failed - Local fallback available")
    isCloudAvailable = false
    currentProvider = "local"
    lastCloudSuccess = Date.now()
  } else {
    debugLog("[AI-ROUTER] Cloud failed - no fallback available!")
    isCloudAvailable = false
  }
}

// Get current provider status
export function getProviderStatus(): { current: AIProvider; cloudAvailable: boolean; localAIAvailable: boolean | null; lastSuccess: number } {
  return {
    current: currentProvider,
    cloudAvailable: isCloudAvailable,
    localAIAvailable: localAIAvailable,
    lastSuccess: lastCloudSuccess
  }
}

// Wrapped AI call with fallback
export async function withAIFallback<T>(
  cloudCall: () => Promise<T>,
  localCall: () => Promise<T>
): Promise<{ result: T; provider: AIProvider }> {
  // Try Local first if available
  if (localAIAvailable === true) {
    try {
      const result = await localCall()
      return { result, provider: "local" }
    } catch (localError) {
      debugError("[AI-ROUTER] Local AI failed:", localError)
    }
  }

  // Try cloud as fallback
  if (isCloudAIAvailable()) {
    try {
      const result = await Promise.race([
        cloudCall(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Cloud timeout")), CLOUD_TIMEOUT_MS)
        )
      ])
      markCloudSuccess()
      return { result, provider: "cloud" }
    } catch (error) {
      debugError("[AI-ROUTER] Cloud AI failed:", error)
      markCloudFailed()
    }
  }

  throw new Error("All AI providers failed")
}
