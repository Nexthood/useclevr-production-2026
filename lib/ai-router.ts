/**
 * Hybrid AI Router
 * 
 * Provides intelligent failover between Local AI and Cloud AI.
 * Priority: Local AI (preferred) > Cloud Gemini Flash 2.5 (fallback)
 * 
 * Routing Logic:
 * 1. If Local AI is available → use Local AI (offline mode active)
 * 2. If Local AI is unavailable → use Cloud AI (Gemini Flash 2.5 default)
 * 
 * Never selects Local when Local is unavailable.
 */

import { google } from "@ai-sdk/google"
import { openai } from "@ai-sdk/openai"
import { deepseek } from "@ai-sdk/deepseek"
import type { LanguageModel } from "ai"

// Configuration
const CLOUD_TIMEOUT_MS = 15000 // 15 seconds timeout for cloud AI
// Ollama endpoints
const DEFAULT_OLLAMA_BASE = "http://localhost:11434"
const OLLAMA_TAGS_PATH = "/api/tags"
const OLLAMA_GENERATE_PATH = "/api/generate"
const LOCAL_HEALTH_TIMEOUT_MS = 5000 // 5 seconds timeout for health check
const RETRY_INTERVAL_MS = 60000 // Retry cloud every 60 seconds

// Provider type
export type AIProvider = "local" | "cloud"
export type CloudProvider = "gemini" | "deepseek" | "openai"

// State tracking
let lastCloudSuccess = Date.now()
let isCloudAvailable = true
let currentProvider: AIProvider = "local"
let localAIAvailable: boolean | null = null // null = not checked yet

// Check if local AI is available via health endpoint
export async function checkLocalAIAvailability(): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), LOCAL_HEALTH_TIMEOUT_MS)
    
    const baseUrl = process.env.OLLAMA_BASE_URL?.trim() || DEFAULT_OLLAMA_BASE
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}${OLLAMA_TAGS_PATH}`, { method: 'GET', signal: controller.signal })
    
    clearTimeout(timeoutId)
    
    if (response.ok) {
      localAIAvailable = true
      console.log("[AI-ROUTER] Local: AVAILABLE ✓")
      return true
    } else {
      localAIAvailable = false
      console.log("[AI-ROUTER] Local: NOT AVAILABLE (status:", response.status, ")")
      return false
    }
  } catch (error) {
    localAIAvailable = false
    console.log("[AI-ROUTER] Local: NOT AVAILABLE (network error)")
    return false
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
async function selectLocalModel(baseUrl: string): Promise<string> {
  const tagsRes = await fetch(`${baseUrl}${OLLAMA_TAGS_PATH}`, { method: 'GET' })
  if (!tagsRes.ok) throw new Error(`Ollama tags failed: ${tagsRes.status}`)
  const tagsJson: { models?: Array<{ name: string }> } = await tagsRes.json()
  const models = tagsJson.models || []
  const preferred = ['llama3:8b-instruct', 'llama3.2:3b-instruct']
  const found = preferred.find(m => models.some(x => x.name === m))
  if (!found) throw new Error('No supported local model installed')
  return found
}

export async function askLocalAI(request: LocalAIRequest): Promise<LocalAIResponse> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)
  try {
    const baseUrl = (process.env.OLLAMA_BASE_URL?.trim() || DEFAULT_OLLAMA_BASE).replace(/\/$/, '')
    const model = await selectLocalModel(baseUrl)
    const res = await fetch(`${baseUrl}${OLLAMA_GENERATE_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: request.prompt, stream: false }),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    if (!res.ok) throw new Error(`Local AI request failed: ${res.status}`)
    const data: { response?: string } = await res.json()
    return { response: data.response || '' }
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

// Check if cloud is available (not failed recently)
export function isCloudAIAvailable(): boolean {
  if (!isCloudAvailable) {
    if (Date.now() - lastCloudSuccess > RETRY_INTERVAL_MS) {
      console.log("[AI-ROUTER] Retrying cloud after cooldown")
      isCloudAvailable = true
    }
  }
  return isCloudAvailable
}

