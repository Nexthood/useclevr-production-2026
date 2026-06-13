import { DashboardSubpageLayout } from "@/components/layout/dashboard-subpage-layout"
import { auth } from "@/lib/auth/auth"
import { GraduationCap } from "lucide-react"
import type { Metadata } from "next"
import { MentoringClient } from "./mentoring-client"

export const metadata: Metadata = {
  title: "Business Mentoring",
}

export default async function MentoringPage() {
  const _session = await auth()

  const rightSidebar = (
    <aside className="hidden w-80 flex-shrink-0 border-l border-border bg-card lg:block">
      <div className="flex h-full flex-col overflow-y-auto p-4">
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground">Mentoring guide</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Book expert sessions, review notes, and track follow-up actions from your mentoring history.
            </p>
          </div>
        </div>
      </div>
    </aside>
  )

  return (
    <DashboardSubpageLayout
      title="Business Mentoring"
      description="Book expert sessions and review your mentoring history."
      breadcrumbs={[
        { label: "Dashboard", href: "/app" },
        { label: "Mentoring" },
      ]}
      icon={GraduationCap}
      rightSidebar={rightSidebar}
    >
      <main className="flex-1 overflow-y-auto p-5">
        <MentoringClient />
      </main>
    </DashboardSubpageLayout>
  )
}
