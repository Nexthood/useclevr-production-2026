"use client"

import { Logo } from "@/components/layout/logo"
import { Button } from "@/components/ui/button"
import { ProductStatusBadge } from "@/components/ui/product-status-badge"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { Brain, Cloud, Menu, Sparkles, WifiOff, X } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

export function PublicHeader() {
  const [isOffline, setIsOffline] = useState(false)
  const [showHybridAIPopover, setShowHybridAIPopover] = useState(false)
  const [showModePopover, setShowModePopover] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    let mounted = true

    fetch("/api/auth/session", { credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : null))
      .then((session: { user?: unknown } | null) => {
        if (mounted) {
          setIsLoggedIn(Boolean(session?.user))
        }
      })
      .catch(() => {
        if (mounted) {
          setIsLoggedIn(false)
        }
      })

    return () => {
      mounted = false
    }
  }, [])

  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-20 w-full min-w-0 items-center justify-between gap-2 px-4 md:gap-3 md:px-6 lg:px-8">
        {/* Left - Logo */}
        <Link href="/" className="flex h-16 min-w-0 shrink items-center rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 sm:shrink-0">
          <Logo className="h-12 w-auto md:h-14" />
        </Link>
        
        {/* Center - Navigation */}
        <nav className="hidden lg:flex items-center gap-4 ml-8">
          {/* Hybrid AI - with popover */}
          <div className="relative">
            <button 
              className="relative flex items-center gap-1.5 overflow-hidden rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary transition-all hover:border-primary/60 hover:bg-primary/15 dark:text-cyan-100"
              onMouseEnter={() => setShowHybridAIPopover(true)}
              onMouseLeave={() => setShowHybridAIPopover(false)}
              onClick={() => setShowHybridAIPopover(!showHybridAIPopover)}
            >
              <Brain className="h-3.5 w-3.5" />
              <span>UseClevr Hybrid AI</span>
              <div className="absolute inset-0 animate-sweep-light bg-gradient-to-r from-transparent via-primary/15 to-transparent" />
            </button>

            {/* Popover */}
            {showHybridAIPopover && (
              <div 
                className="absolute left-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-primary/25 bg-card/95 p-5 shadow-2xl shadow-black/10 backdrop-blur dark:shadow-black/40"
                onMouseEnter={() => setShowHybridAIPopover(true)}
                onMouseLeave={() => setShowHybridAIPopover(false)}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Brain className="h-5 w-5 text-primary dark:text-cyan-100" />
                  <h3 className="text-lg font-bold text-foreground">Hybrid AI</h3>
                  <ProductStatusBadge status="beta" />
                </div>
                <p className="text-base text-foreground/80 mb-4 leading-relaxed">
                  Choose Cloud AI for managed analysis or Local AI beta for compatible private provider setups.
                </p>
                <div className="space-y-2 mb-4">
                  <p className="text-sm font-medium text-cyan-800 dark:text-cyan-100">
                    ✓ Lite and Standard are available now
                  </p>
                  <p className="text-sm text-muted-foreground/60">
                    ✦ MEGA is available for enterprise hardware by request
                  </p>
                </div>
                <p className="text-xs text-muted-foreground/50 pt-3 border-t border-border/30">
                  Local AI performance and compatibility depend on your system configuration.
                </p>
              </div>
            )}
          </div>

          {/* Affiliate - premium animated */}
          <Link href="/affiliate" className="relative flex items-center gap-1.5 overflow-hidden rounded-full border border-cyan-700/30 bg-cyan-500/10 px-3 py-1.5 text-sm font-medium text-cyan-800 transition-all hover:border-cyan-700/50 hover:bg-cyan-500/15 dark:border-cyan-300/30 dark:text-cyan-100 dark:hover:border-cyan-300/50">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Affiliate</span>
            <div className="absolute inset-0 animate-sweep-light bg-gradient-to-r from-transparent via-cyan-400/15 to-transparent" />
          </Link>

          {/* Plans */}
          <Link href="/pricing" className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors px-2">
            Plans
          </Link>

          {/* FAQ */}
          <Link href="/faq" className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors px-2">
            FAQ
          </Link>

          <Link href="/news" className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors px-2">
            What You&apos;re Missing
          </Link>
        </nav>
        
        {/* Right side - Controls and CTAs */}
        <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
          {/* Cloud / Offline Mode Switcher */}
          <div className="relative">
            <button
              onClick={() => setIsOffline(!isOffline)}
              onMouseEnter={() => setShowModePopover(true)}
              onMouseLeave={() => setShowModePopover(false)}
              className={`relative flex h-10 min-w-10 items-center justify-center gap-1.5 overflow-hidden rounded-full px-2.5 py-1.5 text-sm font-medium transition-all sm:h-auto sm:justify-start sm:px-3 ${
                isOffline
                  ? "border border-fuchsia-700/25 bg-fuchsia-500/10 text-fuchsia-800 hover:border-fuchsia-700/45 dark:border-fuchsia-200/25 dark:text-fuchsia-100 dark:hover:border-fuchsia-200/45"
                  : "border border-cyan-700/30 bg-cyan-500/10 text-cyan-800 hover:border-cyan-700/50 dark:border-cyan-300/30 dark:text-cyan-100 dark:hover:border-cyan-300/50"
              }`}
            >
              {isOffline ? (
                <>
                  <WifiOff className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Local AI</span>
                  <ProductStatusBadge status="beta" className="hidden sm:inline-flex" />
                </>
              ) : (
                <>
                  <Cloud className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Cloud AI</span>
                </>
              )}
            </button>

            {/* Mode Popover */}
            {showModePopover && (
              <div 
                className="absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-cyan-700/20 bg-card/95 p-4 shadow-2xl shadow-black/10 backdrop-blur dark:border-cyan-300/20 dark:shadow-black/40"
                onMouseEnter={() => setShowModePopover(true)}
                onMouseLeave={() => setShowModePopover(false)}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Cloud className="h-5 w-5 text-cyan-800 dark:text-cyan-100" />
                  <h3 className="text-lg font-bold text-foreground">UseClevr Cloud / Offline</h3>
                </div>
                
                <div className="space-y-3 mb-3">
                  <div>
                    <p className="text-sm font-medium text-cyan-800 dark:text-cyan-100">Cloud Mode</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Use cloud AI for faster processing and no local installation.
                    </p>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-fuchsia-800 dark:text-fuchsia-100">Local AI</p>
                      <ProductStatusBadge status="beta" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Connect a supported local provider or UseClevr Helper for private local analysis.
                    </p>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground/50 pt-2 border-t border-border/30">
                  Local AI is in beta. Performance and compatibility depend on your system configuration.
                </p>
              </div>
            )}
          </div>

          <ThemeToggle />
          
          <div className="hidden items-center gap-1 ml-1 lg:flex">
            {isLoggedIn ? (
              <Link href="/app">
                <Button size="sm">Dashboard</Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm">
                    Sign in
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button size="sm">Get Started</Button>
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background text-foreground transition hover:bg-muted lg:hidden"
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {mobileOpen && (
        <div className="absolute left-0 right-0 top-20 z-50 border-b border-border bg-background shadow-xl lg:hidden">
          <nav className="container mx-auto grid gap-2 px-4 py-5">
            <Link
              href="/pricing"
              className="rounded-md px-3 py-3 text-sm font-medium text-foreground transition hover:bg-muted"
              onClick={() => setMobileOpen(false)}
            >
              Plans
            </Link>
            <Link
              href="/affiliate"
              className="rounded-md px-3 py-3 text-sm font-medium text-foreground transition hover:bg-muted"
              onClick={() => setMobileOpen(false)}
            >
              Affiliate
            </Link>
            <Link
              href="/news"
              className="rounded-md px-3 py-3 text-sm font-medium text-foreground transition hover:bg-muted"
              onClick={() => setMobileOpen(false)}
            >
              What You&apos;re Missing
            </Link>
            <Link
              href="/faq"
              className="rounded-md px-3 py-3 text-sm font-medium text-foreground transition hover:bg-muted"
              onClick={() => setMobileOpen(false)}
            >
              FAQ
            </Link>
            <div className="mt-3 grid gap-2 border-t border-border pt-4">
              {isLoggedIn ? (
                <Link href="/app" onClick={() => setMobileOpen(false)}>
                  <Button className="w-full">Dashboard</Button>
                </Link>
              ) : (
                <>
                  <Link href="/login" onClick={() => setMobileOpen(false)}>
                    <Button variant="outline" className="w-full bg-transparent">
                      Sign in
                    </Button>
                  </Link>
                  <Link href="/signup" onClick={() => setMobileOpen(false)}>
                    <Button className="w-full">Get Started</Button>
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
