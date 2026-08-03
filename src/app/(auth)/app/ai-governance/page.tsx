import { AiGovernanceView } from "@/components/ai-governance/governance-view"
import { DashboardSubpageLayout } from "@/components/layout/dashboard-subpage-layout"
import { auth } from "@/lib/auth/auth"
import { getAiGovernanceSnapshot } from "@/lib/ai-governance/governance-service"
import { redirect } from "next/navigation"

export const metadata = { title: "AI Governance — UseClevr" }

export default async function AiGovernancePage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const snapshot = await getAiGovernanceSnapshot({ id: session.user.id, role: session.user.role })

  return (
    <DashboardSubpageLayout
      title="AI Governance"
      description="EU AI Act readiness controls for transparency, oversight, privacy, provider health, audit logs, and reporting."
      breadcrumbs={[{ label: "Dashboard", href: "/app" }, { label: "AI Governance" }]}
    >
      <AiGovernanceView activeSection="overview" snapshot={snapshot} />
    </DashboardSubpageLayout>
  )
}
