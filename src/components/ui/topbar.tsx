import HybridAiButton from "@/components/ui/hybrid-ai-button"
import { HelpMenu } from "@/components/ui/help-menu"
import { LanguageSelector } from "@/components/ui/language-selector"
import { OnboardingProcessButton } from "@/components/ui/onboarding-process-button"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { TopbarNoticeActivityDrawer } from "@/components/ui/topbar-notice-activity-drawer"
import { TopbarSignOutButton } from "@/components/ui/topbar-sign-out-button"
import { CreditPanel } from "@/components/ui/credit-panel"
import { auth } from "@/lib/auth"
import { getBillingSettings } from "@/lib/billing/settings-store"
import { getAnalystCreditUsage, FREE_ANALYST_CREDITS } from "@/lib/usage/analyst-credits"

export default async function Topbar() {
  const session = await auth()
  const userId = session?.user?.id ?? null
  const isSuperAdmin = session?.user?.role === "superadmin"

  const [usage, billingSettings] = await Promise.all([
    getAnalystCreditUsage(userId),
    getBillingSettings(),
  ])

  const remainingCredits =
    usage.subscriptionTier === "superadmin" || usage.subscriptionTier === "pro"
      ? "Unlimited"
      : Math.max(0, usage.total - usage.analysisCount).toString()

  const totalCredits = usage.subscriptionTier === "superadmin" || usage.subscriptionTier === "pro" ? 0 : usage.total || FREE_ANALYST_CREDITS

  return (
    <div className="app-topbar min-h-16">
      <div className="flex w-full items-center justify-end">
        <div className="flex items-center gap-3">
          <OnboardingProcessButton />
          <HybridAiButton subscriptionTier={usage.subscriptionTier} hybridAiCreditCosts={billingSettings.hybridAiCreditCosts} />
          <HelpMenu isSuperAdmin={isSuperAdmin} />
          <TopbarNoticeActivityDrawer />
          <CreditPanel remainingCredits={remainingCredits} totalCredits={totalCredits} />
          <ThemeToggle />
          <LanguageSelector />
          <TopbarSignOutButton />
        </div>
      </div>
    </div>
  )
}
