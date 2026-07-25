import { Logo } from "@/components/layout/logo";
import HybridAiButton from "@/components/ui/hybrid-ai-button";
import { Search } from "@/components/ui/search-popup";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { TopbarNoticeActivityDrawer } from "@/components/ui/topbar-notice-activity-drawer";
import { TopbarPanelLink, TopbarSection } from "@/components/ui/topbar-section";
import { TopbarSignOutButton } from "@/components/ui/topbar-sign-out-button";
import { auth } from "@/lib/auth/auth";
import { getAnalystCreditUsage } from "@/lib/usage/analyst-credits";
import { getSetupStatus } from "@/lib/business/company-setup-store";
import { BriefcaseBusiness, CreditCard, HelpCircle, Shield, UserCircle } from "lucide-react";
import Link from "next/link";

export default async function Topbar() {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const usage = await getAnalystCreditUsage(
    userId,
    session?.user?.role,
    session?.user?.email ?? null
  );

  const remainingCredits =
    usage.unlimited
      ? "Unlimited"
      : Math.max(0, usage.availableCredits ?? 0).toString();

  const levelLabel =
    usage.subscriptionTier === "superadmin"
      ? "Unlimited Superadmin"
      : usage.subscriptionTier === "admin"
        ? "Unlimited Admin"
        : usage.subscriptionTier === "builtin"
          ? "Demo"
          : usage.subscriptionTier || "Free";

  // Get business profile completion
  const setupStatus = userId ? await getSetupStatus(userId) : null
  const profileCompletion = setupStatus?.setupAccuracy ?? 0
  const businessValue = `${profileCompletion}% ${levelLabel}`

  return (
    <div className="app-topbar sticky top-0 z-[110] min-h-16 border-b border-border/60 bg-background/95 backdrop-blur-sm">
      <div className="flex min-h-16 min-w-0 flex-1 items-center gap-3 overflow-visible px-4">
        <Link href="/app" className="flex shrink-0 items-center gap-2">
          <Logo className="h-12 w-auto" />
        </Link>

        <nav className="flex min-w-0 flex-1 items-center justify-end gap-4 overflow-visible">
          <HybridAiButton
            subscriptionTier={usage.subscriptionTier}
            userEmail={session?.user?.email ?? null}
            userRole={session?.user?.role ?? null}
            className="flex h-11 items-center gap-2 whitespace-nowrap rounded-md border-0 bg-transparent px-3 text-foreground shadow-none hover:bg-muted/50 [&_svg]:text-muted-foreground"
          />

          <Search />

          <div className="h-7 w-px bg-border/30" />

          <TopbarSection
            icon={<BriefcaseBusiness className="h-4 w-4" />}
            label="Business"
            value={businessValue}
            iconOnly
          >
            <TopbarPanelLink href="/app/business">Business</TopbarPanelLink>
            <TopbarPanelLink href="/app/business/profile">Profile</TopbarPanelLink>
            <TopbarPanelLink href="/app/business/review">Review</TopbarPanelLink>
          </TopbarSection>

          <Link
            href="/app/settings/subscription"
            className="group flex h-11 min-w-11 items-center gap-2 whitespace-nowrap rounded-md px-3 text-sm text-foreground outline-none transition hover:bg-muted/50 focus-visible:bg-muted/50 active:bg-muted/70"
            title="Subscription"
            aria-label="Subscription"
          >
            <CreditCard className="h-4 w-4 flex-shrink-0 text-muted-foreground transition group-hover:text-foreground" />
            <span className="hidden min-w-0 xl:block">
              <span className="block truncate text-xs font-semibold leading-4 whitespace-nowrap">Subscription</span>
              <span className="block truncate text-[11px] leading-4 whitespace-nowrap text-muted-foreground">
                {usage.unlimited ? levelLabel : `${remainingCredits} ${levelLabel}`}
              </span>
            </span>
          </Link>

          {session?.user?.role === "superadmin" && (
            <TopbarSection
              icon={<Shield className="h-4 w-4" />}
              label="Admin"
              iconOnly
            >
              <TopbarPanelLink href="/app/admin/customers">Customers</TopbarPanelLink>
              <TopbarPanelLink href="/app/admin/levels">Levels</TopbarPanelLink>
              <TopbarPanelLink href="/app/admin/discounts">Discounts</TopbarPanelLink>
              <TopbarPanelLink href="/app/admin/billing-settings">Billing</TopbarPanelLink>
              <TopbarPanelLink href="/app/admin/ai-cost-optimizer">AI Cost Optimizer</TopbarPanelLink>
              <TopbarPanelLink href="/app/admin/ai-traces">AI Traces</TopbarPanelLink>
              <TopbarPanelLink href="/app/admin/ai-benchmarking">Benchmarking</TopbarPanelLink>
            </TopbarSection>
          )}

          <div className="h-7 w-px bg-border/30" />

          <TopbarSection
            icon={<HelpCircle className="h-4 w-4" />}
            label="Help"
            iconOnly
          >
            <TopbarPanelLink href="/app/faq">Dashboard FAQ</TopbarPanelLink>
            <TopbarPanelLink href="/app/tickets">Tickets & Issues</TopbarPanelLink>
            <TopbarPanelLink href="/contact">Send feedback</TopbarPanelLink>
          </TopbarSection>

          <div className="h-7 w-px bg-border/30" />

          <ThemeToggle className="bg-transparent" />

          <TopbarNoticeActivityDrawer className="h-11 w-11 rounded-md border-0 bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground" />

          <TopbarSection
            icon={<UserCircle className="h-4 w-4" />}
            label={session?.user?.name || "Profile"}
            value={levelLabel}
            align="right"
            iconOnly
          >
            <TopbarPanelLink href="/app/settings/profile">Profile</TopbarPanelLink>
            <TopbarPanelLink href="/app/settings/preferences">Preferences</TopbarPanelLink>
            <TopbarPanelLink href="/app/settings/activity">Activity</TopbarPanelLink>
          </TopbarSection>

          <div className="flex h-11 min-w-11 items-center justify-center rounded-md px-3 text-sm text-muted-foreground transition hover:bg-muted/50 hover:text-foreground">
            <TopbarSignOutButton />
          </div>
        </nav>
      </div>
    </div>
  );
}
