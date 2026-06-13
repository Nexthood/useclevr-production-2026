import { DashboardSubpageLayout } from "@/components/layout/dashboard-subpage-layout"
import { PageActionRow } from "@/components/ui/page-action-row"
import { auth } from "@/lib/auth/auth"
import { Plus, Ticket } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { TicketsClient } from "./tickets-client"

export const metadata: Metadata = {
  title: "Support Tickets",
}

export default async function TicketsPage() {
  const session = await auth()
  const isSuperAdmin = session?.user?.role === "superadmin"

  const rightSidebar = (
    <aside className="hidden w-80 flex-shrink-0 border-l border-border bg-card lg:block">
      <div className="flex h-full flex-col overflow-y-auto p-4">
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground">Ticket guidance</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {isSuperAdmin
                ? "Review, update, and resolve customer support tickets with full context."
                : "Ask for help and track issue resolution from your dashboard."}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground">Before submitting</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                <span>Include account, billing, or access context when relevant.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                <span>Add screenshots or export references for faster review.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                <span>Use urgent tickets only for blocked workflows.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </aside>
  )

  return (
    <DashboardSubpageLayout
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
      icon={Ticket}
      rightSidebar={rightSidebar}
      actions={
        <Link
          href="/app/tickets/new"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New ticket
        </Link>
      }
    >
      <main className="flex-1 overflow-y-auto p-5">
        <TicketsClient isSuperAdmin={isSuperAdmin} />
      </main>
    </DashboardSubpageLayout>
  )
}
