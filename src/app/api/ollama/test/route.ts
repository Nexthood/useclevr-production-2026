import { NextResponse } from "next/server"

const DEFAULT_OLLAMA_BASE = "http://localhost:11434"
const GENERATE_PATH = "/api/generate"
const TIMEOUT_MS = 15000 // 15s minimal verification window

export async function POST(request: Request) {
  try {
    const { model } = await request.json()
    if (typeof model !== 'string' || !model.trim()) {
      return NextResponse.json({ success: false, error: 'invalid_model' }, { status: 400 })
    }

    const baseUrl = process.env.OLLAMA_BASE_URL?.trim() || DEFAULT_OLLAMA_BASE
    const url = `${baseUrl.replace(/\/$/, '')}${GENERATE_PATH}`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

    // Tiny deterministic prompt, no streaming
    const body = {
      model,
      prompt: "respond with: ok",
      stream: false,
      options: { num_predict: 3 },
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return NextResponse.json({ success: false, error: `test_failed:${res.status}`, details: text }, { status: 502 })
    }

    const data: { response?: string } = await res.json().catch(() => ({}))
    const output = (data.response || '').toLowerCase().trim()
    const passed = output.includes('ok')
    if (!passed) {
      return NextResponse.json({ success: false, error: 'unexpected_response', response: data.response || '' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'unknown_error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
