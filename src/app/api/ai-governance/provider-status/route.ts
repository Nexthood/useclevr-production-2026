import { getAiGovernanceProviderStatus } from "@/lib/ai-governance/governance-service"
import { requireSession } from "@/lib/auth/require-session"
import { debugError } from "@/lib/utils/debug"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const auth = await requireSession()
  if (!auth.success) return auth.error

  try {
    const status = await getAiGovernanceProviderStatus(auth.userId)
    return NextResponse.json({ success: true, ...status })
  } catch (error) {
    debugError("[AI_GOVERNANCE] Provider status load failed", error)
    return NextResponse.json({ success: false, error: "AI provider status could not be loaded." }, { status: 500 })
  }
}
