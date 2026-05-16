import { ThemeToggle } from "@/components/theme-toggle"
import HybridAiButton from "@/components/ui/hybrid-ai-button"
import { TopbarSignOutButton } from "@/components/ui/topbar-sign-out-button"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { getAnalystCreditUsage } from "@/lib/usage/analyst-credits"

export default async function Topbar() {
  const session = await auth()
  const usage = await getAnalystCreditUsage(session?.user?.id)
  const planLabel = usage.subscriptionTier === "superadmin" ? "Super admin" : usage.subscriptionTier === "pro" ? "Pro" : "Free"

  return (
    <div className="app-topbar">
      <div className="flex w-full items-center justify-end">
        <div className="flex items-center gap-3">
          <HybridAiButton subscriptionTier={usage.subscriptionTier} />
          <Link
            href="/app/settings/subscription"
            className="hidden items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent sm:flex"
          >
            <span className="text-muted-foreground">Plan</span>
            <span>{planLabel}</span>
          </Link>
          <Link
            href="/app/settings/subscription"
            className="hidden rounded-full px-2 py-1 text-xs font-medium text-primary transition hover:bg-primary/10 md:inline-flex"
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
