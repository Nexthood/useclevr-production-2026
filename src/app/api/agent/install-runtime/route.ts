import { NextResponse } from "next/server"
import { requireDevelopmentOrSuperAdmin } from "@/lib/auth/require-session"
import { requireHybridAiFeature } from "@/lib/hybrid-ai/feature-gate"

const DEFAULT_AGENT_BASE = "http://127.0.0.1:5143"
const INSTALL_PATH = "/install-runtime"
const TIMEOUT_MS = 5000

type AgentInstallState = 'accepted' | 'unsupported' | 'agent_unavailable' | 'already_installed' | 'error' | 'queued' | 'installing'

export async function POST() {
  const access = await requireDevelopmentOrSuperAdmin()
  if (!access.success) return access.error
  if (!("mode" in access) || access.mode !== "development") {
    const gate = await requireHybridAiFeature("helperRoadmap")
    if (!gate.success) return gate.error
  }

  const configuredAgentBase = process.env.USECLEVR_AGENT_BASE?.trim()
  if (process.env.NODE_ENV === "production" && !configuredAgentBase) {
    return NextResponse.json({ success: false, state: "agent_unavailable" })
  }

  const agentBase = configuredAgentBase || DEFAULT_AGENT_BASE
  const url = `${agentBase.replace(/\/$/, '')}${INSTALL_PATH}`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({}),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    // Pass through structured agent responses when available
    if (res.ok) {
      const body = await res.json().catch(() => ({})) as { success?: boolean; state?: AgentInstallState; message?: string }
      const state: AgentInstallState = (body.state || (body.success ? 'accepted' : 'error')) as AgentInstallState
      return NextResponse.json({ success: !!body.success, state })
    }

    if (res.status === 404 || res.status === 501) {
      return NextResponse.json({ success: false, state: 'agent_unavailable' })
    }

    return NextResponse.json({ success: false, state: 'error' }, { status: 502 })
  } catch {
    clearTimeout(timeoutId)
    return NextResponse.json({ success: false, state: 'agent_unavailable' })
  }
}
