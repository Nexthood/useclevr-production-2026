import HybridAiButton from "@/components/ui/hybrid-ai-button"
import { HelpMenu } from "@/components/ui/help-menu"
import { LanguageSelector } from "@/components/ui/language-selector"
import { OnboardingProcessButton } from "@/components/ui/onboarding-process-button"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { TopbarNoticeActivityDrawer } from "@/components/ui/topbar-notice-activity-drawer"
import { TopbarSignOutButton } from "@/components/ui/topbar-sign-out-button"
import { auth } from "@/lib/auth"
import { getBillingSettings } from "@/lib/billing/settings-store"
import { getDb } from "@/lib/db"
import { profiles } from "@/lib/db/schema"
import { getAnalystCreditUsage } from "@/lib/usage/analyst-credits"
import { eq } from "drizzle-orm"
import { CreditCard } from "lucide-react"
import Link from "next/link"

type BusinessCompletion = {
  percent: number
  label: string
}

export default async function Topbar() {
  const session = await auth()
  const userId = session?.user?.id ?? null
  const isSuperAdmin = session?.user?.role === "superadmin"

  const [usage, billingSettings, businessCompletion] = await Promise.all([
    getAnalystCreditUsage(userId),
    getBillingSettings(),
    loadBusinessCompletion(userId),
  ])

  const remainingCredits =
    usage.subscriptionTier === "superadmin" || usage.subscriptionTier === "pro"
      ? "Unlimited"
      : Math.max(0, usage.total - usage.analysisCount).toString()

  return (
    <div className="app-topbar min-h-16">
      <div className="flex w-full items-center justify-end">
        <div className="flex items-center gap-3">
          <OnboardingProcessButton />
          <HybridAiButton subscriptionTier={usage.subscriptionTier} hybridAiCreditCosts={billingSettings.hybridAiCreditCosts} />
          <HelpMenu isSuperAdmin={isSuperAdmin} />
          <TopbarNoticeActivityDrawer />
          <Link
            href="/app/settings/subscription"
            className="hidden items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 transition hover:bg-slate-50 sm:flex dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-900"
            title="Credits and subscription"
          >
            <CreditCard className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            <span>Credits</span>
            <span className="text-muted-foreground">{remainingCredits}</span>
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
          <LanguageSelector />
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
