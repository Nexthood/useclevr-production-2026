import {
  getCheckoutMarketOptions,
  getStripePriceIdForCheckout,
  type BillingInterval,
} from "@/lib/billing/launch-pricing"

type PriceSnapshot = {
  id: string
  active: boolean
  currency: string
  unit_amount: number | null
  recurring: { interval: string } | null
}

type AuditRow = {
  plan: string
  market: string
  interval: BillingInterval
  expected: string
  envPriceId: string
  status: "ok" | "not_configured" | "mismatch"
  detail: string
}

async function main() {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key) {
    console.error("STRIPE_SECRET_KEY is not set. Run this script with the production Stripe key to audit market prices.")
    process.exit(1)
  }

  const { default: Stripe } = await import("stripe")
  const stripe = new Stripe(key, {})

  const rows: AuditRow[] = []

  for (const plan of ["pro", "business"] as const) {
    for (const interval of ["monthly", "yearly"] as BillingInterval[]) {
      for (const option of getCheckoutMarketOptions(plan, interval)) {
        const expectedIntervalName = interval === "yearly" ? "year" : "month"
        const envPriceId = getStripePriceIdForCheckout(plan, option.market, interval)
        const row: AuditRow = {
          plan,
          market: option.market,
          interval,
          expected: `${option.currency} ${option.amountMinor}`,
          envPriceId: envPriceId ?? "(missing)",
          status: "not_configured",
          detail: "",
        }

        if (!envPriceId || option.amountMinor === null) {
          row.detail = "No Stripe Price ID env var is set for this market."
          rows.push(row)
          continue
        }

        const price = (await stripe.prices.retrieve(envPriceId)) as unknown as PriceSnapshot
        const problems: string[] = []
        if (!price.active) problems.push("inactive")
        if (price.recurring?.interval !== expectedIntervalName) {
          problems.push(`interval=${price.recurring?.interval ?? "none"} expected=${expectedIntervalName}`)
        }
        if (price.currency.toLowerCase() !== option.currency.toLowerCase()) {
          problems.push(`currency=${price.currency} expected=${option.currency.toLowerCase()}`)
        }
        if (price.unit_amount !== option.amountMinor) {
          problems.push(`unit_amount=${price.unit_amount} expected=${option.amountMinor}`)
        }

        if (problems.length === 0) {
          row.status = "ok"
          row.detail = `Stripe Price matches ${option.currency} ${option.amountMinor} ${expectedIntervalName}`
        } else {
          row.status = "mismatch"
          row.detail = problems.join("; ")
        }
        rows.push(row)
      }
    }
  }

  console.warn("Audit results:")
  // eslint-disable-next-line no-console -- table output is the script's purpose
  console.table(rows)

  const mismatches = rows.filter((row) => row.status === "mismatch")
  const missing = rows.filter((row) => row.status === "not_configured")

  if (mismatches.length > 0 || missing.length > 0) {
    console.error(
      `Stripe market price audit failed: ${mismatches.length} mismatched, ${missing.length} not configured.`,
    )
    process.exit(1)
  }

  // eslint-disable-next-line no-console -- final pass/fail line is the script's purpose
  console.log("Stripe market price audit passed: every configured market Price matches the app pricing matrix.")
}

main().catch((error: unknown) => {
  console.error("Stripe market price audit crashed:", error)
  process.exit(1)
})
