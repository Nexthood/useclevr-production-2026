import { FaqList } from "@/components/faq/faq-list"
import { DashboardFaqActions } from "@/components/faq/dashboard-faq-actions"
import { AppPageHeader } from "@/components/layout/app-page-header"
import { SupportTicketForm } from "@/components/support/support-ticket-form"
import { Card } from "@/components/ui/card"
import { auth } from "@/lib/auth"
import { dashboardFaqCategories, superAdminFaqCategories } from "@/lib/content/dashboard-faq"
import { HelpCircle, MessageSquare } from "lucide-react"

export default async function DashboardFaqPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>
}) {
  const [session, params] = await Promise.all([auth(), searchParams])
  const isSuperAdmin = session?.user?.role === "superadmin"
  const categories = isSuperAdmin
    ? [...dashboardFaqCategories, ...superAdminFaqCategories]
    : dashboardFaqCategories
  const initialCategory = params.scope === "operator" ? "Super-admin tools" : "All"

  return (
    <div className="min-h-screen bg-background">
      <AppPageHeader
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
      />

      <main className="px-5 py-5">
        <div className="mx-auto max-w-4xl space-y-5">
          <DashboardFaqActions />

          <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <HelpCircle className="h-5 w-5 text-primary" />
                Need help?
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Use the filters to switch between dashboard help, billing, Hybrid AI, and operator notes.
              </p>
            </div>
            <MessageSquare className="h-6 w-6 text-primary" aria-hidden="true" />
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <MessageSquare className="h-5 w-5 text-primary" />
              Open ticket
            </h2>
            <SupportTicketForm compact />
          </Card>

          <FaqList categories={categories} showFilter initialCategory={initialCategory} />
        </div>
      </main>
    </div>
  )
}
