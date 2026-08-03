import {
  AiGovernanceHeaderActions,
  AiGovernanceView,
  normalizeGovernanceSection,
} from "@/components/ai-governance/governance-view"
import { DashboardSubpageLayout } from "@/components/layout/dashboard-subpage-layout"
import { auth } from "@/lib/auth/auth"
import { getAiGovernanceSnapshot } from "@/lib/ai-governance/governance-service"
import { redirect } from "next/navigation"

type PageProps = {
  params: Promise<{ section: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { section } = await params
  const normalized = normalizeGovernanceSection(section)
  const title = normalized === "overview" ? "AI Governance" : `AI Governance ${normalized.replaceAll("-", " ")}`
  return { title }
}

export default async function AiGovernanceSectionPage({ params }: PageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const [{ section }, snapshot] = await Promise.all([
    params,
    getAiGovernanceSnapshot({ id: session.user.id, role: session.user.role }),
  ])
  const activeSection = normalizeGovernanceSection(section)

  return (
    <DashboardSubpageLayout
      title="AI Governance"
      description="EU AI Act readiness controls for transparency, oversight, privacy, provider health, audit logs, and reporting."
      breadcrumbs={[
        { label: "Dashboard", href: "/app" },
        { label: "AI Governance", href: "/app/ai-governance" },
        { label: activeSection.replaceAll("-", " ") },
      ]}
      actions={<AiGovernanceHeaderActions activeSection={activeSection} />}
    >
      <AiGovernanceView activeSection={activeSection} snapshot={snapshot} />
    </DashboardSubpageLayout>
  )
}
