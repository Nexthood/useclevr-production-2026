import { getDb } from "@/lib/db/index";
import { profiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import Stripe from "stripe";

let _stripe: Stripe | null = null;

function _getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }
  _stripe = new Stripe(key);
  return _stripe;
}

type _SubscriptionEventType =
  | "customer.subscription.created"
  | "customer.subscription.updated"
  | "customer.subscription.deleted";

const SUBSCRIPTION_EVENTS: ReadonlySet<string> = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

export async function handleSubscriptionEvent(
  event: Stripe.Event,
): Promise<{ synced: boolean; reason?: string }> {
  if (!SUBSCRIPTION_EVENTS.has(event.type)) {
    return { synced: false, reason: `Unhandled event type: ${event.type}` };
  }

  const sub = event.data.object as Stripe.Subscription;

  // Guard against null customer (defensive — Stripe never sends null here for
  // subscription events, but the typeof check alone would pass through `null`
  // and then throw on `.id`).
  if (sub.customer == null) {
    return { synced: false, reason: "Subscription event has no customer ID." };
  }

  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  const priceId = sub.items.data[0]?.price.id ?? null;
  const status = sub.status;
  const currentPeriodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;

  const activeDb = getDb();
  if (!activeDb) {
    return { synced: false, reason: "Database unavailable." };
  }

  const existing = await activeDb.query.profiles.findFirst({
    where: eq(profiles.stripeCustomerId, customerId),
  });

  if (!existing) {
    return { synced: false, reason: `No profile for customer ${customerId}` };
  }

  const updates: Record<string, unknown> = {
    stripeStatus: status,
    updatedAt: new Date(),
  };
  if (priceId) updates.stripePriceId = priceId;
  if (currentPeriodEnd) updates.stripeCurrentPeriodEnd = currentPeriodEnd;

  const idFromExisting = (existing as Record<string, unknown>).id as string;

  await activeDb.update(profiles).set(updates).where(eq(profiles.id, idFromExisting));

  return { synced: true };
}
