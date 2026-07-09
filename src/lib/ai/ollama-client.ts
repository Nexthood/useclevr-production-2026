const DEFAULT_OLLAMA_BASE = "http://localhost:11434"
const OLLAMA_TAGS_PATH = "/api/tags"
const OLLAMA_GENERATE_PATH = "/api/generate"

export interface OllamaModel {
  name: string
}

interface OllamaTagsResponse {
  models?: OllamaModel[]
}

interface OllamaGenerateResponse {
  response?: string
}

export interface OllamaGenerateRequest {
  model: string
  prompt: string
  stream?: boolean
  options?: Record<string, unknown>
}

export function getOllamaBaseUrl(): string {
  const configuredBaseUrl = process.env.OLLAMA_BASE_URL?.trim()
  if (process.env.NODE_ENV === "production" && !configuredBaseUrl) {
    throw new Error("Local AI runtime is unavailable in production without OLLAMA_BASE_URL.")
  }

  return (configuredBaseUrl || DEFAULT_OLLAMA_BASE).replace(/\/$/, "")
}

export async function fetchOllamaModels(options: { signal?: AbortSignal } = {}): Promise<OllamaModel[]> {
  const response = await fetch(`${getOllamaBaseUrl()}${OLLAMA_TAGS_PATH}`, {
    method: "GET",
    signal: options.signal,
  })

  if (!response.ok) {
    throw new Error(`Ollama tags failed: ${response.status}`)
  }

  const data: OllamaTagsResponse = await response.json()
  return data.models || []
}

export async function generateOllamaCompletion(
  request: OllamaGenerateRequest,
  options: { signal?: AbortSignal } = {}
): Promise<string> {
  const response = await fetch(`${getOllamaBaseUrl()}${OLLAMA_GENERATE_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...request, stream: request.stream ?? false }),
    signal: options.signal,
  })

  if (!response.ok) {
    throw new Error(`Local AI request failed: ${response.status}`)
  }

  const data: OllamaGenerateResponse = await response.json()
  return data.response || ""
}
