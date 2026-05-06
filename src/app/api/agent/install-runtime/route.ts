import { NextResponse } from "next/server"

const DEFAULT_AGENT_BASE = "http://127.0.0.1:5143"
const INSTALL_PATH = "/install-runtime"
const TIMEOUT_MS = 5000

type AgentInstallState = 'accepted' | 'unsupported' | 'not_implemented_yet' | 'already_installed' | 'error' | 'queued' | 'installing'

export async function POST() {
  const agentBase = process.env.USECLEVR_AGENT_BASE?.trim() || DEFAULT_AGENT_BASE
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

    // Map common not-implemented signals
    if (res.status === 404 || res.status === 501) {
      return NextResponse.json({ success: false, state: 'not_implemented_yet' })
    }

    return NextResponse.json({ success: false, state: 'error' }, { status: 502 })
  } catch {
    clearTimeout(timeoutId)
    // Agent unreachable → honest placeholder, no fake success
    return NextResponse.json({ success: false, state: 'not_implemented_yet' })
  }
}
