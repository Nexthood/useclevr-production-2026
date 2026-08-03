import { getAiGovernanceSnapshot } from "@/lib/ai-governance/governance-service"
import { requireSession } from "@/lib/auth/require-session"
import { debugError } from "@/lib/utils/debug"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const auth = await requireSession()
  if (!auth.success) return auth.error

  try {
    const snapshot = await getAiGovernanceSnapshot({ id: auth.userId, role: auth.session.user.role })
    return NextResponse.json({ success: true, snapshot })
  } catch (error) {
    debugError("[AI_GOVERNANCE] Overview load failed", error)
    return NextResponse.json({ success: false, error: "AI Governance overview could not be loaded." }, { status: 500 })
  }
}
