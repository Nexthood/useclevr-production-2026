import { NextResponse } from "next/server"

// Step 3: Route status detection through the UseClevr Local Agent instead of probing Ollama directly

const DEFAULT_AGENT_BASE = "http://127.0.0.1:5143"
const AGENT_STATUS_PATH = "/status"
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

  return NextResponse.json({
    available,
    status,
    provider: "useclevr_hybrid",
    ...(error ? { error } : {}),
    localAIAvailable: available,
  })
}
