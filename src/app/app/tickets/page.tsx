import { AppPageHeader } from "@/components/layout/app-page-header"
import { PageActionRow } from "@/components/ui/page-action-row"
import { auth } from "@/lib/auth"
import { Plus } from "lucide-react"
import Link from "next/link"
import { TicketsClient } from "./tickets-client"

export default async function TicketsPage() {
  const session = await auth()
  const isSuperAdmin = session?.user?.role === "superadmin"

  return (
    <div className="min-h-screen bg-background">
      <AppPageHeader
        title={isSuperAdmin ? "Tickets & Issues" : "Support Tickets"}
        description={
          isSuperAdmin
            ? "Review, update, and resolve customer support tickets."
            : "Ask for help and track issue resolution from your dashboard."
        }
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: "Tickets" },
        ]}
      />

      <PageActionRow description="Create a ticket when support needs details, billing context, or account access information.">
        <Link
          href="/app/tickets/new"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New ticket
        </Link>
      </PageActionRow>

      <main className="px-5 py-5">
        <TicketsClient isSuperAdmin={isSuperAdmin} />
      </main>
    </div>
  )
}
