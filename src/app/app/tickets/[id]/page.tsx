import { AppPageHeader } from "@/components/layout/app-page-header"
import { auth } from "@/lib/auth"
import { TicketEditClient } from "./ticket-edit-client"

export const metadata = {
  title: "Edit Ticket - UseClevr",
}

export default async function TicketEditPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, session] = await Promise.all([params, auth()])
  const isSuperAdmin = session?.user?.role === "superadmin"

  return (
    <div className="min-h-screen bg-background">
      <AppPageHeader
        title="Edit ticket"
        description={isSuperAdmin ? "Update status and support notes for a customer ticket." : "Review your support request and mark it resolved when complete."}
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: "Tickets", href: "/app/tickets" },
          { label: "Edit ticket" },
        ]}
      />

      <main className="px-5 py-5">
        <div className="mx-auto max-w-6xl">
          <TicketEditClient id={id} isSuperAdmin={isSuperAdmin} />
        </div>
      </main>
    </div>
  )
}
