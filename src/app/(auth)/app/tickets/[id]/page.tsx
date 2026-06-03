import { AppPageHeader } from "@/components/layout/app-page-header"
import { PageActionRow } from "@/components/ui/page-action-row"
import { auth } from "@/lib/auth/auth"
import { Ticket } from "lucide-react"
import Link from "next/link"
import { TicketEditClient } from "./ticket-edit-client"

export const metadata = {
  title: "Edit Ticket - UseClevr",
}

export default async function TicketEditPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, session] = await Promise.all([params, auth()])
  const isSuperAdmin = session?.user?.role === "superadmin"

  return (
    <div className="flex-1 bg-background">
      <AppPageHeader
        title="Edit ticket"
        description={isSuperAdmin ? "Update status and support notes for a customer ticket." : "Review your support request and mark it resolved when complete."}
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: "Tickets", href: "/app/tickets" },
          { label: "Edit ticket" },
        ]}
        icon={Ticket}
      />

      <PageActionRow description="Update the ticket status, notes, and resolution details.">
        <Link
          href="/app/tickets"
          className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium text-foreground transition hover:bg-accent hover:text-accent-foreground"
        >
          Back to tickets
        </Link>
      </PageActionRow>

      <main className="px-5 py-5">
        <div className="mx-auto max-w-6xl">
          <TicketEditClient id={id} isSuperAdmin={isSuperAdmin} />
        </div>
      </main>
    </div>
  )
}
