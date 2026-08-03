import { getAiGovernanceSettings, saveAiGovernanceSettings } from "@/lib/ai-governance/governance-service"
import { requireSession } from "@/lib/auth/require-session"
import { debugError } from "@/lib/utils/debug"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const auth = await requireSession()
  if (!auth.success) return auth.error

  try {
    const settings = await getAiGovernanceSettings(auth.userId)
    return NextResponse.json({ success: true, settings })
  } catch (error) {
    debugError("[AI_GOVERNANCE] Settings load failed", error)
    return NextResponse.json({ success: false, error: "AI Governance settings could not be loaded." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireSession()
  if (!auth.success) return auth.error

  try {
    const body = await request.json().catch(() => ({}))
    const settings = await saveAiGovernanceSettings(auth.userId, body)
    return NextResponse.json({ success: true, settings })
  } catch (error) {
    debugError("[AI_GOVERNANCE] Settings save failed", error)
    return NextResponse.json({ success: false, error: "AI Governance settings could not be saved." }, { status: 500 })
  }
}
