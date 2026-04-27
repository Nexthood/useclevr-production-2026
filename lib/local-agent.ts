// Local Agent MVP contract and client
// This defines the minimal API surface for a future UseClevr Local Agent.
// For now, status() is wired to existing app APIs to preserve behavior.

export type AgentModelTier = 'lite' | 'standard'

// Canonical state names aligned to UseClevr UI
export type HybridState =
  | 'runtime_required'
  | 'installing_runtime'
  | 'runtime_available'
  | 'model_missing'
  | 'downloading_model'
  | 'verifying'
  | 'ready_for_offline_use'
  | 'failed'

export type AgentRuntimeState = 'unavailable' | 'installing' | 'available' | 'starting' | 'error'

export interface LocalAgentStatus {
  runtime: AgentRuntimeState
  models: Array<{ name: string }>
  // Optional diagnostics to keep technical details secondary
  info?: string
}

// Endpoint contracts (for a future local agent listening on localhost)
// GET /status → StatusResponse
export interface StatusResponse {
  success: boolean
  runtime: AgentRuntimeState
  models: Array<{ name: string }>
  version?: string
}

// POST /install-runtime → InstallRuntimeResponse
export interface InstallRuntimeRequest {}
export interface InstallRuntimeResponse {
  success: boolean
  state: 'installing' | 'queued' | 'error'
  message?: string
}

// POST /start-runtime → StartRuntimeResponse
export interface StartRuntimeResponse {
  success: boolean
  state: 'starting' | 'available' | 'error'
  message?: string
}

// POST /pull-model → PullModelResponse
export interface PullModelRequest { model: string }
export interface PullModelResponse {
  success: boolean
  state: 'downloading_model' | 'ready' | 'runtime_required' | 'error'
  progress?: number // 0..100 optional future field
  message?: string
}

// POST /verify → VerifyResponse
export interface VerifyRequest { model: string }
export interface VerifyResponse {
  success: boolean
  state: 'verifying' | 'verified' | 'error'
  message?: string
}

export interface LocalAgentAPI {
  // GET /status
  status(): Promise<LocalAgentStatus>
  // POST /install-runtime
  installRuntime(_req?: InstallRuntimeRequest): Promise<Response>
  // POST /start-runtime
  startRuntime(): Promise<Response>
  // POST /pull-model
  pullModel(req: PullModelRequest): Promise<Response>
  // POST /verify
  verify(req: VerifyRequest): Promise<Response>
}

export const DEFAULT_AGENT_BASE = 'http://127.0.0.1:5143'

export class LocalAgentClient implements LocalAgentAPI {
  constructor(private baseUrl: string = DEFAULT_AGENT_BASE) {}

  // MVP: bridge to existing internal endpoint for status to avoid behavior changes
  async status(): Promise<LocalAgentStatus> {
    // Use existing app route to detect runtime and list models via Ollama when available
    const res = await fetch('/api/local-ai-status', { method: 'GET' })
    if (!res.ok) {
      return { runtime: 'error', models: [], info: `status_http_${res.status}` }
    }
    const data: { available: boolean; baseUrl?: string } = await res.json()
    if (!data.available || !data.baseUrl) {
      return { runtime: 'unavailable', models: [] }
    }
    try {
      const base = data.baseUrl.replace(/\/$/, '')
      const tagsRes = await fetch(`${base}/api/tags`, { method: 'GET' })
      if (!tagsRes.ok) return { runtime: 'available', models: [], info: 'tags_unreachable' }
      const tagsJson: { models?: Array<{ name: string }> } = await tagsRes.json()
      return { runtime: 'available', models: tagsJson.models || [] }
    } catch {
      return { runtime: 'available', models: [], info: 'tags_error' }
    }
  }

  async installRuntime(_req?: InstallRuntimeRequest): Promise<Response> {
    // Route via Next API proxy for web app to avoid CORS and centralize mapping
    return fetch('/api/agent/install-runtime', { method: 'POST' })
  }

  async startRuntime(): Promise<Response> {
    return fetch(`${this.baseUrl}/start-runtime`, { method: 'POST' })
  }

  async pullModel(req: PullModelRequest): Promise<Response> {
    return fetch(`${this.baseUrl}/pull-model`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req)
    })
  }

  async verify(req: VerifyRequest): Promise<Response> {
    return fetch(`${this.baseUrl}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req)
    })
  }
}
