import { requireSession } from "@/lib/auth/require-session"
import { getUserTraces } from "@/lib/ai/ai-trace"
import { debugError } from "@/lib/utils/debug"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const auth = await requireSession()
  if (!auth.success) return auth.error

  const url = new URL(request.url)
  const format = url.searchParams.get("format") || "json"
  const fromDate = url.searchParams.get("from") ? new Date(url.searchParams.get("from")!) : undefined
  const toDate = url.searchParams.get("to") ? new Date(url.searchParams.get("to")!) : undefined

  try {
    const result = await getUserTraces(auth.userId, { limit: 10000, fromDate, toDate })

    if (format === "csv") {
      const header = "id,prompt,response,providerName,modelName,latencyMs,error,feedback,createdAt"
      const rows = result.traces.map((t) => {
        const escape = (s: string | null) => {
          if (!s) return ""
          const str = String(s).replace(/"/g, '""')
          return `"${str}"`
        }
        return [
          escape(t.id),
          escape(t.prompt),
          escape(t.response),
          escape(t.providerName),
          escape(t.modelName),
          t.latencyMs ?? "",
          escape(t.error),
          escape(t.feedback),
          t.createdAt?.toISOString() || "",
        ].join(",")
      })
      const csv = [header, ...rows].join("\n")
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="ai-interaction-history-${Date.now()}.csv"`,
        },
      })
    }

    return NextResponse.json({ traces: result.traces, total: result.total })
  } catch (err: any) {
    debugError("[EXPORT] Failed:", err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
