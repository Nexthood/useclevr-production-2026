import { requireHybridAiFeature } from "@/lib/hybrid-ai/feature-gate"
import { calculateRiskIntelligenceForDataset } from "@/lib/risk-intelligence/risk-service"
import { debugError } from "@/lib/utils/debug"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  return handleRiskRequest(request)
}

export async function POST(request: Request) {
  return handleRiskRequest(request)
}

async function handleRiskRequest(request: Request) {
  const gate = await requireHybridAiFeature("dashboardInsights")
  if (!gate.success) return gate.error

  try {
    const datasetId = await getDatasetId(request)
    if (!datasetId) {
      return NextResponse.json(
        {
          success: false,
          error: "datasetId is required.",
          code: "dataset_id_required",
        },
        { status: 400 },
      )
    }

    const calculated = await calculateRiskIntelligenceForDataset(datasetId, {
      id: gate.session.user.id,
      role: gate.access.role,
      email: gate.session.user.email,
    })

    if (!calculated.success) {
      return NextResponse.json(
        {
          success: false,
          error: calculated.error,
          code: calculated.code,
        },
        { status: calculated.status },
      )
    }

    return NextResponse.json({ success: true, riskIntelligence: calculated.result })
  } catch (error) {
    debugError("[RISK_INTELLIGENCE] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Risk Intelligence could not be calculated.",
        code: "risk_calculation_failed",
      },
      { status: 500 },
    )
  }
}

async function getDatasetId(request: Request) {
  const url = new URL(request.url)
  const queryDatasetId = url.searchParams.get("datasetId")?.trim()
  if (queryDatasetId) return queryDatasetId

  if (request.method !== "POST") return null

  const contentType = request.headers.get("content-type") || ""
  if (!contentType.includes("application/json")) return null

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object" || Array.isArray(body)) return null

  const datasetId = "datasetId" in body ? body.datasetId : null
  return typeof datasetId === "string" && datasetId.trim() ? datasetId.trim() : null
}
