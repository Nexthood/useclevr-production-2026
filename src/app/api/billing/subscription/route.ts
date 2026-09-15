import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { 
  getSubscriptionState, 
  cancelStripeSubscription, 
  resumeStripeSubscription,
  type SubscriptionState 
} from "@/services/stripe/checkout";
import { syncSubscription } from "@/services/stripe/webhook";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 500 });
  }

  let body: { action?: string } | undefined;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const action = body?.action;
  if (action !== "cancel" && action !== "resume") {
    return NextResponse.json({ error: "Invalid action. Use 'cancel' or 'resume'." }, { status: 400 });
  }

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, session.user.id),
    columns: {
      stripeSubscriptionId: true,
      stripeCustomerId: true,
      subscriptionTier: true,
    },
  });

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  if (!profile.stripeSubscriptionId) {
    return NextResponse.json({ error: "No active subscription found" }, { status: 400 });
  }

  if (!profile.stripeCustomerId) {
    return NextResponse.json({ error: "No Stripe customer found" }, { status: 400 });
  }

  let stripeState: SubscriptionState;
  try {
    stripeState = await getSubscriptionState(profile.stripeSubscriptionId);
  } catch (error) {
    console.error("[STRIPE_SUBSCRIPTION_LIFECYCLE] failed_to_get_state", {
      action,
      subscriptionId: profile.stripeSubscriptionId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "Unable to verify subscription status. Please try again." },
      { status: 500 }
    );
  }

  console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] action_started", {
    action,
    subscriptionId: profile.stripeSubscriptionId,
    stripeStatus: stripeState.status,
    cancelAtPeriodEnd: stripeState.cancelAtPeriodEnd,
    entitled: stripeState.entitled,
  });

  const knownProfile = {
    stripeSubscriptionId: profile.stripeSubscriptionId,
    stripeCustomerId: profile.stripeCustomerId,
    subscriptionTier: profile.subscriptionTier,
  };

  try {
    if (action === "cancel") {
      return await handleCancelAction(db, knownProfile, session.user.id, stripeState);
    } else {
      return await handleResumeAction(db, knownProfile, session.user.id, stripeState);
    }
  } catch (error) {
    console.error("[STRIPE_SUBSCRIPTION_LIFECYCLE] action_failed", {
      action,
      subscriptionId: profile.stripeSubscriptionId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process subscription action" },
      { status: 500 }
    );
  }
}

async function handleCancelAction(
  db: ReturnType<typeof getDb>,
  profile: { stripeSubscriptionId: string; stripeCustomerId: string; subscriptionTier: string | null },
  userId: string,
  stripeState: SubscriptionState
): Promise<NextResponse> {
  if (stripeState.status === "missing") {
    console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] subscription_missing_reconciling", {
      subscriptionId: profile.stripeSubscriptionId,
      previousTier: profile.subscriptionTier,
    });
    
    await reconcileToFree(db, userId, profile.subscriptionTier);
    
    return NextResponse.json({
      success: true,
      action: "reconciled",
      reason: "subscription_not_found",
      previousTier: profile.subscriptionTier,
      tier: "free",
      message: "No active subscription found. Account has been reconciled to Free plan.",
    });
  }

  if (!stripeState.entitled) {
    console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] not_entitled_reconciling", {
      subscriptionId: profile.stripeSubscriptionId,
      stripeStatus: stripeState.status,
      previousTier: profile.subscriptionTier,
    });
    
    await reconcileToFree(db, userId, profile.subscriptionTier);
    
    return NextResponse.json({
      success: true,
      action: "reconciled",
      reason: "subscription_not_entitled",
      stripeStatus: stripeState.status,
      previousTier: profile.subscriptionTier,
      tier: "free",
      message: `Subscription is ${stripeState.status}. Account has been reconciled to Free plan.`,
    });
  }

  if (stripeState.cancelAtPeriodEnd) {
    console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] already_scheduled", {
      subscriptionId: profile.stripeSubscriptionId,
      cancelAtPeriodEnd: stripeState.cancelAtPeriodEnd,
      currentPeriodEnd: stripeState.currentPeriodEnd,
    });

    await syncCanceledSubscription(userId, profile.subscriptionTier, stripeState);
    
    return NextResponse.json({
      success: true,
      action: "already_scheduled",
      subscriptionId: profile.stripeSubscriptionId,
      cancelAtPeriodEnd: true,
      currentPeriodEnd: stripeState.currentPeriodEnd,
      message: "Cancellation already scheduled.",
    });
  }

  const subscription = await cancelStripeSubscription(profile.stripeSubscriptionId);
  
  console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] cancellation_scheduled", {
    subscriptionId: subscription.id,
    customerId: profile.stripeCustomerId,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    currentPeriodEnd: subscription.current_period_end,
  });

  await syncCanceledSubscription(userId, profile.subscriptionTier, {
    ...stripeState,
    cancelAtPeriodEnd: true,
  });

  return NextResponse.json({
    success: true,
    action: "cancel",
    subscriptionId: subscription.id,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    currentPeriodEnd: subscription.current_period_end,
  });
}

