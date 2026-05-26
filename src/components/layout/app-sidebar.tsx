"use client"

import { Logo } from "@/components/layout/logo"
import { UsageMonitor, useUsage } from "@/components/ui/usage-monitor"
import { Award, BarChart3, Building2, CreditCard, Database, FileText, Gift, Globe, LogOut, Menu, ReceiptText, Settings, Sparkles, Tag, User, Users, X } from "lucide-react"
import type { Session } from "next-auth"
import { signOut } from "next-auth/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { FaApple, FaGooglePlay, FaLinkedin, FaXTwitter } from "react-icons/fa6"

const navigation = [
  { name: "Dashboard", href: "/app", icon: BarChart3 },
  { name: "Datasets", href: "/app/datasets", icon: Database },
  { name: "AI Assistant", href: "/app/assistant", icon: Sparkles },
  { name: "Reports & Downloads", href: "/app/downloads", icon: FileText },
  { name: "Business", href: "/app/business", icon: Building2 },
  { name: "Referral", href: "/app/referral", icon: Gift },
]

type AppSidebarProps = {
  user: Session["user"]
}

function getInitials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.split("@")[0] || "User"
  const parts = source.split(/\s+/).filter(Boolean)

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }

  return source.slice(0, 2).toUpperCase()
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname()
  const { usage, total, isPro, isLoading } = useUsage()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  useEffect(() => {
    setIsMobileOpen(false)
    setShowUserMenu(false)
  }, [pathname])

  const handleSignOut = async () => {
    await signOut({ redirect: false })
    window.location.assign("/login")
  }

  const userName = user.name || user.email?.split("@")[0] || "User"
  const userInitials = getInitials(user.name, user.email)
  const planStatus = user.role === "superadmin" ? "Super admin" : isPro ? "Pro" : "Free"
  const navItems = [
    ...navigation,
    ...(user.role === "superadmin"
      ? [
          { name: "Customers", href: "/app/admin/customers", icon: Users },
          { name: "Customer Levels", href: "/app/admin/levels", icon: Award },
          { name: "Discount Rules", href: "/app/admin/discounts", icon: Tag },
        ]
      : []),
  ]

  const sidebarContent = (
    <>
      <div className="border-b border-sidebar-border px-4 py-3">
        <Link href="/" className="flex h-14 items-center">
          <Logo className="h-12 w-auto" />
        </Link>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                  : "border-transparent text-sidebar-foreground hover:border-sidebar-border/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              }`}
            >
              <item.icon className={`h-4 w-4 flex-shrink-0 ${isActive ? "text-primary" : "text-sidebar-foreground"}`} />
              <span className="truncate">{item.name}</span>
            </Link>
          )
        })}
      </nav>

      <div className="space-y-3 border-t border-sidebar-border p-4">
        {!isLoading && (
          <UsageMonitor used={usage} total={total} isPro={isPro} />
        )}

        <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/35 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/70">
            App coming soon
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <ComingSoonButton icon={FaApple} label="App Store" />
            <ComingSoonButton icon={FaGooglePlay} label="Google Play" />
          </div>
        </div>

        <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/35 p-3">
          <div className="mt-3 grid grid-cols-2 gap-2">
            <SocialLink icon={FaXTwitter} label="X" href="https://twitter.com/useclevr" />
            <SocialLink icon={FaLinkedin} label="LinkedIn" href="https://linkedin.com/company/useclevr" />
          </div>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex w-full items-center gap-3 rounded-lg border border-transparent p-2.5 transition-colors hover:border-border hover:bg-accent"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 to-purple-600 text-sm font-medium text-white shadow-sm">
              {userInitials}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-medium text-foreground">{userName}</p>
              <p className="text-xs text-muted-foreground">{planStatus}</p>
            </div>
          </button>

          {showUserMenu && (
            <div className="absolute bottom-full left-0 right-0 mb-2 rounded-lg border border-border bg-card p-2 shadow-lg">
              <div className="space-y-1">
                <Link href="/app/settings/profile" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent">
                  <User className="h-4 w-4" />
                  Profile
                </Link>
                <Link href="/app/settings/preferences" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent">
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
                <Link href="/app/business/profile" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent">
                  <Building2 className="h-4 w-4" />
                  Business
                </Link>
                <Link href="/app/settings/subscription" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent">
                  <CreditCard className="h-4 w-4" />
                  Subscription
                </Link>
                {user.role === "superadmin" && (
                  <Link href="/app/settings/billing" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent">
                    <ReceiptText className="h-4 w-4" />
                    Billing
                  </Link>
                )}
                <hr className="my-2 border-border" />
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-red-400 hover:bg-red-950/30"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </div>
            </div>
          )}
        </div>

        <Link
          href="/terms"
          className="flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-sidebar-foreground/70 transition hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <Globe className="h-3.5 w-3.5" />
          Terms & Conditions
        </Link>

        <div className="flex items-center justify-center px-3 py-2 text-xs text-sidebar-foreground/50">
          <span>UseClevr v1.0.0</span>
        </div>
      </div>
    </>
  )

  return (
    <>
      <button
        type="button"
        aria-label={isMobileOpen ? "Close sidebar navigation" : "Open sidebar navigation"}
        aria-expanded={isMobileOpen}
        aria-controls="app-mobile-sidebar"
        onClick={() => setIsMobileOpen((value) => !value)}
        className="fixed left-3 top-3 z-[140] inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm transition hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
      >
        {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      <aside className="fixed left-0 top-0 z-50 hidden h-screen w-[220px] flex-col border-r border-sidebar-border bg-sidebar md:flex">
        {sidebarContent}
      </aside>

      {isMobileOpen && (
        <div className="fixed inset-0 z-[120] md:hidden">
          <button
            type="button"
            aria-label="Close sidebar overlay"
            className="absolute inset-0 bg-black/45"
            onClick={() => setIsMobileOpen(false)}
          />
          <aside id="app-mobile-sidebar" className="relative z-[121] flex h-full w-[min(82vw,280px)] flex-col border-r border-sidebar-border bg-sidebar shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  )
}

function ComingSoonButton({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
}) {
  return (
    <button
      type="button"
      title="Coming soon"
      className="flex items-center justify-center gap-2 rounded-md border border-sidebar-border bg-sidebar px-2 py-2 text-xs font-medium text-sidebar-foreground transition hover:bg-sidebar-accent"
    >
      <Icon className="h-4 w-4" />
      <span className="sr-only">{label}</span>
      <span aria-hidden="true">Soon</span>
    </button>
  )
}

function SocialLink({
  icon: Icon,
  label,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  href: string
}) {
  return (
    <a
      href={href}
      aria-label={label}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-9 items-center justify-center rounded-md border border-sidebar-border bg-sidebar text-sidebar-foreground transition hover:bg-sidebar-accent hover:text-primary"
    >
      <Icon className="h-4 w-4" />
    </a>
  )
}
