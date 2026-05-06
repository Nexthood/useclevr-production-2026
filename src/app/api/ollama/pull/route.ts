import { NextResponse } from "next/server"

const DEFAULT_OLLAMA_BASE = "http://localhost:11434"
const PULL_PATH = "/api/pull"
const TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes

export async function POST(request: Request) {
  try {
    const { model } = await request.json()
    if (typeof model !== 'string' || !model.trim()) {
      return NextResponse.json({ success: false, error: 'invalid_model' }, { status: 400 })
    }

    const baseUrl = process.env.OLLAMA_BASE_URL?.trim() || DEFAULT_OLLAMA_BASE
    const url = `${baseUrl.replace(/\/$/, '')}${PULL_PATH}`

    // Minimal runtime availability check to avoid opaque 502s
    const runtimeOk = await (async () => {
      const controller = new AbortController()
      const t = setTimeout(() => controller.abort(), 2000)
      try {
        const probe = await fetch(`${baseUrl.replace(/\/$/, '')}/api/version`, { method: 'GET', signal: controller.signal })
        clearTimeout(t)
        return probe.ok
      } catch {
        clearTimeout(t)
        return false
      }
    })()

    if (!runtimeOk) {
      // Do not attempt model pull; provide structured product-usable response
      return NextResponse.json(
        {
          success: false,
          error: 'runtime_required',
          reason: 'runtime_unavailable',
          status: 'model_pull_blocked'
        },
        { status: 428 } // Precondition Required
      )
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model, stream: false }),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return NextResponse.json({ success: false, error: `pull_failed:${res.status}`, details: text }, { status: 502 })
    }

    const data = await res.json().catch(() => ({}))
    return NextResponse.json({ success: true, result: data })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'unknown_error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
