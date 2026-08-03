import { requireHybridAiFeature } from "@/lib/hybrid-ai/feature-gate"
import { listRiskIntelligenceDatasets } from "@/lib/risk-intelligence/risk-service"
import { debugError } from "@/lib/utils/debug"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const gate = await requireHybridAiFeature("dashboardInsights")
  if (!gate.success) return gate.error

  try {
    const url = new URL(request.url)
    const datasets = await listRiskIntelligenceDatasets({
      id: gate.session.user.id,
      role: gate.access.role,
      email: gate.session.user.email,
    }, {
      scope: url.searchParams.get("scope"),
      datasetId: url.searchParams.get("datasetId"),
    })

    return NextResponse.json({ success: true, datasets })
  } catch (error) {
    debugError("[RISK_INTELLIGENCE_DATASETS] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Risk Intelligence datasets could not be loaded.",
        code: "risk_datasets_load_failed",
      },
      { status: 500 },
    )
  }
}
