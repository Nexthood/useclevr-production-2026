import { getDb } from "@/lib/db"
import { providerModelPricing } from "@/lib/db/schema"
import { eq, and, isNull } from "drizzle-orm"
import { cache } from "react"

export type ProviderName = "openai" | "anthropic" | "google" | "ollama" | "local"
export const PRICING_VERSION = "2026-07-12"

export interface ModelPricing {
  id: string
  provider: ProviderName
  model: string
  inputCostPer1M: number
  outputCostPer1M: number
  currency: string
  isActive: boolean
}

const DEFAULT_PRICING: Record<string, ModelPricing> = {
  "gemini-2.5-flash": {
    id: "default-gemini-2.5-flash",
    provider: "google",
    model: "gemini-2.5-flash",
    inputCostPer1M: 150,
    outputCostPer1M: 600,
    currency: "EUR",
    isActive: true,
  },
  "gemini-2.5-flash-lite": {
    id: "default-gemini-2.5-flash-lite",
    provider: "google",
    model: "gemini-2.5-flash-lite",
    inputCostPer1M: 75,
    outputCostPer1M: 300,
    currency: "EUR",
    isActive: true,
  },
  "gemini-2.0-flash": {
    id: "default-gemini-2.0-flash",
    provider: "google",
    model: "gemini-2.0-flash",
    inputCostPer1M: 150,
    outputCostPer1M: 600,
    currency: "EUR",
    isActive: true,
  },
  "gpt-4o": {
    id: "default-gpt-4o",
    provider: "openai",
    model: "gpt-4o",
    inputCostPer1M: 2500,
    outputCostPer1M: 10000,
    currency: "EUR",
    isActive: true,
  },
  "gpt-4o-mini": {
    id: "default-gpt-4o-mini",
    provider: "openai",
    model: "gpt-4o-mini",
    inputCostPer1M: 150,
    outputCostPer1M: 600,
    currency: "EUR",
    isActive: true,
  },
  "gpt-4-turbo": {
    id: "default-gpt-4-turbo",
    provider: "openai",
    model: "gpt-4-turbo",
    inputCostPer1M: 5000,
    outputCostPer1M: 15000,
    currency: "EUR",
    isActive: true,
  },
  "claude-3-5-sonnet": {
    id: "default-claude-3.5-sonnet",
    provider: "anthropic",
    model: "claude-3-5-sonnet",
    inputCostPer1M: 1500,
    outputCostPer1M: 7500,
    currency: "EUR",
    isActive: true,
  },
  "claude-3-opus": {
    id: "default-claude-3-opus",
    provider: "anthropic",
    model: "claude-3-opus",
    inputCostPer1M: 7500,
    outputCostPer1M: 37500,
    currency: "EUR",
    isActive: true,
  },
  "claude-3-haiku": {
    id: "default-claude-3-haiku",
    provider: "anthropic",
    model: "claude-3-haiku",
    inputCostPer1M: 125,
    outputCostPer1M: 625,
    currency: "EUR",
    isActive: true,
  },
  "ollama-local": {
    id: "default-ollama-local",
    provider: "ollama",
    model: "ollama-local",
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    currency: "EUR",
    isActive: true,
  },
}

export const getProviderPricing = cache(async (): Promise<Record<string, ModelPricing>> => {
  const db = getDb()
  if (!db) {
    return DEFAULT_PRICING
  }

  try {
    const now = new Date()
    const pricing = await db
      .select()
      .from(providerModelPricing)
      .where(
        and(
          eq(providerModelPricing.isActive, true),
          isNull(providerModelPricing.effectiveTo),
          eq(providerModelPricing.effectiveFrom, providerModelPricing.effectiveFrom)
        )
      )

    if (pricing.length === 0) {
      return DEFAULT_PRICING
    }

    const result: Record<string, ModelPricing> = {}
    for (const p of pricing) {
      result[p.model] = {
        id: p.id,
        provider: p.provider as ProviderName,
        model: p.model,
        inputCostPer1M: p.inputCostPer1M,
        outputCostPer1M: p.outputCostPer1M,
        currency: p.currency,
        isActive: p.isActive,
      }
    }

    for (const [model, defaultPrice] of Object.entries(DEFAULT_PRICING)) {
      if (!result[model]) {
        result[model] = defaultPrice
      }
    }

    return result
  } catch {
    return DEFAULT_PRICING
  }
})

export function getModelPricing(model: string): ModelPricing {
  return DEFAULT_PRICING[model] || {
    id: "unknown",
    provider: "openai",
    model: model,
    inputCostPer1M: 1000,
    outputCostPer1M: 5000,
    currency: "EUR",
    isActive: true,
  }
}

export function calculateTokenCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = getModelPricing(model)
  const inputCost = (inputTokens / 1_000_000) * pricing.inputCostPer1M
  const outputCost = (outputTokens / 1_000_000) * pricing.outputCostPer1M
  return Math.round((inputCost + outputCost) * 100) / 100
}

export function calculateTokenCostMinor(
  model: string,
  usage: {
    inputTokens?: number
    outputTokens?: number
    thinkingTokens?: number
    cachedTokens?: number
    embeddingTokens?: number
  }
): number {
  const pricing = getModelPricing(model)
  const billableInputTokens = Math.max(0, (usage.inputTokens ?? 0) - (usage.cachedTokens ?? 0))
  const inputMinor = Math.ceil((billableInputTokens * pricing.inputCostPer1M) / 1_000_000)
  const outputMinor = Math.ceil((((usage.outputTokens ?? 0) + (usage.thinkingTokens ?? 0)) * pricing.outputCostPer1M) / 1_000_000)
  const embeddingMinor = Math.ceil(((usage.embeddingTokens ?? 0) * pricing.inputCostPer1M) / 1_000_000)
  return Math.max(0, inputMinor + outputMinor + embeddingMinor)
}

export function getAllProviderModels(): Array<{ provider: ProviderName; model: string }> {
  return Object.values(DEFAULT_PRICING).map((p) => ({
    provider: p.provider,
    model: p.model,
  }))
}
