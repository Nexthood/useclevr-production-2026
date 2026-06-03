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
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  Sparkles,
  Tag,
  Users,
  X,
} from "lucide-react";
import type { Session } from "next-auth";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const primaryNavigation = [
  { name: "Dashboard", href: "/app", icon: BarChart3 },
  { name: "Datasets", href: "/app/datasets", icon: Database },
  { name: "AI Assistant", href: "/app/assistant", icon: Sparkles },
  { name: "Reports & Downloads", href: "/app/downloads", icon: FileText },
  { name: "Business", href: "/app/business", icon: Building2 },
  { name: "Accountancy", href: "/app/accountancy", icon: Receipt },
  { name: "Referral", href: "/app/referral", icon: Gift },
];

const adminNavigation = [
  { name: "Customers", href: "/app/admin/customers", icon: Users },
  { name: "Customer Levels", href: "/app/admin/levels", icon: Award },
  { name: "Discount Rules", href: "/app/admin/discounts", icon: Tag },
  { name: "Billing Settings", href: "/app/admin/billing-settings", icon: CreditCard },
  { name: "AI Traces", href: "/app/admin/ai-traces", icon: BarChart3 },
  { name: "AI Benchmarking", href: "/app/admin/ai-benchmarking", icon: BarChart3 },
];

type AppSidebarProps = {
  user: Session["user"];
};

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
  const { usage, total, isPro, isLoading } = useUsage();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

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

  const navigationItems =
    user.role === "superadmin" ? [...primaryNavigation, ...adminNavigation] : primaryNavigation;

  const sidebarContent = (
    <>
      <div className="border-b border-sidebar-border px-4 py-3 md:hidden">
        <Link href="/" className="flex h-14 items-center">
          <Logo className="h-12 w-auto" />
        </Link>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navigationItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.name}
              href={item.href}
              title={isCollapsed ? item.name : undefined}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                  : "border-transparent text-sidebar-foreground hover:border-sidebar-border/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              }`}
            >
              <item.icon
                className={`h-4 w-4 flex-shrink-0 ${isActive ? "text-primary" : "text-sidebar-foreground"}`}
              />
              {!isCollapsed && <span className="truncate">{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-sidebar-border p-4">
        {!isLoading && !isCollapsed && <UsageMonitor used={usage} total={total} isPro={isPro} />}
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
        <div className="relative h-full">
          {sidebarContent}
          {/* Desktop sidebar toggle - positioned within sidebar */}
          <button
            type="button"
            onClick={() => {
              const next = !isCollapsed
              setIsCollapsed(next)
              localStorage.setItem("useclevr_sidebar_collapsed", String(next))
              window.dispatchEvent(new CustomEvent("useclevr:sidebar-toggle", { detail: { collapsed: next } }))
            }}
            className="absolute -right-3 top-4 z-50 hidden h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm hover:bg-muted md:inline-flex"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <PanelLeftOpen className="h-3 w-3" /> : <PanelLeftClose className="h-3 w-3" />}
          </button>
        </div>
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
