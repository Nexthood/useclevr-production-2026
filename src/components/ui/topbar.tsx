import { ThemeToggle } from "@/components/ui/theme-toggle"
import HybridAiButton from "@/components/ui/hybrid-ai-button"
import { TopbarSignOutButton } from "@/components/ui/topbar-sign-out-button"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { getAnalystCreditUsage } from "@/lib/usage/analyst-credits"
import { getBillingSettings } from "@/lib/billing/settings-store"
import { getDb } from "@/lib/db"
import { profiles } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { Ticket } from "lucide-react"

type BusinessCompletion = {
  percent: number
  label: string
}

export default async function Topbar() {
  const session = await auth()
  const userId = session?.user?.id ?? null

  const [usage, billingSettings, businessCompletion] = await Promise.all([
    getAnalystCreditUsage(userId),
    getBillingSettings(),
    loadBusinessCompletion(userId),
  ])

  const tier = usage.subscriptionTier
  const planLabel =
    tier === "superadmin"
      ? "Super admin"
      : tier === "pro"
      ? "Pro"
      : "Free"

  const matchedPlan =
    tier !== "free" && tier !== "superadmin"
      ? billingSettings.plans.find((p) => p.id === tier) || null
      : null
  const fullPlanLabel = matchedPlan ? `${matchedPlan.name} · ${planLabel}` : planLabel

  return (
    <div className="app-topbar min-h-16">
      <div className="flex w-full items-center justify-end">
        <div className="flex items-center gap-3">
          <HybridAiButton subscriptionTier={usage.subscriptionTier} hybridAiCreditCosts={billingSettings.hybridAiCreditCosts} />
          <Link
            href="/app/tickets"
            className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/15 dark:text-cyan-100"
          >
            <Ticket className="h-3.5 w-3.5" />
            <span>Tickets / Issues</span>
          </Link>
          <Link
            href="/pricing"
            className="hidden items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 transition hover:bg-slate-50 sm:flex dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-900"
            title={matchedPlan ? matchedPlan.name : undefined}
          >
            <span className="text-muted-foreground">Plan</span>
            <span>{fullPlanLabel}</span>
          </Link>
          <Link
            href="/pricing"
            className="hidden rounded-full px-3 py-2 text-xs font-semibold text-slate-900 transition hover:bg-slate-100 md:inline-flex dark:text-white dark:hover:bg-slate-900"
          >
            Plans
          </Link>
          {businessCompletion.percent > 0 && businessCompletion.percent < 100 && (
            <Link
              href="/app/settings/business"
              className="hidden items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 transition hover:bg-slate-50 sm:flex dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-900"
              title="Business profile completion"
            >
              <span className="text-primary">{businessCompletion.percent}%</span>
            </Link>
          )}
          <ThemeToggle />
          <TopbarSignOutButton />
        </div>
      </div>
    </div>
  )
}

async function loadBusinessCompletion(userId: string | null): Promise<BusinessCompletion> {
  if (!userId) return { percent: 0, label: "0%" }

  const db = getDb()
  if (!db) return { percent: 0, label: "0%" }

  try {
    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, userId),
      columns: {
        businessName: true,
        businessEmail: true,
        industry: true,
        location: true,
        website: true,
        businessDescription: true,
      },
    })

    if (!profile) return { percent: 0, label: "0%" }

    const fields = [
      profile.businessName,
      profile.businessEmail,
      profile.industry,
      profile.location,
      profile.website,
      profile.businessDescription,
    ] as const

    const filled = fields.filter(Boolean).length
    const percent = Math.round((filled / fields.length) * 100)
    return { percent, label: `${percent}%` }
  } catch {
    return { percent: 0, label: "0%" }
  }
}
