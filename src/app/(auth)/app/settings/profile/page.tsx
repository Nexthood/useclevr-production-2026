import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { auth } from "@/lib/auth/auth"
import { isBuiltinUserId } from "@/lib/auth/builtin-users"
import { getSetupStatus } from "@/lib/business/company-setup-store"
import { getDb } from "@/lib/db"
import { profiles } from "@/lib/db/schema"
import { getAnalystCreditUsage } from "@/lib/usage/analyst-credits"
import { debugError } from "@/lib/utils/debug"
import { eq } from "drizzle-orm"
import { Building2, CheckCircle2, CreditCard, LockKeyhole, ShieldCheck, Sparkles, User } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import type React from "react"
import { ProfileForm } from "./profile-form"

export const metadata: Metadata = { title: "Profile Settings" }

export default async function ProfileSettingsPage() {
  const session = await auth()
  const user = session?.user
  const db = getDb()
  let loadError: string | null = null
  let profile: {
    fullName: string | null
    email: string | null
    businessName: string | null
    businessEmail: string | null
    industry: string | null
    location: string | null
    website: string | null
  } | null = null

  if (user?.id && !isBuiltinUserId(user.id) && db) {
    try {
      profile = await db.query.profiles.findFirst({
        where: eq(profiles.userId, user.id),
        columns: {
          fullName: true,
          email: true,
          businessName: true,
          businessEmail: true,
          industry: true,
          location: true,
          website: true,
        },
      }) ?? null
    } catch (error) {
      debugError("[Settings] Profile load failed:", error)
      loadError = "Some profile details could not be loaded. You can still view and update the account fields below."
    }
  }

  const fullName = profile?.fullName || user?.name || ""
  const email = profile?.email || user?.email || ""
  const setupStatus = user?.id ? await getSetupStatus(user.id) : null
  const usage = await getAnalystCreditUsage(user?.id)
  const profileComplete = Boolean(fullName && email)
  const companyComplete = (setupStatus?.setupAccuracy ?? 0) >= 80
  const subscriptionComplete = usage.subscriptionTier !== "free" || usage.trialActive
  const securityComplete = Boolean(email)
  const completionItems = [
    { label: "Profile", complete: profileComplete },
    { label: "Company", complete: companyComplete },
    { label: "Subscription", complete: subscriptionComplete },
    { label: "Security", complete: securityComplete },
  ]
  const completionPercent = Math.round((completionItems.filter((item) => item.complete).length / completionItems.length) * 100)
  const planLabel = usage.trialActive
    ? `Trial, ${usage.trialDaysRemaining} ${usage.trialDaysRemaining === 1 ? "day" : "days"} left`
    : usage.subscriptionTier
  const businessFacts = [
    { label: "Company", value: profile?.businessName || "Not set" },
    { label: "Industry", value: profile?.industry || "Not set" },
    { label: "Location", value: profile?.location || "Not set" },
    { label: "Website", value: profile?.website || "Not set" },
  ]

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="p-6 lg:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  Account control center
                </div>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">Profile, access, and setup in one place</h2>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  Keep the account details, company context, subscription, and security posture that shape the UseClevr workspace.
                </p>
              </div>
              <Link
                href="/app/business/setup"
                className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Continue Setup
              </Link>
            </div>
          </div>
          <div className="border-t border-border bg-background/60 p-6 lg:border-l lg:border-t-0 lg:p-7">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">Workspace completion</p>
                <p className="mt-1 text-sm text-muted-foreground">{completionItems.filter((item) => item.complete).length} of {completionItems.length} sections ready</p>
              </div>
              <span className="text-3xl font-semibold text-foreground">{completionPercent}%</span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${completionPercent}%` }} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {completionItems.map((item) => (
                <CompletionPill key={item.label} label={item.label} complete={item.complete} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <Card className="border-border bg-card">
          <CardHeader className="pb-4">
            <SectionTitle icon={User} title="Profile" description="Identity used across account, reports, and workspace activity." complete={profileComplete} />
          </CardHeader>
          <CardContent>
            <ProfileForm
              fullName={fullName}
              email={email}
              isDemo={isBuiltinUserId(user?.id)}
              loadError={loadError}
            />
          </CardContent>
        </Card>

        <div className="grid gap-5">
          <Card className="border-border bg-card">
            <CardHeader className="pb-4">
              <SectionTitle icon={Building2} title="Company" description="Business context used by analysis, tax, payroll, and cash-flow calculations." complete={companyComplete} />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {businessFacts.map((fact) => (
                  <div key={fact.label} className="rounded-md border border-border bg-background/70 p-3">
                    <p className="text-xs text-muted-foreground">{fact.label}</p>
                    <p className="mt-1 truncate text-sm font-medium text-foreground">{fact.value}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-md border border-border bg-background/70 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Business Profile setup</span>
                  <span className="text-sm font-semibold text-foreground">{setupStatus?.setupAccuracy ?? 0}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${setupStatus?.setupAccuracy ?? 0}%` }} />
                </div>
              </div>
              <Link href="/app/business/setup" className="inline-flex h-10 w-full items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted">
                Continue company setup
              </Link>
            </CardContent>
          </Card>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <Card className="border-border bg-card">
              <CardHeader className="pb-4">
                <SectionTitle icon={CreditCard} title="Subscription" description="Plan access and analyst usage." complete={subscriptionComplete} />
              </CardHeader>
              <CardContent className="space-y-3">
                <MetricLine label="Plan" value={planLabel} />
                <MetricLine label="Analyst credits" value={usage.trialActive || ["pro", "business", "superadmin", "builtin"].includes(usage.subscriptionTier) ? "Unlimited" : `${usage.analysisCount}/${usage.total} used`} />
                <Link href="/app/settings/subscription" className="inline-flex h-10 w-full items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted">
                  Manage subscription
                </Link>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="pb-4">
                <SectionTitle icon={LockKeyhole} title="Security" description="Sign-in identity and account protection." complete={securityComplete} />
              </CardHeader>
              <CardContent className="space-y-3">
                <MetricLine label="Email identity" value={email || "Missing"} />
                <MetricLine label="Account type" value={isBuiltinUserId(user?.id) ? "Built-in demo" : "User account"} />
                <div className="rounded-md border border-border bg-background/70 p-3 text-sm text-muted-foreground">
                  Authentication settings are managed by the active sign-in provider.
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  )
}

function SectionTitle({
  icon: Icon,
  title,
  description,
  complete,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  complete: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <CardTitle className="text-foreground">{title}</CardTitle>
          <CardDescription className="mt-1 text-muted-foreground">{description}</CardDescription>
        </div>
      </div>
      <CompletionPill label={complete ? "Ready" : "Needs setup"} complete={complete} compact />
    </div>
  )
}

function CompletionPill({ label, complete, compact = false }: { label: string; complete: boolean; compact?: boolean }) {
  return (
    <span
      className={[
        "inline-flex items-center justify-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        compact ? "shrink-0" : "",
        complete
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      ].join(" ")}
    >
      {complete ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
      {label}
    </span>
  )
}

function MetricLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-background/70 px-3 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right text-sm font-medium capitalize text-foreground">{value}</span>
    </div>
  )
}
