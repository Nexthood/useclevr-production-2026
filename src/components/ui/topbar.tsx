import { Logo } from "@/components/layout/logo"
import { Search } from "@/components/ui/search-popup"
import { TopbarSignOutButton } from "@/components/ui/topbar-sign-out-button"
import { auth } from "@/lib/auth/auth"
import { getAnalystCreditUsage } from "@/lib/usage/analyst-credits"
import { Brain, Bell, CreditCard, Sun } from "lucide-react"
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

        <nav className="flex h-full min-w-0 flex-1 items-center justify-end overflow-x-auto px-2 gap-1">
          <Link href="/app/assistant" className="flex h-full min-w-12 items-center gap-2 px-3 text-sm font-semibold text-primary bg-primary/10 rounded-md transition hover:bg-primary/20">
            <Brain className="h-4 w-4" />
            <span className="hidden min-w-0 lg:block">Hybrid AI</span>
          </Link>

          <Search />

          <Link href="/app/business" className="flex h-full min-w-12 items-center gap-2 px-3 text-sm text-foreground transition hover:bg-muted/70">
            <span className="hidden min-w-0 lg:block">Business</span>
          </Link>

          <Link href="/app/settings/subscription" className="flex h-full min-w-12 items-center gap-2 px-3 text-sm text-foreground transition hover:bg-muted/70">
            <CreditCard className="h-4 w-4 text-primary" />
            <span className="hidden min-w-0 lg:block">
              <span className="block truncate text-xs font-semibold leading-4">{remainingCredits}</span>
              <span className="block truncate text-[11px] leading-4 text-muted-foreground">{levelLabel}</span>
            </span>
          </Link>

          <div className="flex h-full min-w-12 items-center gap-2 px-3 text-sm text-foreground transition hover:bg-muted/70">
            <TopbarSignOutButton />
          </div>

          <Link href="/app" className="flex h-full min-w-12 items-center gap-2 px-3 text-sm text-foreground transition hover:bg-muted/70">
            <Bell className="h-4 w-4 text-primary" />
            <span className="hidden min-w-0 lg:block">Notices</span>
          </Link>
        </nav>
      </div>
    </div>
  )
}

// Theme switcher - add to separate component if needed
function ThemeSwitcher() {
  return (
    <button
      type="button"
      className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background transition hover:bg-muted"
      aria-label="Toggle theme"
    >
      <Sun className="h-4 w-4" />
    </button>
  )
}