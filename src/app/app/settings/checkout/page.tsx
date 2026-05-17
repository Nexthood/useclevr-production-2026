import Link from "next/link"
import { Check, CreditCard, Lock } from "lucide-react"
import { CheckoutConfirmButton } from "@/components/billing/checkout-confirm-button"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatPlanPrice } from "@/lib/billing/plans"
import { getConfiguredBillingPlan } from "@/lib/billing/settings-store"

export default async function SettingsCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; discount?: string }>
}) {
  const params = await searchParams
  const plan = await getConfiguredBillingPlan(params.plan)
  const hasAutoDiscount = params.discount === "auto"

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <p className="text-sm font-semibold text-primary">Checkout</p>
        <CardTitle className="text-2xl">Review your plan</CardTitle>
        <p className="text-sm text-muted-foreground">
          Upgrade, downgrade, or review billing before payment is enabled.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-lg border border-border bg-background p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{plan.name}</h2>
              <span className="text-xl font-semibold">{formatPlanPrice(plan)}</span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{plan.description}</p>

            <div className="mt-5 space-y-2">
              {plan.features.map((feature) => (
                <div key={feature} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            {hasAutoDiscount && (
              <div className="mt-5 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium text-foreground">
                {plan.discountLabel || "Automatic discount checked and applied where available."}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border bg-background p-5">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Payment</h2>
            </div>
            <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/50 p-4">
              <div className="flex items-start gap-3">
                <Lock className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Payment option coming soon</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Your cart and discount are ready. Card payment activates after the payment provider is connected.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <CheckoutConfirmButton planId={plan.id} />
              <Link href="/app/settings/subscription" className="block">
                <Button variant="outline" className="w-full bg-transparent">
                  Back to subscription
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
