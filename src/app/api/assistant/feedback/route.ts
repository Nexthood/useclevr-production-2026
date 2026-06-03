import { requireSession } from "@/lib/auth/require-session"
import { updateTraceFeedback } from "@/lib/ai/ai-trace"
import { debugError } from "@/lib/utils/debug"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const auth = await requireSession()
  if (!auth.success) return auth.error

  try {
    const body = await request.json()
    const { traceId, feedback, feedbackText } = body

    if (!traceId) {
      return NextResponse.json({ success: false, error: "Missing traceId" }, { status: 400 })
    }

    if (feedback !== null && feedback !== "positive" && feedback !== "negative") {
      return NextResponse.json({ success: false, error: "feedback must be 'positive', 'negative', or null" }, { status: 400 })
    }

    const success = await updateTraceFeedback(traceId, auth.userId, feedback, feedbackText)
    if (!success) {
      return NextResponse.json({ success: false, error: "Trace not found or not owned by user" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    debugError("[FEEDBACK] Failed:", err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
