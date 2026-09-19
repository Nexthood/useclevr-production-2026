import { v4 as uuidv4 } from "uuid";
import { getDb } from "@/lib/db/index";
import { recordActivity } from "@/lib/activity/activity-store";
import { processPlanChange } from "@/lib/billing/credit-engine";
import { getSubscriptionTierForStripePriceId, getSubscriptionIntervalForStripePriceId } from "@/lib/billing/launch-pricing";
import { profiles, users } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import Stripe from "stripe";
import {
  sendSubscriptionActivationEmail,
  sendSubscriptionCancellationEmail,
  sendSubscriptionCancellationScheduledEmail,
} from "@/lib/email/subscription-emails";

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

const REVOKED_SUBSCRIPTION_STATUSES = new Set(["canceled", "incomplete_expired", "unpaid", "past_due"]);

const TERMINAL_SUBSCRIPTION_STATUSES = new Set(["canceled", "incomplete_expired", "unpaid", "past_due", "ended"]);

export async function handleSubscriptionEvent(
  event: Stripe.Event,
): Promise<{ synced: boolean; reason?: string }> {
  if (!SUBSCRIPTION_EVENTS.has(event.type)) {
    return { synced: false, reason: `Unhandled event type: ${event.type}` };
  }

  console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] event_received", {
    eventType: event.type,
    eventId: event.id,
    eventCreated: event.created,
  });

  if (event.type === "checkout.session.completed") {
    const result = await syncCheckoutSession(event.data.object as Stripe.Checkout.Session);
    console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] checkout_completed", {
      synced: result.synced,
      reason: result.reason,
    });
    return result;
  }

  const sub = event.data.object as Stripe.Subscription;
  console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] subscription_event", {
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

  const newTier = updates.subscriptionTier;
  const previousTier = profile?.subscriptionTier || null;
  const isActivation = previousTier === "free" || previousTier === null;

  if (isActivation && (newTier === "pro" || newTier === "business") && stripeSubscription && userEmail) {
    const profileUserId = profile?.userId || userId;
    if (profileUserId) {
      const idempotencyCheck = await shouldSendEmail({ email: userEmail, userId: profileUserId }, "activation");
      if (!idempotencyCheck.shouldSend) {
        console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] checkout_activation_email_skipped_idempotent", {
          userId: profileUserId,
          reason: idempotencyCheck.reason,
        });
      } else {
        const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL || "https://useclevr.com/app";
        const planName = newTier === "business" ? "Business" : "Pro";
        const interval = getSubscriptionIntervalForStripePriceId(stripeSubscription.items.data[0]?.price?.id || "");
        const amount = stripeSubscription.items.data[0]?.price?.unit_amount
          ? stripeSubscription.items.data[0].price.unit_amount / 100
          : newTier === "business"
            ? 80
            : 40;
        const currency = stripeSubscription.items.data[0]?.price?.currency || "eur";
        const nextBillingDate = stripeSubscription.current_period_end
          ? new Date(stripeSubscription.current_period_end * 1000).toISOString()
          : undefined;

        const result = await sendSubscriptionActivationEmail({
          to: userEmail,
          planName: planName as "Pro" | "Business",
          billingInterval: interval === "yearly" ? "yearly" : "monthly",
          amount,
          currency: currency.toUpperCase(),
          activatedAt: new Date().toISOString(),
          nextBillingDate,
          dashboardUrl: `${dashboardUrl}/app/settings/subscription`,
        });

        if (result.success) {
          await markEmailSent(profileUserId, "activation");
        }
      }
    }
  }

  return { synced: true };
}

