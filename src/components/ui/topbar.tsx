import HybridAiButton from "@/components/ui/hybrid-ai-button"
import { Logo } from "@/components/layout/logo"
import { LanguageSelector } from "@/components/ui/language-selector"
import { OnboardingProcessButton } from "@/components/ui/onboarding-process-button"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { TopbarNoticeActivityDrawer } from "@/components/ui/topbar-notice-activity-drawer"
import { TopbarSignOutButton } from "@/components/ui/topbar-sign-out-button"
import { CreditPanel } from "@/components/ui/credit-panel"
import { Search } from "@/components/ui/search-popup"
import { TourGuideButton } from "@/components/ui/tour-guide-button"
import { UserLevelLink } from "@/components/ui/user-level-link"
import { TopbarPanelLink, TopbarSection } from "@/components/ui/topbar-section"
import { auth } from "@/lib/auth"
import { getBillingSettings } from "@/lib/billing/settings-store"
import { getAnalystCreditUsage, FREE_ANALYST_CREDITS } from "@/lib/usage/analyst-credits"
import { Brain, Bell, CircleHelp, CreditCard, LogOut, SearchIcon, Settings, Sparkles, UserRound } from "lucide-react"
import Link from "next/link"

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
  const displayName = session?.user?.name || session?.user?.email?.split("@")[0] || "User"
  const levelLabel = usage.subscriptionTier === "superadmin" ? "Admin" : usage.subscriptionTier || "Free"

  return (
    <div className="app-topbar min-h-16">
      <div className="flex h-full min-w-0 flex-1 items-center">
        <Link href="/app" className="flex h-full w-[180px] shrink-0 items-center border-r border-border px-4 md:w-[220px]">
          <Logo className="h-10 w-auto" />
        </Link>

        <div className="flex h-full min-w-0 flex-1 items-center overflow-x-auto">
          <TopbarSection
            icon={<Brain className="h-4 w-4" />}
            label="Hybrid AI"
            value="Cloud + local"
            header="Hybrid AI"
            description="Open cloud analysis tools or local private analysis setup for eligible plans."
          >
            <HybridAiButton subscriptionTier={usage.subscriptionTier} hybridAiCreditCosts={billingSettings.hybridAiCreditCosts} mode="link" />
            <TopbarPanelLink href="/app/settings/subscription">Review plan access</TopbarPanelLink>
          </TopbarSection>

          <TopbarSection
            icon={<SearchIcon className="h-4 w-4" />}
            label="Search"
            value="Find work"
            header="Dashboard search"
            description="Find datasets, reports, tickets, and business pages from one control."
          >
            <Search />
          </TopbarSection>

          <TopbarSection
            icon={<Sparkles className="h-4 w-4" />}
            label="Setup"
            value="Progress"
            header="Setup progress"
            description="Review missing profile, business, workflow, and page-visit actions."
          >
            <OnboardingProcessButton />
            <TourGuideButton />
          </TopbarSection>

          <TopbarSection
            icon={<CircleHelp className="h-4 w-4" />}
            label="Help"
            value={isSuperAdmin ? "User + operator" : "User FAQ"}
            header="Help and support"
            description="Open FAQ, chat support, or the ticket queue."
          >
            <TopbarPanelLink href="/app/faq">Dashboard FAQ</TopbarPanelLink>
            <TopbarPanelLink href="/app/tickets">Support tickets</TopbarPanelLink>
            {isSuperAdmin && <TopbarPanelLink href="/app/faq?scope=operator">Operator FAQ</TopbarPanelLink>}
          </TopbarSection>

          <TopbarSection
            icon={<CreditCard className="h-4 w-4" />}
            label="Credits"
            value={remainingCredits}
            header="Credits and subscription"
            description="Check analyst-credit balance and subscription settings."
          >
            <CreditPanel remainingCredits={remainingCredits} totalCredits={totalCredits} />
          </TopbarSection>

          <TopbarSection
            icon={<Settings className="h-4 w-4" />}
            label="Display"
            value="Theme + language"
            header="Display settings"
            description="Adjust dashboard theme and language."
          >
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <LanguageSelector />
            </div>
          </TopbarSection>

          <TopbarSection
            icon={<UserRound className="h-4 w-4" />}
            label={displayName}
            value={levelLabel}
            header="User profile"
            description="Open account, business, billing, and preference settings."
            align="right"
          >
            <UserLevelLink subscriptionTier={usage.subscriptionTier} />
            <TopbarPanelLink href="/app/settings/profile">Profile settings</TopbarPanelLink>
            <TopbarPanelLink href="/app/settings/preferences">Preferences</TopbarPanelLink>
            <TopbarPanelLink href="/app/business/profile">Business profile</TopbarPanelLink>
            <TopbarPanelLink href="/app/settings/subscription">Subscription</TopbarPanelLink>
            {isSuperAdmin && <TopbarPanelLink href="/app/settings/billing">Billing controls</TopbarPanelLink>}
          </TopbarSection>

          <TopbarSection
            icon={<LogOut className="h-4 w-4" />}
            label="Sign out"
            value="Login route"
            header="Session"
            description="End the current session and return to the login page."
            align="right"
          >
            <TopbarSignOutButton />
          </TopbarSection>

          <TopbarSection
            icon={<Bell className="h-4 w-4" />}
            label="Notices"
            value="Activity"
            header="Notices and activity"
            description="Review current notices and recent dashboard activity."
            align="right"
          >
            <TopbarNoticeActivityDrawer />
          </TopbarSection>
        </div>
      </div>
    </div>
  )
}
