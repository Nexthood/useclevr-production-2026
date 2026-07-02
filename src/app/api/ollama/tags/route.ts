import { fetchOllamaModels } from "@/lib/ai/ollama-client"
import { isMockAIMode } from "@/lib/ai/mock-ai"
import { requireHybridAiFeature } from "@/lib/hybrid-ai/feature-gate"
import { NextResponse } from "next/server"

const TIMEOUT_MS = 5000

export async function GET() {
  const gate = await requireHybridAiFeature("futureHelperIntegration")
  if (!gate.success) return gate.error

  if (isMockAIMode()) {
    return NextResponse.json({
      models: [
        { name: "llama3.2:3b-instruct", mock: true },
        { name: "llama3:8b-instruct", mock: true },
      ],
      mock: true,
    })
  }

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