// Get the appropriate AI provider
// Priority: Local (preferred) > Cloud (fallback)
export function getAIProvider(): { provider: LanguageModel; type: AIProvider; providerName: string; modelName: string } {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY
  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY
  
  const localIsAvailable = localAIAvailable === true
  const cloudKey = GEMINI_API_KEY || DEEPSEEK_API_KEY || OPENAI_API_KEY
  
  // Priority 1: LOCAL AI - use if available (offline/hybrid mode)
  if (localIsAvailable) {
    console.log("[AI-ROUTER] ═══ SELECTED ═══")
    console.log("[AI-ROUTER] Provider: LOCAL AI (offline/hybrid)")
    console.log("[AI-ROUTER] Reason: Local AI is available")
    return {
      provider: openai("gpt-4o-mini") as LanguageModel,
      type: "local",
      providerName: "Local AI",
      modelName: "ollama-local"
    }
  }
  
  // Priority 2: CLOUD AI - fallback when Local unavailable
  // Try cloud providers in priority order: Gemini > DeepSeek > OpenAI
  if (cloudKey) {
    if (GEMINI_API_KEY) {
      console.log("[AI-ROUTER] ═══ SELECTED ═══")
      console.log("[AI-ROUTER] Provider: CLOUD (Gemini Flash 2.5)")
      console.log("[AI-ROUTER] Reason: Local unavailable → using cloud fallback")
      return {
        provider: google("gemini-2.0-flash"),
        type: "cloud",
        providerName: "Gemini Flash 2.5",
        modelName: "gemini-2.0-flash"
      }
    } else if (DEEPSEEK_API_KEY) {
      console.log("[AI-ROUTER] ═══ SELECTED ═══")
      console.log("[AI-ROUTER] Provider: CLOUD (DeepSeek)")
      console.log("[AI-ROUTER] Reason: Local unavailable → using cloud fallback")
      return {
        provider: deepseek("deepseek-chat"),
        type: "cloud",
        providerName: "DeepSeek",
        modelName: "deepseek-chat"
      }
    } else if (OPENAI_API_KEY) {
      console.log("[AI-ROUTER] ═══ SELECTED ═══")
      console.log("[AI-ROUTER] Provider: CLOUD (OpenAI)")
      console.log("[AI-ROUTER] Reason: Local unavailable → using cloud fallback")
      return {
        provider: openai("gpt-4o-mini"),
        type: "cloud",
        providerName: "OpenAI",
        modelName: "gpt-4o-mini"
      }
    }
  }
  
  // Priority 3: ERROR - no providers available
  console.log("[AI-ROUTER] ═══ ERROR ═══")
  console.log("[AI-ROUTER] No AI provider available!")
  console.log("[AI-ROUTER] Local: NOT AVAILABLE")
  console.log("[AI-ROUTER] Cloud: NOT CONFIGURED")
  throw new Error("No AI provider. Configure GEMINI_API_KEY in .env.local or start Local AI server.")
}

// Mark cloud AI as successful
export function markCloudSuccess(): void {
  lastCloudSuccess = Date.now()
  if (!isCloudAvailable) {
    console.log("[AI-ROUTER] Cloud AI recovered")
  }
  isCloudAvailable = true
  currentProvider = "cloud"
}

// Mark cloud AI as failed
export function markCloudFailed(): void {
  if (localAIAvailable === true) {
    console.log("[AI-ROUTER] Cloud failed - Local fallback available")
    isCloudAvailable = false
    currentProvider = "local"
    lastCloudSuccess = Date.now()
  } else {
    console.log("[AI-ROUTER] Cloud failed - no fallback available!")
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
      console.error("[AI-ROUTER] Local AI failed:", localError)
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
      console.error("[AI-ROUTER] Cloud AI failed:", error)
      markCloudFailed()
    }
  }
  
  throw new Error("All AI providers failed")
}
