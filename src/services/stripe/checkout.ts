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
  expectedCurrency?: string;
  expectedInterval?: "month" | "year";
  plan?: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export class StripeCheckoutConfigurationError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "StripeCheckoutConfigurationError";
    this.code = code;
  }
}

export async function createStripeCheckoutSession({
  userId,
  userEmail,
  customerId,
  priceId,
  expectedCurrency,
  expectedInterval = "month",
  plan,
  successUrl,
  cancelUrl,
  metadata,
}: CreateStripeCheckoutOptions): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  await validateStripeSubscriptionPrice(stripe, {
    priceId,
    expectedCurrency,
    expectedInterval,
    plan,
  });
  const mergedMetadata = {
    userId,
    userEmail,
    ...(metadata ?? {}),
  }

  const session = await stripe.checkout.sessions.create({
    ...(customerId ? { customer: customerId } : { customer_email: userEmail }),
    client_reference_id: userId,
    metadata: mergedMetadata,
    subscription_data: {
      metadata: mergedMetadata,
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

async function validateStripeSubscriptionPrice(
  stripe: Stripe,
  input: {
    priceId: string;
    expectedCurrency?: string;
    expectedInterval?: "month" | "year";
    plan?: string;
  },
) {
  const price = await stripe.prices.retrieve(input.priceId);
  const planCode = input.plan === "business" ? "business" : "pro";

  if (!price.active) {
    throw new StripeCheckoutConfigurationError(`${planCode}_price_inactive`, "The selected Stripe price is inactive.");
  }

  if (!price.recurring || price.recurring.interval !== input.expectedInterval) {
    throw new StripeCheckoutConfigurationError(
      "stripe_mode_mismatch",
      `The selected Stripe price must be a recurring ${input.expectedInterval === "year" ? "yearly" : "monthly"} subscription price.`,
    );
  }

  const expectedCurrency = input.expectedCurrency?.trim().toLowerCase();
  if (expectedCurrency && price.currency.toLowerCase() !== expectedCurrency) {
    throw new StripeCheckoutConfigurationError(
      planCode === "pro" ? "invalid_pro_price_mapping" : "invalid_business_price_mapping",
      "The selected Stripe price currency does not match the selected market.",
    );
  }
}

export async function retrieveStripeCustomerCountry(customerId: string): Promise<string | null> {
  const stripe = getStripe();
  const customer = await stripe.customers.retrieve(customerId);

  if (customer.deleted) return null;

  return customer.address?.country || customer.shipping?.address?.country || null;
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
