import { recordAiGovernanceOverride } from "@/lib/ai-governance/governance-service"
import { requireSession } from "@/lib/auth/require-session"
import { debugError } from "@/lib/utils/debug"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const auth = await requireSession()
  if (!auth.success) return auth.error

  try {
    const body = await request.json().catch(() => ({}))
    const action = typeof body.action === "string" ? body.action : ""
    if (action !== "accept" && action !== "reject" && action !== "edit" && action !== "undo") {
      return NextResponse.json({ success: false, error: "Unsupported override action." }, { status: 400 })
    }
    const override = await recordAiGovernanceOverride({
      userId: auth.userId,
      traceId: typeof body.traceId === "string" ? body.traceId : null,
      datasetId: typeof body.datasetId === "string" ? body.datasetId : null,
      action,
      originalValue: typeof body.originalValue === "string" ? body.originalValue : null,
      editedValue: typeof body.editedValue === "string" ? body.editedValue : null,
      reason: typeof body.reason === "string" ? body.reason : null,
    })
    return NextResponse.json({ success: true, override })
  } catch (error) {
    debugError("[AI_GOVERNANCE] Override record failed", error)
    return NextResponse.json({ success: false, error: "AI override could not be recorded." }, { status: 500 })
  }
}
