import { FaqList } from "@/components/faq/faq-list"
import { DashboardFaqActions } from "@/components/faq/dashboard-faq-actions"
import { FaqScopeNav } from "@/components/faq/faq-scope-nav"
import { DashboardSubpageLayout } from "@/components/layout/dashboard-subpage-layout"
import { Card } from "@/components/ui/card"
import { auth } from "@/lib/auth/auth"
import { dashboardFaqCategories, superAdminFaqCategories } from "@/lib/content/dashboard-faq"
import { HelpCircle, MessageSquare } from "lucide-react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Dashboard FAQ",
}

export default async function DashboardFaqPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>
}) {
  const [session, params] = await Promise.all([auth(), searchParams])
  const isSuperAdmin = session?.user?.role === "superadmin"
  const activeScope = isSuperAdmin && params.scope === "operator" ? "operator" : "user"
  const categories = activeScope === "operator" ? superAdminFaqCategories : dashboardFaqCategories
  const initialCategory = activeScope === "operator" ? "Super-admin tools" : "All"

  const rightSidebar = (
    <aside className="hidden w-80 flex-shrink-0 border-l border-border bg-card lg:block">
      <div className="flex h-full flex-col overflow-y-auto p-4">
        <div className="space-y-4">
          <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <HelpCircle className="h-5 w-5 text-primary" />
                Need help?
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Use the filters to switch between dashboard help, billing, Hybrid AI, and operator notes.
              </p>
            </div>
            <MessageSquare className="h-6 w-6 text-primary" aria-hidden="true" />
          </Card>

          <Card className="p-4 bg-card border-border">
            <h3 className="text-sm font-semibold text-foreground">FAQ tips</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                <span>Use the scope filter to switch between user and operator help.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                <span>Search by keyword to find specific dashboard guidance.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                <span>Open a ticket when the FAQ does not answer your issue.</span>
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </aside>
  )

  return (
    <DashboardSubpageLayout
      title="FAQ"
      description={
        isSuperAdmin
          ? "Customer help and operator notes in one searchable reference."
          : "Answers for datasets, reports, billing, credits, and support inside the app."
      }
      breadcrumbs={[
        { label: "Dashboard", href: "/app" },
        { label: "FAQ" },
      ]}
      icon={HelpCircle}
      rightSidebar={rightSidebar}
    >
      <FaqScopeNav activeScope={activeScope} showOperator={isSuperAdmin} />

      <main className="flex-1 overflow-y-auto px-5 py-5">
        <div className="mx-auto max-w-4xl space-y-5">
          <DashboardFaqActions />
          <FaqList categories={categories} showFilter initialCategory={initialCategory} />
        </div>
      </main>
    </DashboardSubpageLayout>
  )
}
