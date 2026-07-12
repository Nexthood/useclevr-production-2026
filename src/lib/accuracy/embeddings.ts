import { createHash } from "node:crypto"

type EmbeddingResponse = {
  data?: Array<{ embedding?: unknown }>
  usage?: { total_tokens?: unknown; prompt_tokens?: unknown }
  error?: { message?: unknown }
}

export type AccuracyEmbedding = {
  vector: number[]
  model: string
  dimensions: number
  provider: "hash" | "openai-compatible"
  tokenUsage?: number
}

const DEFAULT_HASH_DIMENSIONS = 384
const REQUEST_TIMEOUT_MS = 20_000

export async function embedAccuracyText(text: string): Promise<AccuracyEmbedding> {
  const provider = (process.env.ACCURACY_EMBEDDING_PROVIDER || "hash").trim().toLowerCase()

  if (provider === "openai-compatible") {
    return embedWithOpenAiCompatible(text)
  }

  return embedWithHash(text)
}

export async function embedAccuracyTexts(texts: string[]): Promise<AccuracyEmbedding[]> {
  const results: AccuracyEmbedding[] = []
  for (const text of texts) {
    results.push(await embedAccuracyText(text))
  }
  return results
}

export function cosineSimilarity(a: number[] | null | undefined, b: number[] | null | undefined) {
  if (!a?.length || !b?.length || a.length !== b.length) return 0
  let dot = 0
  let aMagnitude = 0
  let bMagnitude = 0
  for (let index = 0; index < a.length; index += 1) {
    const av = a[index] || 0
    const bv = b[index] || 0
    dot += av * bv
    aMagnitude += av * av
    bMagnitude += bv * bv
  }
  if (aMagnitude === 0 || bMagnitude === 0) return 0
  return dot / (Math.sqrt(aMagnitude) * Math.sqrt(bMagnitude))
}

function embedWithHash(text: string): AccuracyEmbedding {
  const dimensions = normalizeDimensions(process.env.ACCURACY_EMBEDDING_DIMENSIONS, DEFAULT_HASH_DIMENSIONS)
  const vector = new Array<number>(dimensions).fill(0)
  const tokens = normalizeForEmbedding(text).split(/\s+/).filter(Boolean)

  for (const token of tokens) {
    const digest = createHash("sha256").update(token).digest()
    const index = digest.readUInt32BE(0) % dimensions
    const sign = digest[4] % 2 === 0 ? 1 : -1
    vector[index] += sign
  }

  return {
    vector: normalizeVector(vector),
    model: `hash-${dimensions}`,
    dimensions,
    provider: "hash",
  }
}

async function embedWithOpenAiCompatible(text: string): Promise<AccuracyEmbedding> {
  const baseUrl = (process.env.ACCURACY_EMBEDDING_BASE_URL || "").trim().replace(/\/+$/, "")
  const apiKey = (process.env.ACCURACY_EMBEDDING_API_KEY || "").trim()
  const model = (process.env.ACCURACY_EMBEDDING_MODEL || "").trim()

  if (!baseUrl || !model) {
    throw new Error("Accuracy embedding endpoint and model are required.")
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(`${baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({ model, input: text }),
      signal: controller.signal,
      redirect: "error",
    })
    const body = await response.json().catch(() => ({})) as EmbeddingResponse

    if (!response.ok) {
      const message = typeof body.error?.message === "string" ? body.error.message : `Embedding provider returned HTTP ${response.status}.`
      throw new Error(message)
    }

    const vector = body.data?.[0]?.embedding
    if (!Array.isArray(vector) || !vector.every((value) => typeof value === "number")) {
      throw new Error("Embedding provider returned an invalid vector.")
    }

    return {
      vector,
      model,
      dimensions: vector.length,
      provider: "openai-compatible",
      tokenUsage: typeof body.usage?.total_tokens === "number"
        ? body.usage.total_tokens
        : typeof body.usage?.prompt_tokens === "number"
          ? body.usage.prompt_tokens
          : undefined,
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Embedding provider request timed out.")
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

function normalizeForEmbedding(text: string) {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_./:@€$£%-]+/gu, " ")
    .trim()
}

function normalizeVector(vector: number[]) {
  const magnitude = Math.sqrt(vector.reduce((total, value) => total + value * value, 0))
  if (magnitude === 0) return vector
  return vector.map((value) => Number((value / magnitude).toFixed(8)))
}

function normalizeDimensions(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || "", 10)
  if (!Number.isFinite(parsed) || parsed < 32 || parsed > 4096) return fallback
  return parsed
}
