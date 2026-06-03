import { requireSuperAdmin } from "@/lib/auth/require-session"
import { getAdminTraceAnalytics, getBenchmarkingData, anonymizeUserTraces, deleteOldTraces } from "@/lib/ai/ai-trace"
import { debugError } from "@/lib/utils/debug"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const auth = await requireSuperAdmin()
  if (!auth.success) return auth.error

  const url = new URL(request.url)
  const view = url.searchParams.get("view") || "analytics"
  const fromDate = url.searchParams.get("from") ? new Date(url.searchParams.get("from")!) : undefined
  const toDate = url.searchParams.get("to") ? new Date(url.searchParams.get("to")!) : undefined

  try {
    if (view === "benchmarking") {
      const data = await getBenchmarkingData({ fromDate, toDate })
      return NextResponse.json({ benchmarking: data })
    }

    const analytics = await getAdminTraceAnalytics({ fromDate, toDate })
    return NextResponse.json(analytics)
  } catch (err: any) {
    debugError("[ADMIN TRACES] Failed:", err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireSuperAdmin()
  if (!auth.success) return auth.error

  try {
    const body = await request.json()
    const { action, userId, retentionDays } = body

    if (action === "anonymize" && userId) {
      const success = await anonymizeUserTraces(userId)
      return NextResponse.json({ success })
    }

    if (action === "cleanup" && retentionDays) {
      const deleted = await deleteOldTraces(retentionDays)
      return NextResponse.json({ success: true, deleted })
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 })
  } catch (err: any) {
    debugError("[ADMIN TRACES] POST failed:", err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