async function syncSubscriptionInternal(
  sub: Stripe.Subscription,
  eventType: string,
  authenticatedUserId?: string | null,
): Promise<{ synced: boolean; reason?: string }> {

  console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] sync_started", { eventType, subscriptionId: sub.id })

  // Guard against null customer (defensive — Stripe never sends null here for
  // subscription events, but the typeof check alone would pass through `null`
  // and then throw on `.id`).
  if (sub.customer == null) {
    console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] sync_failed", { reason: "no_customer_id" });
    return { synced: false, reason: "Subscription event has no customer ID." };
  }

  const customerId = getStripeId(sub.customer);
  if (!customerId) {
    console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] sync_failed", { reason: "invalid_customer_id" });
    return { synced: false, reason: "Subscription event has no customer ID." };
  }

  const status = sub.status;
  const userId = sub.metadata?.userId || null;
  const userEmail = sub.metadata?.userEmail || null;

  const activeDb = getDb();
  if (!activeDb) {
    console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] sync_failed", { reason: "database_unavailable" });
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
    console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] profile_not_found", {
      customerId,
      userIdFromMetadata: userId,
      userEmailFromMetadata: userEmail,
      authenticatedUserId,
    })
    return { synced: false, reason: `No profile for customer ${customerId}` };
  }

  const currentTier = existing.subscriptionTier;
  const priceId = sub.items.data[0]?.price?.id ?? null;
  const mappedTier = priceId ? getSubscriptionTierForStripePriceId(priceId) : null;
  const metadataTier = getSubscriptionTierFromMetadata(sub.metadata);

  console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] profile_found", {
    profileId: (existing as Record<string, unknown>).id,
    userId: existing.userId,
    currentDBTier: currentTier,
    stripeCustomerIdPresent: Boolean(existing.stripeCustomerId),
    stripeSubscriptionIdPresent: Boolean(existing.stripeSubscriptionId),
    subscriptionStatus: status,
    stripePriceId: priceId,
    mappedUseClevrTier: mappedTier,
    metadataTier,
    eventType,
  })

  const updates: Record<string, unknown> = {
    stripeCustomerId: customerId,
    stripeSubscriptionId: sub.id,
    stripeStatus: status,
    updatedAt: new Date(),
  };
  applySubscriptionUpdates(updates, sub, undefined, eventType);

  const dbUpdateAttempted = Boolean(updates.stripeCustomerId || updates.stripeSubscriptionId);
  console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] db_update", {
    dbUpdateAttempted,
    previousTier: currentTier,
    newTier: updates.subscriptionTier,
    stripeStatus: updates.stripeStatus,
    eventType,
  })

  const idFromExisting = (existing as Record<string, unknown>).id as string;

  await activeDb.update(profiles).set(updates).where(eq(profiles.id, idFromExisting));

  const tierAfterUpdate = (updates.subscriptionTier as string | null | undefined) ?? currentTier;
  console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] db_update_succeeded", {
    tierAfterUpdate,
    previousTier: currentTier,
    eventType,
  })

  await refreshBillingAccess(existing.userId, updates.subscriptionTier, existing.subscriptionTier);

  console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] billing_access_refreshed", {
    previousTier: currentTier,
    newTier: tierAfterUpdate,
    tierChanged: tierAfterUpdate !== currentTier,
    eventType,
  })

  const emailResult = await sendSubscriptionLifecycleEmail({
    previousTier: currentTier,
    newTier: tierAfterUpdate,
    profile: existing,
    sub,
    eventType,
  });

  await recordActivity({
    userId: existing.userId,
    userEmail: existing.email,
    type: tierAfterUpdate !== currentTier ? "subscription_changed" : "subscription_updated",
    feature: "subscription",
    title: getSubscriptionActivityTitle(eventType),
    description: `Subscription status is ${status}.`,
    metadata: {
      stripeStatus: status,
      stripePriceId: updates.stripePriceId ?? null,
      stripeSubscriptionId: sub.id,
      previousTier: currentTier,
      newTier: tierAfterUpdate,
    },
  });

  console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] sync_completed", {
    finalResolvedEntitlementTier: tierAfterUpdate,
    previousTier: currentTier,
    tierChanged: tierAfterUpdate !== currentTier,
    synced: true,
    eventType,
    emailSent: emailResult.sent,
    emailError: emailResult.error,
  })

  return { synced: true };
}

type ProfileMatchInput = {
  customerId: string;
  userId?: string | null;
  userEmail?: string | null;
};

/**
 * Resolve the single profile that owns a Stripe payment.
 *
 * Ownership is resolved by strict priority — never by OR-ing identifiers,
 * never by taking whichever profile happens to match first:
 *   1. userId from trusted server-side checkout metadata / client_reference_id
 *   2. stripeCustomerId previously linked to exactly one profile
 *   3. email only when no stronger identifier exists
 *
 * Email is never allowed to override a stronger mapping, so a payment can
 * never land on the wrong account (e.g. Superadmin) when a customer pays
 * with an email address that belongs to another profile.
 */
