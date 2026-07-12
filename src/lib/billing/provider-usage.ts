import { calculateTokenCostMinor, PRICING_VERSION } from "@/lib/billing/provider-pricing"

export type ProviderUsage = {
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  thinkingTokens: number
  cachedTokens: number
  embeddingTokens: number
  requestCount: number
  estimatedCostMinor: number
  currency: string
  pricingVersion: string
  rawUsageReference?: Record<string, unknown>
}

type UsageLike = Record<string, unknown> | null | undefined

export function emptyProviderUsage(provider = "system", model = "system"): ProviderUsage {
  return {
    provider,
    model,
    inputTokens: 0,
    outputTokens: 0,
    thinkingTokens: 0,
    cachedTokens: 0,
    embeddingTokens: 0,
    requestCount: 1,
    estimatedCostMinor: 0,
    currency: "EUR",
    pricingVersion: PRICING_VERSION,
  }
}

export function normalizeProviderUsage(input: {
  provider: string
  model: string
  usage?: UsageLike
  rawUsageReference?: Record<string, unknown>
}): ProviderUsage {
  const usage = input.usage ?? {}
  const inputTokens =
    numberFrom(usage, ["inputTokens", "promptTokens", "prompt_tokens", "input_tokens"]) +
    numberFromNested(usage, ["input", "tokens"])
  const outputTokens =
    numberFrom(usage, ["outputTokens", "completionTokens", "completion_tokens", "output_tokens"]) +
    numberFromNested(usage, ["output", "tokens"])
  const thinkingTokens = numberFrom(usage, [
    "thinkingTokens",
    "reasoningTokens",
    "reasoning_tokens",
    "thoughtsTokenCount",
  ])
  const cachedTokens = numberFrom(usage, [
    "cachedTokens",
    "cached_tokens",
    "cachedContentTokenCount",
  ])
  const embeddingTokens = numberFrom(usage, [
    "embeddingTokens",
    "embedding_tokens",
  ])

  return {
    provider: input.provider,
    model: input.model,
    inputTokens,
    outputTokens,
    thinkingTokens,
    cachedTokens,
    embeddingTokens,
    requestCount: Math.max(1, numberFrom(usage, ["requestCount", "requests"])),
    estimatedCostMinor: calculateTokenCostMinor(input.model, {
      inputTokens,
      outputTokens,
      thinkingTokens,
      cachedTokens,
      embeddingTokens,
    }),
    currency: "EUR",
    pricingVersion: PRICING_VERSION,
    rawUsageReference: input.rawUsageReference,
  }
}

export function estimateUsageFromText(input: {
  provider: string
  model: string
  prompt: string
  output: string
}): ProviderUsage {
  return normalizeProviderUsage({
    provider: input.provider,
    model: input.model,
    usage: {
      inputTokens: Math.ceil(input.prompt.length / 4),
      outputTokens: Math.ceil(input.output.length / 4),
      missingProviderUsage: true,
    },
    rawUsageReference: { source: "estimated_text_length", pricingVersion: PRICING_VERSION },
  })
}

function numberFrom(value: UsageLike, keys: string[]) {
  if (!value) return 0
  for (const key of keys) {
    const candidate = value[key]
    if (typeof candidate === "number" && Number.isFinite(candidate)) return Math.max(0, Math.round(candidate))
  }
  return 0
}

function numberFromNested(value: UsageLike, path: [string, string]) {
  if (!value) return 0
  const parent = value[path[0]]
  if (!parent || typeof parent !== "object") return 0
  const candidate = (parent as Record<string, unknown>)[path[1]]
  return typeof candidate === "number" && Number.isFinite(candidate) ? Math.max(0, Math.round(candidate)) : 0
}
