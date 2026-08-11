import { requireSession } from "@/lib/auth/require-session"
import { createTrace, getUserTraces } from "@/lib/ai/ai-trace"
import { ghostModeTraceMessage, normalizeGhostMode } from "@/lib/ai/ghost-mode"
import { debugError } from "@/lib/utils/debug"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const auth = await requireSession()
  if (!auth.success) return auth.error

  const url = new URL(request.url)
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100)
  const offset = parseInt(url.searchParams.get("offset") || "0")
  const fromDate = url.searchParams.get("from") ? new Date(url.searchParams.get("from")!) : undefined
  const toDate = url.searchParams.get("to") ? new Date(url.searchParams.get("to")!) : undefined

  const result = await getUserTraces(auth.userId, { limit, offset, fromDate, toDate })
  return NextResponse.json(result)
}

export async function POST(request: Request) {
  const auth = await requireSession()
  if (!auth.success) return auth.error

  try {
    const body = await request.json()
    if (normalizeGhostMode(body.ghostMode)) {
      return NextResponse.json({
        success: true,
        trace: null,
        ghostMode: true,
        message: ghostModeTraceMessage(),
      })
    }

    const trace = await createTrace({
      userId: auth.userId,
      datasetId: body.datasetId,
      prompt: body.prompt,
      response: body.response,
      providerName: body.providerName || "unknown",
      modelName: body.modelName || "unknown",
      promptVersion: body.promptVersion,
      latencyMs: body.latencyMs,
      tokenCount: body.tokenCount,
      estimatedCostUsd: body.estimatedCostUsd,
      error: body.error,
    })

    if (!trace) {
      return NextResponse.json({ success: false, error: "Failed to save trace" }, { status: 500 })
    }

    return NextResponse.json({ success: true, trace })
  } catch (err: any) {
    debugError("[HISTORY] Failed to save trace:", err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
