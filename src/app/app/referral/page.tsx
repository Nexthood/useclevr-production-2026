"use client"

import { AppPageHeader } from "@/components/layout/app-page-header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { debugLog } from "@/lib/utils/debug"
import { Check, Copy, CreditCard, Gift, Loader2, MousePointer, QrCode, Share2, Sparkles, Users } from "lucide-react"
import { useEffect, useState } from "react"

interface ReferralStats {
  clicks: number
  signups: number
  paidReferrals: number
  creditsEarned: number
}

interface ReferralSummary {
  code: string
  referralLink: string
  stats: ReferralStats
}

const emptyStats: ReferralStats = {
  clicks: 0,
  signups: 0,
  paidReferrals: 0,
  creditsEarned: 0,
}

export default function ReferralCenter() {
  const [copied, setCopied] = useState(false)
  const [summary, setSummary] = useState<ReferralSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRecording, setIsRecording] = useState<string | null>(null)

  const referralCode = summary?.code || ""
  const referralLink = summary?.referralLink || ""
  const stats = summary?.stats || emptyStats

  const loadReferral = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/referral", { cache: "no-store" })
      if (response.ok) {
        setSummary(await response.json())
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadReferral()
  }, [])

  const recordEvent = async (event: "track" | "signup" | "paid") => {
    if (!referralCode) return
    setIsRecording(event)
    try {
      const response = await fetch(`/api/referral/${event}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: referralCode }),
      })
      if (response.ok) {
        const result = await response.json()
        setSummary((current) => current ? { ...current, stats: result.stats } : current)
      }
    } finally {
      setIsRecording(null)
    }
  }

  const handleCopy = async () => {
    if (!referralLink) return
    await navigator.clipboard.writeText(referralLink)
    await recordEvent("track")
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleShare = async () => {
    if (!referralLink) return
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join UseClevr - AI Business Intelligence",
          text: "Get instant insights from your CSV data with UseClevr. Sign up with my referral link!",
          url: referralLink,
        })
        await recordEvent("track")
      } catch {
        debugLog("Share cancelled")
      }
    } else {
      handleCopy()
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AppPageHeader
        title="Referral Center"
        description="Invite others and earn rewards."
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: "Referral" },
        ]}
      />
      <main className="px-5 py-5">
        <div className="max-w-4xl mx-auto space-y-8">

          {/* Main Card - Referral Link */}
          <Card className="p-6 bg-gradient-to-br from-purple-500/10 to-cyan-500/10 border-purple-500/20">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary dark:text-cyan-100" />
              Your Personal Referral Link
            </h2>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 break-all px-4 py-3 bg-background/80 rounded-lg border border-border font-mono text-sm">
                {isLoading ? "Creating referral link..." : referralLink}
              </div>
              <Button 
                onClick={handleCopy}
                disabled={!referralLink || isLoading}
                className="gap-2"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy
                  </>
                )}
              </Button>
              <Button 
                onClick={handleShare}
                disabled={!referralLink || isLoading}
                variant="outline"
                className="gap-2"
              >
                <Share2 className="h-4 w-4" />
                Share
              </Button>
            </div>

            {/* QR code section */}
            <div className="mt-6 pt-6 border-t border-border/50">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <QrCode className="h-4 w-4 text-cyan-800 dark:text-cyan-100" />
                  Referral QR code
                </h3>
                <span className="rounded-full border border-cyan-700/30 px-2 py-0.5 text-xs font-medium text-cyan-800 dark:border-cyan-300/30 dark:text-cyan-100">
                  Live
                </span>
              </div>
              <div className="flex items-center gap-6">
                <div className="w-36 overflow-hidden rounded-lg border border-border bg-white">
                  {referralCode ? (
                    <img
                      src={`/api/referral/qrcode?code=${encodeURIComponent(referralCode)}`}
                      alt="Referral QR code"
                      className="h-auto w-full"
                    />
                  ) : (
                    <div className="flex h-20 items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>Perfect for:</p>
                  <ul className="mt-2 space-y-1">
                    <li className="flex items-center gap-2">
                      <span className="font-medium text-foreground">Events</span>
                      <span>Events & conferences</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="font-medium text-foreground">Meetings</span>
                      <span>Networking</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="font-medium text-foreground">Mobile</span>
                      <span>In-person sharing</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </Card>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 bg-card border-border">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                  <MousePointer className="h-5 w-5 text-cyan-800 dark:text-cyan-100" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.clicks}</p>
                  <p className="text-xs text-muted-foreground">Clicks</p>
                </div>
              </div>
            </Card>
            
            <Card className="p-4 bg-card border-border">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary dark:text-cyan-100" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.signups}</p>
                  <p className="text-xs text-muted-foreground">Signups</p>
                </div>
              </div>
            </Card>
            
            <Card className="p-4 bg-card border-border">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-emerald-800 dark:text-emerald-100" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.paidReferrals}</p>
                  <p className="text-xs text-muted-foreground">Paid Users</p>
                </div>
              </div>
            </Card>
            
            <Card className="p-4 bg-card border-border">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-amber-800 dark:text-amber-100" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.creditsEarned}</p>
                  <p className="text-xs text-muted-foreground">Credits Earned</p>
                </div>
              </div>
            </Card>
          </div>

          <Card className="p-4 bg-card border-dashed border-border">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-sm font-medium text-foreground">Referral tracking is active</h2>
                <p className="text-sm text-muted-foreground">
                  Copy and share actions count as clicks. Signup and paid events can be recorded by the signup or billing flow.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!referralCode || isRecording !== null}
                  onClick={() => recordEvent("signup")}
                >
                  {isRecording === "signup" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Record signup
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!referralCode || isRecording !== null}
                  onClick={() => recordEvent("paid")}
                >
                  {isRecording === "paid" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Record paid
                </Button>
              </div>
            </div>
          </Card>

          {/* How It Works */}
          <Card className="p-6 bg-card border-border">
            <h2 className="text-lg font-semibold mb-4">How it works</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="h-12 w-12 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl font-bold text-primary dark:text-cyan-100">1</span>
                </div>
                <h3 className="font-medium mb-1">Share your link</h3>
                <p className="text-sm text-muted-foreground">
                  Send your personal referral link to colleagues, clients, or anyone who needs business intelligence.
                </p>
              </div>
              
              <div className="text-center">
                <div className="h-12 w-12 rounded-full bg-cyan-500/10 flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl font-bold text-cyan-800 dark:text-cyan-100">2</span>
                </div>
                <h3 className="font-medium mb-1">They sign up</h3>
                <p className="text-sm text-muted-foreground">
                  When someone signs up using your link, they get bonus credits and you earn referral rewards.
                </p>
              </div>
              
              <div className="text-center">
                <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl font-bold text-emerald-800 dark:text-emerald-100">3</span>
                </div>
                <h3 className="font-medium mb-1">Earn rewards</h3>
                <p className="text-sm text-muted-foreground">
                  Earn AI credits, unlock premium features, and grow your way to VIP partner status.
                </p>
              </div>
            </div>
          </Card>

          {/* Rewards Breakdown */}
          <Card className="p-6 bg-gradient-to-r from-cyan-500/5 via-purple-500/5 to-cyan-500/5 border-cyan-500/20">
            <h2 className="text-lg font-semibold mb-4">Your Rewards</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg">
                <span className="text-sm">Per referral signup</span>
                <span className="font-medium text-primary dark:text-cyan-100">5 AI credits</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg">
                <span className="text-sm">Per paid referral</span>
                <span className="font-medium text-primary dark:text-cyan-100">1 month Pro + 25 credits</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg">
                <span className="text-sm">Your referral bonus</span>
                <span className="font-medium text-cyan-800 dark:text-cyan-100">2 AI credits</span>
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t border-border/50">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Growth milestones:</span> 10+ referrals unlocks custom analytics • 25+ unlocks early access • 50+ unlocks dedicated support
              </p>
            </div>
          </Card>
        </div>
      </main>
    </div>
  )
}
