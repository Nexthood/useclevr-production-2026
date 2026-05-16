import Link from "next/link"
import { Check, CreditCard, Sparkles } from "lucide-react"
import { CheckoutButton } from "@/components/forms/checkout-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatPlanPrice } from "@/lib/billing/plans"
import { getBillingSettings } from "@/lib/billing/settings-store"
import { auth } from "@/lib/auth"
import { getAnalystCreditUsage } from "@/lib/usage/analyst-credits"

export default async function SubscriptionSettingsPage() {
  const session = await auth()
  const usage = await getAnalystCreditUsage(session?.user?.id)
  const billingSettings = await getBillingSettings()
  const remaining = Math.max(0, usage.total - usage.analysisCount)
  const isUnlimited = usage.subscriptionTier === "pro" || usage.subscriptionTier === "superadmin"

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
            <CreditCard className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-foreground">Subscription</CardTitle>
            <CardDescription className="text-muted-foreground">Manage your plan and billing.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
          <div>
            <p className="font-medium text-foreground">Current plan</p>
            <p className="text-sm text-muted-foreground">
              {usage.subscriptionTier === "superadmin" ? "Super admin" : isUnlimited ? "Pro tier" : "Free tier"}
            </p>
          </div>
          {!isUnlimited && (
            <Link href="/app/checkout?plan=pro_monthly&discount=auto">
              <Button variant="outline" size="sm">Upgrade</Button>
            </Link>
          )}
        </div>
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-md bg-primary/15 p-2 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="font-medium text-foreground">Analyst credits</p>
              <p className="text-sm text-muted-foreground">
                {isUnlimited ? "Unlimited analyst usage" : `${usage.analysisCount} / ${usage.total} free credits used`}
              </p>
              {!isUnlimited && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {usage.limitReached
                    ? "Free credits are used. Subscribe to Pro or top up to continue analysis."
                    : `${remaining} free ${remaining === 1 ? "credit" : "credits"} remaining.`}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="grid gap-3 pt-2 lg:grid-cols-3">
          {billingSettings.plans.filter((plan) => plan.id !== "pro_annual").map((plan) => {
            const isCurrent =
              (plan.tier === "free" && !isUnlimited) ||
              (plan.tier === "pro" && usage.subscriptionTier === "pro") ||
              (plan.tier === "business" && usage.subscriptionTier === "business")

            return (
              <div key={plan.id} className="rounded-lg border border-border bg-background p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{plan.name}</p>
                    <p className="text-sm text-muted-foreground">{formatPlanPrice(plan)}</p>
                  </div>
                  {isCurrent && (
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-300">
                      Current
                    </span>
                  )}
                </div>
                <ul className="mt-3 space-y-1.5">
                  {plan.features.slice(0, 3).map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <Button disabled size="sm" variant="outline" className="mt-4 w-full bg-transparent">
                    Active plan
                  </Button>
                ) : (
                  <CheckoutButton
                    productId={plan.id}
                    size="sm"
                    variant={plan.tier === "free" ? "outline" : "default"}
                    className={plan.tier === "free" ? "mt-4 w-full bg-transparent" : "mt-4 w-full"}
                  >
                    {plan.tier === "free" ? "Downgrade" : "Review change"}
                  </CheckoutButton>
                )}
              </div>
            )
          })}
        </div>
        <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          Annual Pro discounts are applied automatically in checkout. If a payment provider is not connected, checkout saves a review instead of collecting a card.
        </div>
      </CardContent>
    </Card>
  )
}
