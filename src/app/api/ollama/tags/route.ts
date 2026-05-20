import { fetchOllamaModels } from "@/lib/ai/ollama-client"
import { NextResponse } from "next/server"

const TIMEOUT_MS = 5000

export async function GET() {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const models = await fetchOllamaModels({ signal: controller.signal })
    clearTimeout(timeoutId)
    return NextResponse.json({ models })
  } catch (e: unknown) {
    clearTimeout(timeoutId)
    const message = e instanceof Error ? e.message : "connection failed"
    return NextResponse.json({ models: [], error: message }, { status: 502 })
  }
}
