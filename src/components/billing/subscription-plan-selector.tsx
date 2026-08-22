"use client"

import { Button } from "@/components/ui/button"
import {
  formatRecurringPrice,
  getCheckoutMarketOptions,
  type BillingInterval,
} from "@/lib/billing/launch-pricing"
import { formatPlanPrice, type BillingPlan } from "@/lib/billing/plans"
import Link from "next/link"
import * as React from "react"

export function SubscriptionPlanSelector({
  plans,
  currentTier,
  currentPlanLabel,
}: {
  plans: BillingPlan[]
  currentTier: string
  currentPlanLabel: string
}) {
  const [billingInterval, setBillingInterval] = React.useState<BillingInterval>("monthly")

  return (
    <div className="space-y-4">
      <div className="flex justify-start">
        <BillingIntervalSelector selectedBillingInterval={billingInterval} onSelect={setBillingInterval} />
      </div>
      <div className="grid min-w-0 gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent =
            (plan.tier === "free" && currentPlanLabel === "Free") ||
            (plan.tier === "pro" && currentTier === "pro") ||
            (plan.tier === "business" && currentTier === "business")
          const href =
            plan.tier === "free"
              ? `/app/settings/checkout?plan=${plan.id}`
              : `/app/settings/checkout?plan=${plan.id}&interval=${billingInterval}`

          return (
            <div key={plan.id} className="min-w-0 rounded-lg border border-border bg-background p-4">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{plan.name}</p>
                  <p className="break-words text-sm text-muted-foreground">
                    {formatSubscriptionPlanPrice(plan, billingInterval)}
                  </p>
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
                <Link href={href}>
                  <Button
                    size="sm"
                    variant={plan.tier === "free" ? "outline" : "default"}
                    className={plan.tier === "free" ? "mt-4 w-full bg-transparent" : "mt-4 w-full"}
                  >
                    {plan.tier === "free" ? "Downgrade" : "Review change"}
                  </Button>
                </Link>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BillingIntervalSelector({
  selectedBillingInterval,
  onSelect,
}: {
  selectedBillingInterval: BillingInterval
  onSelect: (billingInterval: BillingInterval) => void
}) {
  return (
    <div className="inline-flex w-full rounded-lg border border-border bg-muted/40 p-1 sm:w-auto" role="group" aria-label="Billing interval">
      {(["monthly", "yearly"] as BillingInterval[]).map((billingInterval) => {
        const selected = billingInterval === selectedBillingInterval
        return (
          <button
            key={billingInterval}
            type="button"
            onClick={() => onSelect(billingInterval)}
            className={[
              "min-h-10 flex-1 rounded-md px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-w-28",
              selected ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
            ].join(" ")}
            aria-pressed={selected}
          >
            {billingInterval === "yearly" ? "Yearly" : "Monthly"}
          </button>
        )
      })}
    </div>
  )
}

function formatSubscriptionPlanPrice(plan: BillingPlan, billingInterval: BillingInterval) {
  if (plan.tier === "free") return formatPlanPrice(plan)
  const market = getCheckoutMarketOptions(plan.tier, billingInterval).find((option) => option.market === "eu")
  if (market?.amountMinor !== null && market?.amountMinor !== undefined) {
    return formatRecurringPrice(market.amountMinor, market.currency, billingInterval)
  }
  return formatPlanPrice(plan)
}
