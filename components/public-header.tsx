"use client"

import { useState } from "react"
import Link from "next/link"
import { Logo } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Brain, Sparkles, Cloud, WifiOff } from "lucide-react"

export function PublicHeader() {
  const [isOffline, setIsOffline] = useState(false)
  const [showHybridAIPopover, setShowHybridAIPopover] = useState(false)
  const [showModePopover, setShowModePopover] = useState(false)

  return (
    <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto flex h-20 items-center justify-between px-4 md:px-6">
        {/* Left - Logo */}
        <Link href="/" className="flex items-center focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-md">
          <Logo />
        </Link>
        
        {/* Center - Navigation */}
        <nav className="hidden md:flex items-center gap-4 ml-8">
          {/* Hybrid AI - with popover */}
          <div className="relative">
            <button 
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#7C3AED]/30 bg-[#7C3AED]/5 text-sm font-medium text-[#A78BFA] hover:border-[#7C3AED]/50 hover:bg-[#7C3AED]/10 transition-all relative overflow-hidden"
              onMouseEnter={() => setShowHybridAIPopover(true)}
              onMouseLeave={() => setShowHybridAIPopover(false)}
              onClick={() => setShowHybridAIPopover(!showHybridAIPopover)}
            >
              <Brain className="h-3.5 w-3.5" />
              <span>Hybrid AI</span>
              <div className="absolute inset-0 animate-sweep-light bg-gradient-to-r from-transparent via-[#A78BFA]/15 to-transparent" />
            </button>

            {/* Popover */}
            {showHybridAIPopover && (
              <div 
                className="absolute top-full mt-2 left-0 w-80 p-5 rounded-xl bg-card/95 backdrop-blur border border-[#7C3AED]/20 shadow-2xl shadow-purple-500/10 z-50"
                onMouseEnter={() => setShowHybridAIPopover(true)}
                onMouseLeave={() => setShowHybridAIPopover(false)}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Brain className="h-5 w-5 text-[#A78BFA]" />
                  <h3 className="text-lg font-bold text-foreground">Hybrid AI</h3>
                </div>
                <p className="text-base text-foreground/80 mb-4 leading-relaxed">
                  Run UseClevr in cloud or local mode. Your data stays on your device when you need it.
                </p>
                <div className="space-y-2 mb-4">
                  <p className="text-sm font-medium text-cyan-400">
                    ✓ Lite and Standard are available now
                  </p>
                  <p className="text-sm text-muted-foreground/60">
                    ✦ MEGA is coming soon for high-performance systems
                  </p>
                </div>
                <p className="text-xs text-muted-foreground/50 pt-3 border-t border-border/30">
                  Availability depends on device capability
                </p>
              </div>
            )}
          </div>

          {/* Affiliate - premium animated */}
          <Link href="/affiliate" className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/5 text-sm font-medium text-cyan-400 hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-all relative overflow-hidden">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Affiliate</span>
            <div className="absolute inset-0 animate-sweep-light bg-gradient-to-r from-transparent via-cyan-400/15 to-transparent" />
          </Link>

          {/* Plans */}
          <Link href="/pricing" className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors px-2">
            Plans
          </Link>

          {/* Book demo */}
          <Link href="/contact" className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors px-2">
            Book demo
          </Link>
        </nav>
        
        {/* Right side - Controls and CTAs */}
        <div className="flex items-center gap-2">
          {/* Cloud / Offline Mode Switcher */}
          <div className="relative">
            <button
              onClick={() => setIsOffline(!isOffline)}
              onMouseEnter={() => setShowModePopover(true)}
              onMouseLeave={() => setShowModePopover(false)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all relative overflow-hidden ${
                isOffline
                  ? "border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:border-amber-500/50"
                  : "border border-cyan-500/30 bg-cyan-500/5 text-cyan-400 hover:border-cyan-500/50"
              }`}
            >
              {isOffline ? (
                <>
                  <WifiOff className="h-3.5 w-3.5" />
                  <span>Offline</span>
                </>
              ) : (
                <>
                  <Cloud className="h-3.5 w-3.5" />
                  <span>Cloud</span>
                </>
              )}
            </button>

            {/* Mode Popover */}
            {showModePopover && (
              <div 
                className="absolute top-full mt-2 right-0 w-72 p-4 rounded-xl bg-card/95 backdrop-blur border border-cyan-500/20 shadow-2xl shadow-cyan-500/10 z-50"
                onMouseEnter={() => setShowModePopover(true)}
                onMouseLeave={() => setShowModePopover(false)}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Cloud className="h-5 w-5 text-cyan-400" />
                  <h3 className="text-lg font-bold text-foreground">Cloud / Offline Modes</h3>
                </div>
                
                <div className="space-y-3 mb-3">
                  <div>
                    <p className="text-sm font-medium text-cyan-400">Cloud Mode</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Use cloud AI for faster processing and no local installation.
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-amber-400">Offline Mode</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Run available local AI modes on your device for private, offline analysis.
                    </p>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground/50 pt-2 border-t border-border/30">
                  Mode availability depends on device capability
                </p>
              </div>
            )}
          </div>

          <ThemeToggle />
          
          <div className="flex items-center gap-1 ml-1">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
            <Link href="/signup" prefetch={false}>
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}
