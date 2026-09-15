import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/auth";
import { getDb } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { cancelStripeSubscription, resumeStripeSubscription } from "@/services/stripe/checkout";
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

  try {
    if (action === "cancel") {
      const subscription = await cancelStripeSubscription(profile.stripeSubscriptionId);
      
      console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] cancellation_scheduled", {
        subscriptionId: subscription.id,
        customerId: profile.stripeCustomerId,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodEnd: subscription.current_period_end,
      });

      await syncSubscription(subscription, "user_cancellation", session.user.id);

      return NextResponse.json({
        success: true,
        action: "cancel",
        subscriptionId: subscription.id,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodEnd: subscription.current_period_end,
      });
    } else {
      const subscription = await resumeStripeSubscription(profile.stripeSubscriptionId);
      
      console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] cancellation_resumed", {
        subscriptionId: subscription.id,
        customerId: profile.stripeCustomerId,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      });

      await syncSubscription(subscription, "user_resume", session.user.id);

      return NextResponse.json({
        success: true,
        action: "resume",
        subscriptionId: subscription.id,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      });
    }
  } catch (error) {
    console.error("[STRIPE_SUBSCRIPTION_LIFECYCLE] action_failed", {
      action,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process subscription action" },
      { status: 500 }
    );
  }
}
