import { AppPageHeader } from "@/components/layout/app-page-header"
import { auth } from "@/lib/auth"
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

      <main className="px-5 py-5">
        <TicketsClient isSuperAdmin={isSuperAdmin} />
      </main>
    </div>
  )
}
