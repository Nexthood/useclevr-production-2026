import { NextResponse } from "next/server"

// Step 3: Route status detection through the UseClevr Local Agent instead of probing Ollama directly

const DEFAULT_AGENT_BASE = "http://127.0.0.1:5143"
const AGENT_STATUS_PATH = "/status"
const DEFAULT_OLLAMA_BASE = "http://localhost:11434" // preserved for current UI model listing flow
const TIMEOUT_MS = 5000

type Status = "reachable" | "unavailable" | "error"

export async function GET() {
  const agentBase = process.env.USECLEVR_AGENT_BASE?.trim() || DEFAULT_AGENT_BASE

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  let available = false as boolean
  let status: Status = "unavailable"
  let error: string | undefined

  try {
    const res = await fetch(`${agentBase.replace(/\/$/, "")}${AGENT_STATUS_PATH}`, {
      method: "GET",
      signal: controller.signal,
      headers: { "Accept": "application/json" }
    })
    clearTimeout(timeoutId)

    if (!res.ok) {
      available = false
      status = "error"
      error = `HTTP ${res.status}`
    } else {
      const body: { success?: boolean; runtime?: string } = await res.json().catch(() => ({}))
      if (body && body.success && body.runtime === 'available') {
        available = true
        status = "reachable"
      } else if (body && body.success && body.runtime === 'installing') {
        available = false
        status = "unavailable"
      } else {
        available = false
        status = "unavailable"
      }
    }
  } catch (e: unknown) {
    clearTimeout(timeoutId)
    available = false
    status = "unavailable"
    error = e instanceof Error ? e.message : "connection failed"
  }

  // For backward-compat the UI expects a baseUrl to query tags when available.
  // Keep providing the Ollama base only when agent reports runtime available.
  const baseUrl = available ? (process.env.OLLAMA_BASE_URL?.trim() || DEFAULT_OLLAMA_BASE) : undefined

  return NextResponse.json({
    available,
    status,
    provider: "useclevr_hybrid",
    ...(baseUrl ? { baseUrl } : {}),
    ...(error ? { error } : {}),
    localAIAvailable: available,
  })
}
