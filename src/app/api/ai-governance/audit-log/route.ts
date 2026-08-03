import { listAiGovernanceAuditRows } from "@/lib/ai-governance/governance-service"
import { requireSession } from "@/lib/auth/require-session"
import { debugError } from "@/lib/utils/debug"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = await requireSession()
  if (!auth.success) return auth.error

  try {
    const url = new URL(request.url)
    const entries = await listAiGovernanceAuditRows(
      { id: auth.userId, role: auth.session.user.role },
      {
        query: url.searchParams.get("q"),
        provider: url.searchParams.get("provider"),
        mode: url.searchParams.get("mode"),
        status: url.searchParams.get("status"),
        limit: Number(url.searchParams.get("limit") || 100),
      },
    )
    return NextResponse.json({ success: true, entries })
  } catch (error) {
    debugError("[AI_GOVERNANCE] Audit log load failed", error)
    return NextResponse.json({ success: false, error: "AI Governance audit log could not be loaded." }, { status: 500 })
  }
}
