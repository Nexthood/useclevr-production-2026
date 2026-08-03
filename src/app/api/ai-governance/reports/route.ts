import { getAiGovernanceSnapshot } from "@/lib/ai-governance/governance-service"
import { requireSession } from "@/lib/auth/require-session"
import { debugError } from "@/lib/utils/debug"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = await requireSession()
  if (!auth.success) return auth.error

  try {
    const url = new URL(request.url)
    const type = normalizeReportType(url.searchParams.get("type"))
    const snapshot = await getAiGovernanceSnapshot({ id: auth.userId, role: auth.session.user.role })
    const report = buildReport(type, snapshot)
    const body = JSON.stringify(report, null, 2)
    return new NextResponse(body, {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="useclevr-ai-${type}-report.json"`,
      },
    })
  } catch (error) {
    debugError("[AI_GOVERNANCE] Report generation failed", error)
    return NextResponse.json({ success: false, error: "AI Governance report could not be generated." }, { status: 500 })
  }
}

function normalizeReportType(value: string | null) {
  if (value === "usage" || value === "audit" || value === "providers" || value === "errors" || value === "compliance") return value
  return "compliance"
}

function buildReport(type: string, snapshot: Awaited<ReturnType<typeof getAiGovernanceSnapshot>>) {
  const common = {
    type,
    generatedAt: snapshot.generatedAt,
    complianceScore: snapshot.compliance.score,
    note: "This report contains governance metadata only and does not expose provider secrets.",
  }
  if (type === "usage") return { ...common, audit: snapshot.audit, recentRequests: snapshot.recentAuditEntries }
  if (type === "audit") return { ...common, recentTraces: snapshot.recentTraces, recentRequests: snapshot.recentAuditEntries, overrides: snapshot.overrides }
  if (type === "providers") return { ...common, providers: snapshot.providers }
  if (type === "errors") return { ...common, risks: snapshot.risk, failedRequests: snapshot.recentAuditEntries.filter((entry) => !entry.success) }
  return { ...common, compliance: snapshot.compliance, privacy: snapshot.privacy, policies: snapshot.policies }
}
