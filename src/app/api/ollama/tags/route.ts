import { NextResponse } from "next/server"

const DEFAULT_OLLAMA_BASE = "http://localhost:11434"
const TAGS_PATH = "/api/tags"
const TIMEOUT_MS = 5000

export async function GET() {
  const baseUrl = process.env.OLLAMA_BASE_URL?.trim() || DEFAULT_OLLAMA_BASE
  const url = `${baseUrl.replace(/\/$/, "")}${TAGS_PATH}`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!res.ok) {
      return NextResponse.json({ models: [], error: `tags_failed:${res.status}` }, { status: 502 })
    }

    const data = await res.json().catch(() => ({ models: [] }))
    return NextResponse.json(data)
  } catch (e: unknown) {
    clearTimeout(timeoutId)
    const message = e instanceof Error ? e.message : "connection failed"
    return NextResponse.json({ models: [], error: message }, { status: 502 })
  }
}
