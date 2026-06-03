import { checkAntigravityAvailability } from "@/lib/ai/antigravity-client"
import { fetchOllamaModels, generateOllamaCompletion } from "@/lib/ai/ollama-client"
import { debugError, debugLog } from "@/lib/utils/debug"

/**
 * Hybrid AI Router
 *
 * Provides intelligent failover between Local AI and Cloud AI (Antigravity).
 * Priority: Antigravity Server (local proxy) > Local AI (offline) > Cloud Gemini (fallback)
 *
 * Routing Logic:
 * 1. If Antigravity Server is available → use Antigravity (low latency)
 * 2. If Local AI is available → use Local AI (offline mode active)
 * 3. If both unavailable → use Cloud AI (Gemini Flash 2.5 fallback)
 *
 * Never selects Local when better alternatives are available.
 */

import { google } from "@ai-sdk/google"
import type { LanguageModel } from "ai"

// Configuration
const CLOUD_TIMEOUT_MS = 15000 // 15 seconds timeout for cloud AI
const LOCAL_HEALTH_TIMEOUT_MS = 5000 // 5 seconds timeout for health check
const RETRY_INTERVAL_MS = 60000 // Retry cloud every 60 seconds

// Provider type
export type AIProvider = "antigravity" | "local" | "cloud" | "mock"
export type CloudProvider = "gemini"

// State tracking
let lastCloudSuccess = Date.now()
let isCloudAvailable = true
let currentProvider: AIProvider = "cloud"
let localAIAvailable: boolean | null = null // null = not checked yet
let antigravityAvailable: boolean | null = null // null = not checked yet

// Check if Antigravity server is available via health endpoint
export async function checkAntigravityServerAvailability(): Promise<boolean> {
  try {
    const available = await checkAntigravityAvailability()
    antigravityAvailable = available
    debugLog("[AI-ROUTER] Antigravity:", available ? "AVAILABLE ✓" : "NOT AVAILABLE")
    return available
  } catch {
    antigravityAvailable = false
    debugLog("[AI-ROUTER] Antigravity: NOT AVAILABLE (network error)")
    return false
  }
}

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
// Priority: Antigravity (preferred) > Local > Cloud (fallback)
export function getAIProvider(): { provider: LanguageModel; type: AIProvider; providerName: string; modelName: string } {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY

  const antigravityIsAvailable = antigravityAvailable === true
  const localIsAvailable = localAIAvailable === true
  const cloudKey = GEMINI_API_KEY

  // Mock AI mode (development shortcut) - short-circuit before any real provider checks
  if (process.env.MOCK_AI_MODE === "true") {
    debugLog("[AI-ROUTER] ═══ MOCK AI MODE ENABLED ═══")
    currentProvider = "mock"
    return {
      provider: {
        // Stubbed provider object so call sites can still reference getAIProvider(),
        // but attempts to invoke the model will fail fast during development.
        async doGenerate() {
          throw new Error("PENDING_IMPLEMENTATION: Mock AI response generation is not implemented.")
        },
      } as unknown as LanguageModel,
      type: "mock",
      providerName: "Mock AI",
      modelName: "mock-model"
    }
  }

  // Priority 1: ANTIGRAVITY SERVER - use if available (low latency, supports multiple models)
  if (antigravityIsAvailable) {
    debugLog("[AI-ROUTER] ═══ SELECTED ═══")
    debugLog("[AI-ROUTER] Provider: ANTIGRAVITY SERVER (local proxy)")
    debugLog("[AI-ROUTER] Reason: Antigravity server is available")
    currentProvider = "antigravity"
    return {
      provider: google("gemini-2.5-flash") as LanguageModel,
      type: "antigravity",
      providerName: "Antigravity Server",
      modelName: "gemini-2.5-flash"
    }
  }

  // Priority 2: LOCAL AI - use if available (offline/hybrid mode)
  if (localIsAvailable) {
    debugLog("[AI-ROUTER] ═══ SELECTED ═══")
    debugLog("[AI-ROUTER] Provider: LOCAL AI (offline/hybrid)")
    debugLog("[AI-ROUTER] Reason: Antigravity unavailable → using local AI")
    currentProvider = "local"
    return {
      provider: google("gemini-2.5-flash") as LanguageModel,
      type: "local",
      providerName: "Local AI",
      modelName: "ollama-local"
    }
  }

  // Priority 3: CLOUD AI - fallback when Local and Antigravity unavailable
  // Use Gemini only
  if (cloudKey) {
    debugLog("[AI-ROUTER] ═══ SELECTED ═══")
    debugLog("[AI-ROUTER] Provider: CLOUD (Gemini Flash 2.5)")
    debugLog("[AI-ROUTER] Reason: Antigravity and Local unavailable → using cloud fallback")
    currentProvider = "cloud"
    return {
      provider: google("gemini-2.5-flash"),
      type: "cloud",
      providerName: "Gemini Flash 2.5",
      modelName: "gemini-2.5-flash"
    }
  }

  // Priority 4: ERROR - no providers available
  debugLog("[AI-ROUTER] ═══ ERROR ═══")
  debugLog("[AI-ROUTER] No AI provider available!")
  debugLog("[AI-ROUTER] Antigravity: NOT AVAILABLE")
  debugLog("[AI-ROUTER] Local: NOT AVAILABLE")
  debugLog("[AI-ROUTER] Cloud: NOT CONFIGURED")
  throw new Error("No AI provider. Start Antigravity server (http://127.0.0.1:8317), Local AI, or configure GEMINI_API_KEY in .env.local.")
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
  if (antigravityAvailable === true) {
    debugLog("[AI-ROUTER] Cloud failed - Antigravity fallback available")
    isCloudAvailable = false
    currentProvider = "antigravity"
    lastCloudSuccess = Date.now()
  } else if (localAIAvailable === true) {
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
export function getProviderStatus(): { current: AIProvider; cloudAvailable: boolean; antigravityAvailable: boolean | null; localAIAvailable: boolean | null; lastSuccess: number } {
  return {
    current: currentProvider,
    cloudAvailable: isCloudAvailable,
    antigravityAvailable: antigravityAvailable,
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
