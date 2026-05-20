import { BillingSettingsForm } from "@/components/billing/billing-settings-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { auth } from "@/lib/auth"
import { getBillingSettings } from "@/lib/billing/settings-store"
import { FREE_ANALYST_CREDITS } from "@/lib/usage/analyst-credits"
import { Settings2, ShieldCheck, SlidersHorizontal, Users, Wrench } from "lucide-react"
import { redirect } from "next/navigation"

const roleLimits = [
  { role: "Free customer", totalCredits: FREE_ANALYST_CREDITS },
  { role: "Pro customer", totalCredits: "Unlimited" },
  { role: "Super admin", totalCredits: "Unlimited" },
]

function ReferralConfigSection({ referralConfig }: { referralConfig: { referralsPerCredit: number; enabled: boolean } }) {
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Settings2 className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold">Referral credit rules</p>
        <span className={`ml-auto inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${referralConfig.enabled ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-slate-500/10 text-slate-600 dark:text-slate-400"}`}>
          {referralConfig.enabled ? "Active" : "Disabled"}
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        {referralConfig.enabled
          ? `Every ${referralConfig.referralsPerCredit} successful ${referralConfig.referralsPerCredit === 1 ? "referral" : "referrals"} earns 1 analyst credit. Configured in Credit Rules.`
          : "Referral credits are currently disabled."}
      </p>
      <div className="flex items-center gap-6 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />Referrals / credit: <strong className="text-foreground">{referralConfig.referralsPerCredit}</strong></span>
        <span>Admins can adjust this in the Credit Rules form below.</span>
      </div>
    </div>
  )
}

export default async function CreditRulesSettingsPage() {
  const session = await auth()

  if (session?.user?.role !== "superadmin") {
    redirect("/app/settings/subscription")
  }

  const billingSettings = await getBillingSettings()

  return (
    <div className="space-y-5">
      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <CardTitle className="text-foreground">Credit Rules</CardTitle>
              <CardDescription className="text-muted-foreground">
                Super admin view for the current dataset credit model.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <p className="text-sm font-medium text-foreground">Current source of truth</p>
            <p className="mt-1 text-sm text-muted-foreground">
              One uploaded dataset counts as one analyst credit. Usage is calculated from the
              number of rows owned by the user in the Dataset table.
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

      <ReferralConfigSection referralConfig={billingSettings.referralConfig} />

      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
              <Wrench className="h-5 w-5 text-cyan-800 dark:text-cyan-100" />
            </div>
            <div>
              <CardTitle className="text-foreground">Hybrid AI and Package Settings</CardTitle>
              <CardDescription className="text-muted-foreground">
                Set Hybrid AI download credit costs and edit plan titles, descriptions, prices, and list items.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <BillingSettingsForm initialSettings={billingSettings} />
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <SlidersHorizontal className="h-5 w-5 text-purple-800 dark:text-purple-100" />
            </div>
            <div>
              <CardTitle className="text-foreground">Role Limits</CardTitle>
              <CardDescription className="text-muted-foreground">
                These values reflect the active hard-coded limits.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border border-border">
            {roleLimits.map((item) => (
              <div
                key={item.role}
                className="grid grid-cols-2 gap-4 border-b border-border px-4 py-3 last:border-b-0"
              >
                <p className="text-sm font-medium text-foreground">{item.role}</p>
                <p className="text-sm text-muted-foreground">{item.totalCredits}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
