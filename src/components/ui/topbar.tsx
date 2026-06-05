import { Logo } from "@/components/layout/logo";
import HybridAiButton from "@/components/ui/hybrid-ai-button";
import { OnboardingProcessButton } from "@/components/ui/onboarding-process-button";
import { Search } from "@/components/ui/search-popup";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { TopbarNoticeActivityDrawer } from "@/components/ui/topbar-notice-activity-drawer";
import { TopbarPanelLink, TopbarSection } from "@/components/ui/topbar-section";
import { TopbarSignOutButton } from "@/components/ui/topbar-sign-out-button";
import { auth } from "@/lib/auth/auth";
import { getAnalystCreditUsage } from "@/lib/usage/analyst-credits";
import { BriefcaseBusiness, CreditCard, GraduationCap, HelpCircle, Shield, UserCircle } from "lucide-react";
import Link from "next/link";
import pkg from "../../../package.json";

export default async function Topbar() {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const usage = await getAnalystCreditUsage(userId);

  const remainingCredits =
    usage.subscriptionTier === "superadmin" || usage.subscriptionTier === "pro"
      ? "Unlimited"
      : Math.max(0, usage.total - usage.analysisCount).toString();

  const levelLabel =
    usage.subscriptionTier === "superadmin" ? "Admin" : usage.subscriptionTier || "Free";

  return (
    <div className="app-topbar sticky top-0 z-[110] min-h-16 border-b border-border/60 bg-background/95 backdrop-blur-sm">
      <div className="flex min-h-16 min-w-0 flex-1 items-center justify-between gap-2 overflow-visible">
        <Link href="/app" className="flex h-16 shrink-0 items-center gap-2 px-2">
          <Logo className="h-12 w-auto" />
          <span className="self-start pt-1 text-[10px] text-muted-foreground/60">
            v{pkg.version}
          </span>
        </Link>

        <nav className="flex min-w-0 flex-1 items-stretch justify-end overflow-x-auto overflow-y-visible">
          <div className="flex h-16 items-center border-l border-border/50 px-2">
            <HybridAiButton
              subscriptionTier={usage.subscriptionTier}
              className="h-16 whitespace-nowrap rounded-none border-0 bg-transparent px-2 text-foreground shadow-none hover:bg-muted/50 [&_svg]:text-muted-foreground"
            />
          </div>

          <Search />

          <OnboardingProcessButton />

          <TopbarSection
            icon={<HelpCircle className="h-4 w-4" />}
            label="Help"
            header="Help"
            description="Find answers, open tickets, or start chat support."
            iconOnly
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
              icon={<GraduationCap className="h-4 w-4" />}
              label="Mentoring"
              header="Business Mentoring"
              description="Book expert sessions for growth, fundraising, and strategy."
            >
              <TopbarPanelLink href="/app/mentoring">My sessions</TopbarPanelLink>
              <TopbarPanelLink href="/mentoring">Public page</TopbarPanelLink>
            </TopbarSection>

          {session?.user?.role === "superadmin" && (
            <TopbarSection
              icon={<Shield className="h-4 w-4" />}
              label="Admin"
              header="Admin panel"
              description="Manage customers, levels, discounts, billing, and AI trace analytics."
            >
              <TopbarPanelLink href="/app/admin/customers">Customers</TopbarPanelLink>
              <TopbarPanelLink href="/app/admin/levels">Customer Levels</TopbarPanelLink>
              <TopbarPanelLink href="/app/admin/discounts">Discount Rules</TopbarPanelLink>
              <TopbarPanelLink href="/app/admin/billing-settings">Billing Settings</TopbarPanelLink>
              <TopbarPanelLink href="/app/admin/ai-traces">AI Trace Analytics</TopbarPanelLink>
              <TopbarPanelLink href="/app/admin/ai-benchmarking">AI Benchmarking</TopbarPanelLink>
            </TopbarSection>
          )}

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

          <TopbarNoticeActivityDrawer className="h-16 min-w-10 rounded-none border-l border-r-0 border-y-0 bg-transparent text-muted-foreground hover:text-foreground" />

          <ThemeToggle className="h-16 min-w-10 rounded-none border-l border-border/50 text-muted-foreground hover:text-foreground" />

          <div className="flex h-16 min-w-10 items-center justify-center border-l border-border/50 px-2 text-sm text-muted-foreground transition hover:bg-muted/50 hover:text-foreground">
            <TopbarSignOutButton />
          </div>
        </nav>
      </div>
    </div>
  );
}
