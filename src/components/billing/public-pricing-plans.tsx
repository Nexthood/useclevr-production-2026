"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  checkoutMarkets,
  formatRecurringPrice,
  getCheckoutMarketOptions,
  getCountryFromLocale,
  getMarketForCountry,
  type CheckoutMarket,
  type CheckoutMarketPrice,
  type BillingInterval,
  type SupportedCurrency,
} from "@/lib/billing/launch-pricing"
import { billingPlans, formatPlanPrice, type BillingPlan } from "@/lib/billing/plans"
import { Building2, Check, Sparkles, Zap } from "lucide-react"
import Link from "next/link"
import * as React from "react"

const plans = billingPlans

const planIcon = {
  free: Sparkles,
  pro: Zap,
  business: Building2,
} as const

const ctaLabel: Record<BillingPlan["tier"], string> = {
  free: "Get Started",
  pro: "Upgrade to Pro",
  business: "Upgrade to Business",
}

export function PublicPricingPlans() {
  const [billingInterval, setBillingInterval] = React.useState<BillingInterval>("monthly")
  const [market, setMarket] = React.useState<CheckoutMarket>("eu")

  // Resolve the displayed currency with the same authoritative market logic
  // used by checkout: browser locale → supported billing market.
  React.useEffect(() => {
    const country = getCountryFromLocale(navigator.language)
    if (country) setMarket(getMarketForCountry(country))
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <BillingIntervalSelector selectedBillingInterval={billingInterval} onSelect={setBillingInterval} />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => (
          <PricingCard key={plan.id} plan={plan} billingInterval={billingInterval} market={market} />
        ))}
      </div>
    </div>
  )
}

function PricingCard({ plan, billingInterval, market }: { plan: BillingPlan; billingInterval: BillingInterval; market: CheckoutMarket }) {
  const Icon = planIcon[plan.tier]
  const isPro = plan.tier === "pro"
  const primaryPrice = getPublicPlanPrice(plan, billingInterval, market)
  const href =
    plan.tier === "free"
      ? "/signup"
      : `/app/settings/checkout?plan=${plan.id}&interval=${billingInterval}`

  return (
    <Card
      data-public-pricing-card={plan.tier}
      className={[
        "flex h-full min-w-0 flex-col space-y-5 border-border/50 bg-card p-6",
        isPro ? "relative border-2 border-primary/50 shadow-lg shadow-primary/10" : "",
      ].join(" ")}
    >
      {isPro && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <div className="max-w-[calc(100vw-3rem)] rounded-full bg-primary px-3 py-1 text-center text-xs font-medium leading-tight text-primary-foreground">
            Most Popular
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="mb-1 text-xl font-bold">{plan.name}</h3>
          <p className="text-sm text-muted-foreground">{plan.description}</p>
        </div>
        <RecurringPriceDisplay price={primaryPrice} />
      </div>

      <ul className="flex-1 space-y-2">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span className="text-sm font-medium">{feature}</span>
          </li>
        ))}
      </ul>

      <Link href={href} className="block" prefetch={false}>
        <Button
          variant={isPro ? "default" : "outline"}
          className={isPro ? "min-h-11 w-full whitespace-normal text-center leading-tight" : "min-h-11 w-full whitespace-normal bg-transparent text-center leading-tight"}
        >
          {ctaLabel[plan.tier]}
        </Button>
      </Link>
    </Card>
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

type PublicPriceDisplay = {
  amountText: string
  period: BillingInterval
  amountMinor: number | null
  currency: SupportedCurrency
}

function getPublicPlanPrice(plan: BillingPlan, billingInterval: BillingInterval, market: CheckoutMarket): PublicPriceDisplay {
  if (plan.tier === "free") {
    return {
      amountText: formatPlanPrice(plan, market).replace("/month", ""),
      period: "monthly",
      amountMinor: 0,
      currency: marketCurrency(market),
    };
  }

  const options = getCheckoutMarketOptions(plan.tier, billingInterval)
  const marketOption =
    options.find((option) => option.market === market && option.amountMinor !== null) ??
    options.find((option) => option.amountMinor !== null)
  if (marketOption) {
    return getMarketPriceDisplay(marketOption)
  }

  return {
    amountText: "Unavailable",
    period: billingInterval,
    amountMinor: null,
    currency: "EUR",
  }
}

function marketCurrency(market: CheckoutMarket): SupportedCurrency {
  return checkoutMarkets.find((entry) => entry.market === market)?.currency ?? "EUR"
}

function getMarketPriceDisplay(price: CheckoutMarketPrice): PublicPriceDisplay {
  return {
    amountText: formatCurrencyAmount(price.amountMinor, price.currency),
    period: price.billingInterval,
    amountMinor: price.amountMinor,
    currency: price.currency,
  }
}

function formatCurrencyAmount(amountMinor: number | null, currency: SupportedCurrency) {
  if (amountMinor === null) return "Unavailable"

  return formatRecurringPrice(amountMinor, currency, "monthly").replace("/month", "")
}

function RecurringPriceDisplay({
  price,
}: {
  price: PublicPriceDisplay
}) {
  const periodLabel = price.period === "yearly" ? "year" : "month"
  const ariaLabel =
    price.amountMinor === null
      ? `Unavailable per ${periodLabel}`
      : `${price.amountText} per ${periodLabel}`

  return (
    <div
      className="notranslate flex min-w-0 flex-wrap items-baseline gap-x-1 gap-y-0.5"
      translate="no"
      data-public-price="primary"
      data-price-amount-minor={price.amountMinor ?? undefined}
      data-price-currency={price.currency}
      data-billing-period={price.period}
      aria-label={ariaLabel}
    >
      <span className="max-w-full break-words text-4xl font-bold tracking-tight sm:text-[2.5rem]">
        {price.amountText}
      </span>
      <span className="text-sm text-muted-foreground">/{periodLabel}</span>
    </div>
  )
}
