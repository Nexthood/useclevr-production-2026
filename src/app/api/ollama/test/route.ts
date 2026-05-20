import { generateOllamaCompletion } from "@/lib/ai/ollama-client"
import { NextResponse } from "next/server"

const TIMEOUT_MS = 15000 // 15s minimal verification window

export async function POST(request: Request) {
  try {
    const { model } = await request.json()
    if (typeof model !== 'string' || !model.trim()) {
      return NextResponse.json({ success: false, error: 'invalid_model' }, { status: 400 })
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

    let response: string
    try {
      response = await generateOllamaCompletion(
        {
          model,
          prompt: "respond with: ok",
          stream: false,
          options: { num_predict: 3 },
        },
        { signal: controller.signal }
      )
      clearTimeout(timeoutId)
    } catch (e: unknown) {
      clearTimeout(timeoutId)
      const message = e instanceof Error ? e.message : 'test_failed'
      return NextResponse.json({ success: false, error: message }, { status: 502 })
    }

    const output = response.toLowerCase().trim()
    const passed = output.includes('ok')
    if (!passed) {
      return NextResponse.json({ success: false, error: 'unexpected_response', response }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'unknown_error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
