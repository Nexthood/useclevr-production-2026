import { AppPageHeader } from "@/components/layout/app-page-header"
import { Card } from "@/components/ui/card"
import { SupportTicketForm } from "@/components/support/support-ticket-form"

export const metadata = {
  title: "New Ticket - UseClevr",
}

export default function NewTicketPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppPageHeader
        title="New ticket"
        description="Create a support request for billing, uploads, reports, or account access."
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: "Tickets", href: "/app/tickets" },
          { label: "New ticket" },
        ]}
      />

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