async function findProfileForStripeCustomer({ customerId, userId, userEmail }: ProfileMatchInput) {
  const activeDb = getDb();
  if (!activeDb) return null;

  if (userId) {
    const byUserId = await activeDb.query.profiles.findFirst({
      where: eq(profiles.userId, userId),
    });
    if (byUserId) return byUserId;

    // The trusted userId exists but has no profile yet — only another
    // identifier owned by the SAME user may resolve here.
    if (customerId) {
      const byCustomer = await activeDb.query.profiles.findFirst({
        where: and(eq(profiles.stripeCustomerId, customerId), eq(profiles.userId, userId)),
      });
      if (byCustomer) return byCustomer;
    }

    if (userEmail) {
      const byUserEmail = await activeDb.query.profiles.findFirst({
        where: and(eq(profiles.email, userEmail), eq(profiles.userId, userId)),
      });
      if (byUserEmail) return byUserEmail;
    }

    return null;
  }

  if (customerId) {
    return activeDb.query.profiles.findFirst({
      where: eq(profiles.stripeCustomerId, customerId),
    });
  }

  if (userEmail) {
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
  eventType?: string,
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

  const isDeletedEvent = eventType === "customer.subscription.deleted";

  if (isDeletedEvent || TERMINAL_SUBSCRIPTION_STATUSES.has(sub.status)) {
    updates.subscriptionTier = "free";
    console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] subscription_terminated", {
      eventType,
      subscriptionId: sub.id,
      status: sub.status,
      isDeletedEvent,
      resolvedTier: "free",
    });
  } else {
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

const EMAIL_IDEMPOTENCY_WINDOW_MS = 5 * 60 * 1000;

async function shouldSendEmail(
  profile: { email: string | null; userId: string },
  emailType: "activation" | "cancellation" | "cancellation_scheduled"
): Promise<{ shouldSend: boolean; reason: string }> {
  const db = getDb();
  if (!db) {
    return { shouldSend: true, reason: "no_db" };
  }

  const profileData = await db.query.profiles.findFirst({
    where: eq(profiles.userId, profile.userId),
    columns: {
      lastSubscriptionActivationEmailSent: true,
      lastSubscriptionCancellationEmailSent: true,
      lastSubscriptionCancellationScheduledEmailSent: true,
    },
  });

  if (!profileData) {
    return { shouldSend: true, reason: "no_profile" };
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() - EMAIL_IDEMPOTENCY_WINDOW_MS);

  if (emailType === "activation") {
    if (profileData.lastSubscriptionActivationEmailSent && profileData.lastSubscriptionActivationEmailSent > windowStart) {
      return { shouldSend: false, reason: "recently_sent" };
    }
  } else if (emailType === "cancellation") {
    if (profileData.lastSubscriptionCancellationEmailSent && profileData.lastSubscriptionCancellationEmailSent > windowStart) {
      return { shouldSend: false, reason: "recently_sent" };
    }
  } else if (emailType === "cancellation_scheduled") {
    if (profileData.lastSubscriptionCancellationScheduledEmailSent && profileData.lastSubscriptionCancellationScheduledEmailSent > windowStart) {
      return { shouldSend: false, reason: "recently_sent" };
    }
  }

  return { shouldSend: true, reason: "ok" };
}

async function markEmailSent(
  userId: string,
  emailType: "activation" | "cancellation" | "cancellation_scheduled"
): Promise<void> {
  const db = getDb();
  if (!db) return;

  const updateField = {
    activation: "lastSubscriptionActivationEmailSent",
    cancellation: "lastSubscriptionCancellationEmailSent",
    cancellation_scheduled: "lastSubscriptionCancellationScheduledEmailSent",
  }[emailType];

  await db.update(profiles)
    .set({ [updateField]: new Date() } as any)
    .where(eq(profiles.userId, userId));
}

async function sendSubscriptionLifecycleEmail(params: {
  previousTier: string | null;
  newTier: string | null | undefined;
  profile: { email: string | null; userId: string };
  sub: Stripe.Subscription;
  eventType: string;
}): Promise<{ sent: boolean; error?: string }> {
  const { previousTier, newTier, profile, sub, eventType } = params;
  const to = profile.email;
  if (!to) {
    console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] email_skipped_no_email", { userId: profile.userId });
    return { sent: false, error: "no_email" };
  }

  const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL || "https://useclevr.com/app";

  const tierChanged = previousTier !== newTier && newTier !== undefined;
  const isActivation =
    tierChanged &&
    (previousTier === "free" || previousTier === null) &&
    (newTier === "pro" || newTier === "business");
  const isCancellation =
    tierChanged &&
    (previousTier === "pro" || previousTier === "business") &&
    newTier === "free";
  const isScheduledCancellation =
    eventType === "customer.subscription.updated" &&
    sub.cancel_at_period_end === true &&
    (newTier === "pro" || newTier === "business");

  if (isActivation) {
    const idempotencyCheck = await shouldSendEmail(profile, "activation");
    if (!idempotencyCheck.shouldSend) {
      console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] activation_email_skipped_idempotent", {
        userId: profile.userId,
        reason: idempotencyCheck.reason,
      });
      return { sent: false, error: idempotencyCheck.reason };
    }

    const planName = newTier === "business" ? "Business" : "Pro";
    const interval = getSubscriptionIntervalForStripePriceId(sub.items.data[0]?.price?.id || "");
    const amount = sub.items.data[0]?.price?.unit_amount
      ? sub.items.data[0].price.unit_amount / 100
      : newTier === "business"
        ? 80
        : 40;
    const currency = sub.items.data[0]?.price?.currency || "eur";
    const nextBillingDate = sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : undefined;

    const result = await sendSubscriptionActivationEmail({
      to,
      planName: planName as "Pro" | "Business",
      billingInterval: interval === "yearly" ? "yearly" : "monthly",
      amount,
      currency: currency.toUpperCase(),
      activatedAt: new Date().toISOString(),
      nextBillingDate,
      dashboardUrl: `${dashboardUrl}/app/settings/subscription`,
    });

    if (result.success) {
      await markEmailSent(profile.userId, "activation");
    }

    console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] activation_email_sent", {
      success: result.success,
      error: result.error,
      planName,
      to: to.substring(0, 3) + "***",
    });

    return { sent: result.success, error: result.error };
  }

  if (isCancellation) {
    const idempotencyCheck = await shouldSendEmail(profile, "cancellation");
    if (!idempotencyCheck.shouldSend) {
      console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] cancellation_email_skipped_idempotent", {
        userId: profile.userId,
        reason: idempotencyCheck.reason,
      });
      return { sent: false, error: idempotencyCheck.reason };
    }

    const result = await sendSubscriptionCancellationEmail({
      to,
      planName: previousTier === "business" ? "Business" : "Pro",
      canceledAt: new Date().toISOString(),
      datasetsPreserved: true,
      purchasedCreditsPreserved: true,
      dashboardUrl: `${dashboardUrl}/app/settings/subscription`,
    });

    if (result.success) {
      await markEmailSent(profile.userId, "cancellation");
    }

    console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] cancellation_email_sent", {
      success: result.success,
      error: result.error,
      planName: previousTier,
      to: to.substring(0, 3) + "***",
    });

    return { sent: result.success, error: result.error };
  }

  if (isScheduledCancellation) {
    const idempotencyCheck = await shouldSendEmail(profile, "cancellation_scheduled");
    if (!idempotencyCheck.shouldSend) {
      console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] scheduled_cancellation_email_skipped_idempotent", {
        userId: profile.userId,
        reason: idempotencyCheck.reason,
      });
      return { sent: false, error: idempotencyCheck.reason };
    }

    const result = await sendSubscriptionCancellationScheduledEmail({
      to,
      planName: newTier === "business" ? "Business" : "Pro",
      currentPeriodEnd: sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : new Date().toISOString(),
      dashboardUrl: `${dashboardUrl}/app/settings/subscription`,
    });

    if (result.success) {
      await markEmailSent(profile.userId, "cancellation_scheduled");
    }

    console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] scheduled_cancellation_email_sent", {
      success: result.success,
      error: result.error,
      planName: newTier,
      to: to.substring(0, 3) + "***",
    });

    return { sent: result.success, error: result.error };
  }

  console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] email_not_required", {
    previousTier,
    newTier,
    eventType,
    tierChanged,
  });

  return { sent: false, error: "not_required" };
}