async function handleResumeAction(
  db: ReturnType<typeof getDb>,
  profile: { stripeSubscriptionId: string; stripeCustomerId: string; subscriptionTier: string | null },
  userId: string,
  stripeState: SubscriptionState
): Promise<NextResponse> {
  if (stripeState.status === "missing") {
    return NextResponse.json({
      success: false,
      action: "resume_failed",
      reason: "subscription_not_found",
      message: "Cannot resume. Subscription no longer exists.",
    });
  }

  if (!stripeState.entitled) {
    return NextResponse.json({
      success: false,
      action: "resume_failed",
      reason: "subscription_not_entitled",
      stripeStatus: stripeState.status,
      message: `Cannot resume. Subscription is ${stripeState.status}.`,
    });
  }

  if (!stripeState.cancelAtPeriodEnd) {
    console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] already_active_no_cancel", {
      subscriptionId: profile.stripeSubscriptionId,
      cancelAtPeriodEnd: stripeState.cancelAtPeriodEnd,
    });

    return NextResponse.json({
      success: true,
      action: "already_active",
      subscriptionId: profile.stripeSubscriptionId,
      cancelAtPeriodEnd: false,
      message: "Subscription is already active with no cancellation scheduled.",
    });
  }

  const subscription = await resumeStripeSubscription(profile.stripeSubscriptionId);
  
  console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] cancellation_resumed", {
    subscriptionId: subscription.id,
    customerId: profile.stripeCustomerId,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });

  await syncSubscription(subscription, "user_resume", userId);

  return NextResponse.json({
    success: true,
    action: "resume",
    subscriptionId: subscription.id,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });
}

async function reconcileToFree(
  db: ReturnType<typeof getDb>,
  userId: string,
  previousTier: string | null
): Promise<void> {
  console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] reconciling_to_free", {
    userId,
    previousTier,
  });

  const mockSubscription = {
    id: "reconciled",
    customer: "reconciled",
    status: "canceled",
    cancel_at_period_end: false,
    current_period_end: Math.floor(Date.now() / 1000),
    items: { data: [{ price: { id: null } }] },
    metadata: {},
  } as unknown;

  await syncSubscription(mockSubscription as any, "reconciliation", userId);
}

async function syncCanceledSubscription(
  userId: string,
  previousTier: string | null,
  stripeState: SubscriptionState
): Promise<void> {
  const mockSubscription = {
    id: "canceled_sync",
    customer: "canceled_sync",
    status: stripeState.entitled ? "active" : "canceled",
    cancel_at_period_end: stripeState.cancelAtPeriodEnd,
    current_period_end: stripeState.currentPeriodEnd,
    items: { data: [{ price: { id: stripeState.priceId } }] },
    metadata: {},
  } as unknown;

  await syncSubscription(mockSubscription as any, "user_cancellation_scheduled", userId);
}
