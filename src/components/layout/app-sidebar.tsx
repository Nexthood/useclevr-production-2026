"use client";

import { Logo } from "@/components/layout/logo";
import { UsageMonitor, useUsage } from "@/components/ui/usage-monitor";
import {
  Award,
  BarChart3,
  Building2,
  CreditCard,
  Database,
  FileText,
  Gift,
  KeyRound,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Tag,
  Users,
  X,
  Activity,
  Gauge,
} from "lucide-react";
import type { Session } from "next-auth";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type React from "react";
import { useEffect, useState } from "react";

type SidebarStatus = {
  completion: number
  requiredLabel: string
  complete: boolean
  hrefWhenIncomplete: string
}

type NavigationItem = {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  status?: SidebarStatus
}

const primaryNavigation: NavigationItem[] = [
  { name: "Dashboard", href: "/app", icon: BarChart3 },
  { name: "Datasets", href: "/app/datasets", icon: Database },
  { name: "Risk Intelligence", href: "/app/risk-intelligence", icon: ShieldAlert },
  { name: "Reports & Downloads", href: "/app/downloads", icon: FileText },
  { name: "Business", href: "/app/business", icon: Building2 },
  { name: "Accountancy", href: "/app/accountancy", icon: Receipt },
  { name: "Retail", href: "/app/retail", icon: Building2 },
  { name: "Referral", href: "/app/referral", icon: Gift },
];

const aiNavigation: NavigationItem[] = [
  { name: "AI Assistant", href: "/app/assistant", icon: Sparkles },
  { name: "AI Governance", href: "/app/ai-governance", icon: ShieldCheck },
];

const adminAiNavigation: NavigationItem[] = [
  { name: "AI Traces", href: "/app/admin/ai-traces", icon: Activity },
  { name: "AI Benchmarking", href: "/app/admin/ai-benchmarking", icon: Gauge },
  { name: "AI Cost Optimizer", href: "/app/admin/ai-cost-optimizer", icon: BarChart3 },
];

const adminNavigation: NavigationItem[] = [
  { name: "Customers", href: "/app/admin/customers", icon: Users },
  { name: "Customer Levels", href: "/app/admin/levels", icon: Award },
  { name: "Discount Rules", href: "/app/admin/discounts", icon: Tag },
  { name: "Billing Settings", href: "/app/admin/billing-settings", icon: CreditCard },
  { name: "MCP Tokens", href: "/app/admin/mcp-tokens", icon: KeyRound },
];

type AppSidebarProps = {
  user: Session["user"];
  businessStatus?: SidebarStatus;
  accountancyStatus?: SidebarStatus;
  retailStatus?: SidebarStatus;
};

