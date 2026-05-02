"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Database, FileText, Settings, LogOut, User, CreditCard, Gift } from "lucide-react"
import { signOut } from "next-auth/react"
import { Logo } from "@/components/logo"
import { UsageMonitor } from "@/components/usage-monitor"
import { useUsage } from "@/components/usage-monitor"
import { useState } from "react"
import type { Session } from "next-auth"

const navigation = [
  { name: "Dashboard", href: "/app", icon: LayoutDashboard },
  { name: "Datasets", href: "/app/datasets", icon: Database },
  // Analysis is now integrated into the dataset analysis page
  // The "Ask AI" button is available on each dataset's analysis page
  { name: "Reports & Downloads", href: "/app/downloads", icon: FileText },
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

  const handleSignOut = async () => {
    await signOut({ redirect: false })
    window.location.assign("/login")
  }

  const userName = user.name || user.email?.split("@")[0] || "User"
  const userInitials = getInitials(user.name, user.email)
  const planStatus = user.role === "superadmin" ? "Super admin" : isPro ? "Pro" : "Free"

  return (
      <aside className="fixed left-0 top-0 z-50 flex h-screen w-[220px] flex-col border-r border-sidebar-border bg-sidebar">
        {/* Logo */}
        <div className="border-b border-sidebar-border px-4 py-3">
          <Link href="/" className="flex h-14 items-center">
            <Logo className="h-12 w-auto" />
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-3">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground border border-sidebar-border"
                    : "text-sidebar-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                }`}
              >
                <item.icon className="h-4 w-4 flex-shrink-0 text-sidebar-foreground" />
                <span>{item.name}</span>
              </Link>
            )
          })}
      </nav>

      {/* Bottom Section */}
      <div className="p-4 border-t border-sidebar-border space-y-3">
        {/* AI Analysis Usage Box */}
        {!isLoading && (
          <UsageMonitor used={usage} total={total} isPro={isPro} />
        )}

        {/* User Account Card */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent transition-colors border border-transparent hover:border-border"
          >
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white text-sm font-medium shadow-sm">
              {userInitials}
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{userName}</p>
              <p className="text-xs text-muted-foreground">{planStatus}</p>
            </div>
          </button>

          {/* Dropdown Menu */}
          {showUserMenu && (
            <div className="absolute bottom-full left-0 right-0 mb-2 p-2 rounded-lg bg-card border border-border shadow-lg">
              <div className="space-y-1">
                <Link
                  href="/app/settings/profile"
                  className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-foreground hover:bg-accent"
                  onClick={() => setShowUserMenu(false)}
                >
                  <User className="h-4 w-4" />
                  Profile
                </Link>
                <Link
                  href="/app/settings/preferences"
                  className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-foreground hover:bg-accent"
                  onClick={() => setShowUserMenu(false)}
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
                <Link
                  href="/app/settings/subscription"
                  className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-foreground hover:bg-accent"
                  onClick={() => setShowUserMenu(false)}
                >
                  <CreditCard className="h-4 w-4" />
                  Subscription
                </Link>
                <hr className="my-2 border-border" />
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-red-400 hover:bg-red-950/30"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
