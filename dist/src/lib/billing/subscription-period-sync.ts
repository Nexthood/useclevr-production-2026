import "server-only";

import { debugError } from "@/lib/utils/debug";

/**
 * Stripe-authoritative reconciliation for expired subscription periods.
 *
 * The webhook lifecycle (`customer.subscription.updated/deleted`) is the
 * primary downgrade path. When such an event is missed (Stripe outage,
 * failed delivery), the locally stored `stripeCurrentPeriodEnd` passes while
 * the profile still holds a paid tier — and the next monthly credit reset
 * would keep granting paid included credits forever.
 *
 * This helper closes that gap without creating a parallel local billing
 * truth: it runs only when the stored Stripe period end is in the past AND
 * the profile still resolves to a paid tier, then asks Stripe for the
 * authoritative subscription state and applies it through the standard
 * `syncSubscription` path (which also runs the credit lifecycle plan change).
 *
 *   - Stripe still has an active/trialing subscription → the subscription
 *     renewed (or the period end is stale): its current state is applied,
 *     refreshing tier, status, and period end.
 *   - Stripe has no active/trialing subscription → the paid entitlement has
 *     ended: the most recent subscription's authoritative state (terminal
 *     status or deleted) is applied and the account downgrades to Free.
 *     Purchased credits survive; only included plan credits reset.
 *
 * Errors are logged and swallowed — reconciliation must never break the
 * read path it heals. It is naturally idempotent: once the tier is Free or
 * Stripe reports a live period, the guard no longer fires.
 */
export async function reconcileExpiredSubscriptionPeriod(userId: string): Promise<void> {
  try {
    const { getDb } = await import("@/lib/db");
    const { profiles } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");

    const db = getDb();
    if (!db) return;

    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, userId),
      columns: {
        subscriptionTier: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        stripeStatus: true,
        stripeCurrentPeriodEnd: true,
      },
    });

    if (!profile) return;

    const tier = profile.subscriptionTier;
    if (tier !== "pro" && tier !== "business") return;

    const periodEnd = profile.stripeCurrentPeriodEnd;
    if (!periodEnd || periodEnd.getTime() > Date.now()) return;
    if (periodEnd.getTime() < Date.now() - 3 * 365 * 24 * 3600 * 1000) return;

    const customerId = profile.stripeCustomerId;
    if (!customerId) return;

    const [
      { listStripeCustomerSubscriptions, retrieveStripeSubscription },
      { syncSubscription },
    ] = await Promise.all([
      import("@/services/stripe/checkout"),
      import("@/services/stripe/webhook"),
    ]);

    let newest: Awaited<ReturnType<typeof listStripeCustomerSubscriptions>>[number] | null = null;

    try {
      const subscriptions = await listStripeCustomerSubscriptions(customerId);
      newest = subscriptions[0] ?? null;
      const activeSubscription =
        subscriptions.find((sub) => sub.status === "active" || sub.status === "trialing") ?? null;

      if (activeSubscription) {
        // A paid entitlement still exists in Stripe (renewal webhook missed).
        // Re-sync from the authoritative object; never invent a downgrade.
        await syncSubscription(activeSubscription, "subscription_period_recovery", userId);
        return;
      }

      // No live entitlement. Confirm the locally linked subscription is really
      // gone/terminated at Stripe before downgrading.
      const linkedId = profile.stripeSubscriptionId;
      if (linkedId) {
        try {
          const linked = await retrieveStripeSubscription(linkedId);
          newest = linked;
        } catch {
          // Linked subscription no longer retrievable — treat as terminated.
        }
      }
    } catch (stripeError) {
      debugError("[SUBSCRIPTION_PERIOD_SYNC] stripe_lookup_failed", {
        userId,
        customerId,
        error: stripeError instanceof Error ? stripeError.message : String(stripeError),
      });
      return;
    }

    const terminatedSubscription = newest
      ? { ...newest, status: "canceled" as const }
      : {
          id: profile.stripeSubscriptionId || "reconciled",
          customer: customerId,
          status: "canceled" as const,
          cancel_at_period_end: false,
          current_period_end: Math.floor(Date.now() / 1000),
          items: { data: [{ price: { id: null } }] },
          metadata: {},
        };

    console.warn("[SUBSCRIPTION_PERIOD_SYNC] expired_period_downgrade", {
      userId,
      previousTier: tier,
      storedPeriodEnd: periodEnd.toISOString(),
      stripeSubscriptionId: newest?.id ?? null,
    });

    await syncSubscription(
      terminatedSubscription as Parameters<typeof syncSubscription>[0],
      "customer.subscription.deleted",
      userId,
    );
  } catch (error) {
    debugError("[SUBSCRIPTION_PERIOD_SYNC] reconciliation_failed", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
