import { FaqList } from "@/components/faq/faq-list"
import { AppPageHeader } from "@/components/layout/app-page-header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { dashboardFaqCategories } from "@/lib/content/dashboard-faq"
import { HelpCircle, MessageSquare } from "lucide-react"
import Link from "next/link"

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
            <Link href="/app/tickets">
              <Button className="gap-2">
                <MessageSquare className="h-4 w-4" />
                Open ticket
              </Button>
            </Link>
          </Card>

          <FaqList categories={dashboardFaqCategories} />
        </div>
      </main>
    </div>
  )
}
