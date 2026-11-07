import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { profiles } from "@/lib/db/schema";
import { database, ingestPartnerEvent, updatePartnerSubscription } from "@/lib/partners/store";
import type { FinancialEvidence } from "@/lib/partners/store";

const stripeId = (v: string | { id?: string } | null | undefined) =>
  typeof v === "string" ? v : v?.id;

/** Called exclusively after raw-body Stripe signature verification. No money movement. */
export async function handlePartnerStripeEvent(event: Stripe.Event, stripe: Stripe) {
  // Operators enable this gate only after applying the additive migration.
  if (process.env.PARTNER_PROGRAM_ENABLED !== "true") return;
  const objectId = (event.data.object as { id: string }).id;
  if (event.type.startsWith("customer.subscription.")) {
    const sub =
      event.type === "customer.subscription.deleted"
        ? (event.data.object as Stripe.Subscription)
        : await stripe.subscriptions.retrieve(objectId);
    const user = await customerUser(stripeId(sub.customer));
    if (user)
      await updatePartnerSubscription({
        id: sub.id,
        userId: user,
        status: sub.status,
        periodEnd: new Date(sub.current_period_end * 1000),
        eventCreated: event.created,
        canceled: sub.status === "canceled",
      });
    return;
  }
  if (event.type === "invoice.payment_succeeded" || event.type === "invoice.paid") {
    const invoice = await stripe.invoices.retrieve(objectId);
    const evidence = await invoiceEvidence(invoice, stripe);
    if (evidence.kind === "payment")
      await updatePartnerSubscription({
        id: evidence.payment.subscriptionId,
        userId: evidence.payment.userId,
        status: evidence.payment.subscriptionStatus,
        periodEnd: new Date(evidence.payment.subscriptionPeriodEnd),
        eventCreated: Math.floor(Date.now() / 1000),
        canceled: evidence.payment.subscriptionStatus === "canceled",
      });
    const result = await ingestPartnerEvent(event.id, event.type, objectId, evidence);
    if (evidence.kind === "payment" && result.status === "processed") {
      const adjustment = await chargeAdjustment(evidence.payment.chargeId, stripe);
      await ingestPartnerEvent(
        `${event.id}:reconcile`,
        "payment.reconciliation",
        evidence.payment.chargeId,
        adjustment,
      );
    }
    return;
  }
  if (
    event.type === "charge.refunded" ||
    event.type.startsWith("charge.dispute.") ||
    event.type === "refund.updated" ||
    event.type === "refund.failed"
  ) {
    const obj = event.data.object as unknown as { id: string; charge?: string | { id: string } };
    const chargeId = event.type === "charge.refunded" ? obj.id : stripeId(obj.charge);
    if (chargeId)
      await ingestPartnerEvent(
        event.id,
        event.type,
        chargeId,
        await chargeAdjustment(chargeId, stripe),
      );
  }
}

async function customerUser(customerId?: string) {
  if (!customerId) return null;
  const matches = await database().query.profiles.findMany({
    where: eq(profiles.stripeCustomerId, customerId),
    columns: { userId: true },
    limit: 2,
  });
  if (matches.length !== 1) return null;
  return matches[0].userId;
}

export async function invoiceEvidence(
  invoice: Stripe.Invoice,
  stripe: Stripe,
): Promise<FinancialEvidence> {
  const unsupported = (reason: string): FinancialEvidence => ({ kind: "unsupported", reason });
  if (
    !invoice.id ||
    invoice.status !== "paid" ||
    !invoice.paid ||
    invoice.paid_out_of_band ||
    invoice.amount_paid <= 0
  )
    return unsupported("excluded:not_collected_payment");
  const chargeId = stripeId(invoice.charge),
    subscriptionId = stripeId(invoice.subscription),
    customerId = stripeId(invoice.customer);
  if (!chargeId || !subscriptionId || !customerId)
    return unsupported("unsupported_invoice_payment_shape");
  const charge = await stripe.charges.retrieve(chargeId);
  if (
    !charge.paid ||
    !charge.captured ||
    charge.status !== "succeeded" ||
    stripeId(charge.invoice) !== invoice.id ||
    stripeId(charge.customer) !== customerId
  )
    return unsupported("unverified_charge");
  // Mixed customer-balance/partial collections require explicit allocation, never an invented net amount.
  if (
    !Number.isSafeInteger(charge.amount) ||
    charge.amount !== invoice.amount_paid ||
    invoice.amount_paid !== invoice.total ||
    charge.currency !== invoice.currency ||
    invoice.total_excluding_tax === null
  )
    return unsupported("complex_collection_requires_review");
  const net = invoice.total_excluding_tax;
  if (!Number.isSafeInteger(net) || net < 0 || net > charge.amount)
    return unsupported("invalid_net_revenue");
  const userId = await customerUser(customerId);
  if (!userId) return unsupported("customer_mapping_requires_review");
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  if (
    stripeId(sub.customer) !== customerId ||
    (sub.metadata?.userId && sub.metadata.userId !== userId)
  )
    return unsupported("subscription_owner_mismatch");
  const paidAt = invoice.status_transitions.paid_at;
  if (!paidAt) return unsupported("payment_timestamp_missing");
  return {
    kind: "payment",
    payment: {
      invoiceId: invoice.id,
      chargeId,
      subscriptionId,
      customerId,
      userId,
      currency: invoice.currency.toUpperCase(),
      grossMinor: String(charge.amount),
      netMinor: String(net),
      paidAt: new Date(paidAt * 1000).toISOString(),
      subscriptionStatus: sub.status,
      subscriptionPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
    },
  };
}

async function chargeAdjustment(chargeId: string, stripe: Stripe): Promise<FinancialEvidence> {
  const charge = await stripe.charges.retrieve(chargeId);
  let refunds = 0;
  for await (const refund of stripe.refunds.list({ charge: chargeId, limit: 100 }))
    if (refund.status === "succeeded") refunds += refund.amount;
  let disputed = 0;
  for await (const dispute of stripe.disputes.list({ charge: chargeId, limit: 100 })) {
    if (
      dispute.status !== "won" &&
      dispute.status !== "warning_closed" &&
      dispute.status !== "warning_needs_response" &&
      dispute.status !== "warning_under_review"
    )
      disputed += dispute.amount;
  }
  if (!Number.isSafeInteger(refunds) || !Number.isSafeInteger(disputed) || charge.amount <= 0)
    return { kind: "unsupported", reason: "invalid_adjustment_amounts" };
  return {
    kind: "adjustment",
    chargeId,
    refundedGrossMinor: String(refunds),
    disputedGrossMinor: String(disputed),
    observedAt: new Date().toISOString(),
  };
}