export function AppSidebar({ user, businessStatus, accountancyStatus, retailStatus }: AppSidebarProps) {
  const pathname = usePathname();
  const { usage, total, available, reserved, isPro, isLoading, unlimitedLabel } = useUsage();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const hasUnlimitedAdminAccess = user.role === "superadmin" || user.role === "admin";

  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const stored = localStorage.getItem("useclevr_sidebar_collapsed");
    if (stored === "true") {
      setIsCollapsed(true);
    }

    const handleToggle = (e: CustomEvent) => {
      setIsCollapsed(e.detail.collapsed);
    };
    window.addEventListener("useclevr:sidebar-toggle", handleToggle as EventListener);
    return () =>
      window.removeEventListener("useclevr:sidebar-toggle", handleToggle as EventListener);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--app-sidebar-width",
      isCollapsed ? "72px" : "220px",
    );
  }, [isCollapsed]);

  const navigationWithStatus = primaryNavigation.map((item) => {
    if (item.name === "Business") return { ...item, status: businessStatus }
    if (item.name === "Accountancy") return { ...item, status: accountancyStatus }
    if (item.name === "Retail") return { ...item, status: retailStatus }
    return item
  })
  const dashboardItem = navigationWithStatus[0];
  const workspaceNavigationItems = navigationWithStatus.slice(1);
  const aiNavigationItems = user.role === "superadmin" ? [...aiNavigation, ...adminAiNavigation] : aiNavigation;

  const sidebarContent = (
    <>
      <div className="border-b border-sidebar-border px-4 py-3 md:hidden">
        <Link href="/" className="flex h-14 items-center">
          <Logo className="h-12 w-auto" />
        </Link>
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
        {dashboardItem && (
          <div className="flex items-center gap-2">
            <SidebarLink
              item={dashboardItem}
              href={dashboardItem.href}
              isActive={pathname === dashboardItem.href}
              isCollapsed={isCollapsed}
            />

            <button
              type="button"
              onClick={() => {
                const next = !isCollapsed
                setIsCollapsed(next)
                localStorage.setItem("useclevr_sidebar_collapsed", String(next))
                window.dispatchEvent(
                  new CustomEvent("useclevr:sidebar-toggle", { detail: { collapsed: next } }),
                )
              }}
              className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-sidebar-foreground/65 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          </div>
        )}

        <SidebarGroup
          label="AI"
          items={aiNavigationItems}
          pathname={pathname}
          isCollapsed={isCollapsed}
          hasUnlimitedAdminAccess={hasUnlimitedAdminAccess}
        />
        <SidebarGroup
          label="Workspace"
          items={workspaceNavigationItems}
          pathname={pathname}
          isCollapsed={isCollapsed}
          hasUnlimitedAdminAccess={hasUnlimitedAdminAccess}
        />
        {user.role === "superadmin" && (
          <SidebarGroup
            label="Admin"
            items={adminNavigation}
            pathname={pathname}
            isCollapsed={isCollapsed}
            hasUnlimitedAdminAccess={hasUnlimitedAdminAccess}
          />
        )}
      </nav>

      <div className="space-y-3 border-t border-sidebar-border p-4">
        {!isLoading && !isCollapsed && (
          <UsageMonitor
            used={usage}
            total={total}
            available={available}
            reserved={reserved}
            isPro={isPro}
            unlimitedLabel={unlimitedLabel}
          />
        )}
        {!isCollapsed && (
          <div className="space-y-2">
            <div className="flex flex-col items-center gap-1.5 text-[10px] text-muted-foreground/70">
              <span>Copyright {new Date().getFullYear()} UseClevr</span>
              <Link href="/terms" className="transition hover:text-foreground">Terms</Link>
              <Link href="/privacy" className="transition hover:text-foreground">Privacy</Link>
            </div>
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      <button
        type="button"
        aria-label={isMobileOpen ? "Close sidebar navigation" : "Open sidebar navigation"}
        aria-expanded={isMobileOpen}
        aria-controls="app-mobile-sidebar"
        onClick={() => setIsMobileOpen((value) => !value)}
        className="fixed right-3 top-3 z-[140] inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm transition hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
      >
        {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      <aside className="fixed left-0 top-16 z-50 hidden h-[calc(100vh-4rem)] w-[var(--app-sidebar-width)] flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 md:flex">
        <div className="relative flex h-full min-h-0 flex-col">{sidebarContent}</div>
      </aside>

      {isMobileOpen && (
        <div className="fixed inset-0 z-[120] md:hidden">
          <button
            type="button"
            aria-label="Close sidebar overlay"
            className="absolute inset-0 bg-black/45"
            onClick={() => setIsMobileOpen(false)}
          />
          <aside
            id="app-mobile-sidebar"
            className="relative z-[121] flex h-full w-[min(82vw,280px)] flex-col border-r border-sidebar-border bg-sidebar shadow-2xl"
          >
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}

function SidebarGroup({
  label,
  items,
  pathname,
  isCollapsed,
  hasUnlimitedAdminAccess,
}: {
  label: string
  items: NavigationItem[]
  pathname: string
  isCollapsed: boolean
  hasUnlimitedAdminAccess: boolean
}) {
  if (items.length === 0) return null

  return (
    <div className="space-y-1 pt-3 first:pt-0">
      {!isCollapsed && (
        <p className="px-3 text-[11px] font-semibold uppercase text-sidebar-foreground/55">{label}</p>
      )}
      {items.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
        const href =
          !hasUnlimitedAdminAccess && item.status && !isStatusComplete(item.status)
            ? item.status.hrefWhenIncomplete
            : item.href
        return (
          <SidebarLink
            key={item.name}
            item={item}
            href={href}
            isActive={isActive}
            isCollapsed={isCollapsed}
            forceComplete={hasUnlimitedAdminAccess}
          />
        )
      })}
    </div>
  )
}

function SidebarLink({
  item,
  href,
  isActive,
  isCollapsed,
  forceComplete = false,
}: {
  item: NavigationItem
  href: string
  isActive: boolean
  isCollapsed: boolean
  forceComplete?: boolean
}) {
  const status = item.status
  const isComplete = forceComplete || (status ? isStatusComplete(status) : false)
  const title = isCollapsed
    ? status
      ? `${item.name}: ${isComplete ? "complete" : status.requiredLabel}`
      : item.name
    : undefined
  const ariaLabel = status
    ? `${item.name}. ${isComplete ? "Complete" : `${status.requiredLabel}. Complete this step to improve analysis accuracy.`}`
    : item.name

  return (
    <Link
      href={href}
      title={title}
      aria-label={ariaLabel}
      className={`group relative flex min-w-0 flex-1 items-center gap-3 rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-200 ${
        isActive
          ? "border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
          : "border-transparent text-sidebar-foreground hover:border-sidebar-border/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
      }`}
    >
      <item.icon
        className={`h-4 w-4 flex-shrink-0 ${isActive ? "text-primary" : "text-sidebar-foreground"}`}
      />
      {!isCollapsed && (
        <>
          <span className="min-w-0 flex-1 truncate">{item.name}</span>
          {status && <SidebarStatusBadge status={status} forceComplete={forceComplete} />}
        </>
      )}
      {isCollapsed && status && <CollapsedStatusDot status={status} forceComplete={forceComplete} />}
    </Link>
  )
}

function isStatusComplete(status: SidebarStatus) {
  return status.complete || status.completion >= 100
}

function SidebarStatusBadge({ status, forceComplete = false }: { status: SidebarStatus; forceComplete?: boolean }) {
  if (forceComplete || isStatusComplete(status)) {
    return (
      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-300">
        ✓
      </span>
    )
  }

  const isRequired = status.requiredLabel === "Required"
  return (
    <span
      className={[
        "inline-flex h-5 shrink-0 items-center justify-center rounded-full border px-2 text-[10px] font-semibold",
        isRequired
          ? "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300"
          : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      ].join(" ")}
    >
      {status.requiredLabel}
    </span>
  )
}

function CollapsedStatusDot({ status, forceComplete = false }: { status: SidebarStatus; forceComplete?: boolean }) {
  const isComplete = forceComplete || isStatusComplete(status)
  return (
    <span
      className={[
        "absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border border-sidebar",
        isComplete ? "bg-emerald-500" : status.requiredLabel === "Required" ? "bg-red-500" : "bg-amber-500",
      ].join(" ")}
    />
  )
}
