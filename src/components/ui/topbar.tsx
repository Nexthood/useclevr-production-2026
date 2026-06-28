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
import { BriefcaseBusiness, CreditCard, GraduationCap, HelpCircle, Shield, UserCircle } from "lucide-react";
import Link from "next/link";
import pkg from "../../../package.json";

export default async function Topbar() {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const usage = await getAnalystCreditUsage(userId, session?.user?.role);

  const remainingCredits =
    usage.unlimited
      ? "Unlimited"
      : Math.max(0, usage.total - usage.analysisCount).toString();

  const levelLabel =
    usage.subscriptionTier === "superadmin"
      ? "Superadmin"
      : usage.subscriptionTier === "admin"
        ? "Admin"
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
          <span className="self-start pt-1 text-[10px] text-muted-foreground/60">
            v{pkg.version}
          </span>
        </Link>

        <nav className="flex min-w-0 flex-1 items-stretch justify-end gap-0 overflow-visible">
          <HybridAiButton
            subscriptionTier={usage.subscriptionTier}
            className="flex h-full items-center gap-2 whitespace-nowrap rounded-none border-0 bg-transparent px-2.5 text-foreground shadow-none hover:bg-muted/50 [&_svg]:text-muted-foreground"
          />

          <Search />

          <div className="w-px self-stretch bg-border/30" />

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

          <TopbarSection
            icon={<GraduationCap className="h-4 w-4" />}
            label="Mentoring"
            iconOnly
          >
            <TopbarPanelLink href="/app/mentoring">My sessions</TopbarPanelLink>
            <TopbarPanelLink href="/mentoring">Public page</TopbarPanelLink>
          </TopbarSection>

          <TopbarSection
            icon={<CreditCard className="h-4 w-4" />}
            label="Credits"
            value={`${remainingCredits} ${levelLabel}`}
            iconOnly
          >
            <TopbarPanelLink href="/app/settings/subscription">Subscription</TopbarPanelLink>
            <TopbarPanelLink href="/app/settings/billing">Billing</TopbarPanelLink>
            <TopbarPanelLink href="/app/settings/credits">Rules</TopbarPanelLink>
          </TopbarSection>

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
              <TopbarPanelLink href="/app/admin/ai-traces">AI Traces</TopbarPanelLink>
              <TopbarPanelLink href="/app/admin/ai-benchmarking">Benchmarking</TopbarPanelLink>
            </TopbarSection>
          )}

          <div className="w-px self-stretch bg-border/30" />

          <TopbarSection
            icon={<HelpCircle className="h-4 w-4" />}
            label="Help"
            iconOnly
          >
            <TopbarPanelLink href="/app/faq">Dashboard FAQ</TopbarPanelLink>
            <TopbarPanelLink href="/app/tickets">Tickets & Issues</TopbarPanelLink>
            <TopbarPanelLink href="/contact">Send feedback</TopbarPanelLink>
          </TopbarSection>

          <div className="w-px self-stretch bg-border/30" />

          <ThemeToggle className="flex h-full min-w-10 items-center justify-center rounded-none bg-transparent px-2.5 text-muted-foreground hover:text-foreground" />

          <TopbarNoticeActivityDrawer className="flex h-full min-w-10 items-center justify-center rounded-none border-0 bg-transparent text-muted-foreground hover:text-foreground" />

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

          <div className="flex h-full min-w-10 items-center justify-center px-2.5 text-sm text-muted-foreground transition hover:bg-muted/50 hover:text-foreground">
            <TopbarSignOutButton />
          </div>
        </nav>
      </div>
    </div>
  );
}
