import { requireSession } from "@/lib/auth/require-session"
import { searchUserTraces } from "@/lib/ai/ai-trace"
import { debugError } from "@/lib/utils/debug"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const auth = await requireSession()
  if (!auth.success) return auth.error

  const url = new URL(request.url)
  const query = url.searchParams.get("q") || ""
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100)
  const offset = parseInt(url.searchParams.get("offset") || "0")

  if (!query.trim()) {
    return NextResponse.json({ traces: [], total: 0 })
  }

  try {
    const result = await searchUserTraces(auth.userId, query, { limit, offset })
    return NextResponse.json(result)
  } catch (err: any) {
    debugError("[SEARCH] Failed:", err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
