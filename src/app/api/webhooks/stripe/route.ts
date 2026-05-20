import { handleSubscriptionEvent } from "@/services/stripe/webhook";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";

function getRawBody(request: NextRequest): Promise<Uint8Array> {
  return request.arrayBuffer().then((buf) => new Uint8Array(buf));
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET is not configured." },
      { status: 500 },
    );
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return NextResponse.json({ error: "STRIPE_SECRET_KEY is not configured." }, { status: 500 });
  }

  const stripe = new Stripe(stripeSecretKey);

  try {
    const rawBody = await getRawBody(request);
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
    }

    const event = stripe.webhooks.constructEvent(Buffer.from(rawBody), signature, webhookSecret);

    const result = await handleSubscriptionEvent(event);

    return NextResponse.json({
      received: true,
      type: event.type,
      synced: result.synced,
      ...(result.reason ? { reason: result.reason } : {}),
    });
  } catch (err) {
    console.error("[stripe-webhook] error:", err);
    return NextResponse.json({ error: "Webhook signature verification failed." }, { status: 400 });
  }
}
