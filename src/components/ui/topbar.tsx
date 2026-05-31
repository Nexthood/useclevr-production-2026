import { Logo } from "@/components/layout/logo"
import HybridAiButton from "@/components/ui/hybrid-ai-button"
import { Search } from "@/components/ui/search-popup"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { TopbarSignOutButton } from "@/components/ui/topbar-sign-out-button"
import { OnboardingProcessButton } from "@/components/ui/onboarding-process-button"
import { auth } from "@/lib/auth"
import { getAnalystCreditUsage } from "@/lib/usage/analyst-credits"
import { Bell, BriefcaseBusiness, CreditCard, HelpCircle } from "lucide-react"
import Link from "next/link"

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
        <Link href="/app" className="flex h-full w-[180px] shrink-0 items-center border-r border-border px-4">
          <Logo className="h-10 w-auto" />
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
           
           <Link href="/app/faq" className="flex h-full min-w-12 items-center justify-center px-3 text-sm text-foreground transition hover:bg-muted/70" aria-label="Help" title="Help">
             <HelpCircle className="h-4 w-4 text-primary flex-shrink-0" />
           </Link>

            <Link href="/app/business" className="flex h-full min-w-12 items-center justify-center px-3 text-sm text-foreground transition hover:bg-muted/70" aria-label="Business" title="Business">
             <BriefcaseBusiness className="h-4 w-4 text-primary flex-shrink-0" />
             <span className="hidden min-w-0 lg:block">
               <span className="block whitespace-nowrap text-xs font-semibold leading-4">{remainingCredits}</span>
               <span className="block whitespace-nowrap text-[11px] leading-4 text-muted-foreground">{levelLabel}</span>
             </span>
           </Link>

           <Link href="/app/settings/subscription" className="flex h-full min-w-12 items-center gap-2 px-3 text-sm text-foreground transition hover:bg-muted/70" aria-label="Subscription credits" title="Subscription credits">
             <CreditCard className="h-4 w-4 text-primary flex-shrink-0" />
             <span className="hidden min-w-0 lg:block">
               <span className="block whitespace-nowrap text-xs font-semibold leading-4">{remainingCredits}</span>
               <span className="block whitespace-nowrap text-[11px] leading-4 text-muted-foreground">{levelLabel}</span>
             </span>
           </Link>

           <Link href="/app" className="flex h-full min-w-12 items-center justify-center px-3 text-sm text-foreground transition hover:bg-muted/70" aria-label="Notices" title="Notices">
             <Bell className="h-4 w-4 text-primary flex-shrink-0" />
           </Link>

          <ThemeToggle className="h-full min-w-12 rounded-none" />

          <div className="flex h-full min-w-12 items-center justify-center px-3 text-sm text-foreground transition hover:bg-muted/70">
            <TopbarSignOutButton />
          </div>
        </nav>
      </div>
    </div>
  )
}
