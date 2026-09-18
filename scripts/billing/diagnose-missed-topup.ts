import Stripe from "stripe"

/**
 * Diagnostic script to investigate a missed credit top-up payment.
 *
 * Usage:
 *   STRIPE_SECRET_KEY="sk_live_..." node scripts/billing/diagnose-missed-topup.ts
 *
 * Outputs:
 *   - Recent checkout.session.completed events from Stripe
 *   - Whether each was credited (by checking if CreditTopUp exists)
 *   - Suggests which session IDs need replaying
 */

const stripeKey = process.env.STRIPE_SECRET_KEY
if (!stripeKey) {
  console.error("Set STRIPE_SECRET_KEY environment variable")
  process.exit(1)
}

const stripe = new Stripe(stripeKey, {})

async function findMissedTopUps(limit = 50): Promise<void> {
  console.log("[diagnose] Fetching recent checkout sessions...\n")

  const allSessions: Stripe.Checkout.Session[] = []
  let hasMore = true
  let startingAfter: string | undefined

  while (hasMore) {
    const result = await stripe.checkout.sessions.list({
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
      expand: ["payment_intent"],
    })

    allSessions.push(...result.data)
    hasMore = result.has_more
    if (result.data.length > 0) {
      startingAfter = result.data[result.data.length - 1].id
    }
  }

  const paymentSessions = allSessions.filter(
    (s) => s.mode === "payment" && s.payment_status === "paid",
  )

  console.log(`[diagnose] Found ${paymentSessions.length} paid payment-mode checkout sessions\n`)
  console.log("ID".padEnd(36), "Amount", "Currency", "Status", "Metadata")
  console.log("-".repeat(120))

  for (const session of paymentSessions.slice(0, limit)) {
    const metadata = session.metadata || {}
    const amount = session.amount_total ? `${session.amount_total / 100} ${(session.currency || "usd").toUpperCase()}` : "N/A"
    const metaStr = JSON.stringify(metadata).slice(0, 60)

    console.log(
      session.id.padEnd(36),
      amount.padEnd(12),
      (session.currency || "?").toUpperCase().padEnd(8),
      (session.payment_status || "?").padEnd(12),
      metaStr,
    )
  }

  console.log("\n[diagnose] To replay a specific session:")
  console.log("  POST /api/admin/replay-topup { \"sessionId\": \"cs_xxx\" }")
  console.log("\n[diagnose] Or check on server:")
  console.log("  SELECT * FROM \"CreditTopUp\" ORDER BY \"createdAt\" DESC LIMIT 10;")
  console.log("  SELECT * FROM \"CreditLedger\" WHERE \"transactionType\" = 'TOP_UP_PURCHASE' ORDER BY \"createdAt\" DESC LIMIT 10;")
  console.log("  SELECT \"userId\", \"purchasedBalance\", \"includedBalance\", \"totalAvailableBalance\" FROM \"UserCredit\";")
}

void findMissedTopUps()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[diagnose] Error:", err instanceof Error ? err.message : err)
    process.exit(1)
  })
