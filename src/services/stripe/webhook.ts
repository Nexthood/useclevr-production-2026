import { v4 as uuidv4 } from "uuid";
import { getDb } from "@/lib/db/index";
import { recordActivity } from "@/lib/activity/activity-store";
import { billingPlans } from "@/lib/billing/plans";
import { profiles, users } from "@/lib/db/schema";
import { eq, or } from "drizzle-orm";
import Stripe from "stripe";

let _stripe: Stripe | null = null;

function _getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }
  _stripe = new Stripe(key, {});
  return _stripe;
}

type _SubscriptionEventType =
  | "customer.subscription.created"
  | "customer.subscription.updated"
  | "customer.subscription.deleted";

const SUBSCRIPTION_EVENTS: ReadonlySet<string> = new Set([
  "checkout.session.completed",
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

  if (event.type === "checkout.session.completed") {
    return syncCheckoutSession(event.data.object as Stripe.Checkout.Session);
  }

  const sub = event.data.object as Stripe.Subscription;
  return syncSubscription(sub, event.type);
}

async function syncCheckoutSession(
  session: Stripe.Checkout.Session,
): Promise<{ synced: boolean; reason?: string }> {
  if (session.mode !== "subscription") {
    return { synced: false, reason: `Checkout mode is ${session.mode || "unknown"}.` };
  }

  const customerId = getStripeId(session.customer);
  const subscriptionId = getStripeId(session.subscription);
  const userId = session.client_reference_id || session.metadata?.userId || null;
  const userEmail =
    session.customer_details?.email || session.customer_email || session.metadata?.userEmail || null;

  if (!customerId) {
    return { synced: false, reason: "Checkout session has no customer ID." };
  }

  const activeDb = getDb();
  if (!activeDb) {
    return { synced: false, reason: "Database unavailable." };
  }

  const updates: Record<string, unknown> = {
    stripeCustomerId: customerId,
    updatedAt: new Date(),
  };

  if (subscriptionId) {
    updates.stripeSubscriptionId = subscriptionId;
  }

  let stripeSubscription: Stripe.Subscription | null = null;
  if (subscriptionId) {
    stripeSubscription = await _getStripe().subscriptions.retrieve(subscriptionId);
    applySubscriptionUpdates(updates, stripeSubscription);
  }

  const profile = await findProfileForStripeCustomer({
    customerId,
    userId,
    userEmail,
  });

  if (!profile) {
    if (!userId) {
      return { synced: false, reason: `No profile for Stripe customer ${customerId}.` };
    }

    const user = await activeDb.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (!user) {
      return { synced: false, reason: `No user for checkout reference ${userId}.` };
    }

    await activeDb.insert(profiles).values({
      id: `profile_${uuidv4()}`,
      userId,
      email: userEmail || user.email,
      fullName: user.name,
      ...(updates as {
        stripeCustomerId?: string;
        stripeSubscriptionId?: string;
        stripePriceId?: string;
        stripeStatus?: string;
        stripeCurrentPeriodEnd?: Date;
        subscriptionTier?: "free" | "pro" | "business";
      }),
    });
  } else {
    await activeDb.update(profiles).set(updates).where(eq(profiles.id, profile.id));
  }

  const activityUserId = userId || profile?.userId;
  if (!activityUserId) {
    return { synced: true };
  }

  await recordActivity({
    userId: activityUserId,
    userEmail: userEmail || profile?.email,
    type: "subscribed",
    feature: "subscription",
    title: "Checkout completed",
    description: stripeSubscription
      ? `Subscription status is ${stripeSubscription.status}.`
      : "Stripe checkout completed.",
    metadata: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      stripeSessionId: session.id,
    },
  });

  return { synced: true };
}

async function syncSubscription(
  sub: Stripe.Subscription,
  eventType: string,
): Promise<{ synced: boolean; reason?: string }> {

  // Guard against null customer (defensive — Stripe never sends null here for
  // subscription events, but the typeof check alone would pass through `null`
  // and then throw on `.id`).
  if (sub.customer == null) {
    return { synced: false, reason: "Subscription event has no customer ID." };
  }

  const customerId = getStripeId(sub.customer);
  if (!customerId) {
    return { synced: false, reason: "Subscription event has no customer ID." };
  }

  const status = sub.status;
  const userId = sub.metadata?.userId || null;
  const userEmail = sub.metadata?.userEmail || null;

  const activeDb = getDb();
  if (!activeDb) {
    return { synced: false, reason: "Database unavailable." };
  }

  const existing = await findProfileForStripeCustomer({
    customerId,
    userId,
    userEmail,
  });

  if (!existing) {
    return { synced: false, reason: `No profile for customer ${customerId}` };
  }

  const updates: Record<string, unknown> = {
    stripeCustomerId: customerId,
    stripeSubscriptionId: sub.id,
    stripeStatus: status,
    updatedAt: new Date(),
  };
  applySubscriptionUpdates(updates, sub);

  const idFromExisting = (existing as Record<string, unknown>).id as string;

  await activeDb.update(profiles).set(updates).where(eq(profiles.id, idFromExisting));

  await recordActivity({
    userId: existing.userId,
    userEmail: existing.email,
    type: "subscribed",
    feature: "subscription",
    title: getSubscriptionActivityTitle(eventType),
    description: `Subscription status is ${status}.`,
    metadata: {
      stripeStatus: status,
      stripePriceId: updates.stripePriceId ?? null,
      stripeSubscriptionId: sub.id,
    },
  });

  return { synced: true };
}

type ProfileMatchInput = {
  customerId: string;
  userId?: string | null;
  userEmail?: string | null;
};

async function findProfileForStripeCustomer({ customerId, userId, userEmail }: ProfileMatchInput) {
  const activeDb = getDb();
  if (!activeDb) return null;

  const clauses = [eq(profiles.stripeCustomerId, customerId)];
  if (userId) clauses.push(eq(profiles.userId, userId));
  if (userEmail) clauses.push(eq(profiles.email, userEmail));

  return activeDb.query.profiles.findFirst({
    where: clauses.length === 1 ? clauses[0] : or(...clauses),
  });
}

function applySubscriptionUpdates(updates: Record<string, unknown>, sub: Stripe.Subscription) {
  const priceId = sub.items.data[0]?.price.id ?? null;
  const currentPeriodEnd =
    "current_period_end" in sub && typeof sub.current_period_end === "number"
      ? new Date(sub.current_period_end * 1000)
      : null;

  updates.stripeStatus = sub.status;
  if (priceId) {
    updates.stripePriceId = priceId;
    const subscriptionTier = getSubscriptionTierForPrice(priceId);
    if (subscriptionTier) {
      updates.subscriptionTier = subscriptionTier;
    }
  }
  if (sub.status === "canceled" || sub.status === "incomplete_expired" || sub.status === "unpaid") {
    updates.subscriptionTier = "free";
  }
  if (currentPeriodEnd) updates.stripeCurrentPeriodEnd = currentPeriodEnd;
}

function getSubscriptionTierForPrice(priceId: string) {
  return billingPlans.find((plan) => plan.stripePriceId === priceId)?.tier ?? null;
}

function getStripeId(value: string | { id?: string } | null): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id || null;
}

function getSubscriptionActivityTitle(eventType: string) {
  if (eventType === "customer.subscription.deleted") return "Subscription ended";
  if (eventType === "customer.subscription.updated") return "Subscription updated";
  return "Subscription started";
}
