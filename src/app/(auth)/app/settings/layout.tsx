import { DashboardSubpageLayout } from "@/components/layout/dashboard-subpage-layout"
import { auth } from "@/lib/auth/auth"
import { Settings } from "lucide-react"
import type React from "react"
import { SettingsNav } from "./settings-nav"

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const isSuperAdmin = session?.user?.role === "superadmin"

  const rightSidebar = (
    <aside className="hidden w-56 flex-shrink-0 border-l border-border bg-card xl:block 2xl:w-64">
      <div className="flex h-full flex-col overflow-y-auto p-4">
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground">Account settings</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Manage profile, preferences, subscription, billing, and activity from one place.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground">Quick tips</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                <span>Keep profile and billing details current.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                <span>Use preferences to tune dashboard behavior.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                <span>Review activity when troubleshooting access.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </aside>
  )

  return (
    <DashboardSubpageLayout
      title="Account"
      description="Manage profile, preferences, subscription, billing, and activity."
      breadcrumbs={[
        { label: "Dashboard", href: "/app" },
        { label: "Settings" },
      ]}
      icon={Settings}
      rightSidebar={rightSidebar}
    >
      <div className="flex flex-1 min-h-0">
        <SettingsNav showAdmin={isSuperAdmin} />

        <main className="min-w-0 flex-1 overflow-y-auto px-4 py-5">
          <section className="min-w-0 w-full">{children}</section>
        </main>
      </div>
    </DashboardSubpageLayout>
  )
}
