"use client"

import { debugLog, debugError, debugWarn } from "@/lib/debug"



import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Copy, Share2, QrCode, Users, MousePointer, CreditCard, Gift, Check, Sparkles } from "lucide-react"

export default function ReferralCenter() {
  const [copied, setCopied] = useState(false)
  
  // Generate a placeholder referral code (in production, this would come from auth/user data)
  const referralCode = "csaba123"
  const referralLink = `useclevr.ai/r/${referralCode}`
  
  const stats = {
    clicks: 0,
    signups: 0,
    paidReferrals: 0,
    creditsEarned: 0,
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join UseClevr - AI Business Intelligence",
          text: "Get instant insights from your CSV data with UseClevr. Sign up with my referral link!",
          url: referralLink,
        })
      } catch (err) {
        debugLog("Share cancelled")
      }
    } else {
      handleCopy()
    }
  }

  return (
    <div className="min-h-screen p-8">
      <main>
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-foreground">Referral Center</h1>
            <p className="text-muted-foreground mt-1">Invite others and earn rewards</p>
          </div>

          {/* Main Card - Referral Link */}
          <Card className="p-6 bg-gradient-to-br from-purple-500/10 to-cyan-500/10 border-purple-500/20">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Gift className="h-5 w-5 text-purple-400" />
              Your Personal Referral Link
            </h2>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 px-4 py-3 bg-background/80 rounded-lg border border-border font-mono text-sm">
                {referralLink}
              </div>
              <Button 
                onClick={handleCopy}
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
                variant="outline"
                className="gap-2"
              >
                <Share2 className="h-4 w-4" />
                Share
              </Button>
            </div>

            {/* QR Code Section */}
            <div className="mt-6 pt-6 border-t border-border/50">
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <QrCode className="h-4 w-4 text-cyan-400" />
                Scan to share
              </h3>
              <div className="flex items-center gap-6">
                {/* Simple QR code placeholder - in production use a QR library */}
                <div className="w-24 h-24 bg-white rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
                  <div className="text-center p-2">
                    <QrCode className="h-8 w-8 text-gray-400 mx-auto mb-1" />
                    <span className="text-[10px] text-gray-400">QR Code</span>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>Perfect for:</p>
                  <ul className="mt-2 space-y-1">
                    <li className="flex items-center gap-2">
                      <span>�_events</span>
                      <span>Events & conferences</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span>💼</span>
                      <span>Networking</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span>📱</span>
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
                  <MousePointer className="h-5 w-5 text-cyan-400" />
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
                  <Users className="h-5 w-5 text-purple-400" />
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
                  <CreditCard className="h-5 w-5 text-green-400" />
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
                  <Sparkles className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.creditsEarned}</p>
                  <p className="text-xs text-muted-foreground">Credits Earned</p>
                </div>
              </div>
            </Card>
          </div>

          {/* How It Works */}
          <Card className="p-6 bg-card border-border">
            <h2 className="text-lg font-semibold mb-4">How it works</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="h-12 w-12 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl font-bold text-purple-400">1</span>
                </div>
                <h3 className="font-medium mb-1">Share your link</h3>
                <p className="text-sm text-muted-foreground">
                  Send your personal referral link to colleagues, clients, or anyone who needs business intelligence.
                </p>
              </div>
              
              <div className="text-center">
                <div className="h-12 w-12 rounded-full bg-cyan-500/10 flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl font-bold text-cyan-400">2</span>
                </div>
                <h3 className="font-medium mb-1">They sign up</h3>
                <p className="text-sm text-muted-foreground">
                  When someone signs up using your link, they get bonus credits and you earn referral rewards.
                </p>
              </div>
              
              <div className="text-center">
                <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl font-bold text-green-400">3</span>
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
                <span className="font-medium text-purple-400">5 AI credits</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg">
                <span className="text-sm">Per paid referral</span>
                <span className="font-medium text-purple-400">1 month Pro + 25 credits</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg">
                <span className="text-sm">Your referral bonus</span>
                <span className="font-medium text-cyan-400">2 AI credits</span>
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
