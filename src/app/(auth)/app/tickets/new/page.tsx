import { AppPageHeader } from "@/components/layout/app-page-header"
import { Card } from "@/components/ui/card"
import { PageActionRow } from "@/components/ui/page-action-row"
import { SupportTicketForm } from "@/components/support/support-ticket-form"
import { Ticket } from "lucide-react"
import Link from "next/link"

export const metadata = {
  title: "New Ticket - UseClevr",
}

export default function NewTicketPage() {
  return (
    <div className="flex-1 bg-background">
      <AppPageHeader
        title="New ticket"
        description="Create a support request for billing, uploads, reports, or account access."
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: "Tickets", href: "/app/tickets" },
          { label: "New ticket" },
        ]}
        icon={Ticket}
      />

      <PageActionRow description="Start a support request with the issue, category, and priority.">
        <Link
          href="/app/tickets"
          className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium text-foreground transition hover:bg-accent hover:text-accent-foreground"
        >
          Back to tickets
        </Link>
      </PageActionRow>

      <main className="px-5 py-5">
        <div className="mx-auto max-w-3xl">
          <Card className="border-border bg-card p-5">
            <SupportTicketForm redirectTo="/app/tickets" />
          </Card>
        </div>
      </main>
    </div>
  )
}
