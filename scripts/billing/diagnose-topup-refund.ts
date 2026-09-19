import Stripe from "stripe"
import { Pool } from "pg"

/**
 * Read-only diagnostic for the refunded-credit-topup investigation.
 * Runs only SELECT queries against the production database and only
 * read/list calls against Stripe. Creates nothing, refunds nothing,
 * changes no balances.
 *
 * Usage: node -r tsx/esm scripts/billing/diagnose-topup-refund.ts
 * (env loaded from .env by scripts/runtime/load-env.cjs)
 */

const stripeKey = process.env.STRIPE_SECRET_KEY
if (!stripeKey) {
  console.error("STRIPE_SECRET_KEY is not set")
  process.exit(1)
}
const stripe = new Stripe(stripeKey, {})

async function checkStripeWebhookEndpoints() {
  console.log("=== Stripe webhook endpoints (read-only) ===")
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 })
  for (const ep of endpoints.data) {
    console.log(`endpoint: ${ep.id} url=${ep.url} active=${ep.status === "enabled"}`)
    console.log(`  subscribed events: ${ep.enabled_events.join(", ")}`)
    console.log(`  charge.refunded subscribed: ${ep.enabled_events.includes("charge.refunded")}`)
  }
  if (endpoints.data.length === 0) {
    console.log("NO webhook endpoints configured on this Stripe account")
  }
}

async function checkRefundEvents() {
  console.log("\n=== Recent charge.refunded events (Stripe, read-only) ===")
  const events = await stripe.events.list({ type: "charge.refunded", limit: 10 })
  console.log(`count in latest window: ${events.data.length}`)
  for (const event of events.data) {
    const charge = event.data.object as Stripe.Charge
    const refunds = charge.refunds?.data ?? []
    console.log(`event ${event.id} created=${new Date(event.created * 1000).toISOString()} live=${!!event.livemode}`)
    console.log(`  charge=${charge.id} payment_intent=${charge.payment_intent} amount=${charge.amount} refunded=${charge.amount_refunded} status=${charge.status}`)
    for (const r of refunds) {
      console.log(`  refund ${r.id} amount=${r.amount} status=${r.status} created=${new Date(r.created * 1000).toISOString()}`)
    }
    if (typeof charge.payment_intent === "string") {
      try {
        const pi = await stripe.paymentIntents.retrieve(charge.payment_intent)
        console.log(`  payment_intent created=${new Date(pi.created * 1000).toISOString()} amount=${pi.amount} amount_received=${pi.amount_received} status=${pi.status}`)
      } catch (err) {
        console.log(`  payment_intent retrieve failed: ${err instanceof Error ? err.message : err}`)
      }
    }
  }
}

async function checkGrantEvents() {
  console.log("\n=== Recent checkout.session.completed events (Stripe, read-only) ===")
  const events = await stripe.events.list({ type: "checkout.session.completed", limit: 20 })
  for (const event of events.data) {
    const session = event.data.object as Stripe.Checkout.Session
    console.log(
      `event ${event.id} created=${new Date(event.created * 1000).toISOString()} session=${session.id} ` +
      `pi=${typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id} ` +
      `amount=${session.amount_total} mode=${session.mode} status=${session.payment_status}`,
    )
  }
}

async function checkDatabase() {
  console.log("\n=== Production database (read-only SELECTs) ===")
  const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.DIRECT_URL, max: 1 })
  try {
    const topups = await pool.query(
      `SELECT id, "userId", provider, "providerPaymentId", "providerCheckoutId", currency, "amountMinor",
              "creditsGranted", "creditPackageId", status, "ledgerEntryId", metadata, "createdAt", "updatedAt"
       FROM "CreditTopUp" ORDER BY "createdAt" DESC LIMIT 20`,
    )
    console.log(`CreditTopUp rows (latest 20): ${topups.rows.length}`)
    for (const row of topups.rows) {
      const meta = typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata
      console.log(
        `  ${row.id} user=${row.userId} pkg=${row.creditPackageId} status=${row.status} credits=${row.creditsGranted} ` +
        `amount=${row.amountMinor} ${row.currency} payment=${row.providerPaymentId} ledger=${row.ledgerEntryId} ` +
        `created=${row.createdAt?.toISOString?.() ?? row.createdAt} updated=${row.updatedAt?.toISOString?.() ?? row.updatedAt}` +
        (meta?.refundedCredits != null ? ` refundedCredits=${meta.refundedCredits}` : ""),
      )
    }

    const refundLedger = await pool.query(
      `SELECT id, "userId", type, "transactionType", status, "idempotencyKey", amount, credits,
              "monetaryAmount", currency, "providerTransactionId", "paymentProvider", description, "createdAt"
       FROM "CreditLedger"
       WHERE "transactionType" = 'REFUND' OR type = 'refund'
       ORDER BY "createdAt" DESC LIMIT 20`,
    )
    console.log(`\nREFUND ledger rows (latest 20): ${refundLedger.rows.length}`)
    for (const row of refundLedger.rows) {
      console.log(
        `${row.id} user=${row.userId} type=${row.type}/${row.transactionType} status=${row.status} ` +
        `amount=${row.amount} monetary=${row.monetaryAmount} ${row.currency} key=${row.idempotencyKey} ` +
        `payment=${row.providerTransactionId} created=${row.createdAt?.toISOString?.() ?? row.createdAt}`,
      )
    }

    const userIds = [...new Set(topups.rows.map((r) => r.userId))]
    if (userIds.length > 0) {
      const balances = await pool.query(
        `SELECT "userId", "includedBalance", "purchasedBalance", "remainingCredits", "totalPaidCents", "lifetimeCreditsEarned", "updatedAt"
         FROM "UserCredit" WHERE "userId" = ANY($1::text[])`,
        [userIds],
      )
      console.log("\nUserCredit balances for top-up users:")
      for (const row of balances.rows) {
        console.log(
          `user=${row.userId} included=${row.includedBalance} purchased=${row.purchasedBalance} ` +
          `remaining=${row.remainingCredits} totalPaidCents=${row.totalPaidCents} lifetime=${row.lifetimeCreditsEarned} ` +
          `updated=${row.updatedAt?.toISOString?.() ?? row.updatedAt}`,
        )
      }
    }

    const topupLedger = await pool.query(
      `SELECT id, "userId", "idempotencyKey", "transactionType", status, amount, "monetaryAmount", currency, "providerTransactionId", "createdAt"
       FROM "CreditLedger" WHERE "transactionType" = 'TOP_UP_PURCHASE' ORDER BY "createdAt" DESC LIMIT 10`,
    )
    console.log(`\nTOP_UP_PURCHASE ledger rows (latest 10): ${topupLedger.rows.length}`)
    for (const row of topupLedger.rows) {
      console.log(
        `${row.id} user=${row.userId} status=${row.status} amount=${row.amount} monetary=${row.monetaryAmount} ` +
        `${row.currency} payment=${row.providerTransactionId} key=${row.idempotencyKey} created=${row.createdAt?.toISOString?.() ?? row.createdAt}`,
      )
    }
  } finally {
    await pool.end()
  }
}

void (async () => {
  await checkStripeWebhookEndpoints()
  await checkRefundEvents()
  await checkGrantEvents()
  await checkDatabase()
})()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[diagnose] Error:", err instanceof Error ? err.stack || err.message : err)
    process.exit(1)
  })
