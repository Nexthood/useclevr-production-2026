import { v4 as uuidv4 } from "uuid";
import { getDb } from "@/lib/db/index";
import { recordActivity } from "@/lib/activity/activity-store";
import { processPlanChange } from "@/lib/billing/credit-engine";
import { getSubscriptionTierForStripePriceId } from "@/lib/billing/launch-pricing";
import { profiles, users } from "@/lib/db/schema";
import { eq, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
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

type SubscriptionTier = "free" | "pro" | "business";

const SUBSCRIPTION_EVENTS: ReadonlySet<string> = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

const REVOKED_SUBSCRIPTION_STATUSES = new Set(["canceled", "incomplete_expired", "unpaid"]);

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
  console.warn("[SUBSCRIPTION_RECOVERY] webhook_received", {
    eventType: event.type,
    subscriptionId: sub.id,
    customerId: getStripeId(sub.customer),
    stripeStatus: sub.status,
    metadataHasUserId: Boolean(sub.metadata?.userId),
    metadataHasUserEmail: Boolean(sub.metadata?.userEmail),
    metadataHasSubscriptionTier: Boolean(sub.metadata?.subscriptionTier),
  });
  return syncSubscriptionInternal(sub, event.type);
}

export async function syncCheckoutSessionActivation(
  session: Stripe.Checkout.Session,
): Promise<{ synced: boolean; reason?: string }> {
  return syncCheckoutSession(session);
}

export async function syncSubscription(
  sub: Stripe.Subscription,
  eventType: string,
  authenticatedUserId?: string | null,
): Promise<{ synced: boolean; reason?: string }> {
  return syncSubscriptionInternal(sub, eventType, authenticatedUserId);
}

async function syncCheckoutSession(
  session: Stripe.Checkout.Session,
): Promise<{ synced: boolean; reason?: string }> {
  console.warn("[SUBSCRIPTION_RECOVERY] checkout_session_sync_started", {
    sessionId: session.id,
    mode: session.mode,
    paymentStatus: session.payment_status,
    hasSubscription: Boolean(session.subscription),
    metadataHasUserId: Boolean(session.metadata?.userId),
    metadataHasSubscriptionTier: Boolean(session.metadata?.subscriptionTier),
  })

  if (session.mode !== "subscription") {
    return { synced: false, reason: `Checkout mode is ${session.mode || "unknown"}.` };
  }

  const customerId = getStripeId(session.customer);
  const subscriptionId = getStripeId(session.subscription);
  const userId = session.client_reference_id || session.metadata?.userId || null;
  const userEmail =
    session.customer_details?.email || session.customer_email || session.metadata?.userEmail || null;

  console.warn("[SUBSCRIPTION_RECOVERY] checkout_session_identifiers", {
    customerId,
    subscriptionId,
    userId,
    userEmail,
    lookupStrategy: userId ? "client_reference_id" : "metadata_userId",
  })

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
    applySubscriptionUpdates(updates, stripeSubscription, session.metadata);
  } else {
    const tierFromMetadata = getSubscriptionTierFromMetadata(session.metadata);
    if (tierFromMetadata) {
      updates.subscriptionTier = tierFromMetadata;
    }
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
    console.warn("[SUBSCRIPTION_RECOVERY] checkout_session_profile_found", {
      profileId: profile.id,
      currentDBTier: profile.subscriptionTier,
      stripeCustomerIdPresent: Boolean(profile.stripeCustomerId),
    })
    await activeDb.update(profiles).set(updates).where(eq(profiles.id, profile.id));
  }

  const activityUserId = userId || profile?.userId;
  if (activityUserId) {
    await refreshBillingAccess(activityUserId, updates.subscriptionTier, profile?.subscriptionTier);
  }

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

