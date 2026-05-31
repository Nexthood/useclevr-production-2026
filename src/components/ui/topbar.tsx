import { Logo } from "@/components/layout/logo"
import HybridAiButton from "@/components/ui/hybrid-ai-button"
import { Search } from "@/components/ui/search-popup"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { TopbarNoticeActivityDrawer } from "@/components/ui/topbar-notice-activity-drawer"
import { TopbarSignOutButton } from "@/components/ui/topbar-sign-out-button"
import { OnboardingProcessButton } from "@/components/ui/onboarding-process-button"
import { TopbarPanelLink, TopbarSection } from "@/components/ui/topbar-section"
import { auth } from "@/lib/auth"
import { getAnalystCreditUsage } from "@/lib/usage/analyst-credits"
import { BriefcaseBusiness, CreditCard, HelpCircle, UserCircle } from "lucide-react"
import Link from "next/link"
import pkg from "../../../package.json"

export default async function Topbar() {
  const session = await auth()
  const userId = session?.user?.id ?? null

  const usage = await getAnalystCreditUsage(userId)

  const remainingCredits =
    usage.subscriptionTier === "superadmin" || usage.subscriptionTier === "pro"
      ? "Unlimited"
      : Math.max(0, usage.total - usage.analysisCount).toString()

  const levelLabel = usage.subscriptionTier === "superadmin" ? "Admin" : usage.subscriptionTier || "Free"

  return (
    <div className="app-topbar min-h-16 border-b border-border bg-background">
      <div className="flex h-full min-w-0 flex-1 items-center justify-between">
        <Link href="/app" className="flex h-full shrink-0 items-center gap-2">
          <Logo className="h-12 w-auto" />
          <span className="hidden self-start pt-1 text-[10px] text-muted-foreground/60 sm:inline">v{pkg.version}</span>
        </Link>

         <nav className="flex h-full min-w-0 flex-1 items-stretch justify-end overflow-x-auto">
           <div className="flex h-full items-center bg-primary/10 px-1">
             <HybridAiButton
               subscriptionTier={usage.subscriptionTier}
               className="h-full rounded-none border-0 bg-transparent px-3 shadow-none hover:bg-primary/10"
             />
           </div>

           <Search />
           
           <OnboardingProcessButton />

           <TopbarSection
             icon={<HelpCircle className="h-4 w-4" />}
             label="Help"
             header="Help"
             description="Find answers, open tickets, or start chat support."
           >
             <TopbarPanelLink href="/app/faq">Dashboard FAQ</TopbarPanelLink>
             <TopbarPanelLink href="/app/tickets">Tickets & Issues</TopbarPanelLink>
             <TopbarPanelLink href="/contact">Send feedback</TopbarPanelLink>
           </TopbarSection>

           <TopbarSection
             icon={<BriefcaseBusiness className="h-4 w-4" />}
             label="Business"
             value={levelLabel}
             header="Business workspace"
             description="Manage profile details, business settings, and review readiness."
           >
             <TopbarPanelLink href="/app/business">Business overview</TopbarPanelLink>
             <TopbarPanelLink href="/app/business/profile">Business profile</TopbarPanelLink>
             <TopbarPanelLink href="/app/business/review">Review readiness</TopbarPanelLink>
           </TopbarSection>

           <TopbarSection
             icon={<CreditCard className="h-4 w-4" />}
             label="Credits"
             value={`${remainingCredits} ${levelLabel}`}
             header="Credits and billing"
             description="Review analyst credits, subscription settings, and billing details."
           >
             <TopbarPanelLink href="/app/settings/subscription">Subscription</TopbarPanelLink>
             <TopbarPanelLink href="/app/settings/billing">Billing</TopbarPanelLink>
             <TopbarPanelLink href="/app/settings/credits">Credit rules</TopbarPanelLink>
           </TopbarSection>

           <TopbarSection
              icon={<UserCircle className="h-4 w-4" />}
              label={session?.user?.name || "Profile"}
              value={levelLabel}
              header="Account"
              description="Open profile settings, preferences, and activity."
              align="right"
              noBorder
            >
             <TopbarPanelLink href="/app/settings/profile">Profile settings</TopbarPanelLink>
             <TopbarPanelLink href="/app/settings/preferences">Preferences</TopbarPanelLink>
             <TopbarPanelLink href="/app/settings/activity">Activity</TopbarPanelLink>
           </TopbarSection>

          <TopbarNoticeActivityDrawer className="h-full min-w-12 rounded-none border-l border-r-0 border-y-0 bg-transparent" />

          <ThemeToggle className="h-full min-w-12 rounded-none border-l border-border/70" />

          <div className="flex h-full min-w-12 items-center justify-center px-3 text-sm text-foreground transition hover:bg-muted/70">
            <TopbarSignOutButton />
          </div>
        </nav>
      </div>
    </div>
  )
}
