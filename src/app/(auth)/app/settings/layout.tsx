import { DashboardSubpageLayout } from "@/components/layout/dashboard-subpage-layout"
import { auth } from "@/lib/auth/auth"
import { getSetupStatus } from "@/lib/business/company-setup-store"
import { formatCustomerPlanLabel } from "@/lib/billing/plans"
import { getDb } from "@/lib/db"
import { datasets } from "@/lib/db/schema"
import { getAnalystCreditUsage } from "@/lib/usage/analyst-credits"
import { count, eq } from "drizzle-orm"
import { CreditCard, Settings, ShieldCheck } from "lucide-react"
import type React from "react"
import { SettingsProvider, type SettingsContextValue } from "@/components/settings/settings-context"

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const setupStatus = session?.user?.id ? await getSetupStatus(session.user.id) : null
  const usage = await getAnalystCreditUsage(session?.user?.id, session?.user?.role)
  const businessCompletion = Math.min(100, Math.max(0, setupStatus?.setupAccuracy ?? 0))
  const businessComplete = businessCompletion >= 100
  let uploadedDatasetCount = 0
  const db = getDb()
  if (db && session?.user?.id) {
    try {
      const [datasetCount] = await db
        .select({ count: count() })
        .from(datasets)
        .where(eq(datasets.userId, session.user.id))
      uploadedDatasetCount = Number(datasetCount?.count ?? 0)
    } catch {
      uploadedDatasetCount = 0
    }
  }
  const accountancyCompletion = businessComplete && uploadedDatasetCount > 0
    ? 100
    : businessComplete || uploadedDatasetCount > 0
      ? 50
      : 0

  const rightSidebar = (
    <aside className="hidden w-72 flex-shrink-0 border-l border-border bg-card/80 xl:block 2xl:w-80">
      <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
        <section className="rounded-lg border border-border bg-background/70 p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground">Completion indicators</h3>
          <div className="mt-4 grid gap-3">
            <CompletionLine label="Business" value={businessCompletion} />
            <CompletionLine label="Accountancy" value={accountancyCompletion} />
          </div>
        </section>

        <section className="rounded-lg border border-border bg-background/70 p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground">Account status</h3>
          <div className="mt-4 grid gap-3">
            <StatusLine icon={CreditCard} label="Plan" value={formatCustomerPlanLabel(usage.subscriptionTier, usage.unlimitedLabel)} />
            <StatusLine icon={ShieldCheck} label="Access" value={usage.canAnalyze ? "Analysis enabled" : "Credits used"} />
            <StatusLine icon={Settings} label="Role" value={session?.user?.role || "user"} />
          </div>
        </section>
      </div>
    </aside>
  )

  return (
    <SettingsProvider setupStatus={setupStatus} usage={usage} session={session as SettingsContextValue["session"]}>
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
          <main className="min-w-0 flex-1 overflow-y-auto px-5 py-5 lg:px-8">
            <section className="mx-auto min-w-0 w-full max-w-[1100px]">{children}</section>
          </main>
        </div>
      </DashboardSubpageLayout>
    </SettingsProvider>
  )
}

function CompletionLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-xs font-semibold text-primary">{value}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${value}%` }} />
      </div>
    </div>
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