async function syncSubscriptionInternal(
  sub: Stripe.Subscription,
  eventType: string,
  authenticatedUserId?: string | null,
): Promise<{ synced: boolean; reason?: string }> {

  console.warn("[SUBSCRIPTION_RECOVERY] sync_started", { eventType, subscriptionId: sub.id })

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

  let existing = await findProfileForStripeCustomer({
    customerId,
    userId,
    userEmail,
  });

  if (!existing && authenticatedUserId) {
    existing = await findProfileForStripeCustomer({
      customerId,
      userId: authenticatedUserId,
      userEmail,
    });
  }

  if (!existing) {
    console.warn("[SUBSCRIPTION_RECOVERY] profile_not_found", {
      customerId,
      userIdFromMetadata: userId,
      userEmailFromMetadata: userEmail,
      authenticatedUserId,
      lookupStrategies: ["stripeCustomerId", "userId", "userEmail", "authenticatedUserId"],
    })
    return { synced: false, reason: `No profile for customer ${customerId}` };
  }

  const currentTier = existing.subscriptionTier;
  const priceId = sub.items.data[0]?.price?.id ?? null;
  const mappedTier = priceId ? getSubscriptionTierForStripePriceId(priceId) : null;
  const metadataTier = getSubscriptionTierFromMetadata(sub.metadata);

  console.warn("[SUBSCRIPTION_RECOVERY] sync_profile_found", {
    profileId: (existing as Record<string, unknown>).id,
    userId: existing.userId,
    currentDBTier: currentTier,
    stripeCustomerIdPresent: Boolean(existing.stripeCustomerId),
    stripeSubscriptionIdPresent: Boolean(existing.stripeSubscriptionId),
    subscriptionStatus: status,
    stripePriceId: priceId,
    mappedUseClevrTier: mappedTier,
    metadataTier,
    lookupStrategy: authenticatedUserId ? "authenticatedUserId_fallback" : "subscription_metadata",
  })

  const updates: Record<string, unknown> = {
    stripeCustomerId: customerId,
    stripeSubscriptionId: sub.id,
    stripeStatus: status,
    updatedAt: new Date(),
  };
  applySubscriptionUpdates(updates, sub);

  const dbUpdateAttempted = Boolean(updates.stripeCustomerId || updates.stripeSubscriptionId);
  console.warn("[SUBSCRIPTION_RECOVERY] db_update_attempted", {
    dbUpdateAttempted,
    updates: { stripeCustomerId: updates.stripeCustomerId, stripeSubscriptionId: updates.stripeSubscriptionId, stripeStatus: updates.stripeStatus, subscriptionTier: updates.subscriptionTier },
  })

  const idFromExisting = (existing as Record<string, unknown>).id as string;

  await activeDb.update(profiles).set(updates).where(eq(profiles.id, idFromExisting));

  const tierAfterUpdate = updates.subscriptionTier ?? currentTier;
  console.warn("[SUBSCRIPTION_RECOVERY] db_update_succeeded", {
    tierImmediatelyAfterDBUpdate: tierAfterUpdate,
  })

  await refreshBillingAccess(existing.userId, updates.subscriptionTier, existing.subscriptionTier);

  console.warn("[SUBSCRIPTION_RECOVERY] processPlanChange_result", {
    result: tierAfterUpdate !== currentTier ? "plan_change_triggered" : "no_change_needed",
    previousTier: currentTier,
    newTier: tierAfterUpdate,
  })

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

  console.warn("[SUBSCRIPTION_RECOVERY] sync_completed", {
    finalResolvedEntitlementTier: tierAfterUpdate,
    synced: true,
  })

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

  const matched = await activeDb.query.profiles.findFirst({
    where: clauses.length === 1 ? clauses[0] : or(...clauses),
  });

  if (matched) return matched;

  // Fallback: if stripeCustomerId is not yet linked (e.g. recovery before
  // webhook delivery), try an email match across all profiles.
  if (userEmail && !customerId) {
    return activeDb.query.profiles.findFirst({
      where: eq(profiles.email, userEmail),
    });
  }

  return null;
}

function applySubscriptionUpdates(
  updates: Record<string, unknown>,
  sub: Stripe.Subscription,
  checkoutMetadata?: Stripe.Metadata | null,
) {
  const priceId = sub.items.data[0]?.price.id ?? null;
  const currentPeriodEnd =
    "current_period_end" in sub && typeof sub.current_period_end === "number"
      ? new Date(sub.current_period_end * 1000)
      : null;

  updates.stripeStatus = sub.status;
  if (priceId) {
    updates.stripePriceId = priceId;
  }

  const subscriptionTier =
    (priceId ? getSubscriptionTierForPrice(priceId) : null) ||
    getSubscriptionTierFromMetadata(sub.metadata) ||
    getSubscriptionTierFromMetadata(checkoutMetadata);
  if (subscriptionTier) {
    updates.subscriptionTier = subscriptionTier;
  }

  if (REVOKED_SUBSCRIPTION_STATUSES.has(sub.status)) {
    updates.subscriptionTier = "free";
  }
  if (currentPeriodEnd) updates.stripeCurrentPeriodEnd = currentPeriodEnd;
}

function getSubscriptionTierForPrice(priceId: string) {
  return getSubscriptionTierForStripePriceId(priceId);
}

function getSubscriptionTierFromMetadata(metadata?: Stripe.Metadata | null): SubscriptionTier | null {
  const rawTier =
    metadata?.subscriptionTier ||
    metadata?.tier ||
    metadata?.plan ||
    metadata?.billingPlanId ||
    metadata?.productId ||
    null;
  if (!rawTier) return null;

  const normalized = rawTier.trim().toLowerCase();
  if (normalized === "business" || normalized === "business_monthly" || normalized === "business_annual") {
    return "business";
  }
  if (normalized === "pro" || normalized === "pro_monthly" || normalized === "pro_annual") {
    return "pro";
  }
  return null;
}

async function refreshBillingAccess(userId: string, tier: unknown, previousTier?: string | null) {
  if ((tier === "free" || tier === "pro" || tier === "business") && tier !== previousTier) {
    await processPlanChange(userId, tier);
  }

  revalidatePath("/app");
  revalidatePath("/app/settings");
  revalidatePath("/app/settings/subscription");
  revalidatePath("/app/settings/checkout");
  revalidatePath("/app/upload");
  revalidatePath("/app/datasets");
  revalidatePath("/app/accountancy");
  revalidatePath("/app/prebookkeeping");
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
