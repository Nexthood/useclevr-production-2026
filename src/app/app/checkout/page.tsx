import Link from "next/link"
import { Check, CreditCard, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatPlanPrice, getBillingPlan } from "@/lib/billing/plans"

export default async function AppCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; discount?: string }>
}) {
  const params = await searchParams
  const plan = getBillingPlan(params.plan)
  const hasAutoDiscount = params.discount === "auto"

  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <p className="text-sm font-medium text-primary">Checkout</p>
          <h1 className="text-3xl font-bold tracking-tight">Review your plan</h1>
          <p className="mt-1 text-muted-foreground">
            Upgrade, downgrade, or review billing before payment is enabled.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3">
                <span>{plan.name}</span>
                <span className="text-xl">{formatPlanPrice(plan)}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="text-sm text-muted-foreground">{plan.description}</p>

              <div className="space-y-2">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              {hasAutoDiscount && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-100">
                  {plan.discountLabel || "Automatic discount checked and applied where available."}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4">
                <div className="flex items-start gap-3">
                  <Lock className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Payment option coming soon</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      The cart and discount flow are ready. Payment collection is intentionally disabled until the provider is connected.
                    </p>
                  </div>
                </div>
              </div>

              <Button disabled className="w-full">
                Complete checkout
              </Button>
              <Link href="/app/settings/subscription" className="block">
                <Button variant="outline" className="w-full bg-transparent">
                  Back to subscription
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
