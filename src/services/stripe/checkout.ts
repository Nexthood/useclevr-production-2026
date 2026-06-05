import Stripe from "stripe";

let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }
  _stripe = new Stripe(key, {});
  return _stripe;
}

export interface CreateStripeCheckoutOptions {
  userId: string;
  userEmail: string;
  customerId?: string | null;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}

export async function createStripeCheckoutSession({
  userId,
  userEmail,
  customerId,
  priceId,
  successUrl,
  cancelUrl,
}: CreateStripeCheckoutOptions): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    ...(customerId ? { customer: customerId } : { customer_email: userEmail }),
    client_reference_id: userId,
    metadata: {
      userId,
      userEmail,
    },
    subscription_data: {
      metadata: {
        userId,
        userEmail,
      },
    },
    line_items: [{ price: priceId, quantity: 1 }],
    mode: "subscription",
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }

  return session;
}

export async function retrieveStripeCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  return stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["subscription", "customer"],
  });
}

export async function createStripeBillingPortalSession({
  customerId,
  returnUrl,
}: {
  customerId: string;
  returnUrl: string;
}): Promise<Stripe.BillingPortal.Session> {
  const stripe = getStripe();
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}
