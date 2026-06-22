import { DashboardSubpageLayout } from "@/components/layout/dashboard-subpage-layout"
import { auth } from "@/lib/auth/auth"
import { getSetupStatus } from "@/lib/business/company-setup-store"
import { getAnalystCreditUsage } from "@/lib/usage/analyst-credits"
import { CheckCircle2, CircleDashed, CreditCard, Settings, ShieldCheck } from "lucide-react"
import Link from "next/link"
import type React from "react"
import { SettingsNav } from "./settings-nav"

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const isSuperAdmin = session?.user?.role === "superadmin"
  const setupStatus = session?.user?.id ? await getSetupStatus(session.user.id) : null
  const usage = await getAnalystCreditUsage(session?.user?.id)
  const setupAccuracy = setupStatus?.setupAccuracy ?? 0
  const setupItems = [
    { label: "Profile", complete: Boolean(session?.user?.name && session?.user?.email) },
    { label: "Company", complete: setupAccuracy >= 80 },
    { label: "Subscription", complete: usage.subscriptionTier !== "free" || usage.trialActive },
    { label: "Security", complete: Boolean(session?.user?.email) },
  ]
  const completedItems = setupItems.filter((item) => item.complete).length

  const rightSidebar = (
    <aside className="hidden w-72 flex-shrink-0 border-l border-border bg-card/80 xl:block 2xl:w-80">
      <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
        <section className="rounded-lg border border-border bg-background/70 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Setup progress</h3>
              <p className="mt-1 text-xs text-muted-foreground">{completedItems} of {setupItems.length} account areas ready</p>
            </div>
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              {setupAccuracy}%
            </span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${setupAccuracy}%` }} />
          </div>
          <div className="mt-4 space-y-2">
            {setupItems.map((item) => {
              const Icon = item.complete ? CheckCircle2 : CircleDashed
              return (
                <div key={item.label} className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2 text-sm">
                  <span className="text-foreground">{item.label}</span>
                  <Icon className={item.complete ? "h-4 w-4 text-emerald-500" : "h-4 w-4 text-muted-foreground"} />
                </div>
              )
            })}
          </div>
          <Link
            href="/app/business/setup"
            className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Continue Setup
          </Link>
        </section>

        <section className="rounded-lg border border-border bg-background/70 p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground">Account status</h3>
          <div className="mt-4 grid gap-3">
            <StatusLine icon={CreditCard} label="Plan" value={usage.trialActive ? "Trial" : usage.subscriptionTier} />
            <StatusLine icon={ShieldCheck} label="Access" value={usage.canAnalyze ? "Analysis enabled" : "Credits used"} />
            <StatusLine icon={Settings} label="Role" value={session?.user?.role || "user"} />
          </div>
        </section>
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

        <main className="min-w-0 flex-1 overflow-y-auto px-5 py-5 lg:px-8">
          <section className="mx-auto min-w-0 w-full max-w-7xl">{children}</section>
        </main>
      </div>
    </DashboardSubpageLayout>
  )
}

function StatusLine({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2">
      <Icon className="h-4 w-4 text-primary" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium capitalize text-foreground">{value}</p>
      </div>
    </div>
  )
}
