"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useNotice } from "@/components/ui/notice-bar"
import { updateProfile } from "@/app/actions/settings"
import { Building2, CheckCircle2, CreditCard, FileText, LockKeyhole, ShieldCheck, Sparkles, User, Settings } from "lucide-react"
import Link from "next/link"
import * as React from "react"
import { useRouter } from "next/navigation"

type TabId = "profile" | "company" | "subscription" | "billing" | "rules" | "security"

const tabs: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "company", label: "Company", icon: Building2 },
  { id: "subscription", label: "Subscription", icon: CreditCard },
  { id: "billing", label: "Billing", icon: FileText },
  { id: "rules", label: "Rules", icon: ShieldCheck },
  { id: "security", label: "Security", icon: LockKeyhole },
]

type AccountCenterProps = {
  profile: { fullName: string | null; email: string | null } | null
  setupStatus: { setupAccuracy: number; completedSections: string[]; missingFields: string[]; accountantReviewFlags: string[]; completed: boolean } | null
  usage: {
    subscriptionTier: string
    trialActive: boolean
    trialDaysRemaining: number
    analysisCount: number
    total: number
    limitReached: boolean
    canAnalyze: boolean
  } | null
  billingSettings: {
    plans: Array<{
      id: string
      name: string
      tier: string
      price: number
      interval: string
      description: string
      features: string[]
      stripePriceId?: string
    }>
    referralConfig: { referralsPerCredit: number; enabled: boolean }
  } | null
  session: { user?: { id?: string; name?: string | null; email?: string | null; role?: string } } | null
}

