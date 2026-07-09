import {
  HYBRID_AI_MODULES,
  type HybridAiModuleId,
} from "@/lib/hybrid-ai/features"

export const USECLEVR_HELPER_BASE_URL = "http://localhost:14567"

export type UseClevrHelperFeatures = Record<HybridAiModuleId, boolean>

const DEFAULT_HELPER_FEATURES = HYBRID_AI_MODULES.reduce((features, module) => {
  features[module.id] = true
  return features
}, {} as UseClevrHelperFeatures)

const OFFLINE_HELPER_STATUS: UseClevrHelperStatus = {
  state: "offline",
  message: "UseClevr Helper is not running",
  connected: false,
  privateEngineReady: false,
  features: DEFAULT_HELPER_FEATURES,
}

function canCallLocalHelper() {
  if (typeof window === "undefined") return process.env.NODE_ENV !== "production"
  const hostname = window.location.hostname
  const isLocalAppHost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
  return process.env.NODE_ENV !== "production" && isLocalAppHost
}

export type UseClevrHelperStatus =
  | {
      state: "connected"
      message: "Secure runtime connected"
      connected: true
      privateEngineReady: true
      features: UseClevrHelperFeatures
    }
  | {
      state: "setup"
      message: "Private AI engine needs setup"
      connected: true
      privateEngineReady: false
      features: UseClevrHelperFeatures
    }
  | {
      state: "offline"
      message: "UseClevr Helper is not running"
      connected: false
      privateEngineReady: false
      features: UseClevrHelperFeatures
    }

function parseHelperFeatures(body: unknown): UseClevrHelperFeatures {
  const source = body && typeof body === "object" && "features" in body ? (body as { features?: unknown }).features : null
  if (!source || typeof source !== "object") return DEFAULT_HELPER_FEATURES

  return HYBRID_AI_MODULES.reduce((features, module) => {
    const value = (source as Partial<Record<HybridAiModuleId, unknown>>)[module.id]
    features[module.id] = value !== false
    return features
  }, {} as UseClevrHelperFeatures)
}

export async function getUseClevrHelperStatus(): Promise<UseClevrHelperStatus> {
  if (!canCallLocalHelper()) {
    return OFFLINE_HELPER_STATUS
  }

  try {
    const health = await fetch(`${USECLEVR_HELPER_BASE_URL}/health`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    })
    if (!health.ok) throw new Error("helper_offline")

    const status = await fetch(`${USECLEVR_HELPER_BASE_URL}/status`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(2000),
    })
    if (!status.ok) throw new Error("helper_status_failed")

    const body = await status.json().catch(() => ({}))
    const features = parseHelperFeatures(body)
    if (body?.connected && body?.privateEngineReady) {
      return {
        state: "connected",
        message: "Secure runtime connected",
        connected: true,
        privateEngineReady: true,
        features,
      }
    }

    return {
      state: "setup",
      message: "Private AI engine needs setup",
      connected: true,
      privateEngineReady: false,
      features,
    }
  } catch {
    return OFFLINE_HELPER_STATUS
  }
}

export async function askUseClevrHelper(message: string, datasetContext?: object) {
  if (!canCallLocalHelper()) {
    throw new Error("helper_unavailable_in_production")
  }

  const response = await fetch(`${USECLEVR_HELPER_BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      datasetContext,
      mode: "private-analysis",
    }),
    signal: AbortSignal.timeout(60000),
  })

  if (!response.ok) {
    throw new Error("private_analysis_failed")
  }

  const body = await response.json()
  return {
    answer: String(body?.answer || ""),
    mode: "private-analysis" as const,
  }
}
