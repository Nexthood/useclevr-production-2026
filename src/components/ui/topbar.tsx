import { ThemeToggle } from "@/components/ui/theme-toggle"
import HybridAiButton from "@/components/ui/hybrid-ai-button"
import { TopbarSignOutButton } from "@/components/ui/topbar-sign-out-button"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { getAnalystCreditUsage } from "@/lib/usage/analyst-credits"
import { getBillingSettings } from "@/lib/billing/settings-store"

export default async function Topbar() {
  const session = await auth()
  const [usage, billingSettings] = await Promise.all([
    getAnalystCreditUsage(session?.user?.id),
    getBillingSettings(),
  ])
  const planLabel = usage.subscriptionTier === "superadmin" ? "Super admin" : usage.subscriptionTier === "pro" ? "Pro" : "Free"

  return (
    <div className="app-topbar min-h-16">
      <div className="flex w-full items-center justify-end">
        <div className="flex items-center gap-3">
          <HybridAiButton subscriptionTier={usage.subscriptionTier} hybridAiCreditCosts={billingSettings.hybridAiCreditCosts} />
          <Link
            href="/pricing"
            className="hidden items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 transition hover:bg-slate-50 sm:flex dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-900"
          >
            <span className="text-muted-foreground">Plan</span>
            <span>{planLabel}</span>
          </Link>
          <Link
            href="/pricing"
            className="hidden rounded-full px-3 py-2 text-xs font-semibold text-slate-900 transition hover:bg-slate-100 md:inline-flex dark:text-white dark:hover:bg-slate-900"
          >
            Plans
          </Link>
          <ThemeToggle />
          <TopbarSignOutButton />
        </div>
      </div>
    </div>
  )
}