export function AccountCenter({ profile, setupStatus, usage, billingSettings, session }: AccountCenterProps) {
  const router = useRouter()
  const { showNotice } = useNotice()
  const [activeTab, setActiveTab] = React.useState<TabId>("profile")
  const [isSaving, setIsSaving] = React.useState(false)

  const fullName = profile?.fullName || session?.user?.name || ""
  const email = profile?.email || session?.user?.email || ""
  const setupAccuracy = setupStatus?.setupAccuracy ?? 0
  const isDemo = session?.user?.id ? /^demo_/.test(session.user.id) : false

  const profileComplete = Boolean(fullName && email)
  const companyComplete = setupAccuracy >= 80
  const subscriptionComplete = usage?.subscriptionTier !== "free" || usage?.trialActive
  const securityComplete = Boolean(email)
  const completionItems = [
    { label: "Profile", complete: profileComplete },
    { label: "Company", complete: companyComplete },
    { label: "Subscription", complete: subscriptionComplete },
    { label: "Security", complete: securityComplete },
  ]
  const completionPercent = Math.round((completionItems.filter((item) => item.complete).length / completionItems.length) * 100)
  const planLabel = usage?.trialActive
    ? `Trial, ${usage.trialDaysRemaining} ${usage.trialDaysRemaining === 1 ? "day" : "days"} left`
    : usage?.subscriptionTier || "Free"

  const isUnlimited = usage?.trialActive || ["pro", "business", "superadmin"].includes(usage?.subscriptionTier || "")

  const handleProfileSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSaving(true)
    const result = await updateProfile(new FormData(event.currentTarget))
    if (!result.success) {
      showNotice({ type: "error", title: "Profile was not saved.", message: result.error })
    } else {
      showNotice({ type: isDemo ? "info" : "success", title: result.data?.message || "Profile saved." })
      router.refresh()
    }
    setIsSaving(false)
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case "profile":
        return (
          <Card className="border-border bg-card">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted text-foreground">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-foreground">Profile</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Identity used across account, reports, and workspace activity.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileSubmit} className="space-y-5">
                {isDemo && (
                  <div className="rounded-md border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-sm text-foreground">
                    Built-in account identity is locked. Dashboard data and uploads save normally.
                  </div>
                )}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-foreground">Name</Label>
                    <Input id="fullName" name="fullName" defaultValue={fullName} disabled={isDemo} className="h-12 bg-muted border-input text-base disabled:opacity-50" autoComplete="name" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-foreground">Email</Label>
                    <Input id="email" name="email" type="email" defaultValue={email} disabled={isDemo} className="h-12 bg-muted border-input text-base disabled:opacity-50" autoComplete="email" required />
                  </div>
                </div>
                <Button type="submit" disabled={isSaving || isDemo} className="w-full bg-gradient-primary hover:opacity-90 sm:w-auto">
                  {isSaving ? "Saving..." : isDemo ? "Built-in identity locked" : "Save profile"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )

      case "company":
        return (
          <Card className="border-border bg-card">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted text-foreground">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-foreground">Company</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Business context used by analysis, tax, payroll, and cash-flow calculations.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-border bg-background/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Business Profile setup</span>
                  <span className="text-sm font-semibold text-foreground">{setupAccuracy}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${setupAccuracy}%` }} />
                </div>
              </div>
              <Link href="/app/business/setup" className="inline-flex h-10 w-full items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted">
                Continue company setup
              </Link>
              {setupStatus?.accountantReviewFlags && setupStatus.accountantReviewFlags.length > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
                  <p className="font-medium">Analysis confidence warnings</p>
                  <ul className="mt-2 space-y-1">
                    {setupStatus.accountantReviewFlags.slice(0, 4).map((flag) => <li key={flag}>- {flag}</li>)}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )

      case "subscription":
        return (
          <Card className="border-border bg-card">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted text-foreground">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-foreground">Subscription</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Manage your plan and analyst credits.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-border bg-card p-5">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <p className="text-sm font-medium text-foreground">Current plan</p>
                </div>
                <p className="text-sm text-muted-foreground">{planLabel}</p>
                {!isUnlimited && usage && (
                  <Link href="/app/settings/checkout?plan=pro_monthly&discount=auto" className="mt-3 block">
                    <Button variant="outline" size="sm" className="bg-transparent">Upgrade</Button>
                  </Link>
                )}
              </div>

              <div className="rounded-lg border border-border bg-card p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-5 w-5 text-cyan-800 dark:text-cyan-100" />
                  <p className="text-sm font-medium text-foreground">Analyst credits</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {isUnlimited
                    ? usage?.trialActive
                      ? `Unlimited analyst usage for ${usage.trialDaysRemaining} more ${usage.trialDaysRemaining === 1 ? "day" : "days"}`
                      : "Unlimited analyst usage"
                    : `${usage?.analysisCount || 0} / ${usage?.total || 0} free credits used`}
                </p>
                {!isUnlimited && usage && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {usage.limitReached
                      ? "Free credits are used. Subscribe to Pro or top up to continue analysis."
                      : `${Math.max(0, (usage.total || 0) - (usage.analysisCount || 0))} free credits remaining.`}
                  </p>
                )}
              </div>

              <div className="flex min-w-0 items-center justify-between gap-3 pt-2">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-2">
                    <Sparkles className="h-3 w-3" />
                    Pricing
                  </div>
                  <h2 className="text-base font-semibold text-foreground">Plans</h2>
                  <p className="text-sm text-muted-foreground">Full plan details live on the public plans page.</p>
                </div>
                <Link href="/pricing">
                  <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                    Home plans
                  </Button>
                </Link>
              </div>

              <div className="grid min-w-0 gap-3 md:grid-cols-2">
                {billingSettings?.plans
                  .filter((plan) => plan.id !== "pro_annual")
                  .map((plan) => {
                    const isCurrent =
                      (plan.tier === "free" && !isUnlimited) ||
                      (plan.tier === "pro" && usage?.subscriptionTier === "pro") ||
                      (plan.tier === "business" && usage?.subscriptionTier === "business")

                    return (
                      <div key={plan.id} className="min-w-0 rounded-lg border border-border bg-background p-4">
                        <div className="flex min-w-0 items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground">{plan.name}</p>
                            <p className="break-words text-sm text-muted-foreground">${plan.price}/{plan.interval}</p>
                          </div>
                          {isCurrent && (
                            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-300">
                              Current
                            </span>
                          )}
                        </div>
                        <p className="mt-3 min-h-10 break-words text-sm text-muted-foreground">{plan.description}</p>
                        {isCurrent ? (
                          <Button disabled size="sm" variant="outline" className="mt-4 w-full bg-transparent">
                            Active plan
                          </Button>
                        ) : (
                          <Link href={`/app/settings/checkout?plan=${plan.id}`}>
                            <Button size="sm" variant={plan.tier === "free" ? "outline" : "default"} className={`mt-4 w-full ${plan.tier === "free" ? "bg-transparent" : ""}`}>
                              {plan.tier === "free" ? "Downgrade" : "Review change"}
                            </Button>
                          </Link>
                        )}
                      </div>
                    )
                  })}
              </div>
            </CardContent>
          </Card>
        )

      case "billing":
        return (
          <Card className="border-border bg-card">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted text-foreground">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-foreground">Billing</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Invoices, payment status, and account plan details.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-border bg-muted/30 p-5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Current plan</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{planLabel}</p>
                </div>
                <div className="rounded-xl border border-border bg-muted/30 p-5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Payment status</p>
                  <p className="mt-1 text-lg font-semibold capitalize text-foreground">Ready for checkout</p>
                </div>
                <div className="rounded-xl border border-border bg-muted/30 p-5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Billing cycle</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">Monthly</p>
                </div>
              </div>

              <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4">
                <p className="font-medium">Subscription billing</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Payment will be processed during checkout. Invoices will appear here after purchase.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Link href="/app/settings/subscription">
                  <Button>Manage plan</Button>
                </Link>
                <Link href="/app/settings/checkout?plan=pro_monthly&discount=auto">
                  <Button variant="outline" className="bg-transparent">Preview checkout</Button>
                </Link>
                <a href="mailto:sales@useclevr.com">
                  <Button variant="outline" className="bg-transparent">Contact sales</Button>
                </a>
              </div>

              <div className="overflow-hidden rounded-lg border border-border">
                <div className="grid grid-cols-[1.2fr_0.8fr_0.8fr] bg-muted/30 px-5 py-3 text-xs font-medium text-muted-foreground">
                  <span>Invoice</span>
                  <span>Status</span>
                  <span className="text-right">Amount</span>
                </div>
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                  No invoices yet.
                </div>
              </div>
            </CardContent>
          </Card>
        )

      case "rules":
        return (
          <div className="space-y-5">
            <Card className="border-border bg-card">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted text-foreground">
                    <ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <CardTitle className="text-foreground">Credit Rules</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Dataset credit model and usage rules.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-lg border border-border bg-muted/50 p-4">
                  <p className="text-sm font-medium text-foreground">Current source of truth</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    One uploaded dataset counts as one analyst credit. Usage is calculated from the number of rows owned by the user in the Dataset table.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="datasetsPerCredit">Datasets per credit</Label>
                    <Input id="datasetsPerCredit" value="1" readOnly />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="featuresPerCredit">Features included per credit</Label>
                    <Input id="featuresPerCredit" value="All dataset analysis features" readOnly />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <span className={`ml-auto inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${billingSettings?.referralConfig.enabled ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-slate-500/10 text-slate-600 dark:text-slate-400"}`}>
                    {billingSettings?.referralConfig.enabled ? "Active" : "Disabled"}
                  </span>
                </div>
                <CardTitle className="text-foreground">Referral credit rules</CardTitle>
                <CardDescription className="text-muted-foreground">
                  {billingSettings?.referralConfig.enabled
                    ? `Every ${billingSettings.referralConfig.referralsPerCredit} successful ${billingSettings.referralConfig.referralsPerCredit === 1 ? "referral" : "referrals"} earns 1 analyst credit.`
                    : "Referral credits are currently disabled."}
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-foreground">Role Limits</CardTitle>
                <CardDescription className="text-muted-foreground">
                  These values reflect the active hard-coded limits.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-lg border border-border">
                  <div className="grid grid-cols-2 gap-4 border-b border-border px-4 py-3">
                    <p className="text-sm font-medium text-foreground">Free customer</p>
                    <p className="text-sm text-muted-foreground">3 credits</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 border-b border-border px-4 py-3">
                    <p className="text-sm font-medium text-foreground">Pro customer</p>
                    <p className="text-sm text-muted-foreground">Unlimited</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 px-4 py-3">
                    <p className="text-sm font-medium text-foreground">Super admin</p>
                    <p className="text-sm text-muted-foreground">Unlimited</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )

      case "security":
        return (
          <Card className="border-border bg-card">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted text-foreground">
                  <LockKeyhole className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-foreground">Security</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Sign-in identity and account protection.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-background/70 px-3 py-2">
                <span className="text-sm text-muted-foreground">Email identity</span>
                <span className="truncate text-sm font-medium text-foreground">{email || "Missing"}</span>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-background/70 px-3 py-2">
                <span className="text-sm text-muted-foreground">Account type</span>
                <span className="truncate text-sm font-medium text-foreground">{isDemo ? "Built-in demo" : "User account"}</span>
              </div>
              <div className="rounded-md border border-border bg-background/70 p-3 text-sm text-muted-foreground">
                Authentication settings are managed by the active sign-in provider.
              </div>
            </CardContent>
          </Card>
        )

      default:
        return null
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Account Center</h1>
          <p className="text-sm text-muted-foreground">Manage your profile, subscription, billing, and security in one place.</p>
        </div>
      </div>

      <div className="flex min-w-0 gap-1 overflow-x-auto border-b border-border">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                "flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium transition",
                isActive ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
              ].join(" ")}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="min-w-0">{renderTabContent()}</div>
        <div className="grid gap-5">
          <Card className="border-border bg-card">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-foreground">Workspace completion</CardTitle>
                  <CardDescription className="mt-1 text-muted-foreground">
                    {completionItems.filter((item) => item.complete).length} of {completionItems.length} sections ready
                  </CardDescription>
                </div>
                <span className="text-3xl font-semibold text-foreground">{completionPercent}%</span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${completionPercent}%` }} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {completionItems.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2 text-sm">
                    <span className="text-foreground">{item.label}</span>
                    {item.complete ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <ShieldCheck className="h-4 w-4 text-muted-foreground" />}
                  </div>
                ))}
              </div>
            </CardHeader>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="pb-4">
              <CardTitle className="text-foreground">Account status</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2">
                <CreditCard className="h-4 w-4 text-primary" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Plan</p>
                  <p className="truncate text-sm font-medium capitalize text-foreground">{planLabel}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Access</p>
                  <p className="truncate text-sm font-medium text-foreground">{usage?.canAnalyze ? "Analysis enabled" : "Credits used"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2">
                <Settings className="h-4 w-4 text-primary" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Role</p>
                  <p className="truncate text-sm font-medium capitalize text-foreground">{session?.user?.role || "user"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
