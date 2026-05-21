import { FaqList } from "@/components/faq/faq-list"
import { AppPageHeader } from "@/components/layout/app-page-header"
import { SupportTicketForm } from "@/components/support/support-ticket-form"
import { Card } from "@/components/ui/card"
import { dashboardFaqCategories } from "@/lib/content/dashboard-faq"
import { HelpCircle, MessageSquare } from "lucide-react"

export default function DashboardFaqPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppPageHeader
        title="Dashboard FAQ"
        description="Answers for datasets, reports, billing, credits, and support inside the app."
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: "FAQ" },
        ]}
      />

      <main className="px-5 py-5">
        <div className="mx-auto max-w-4xl space-y-5">
          <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <HelpCircle className="h-5 w-5 text-primary" />
                Need help with your account?
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Use this FAQ for dashboard-specific questions. Public product questions remain on the general FAQ.
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

          <FaqList categories={dashboardFaqCategories} />
        </div>
      </main>
    </div>
  )
}
