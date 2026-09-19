import Stripe from "stripe";
import { getSubscriptionTierForStripePriceId } from "@/lib/billing/launch-pricing";

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
  expectedAmountMinor?: number | null;
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
  expectedAmountMinor,
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
    expectedAmountMinor,
    expectedInterval,
    plan,
  });
  const subscriptionTier = plan?.startsWith("pro_") ? "pro"
    : plan?.startsWith("business_") ? "business"
    : null;

  // Trusted ownership fields win: caller-supplied metadata must never be able
  // to redirect a subscription to a different UseClevr user via metadata override.
  const mergedMetadata = {
    ...(metadata ?? {}),
    userId,
    userEmail,
    subscriptionTier,
  }

  const sessionCreateParams: Stripe.Checkout.SessionCreateParams = {
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
  };
  const sessionCurrency = normalizeStripeCurrency(expectedCurrency);
  if (sessionCurrency) {
    sessionCreateParams.currency = sessionCurrency;
  }
  (
    sessionCreateParams as Stripe.Checkout.SessionCreateParams & {
      adaptive_pricing: { enabled: boolean };
    }
  ).adaptive_pricing = {
    enabled: false,
  };

  const session = await stripe.checkout.sessions.create(sessionCreateParams);

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
    expectedAmountMinor?: number | null;
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

  if (typeof input.expectedAmountMinor === "number" && price.unit_amount !== input.expectedAmountMinor) {
    throw new StripeCheckoutConfigurationError(
      planCode === "pro" ? "invalid_pro_price_mapping" : "invalid_business_price_mapping",
      "The selected Stripe price amount does not match the selected market.",
    );
  }
}

function normalizeStripeCurrency(currency?: string | null): string | undefined {
  const normalized = currency?.trim().toLowerCase();
  if (normalized === "eur" || normalized === "gbp" || normalized === "usd" || normalized === "cad") {
    return normalized;
  }
  return undefined;
}

export async function retrieveStripeCustomerCountry(customerId: string): Promise<string | null> {
  const stripe = getStripe();
  const customer = await stripe.customers.retrieve(customerId);

  if (customer.deleted) return null;

  return customer.address?.country || customer.shipping?.address?.country || null;
}

export async function retrieveStripeSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  return stripe.subscriptions.retrieve(subscriptionId);
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

export type SubscriptionState = {
  status: "active" | "trialing" | "canceled" | "past_due" | "incomplete" | "incomplete_expired" | "unpaid" | "paused" | "ended" | "missing";
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: number | null;
  priceId: string | null;
  tier: "free" | "pro" | "business" | null;
  entitled: boolean;
};

const TERMINAL_STATUSES = new Set(["canceled", "incomplete_expired", "unpaid", "ended"]);
const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due", "paused"]);

export async function getSubscriptionState(subscriptionId: string): Promise<SubscriptionState> {
  const stripe = getStripe();
  
  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    
    const status = sub.status as SubscriptionState["status"];
    const cancelAtPeriodEnd = sub.cancel_at_period_end;
    const currentPeriodEnd = sub.current_period_end;
    const priceId = sub.items.data[0]?.price?.id ?? null;
    
    let tier: SubscriptionState["tier"] = null;
    if (priceId) {
      const mapped = getSubscriptionTierForStripePriceId(priceId);
      if (mapped) tier = mapped;
    }
    
    const isTerminal = TERMINAL_STATUSES.has(status);
    const isActive = ACTIVE_STATUSES.has(status);
    const entitled = !isTerminal && (isActive || status === "trialing");
    
    return {
      status,
      cancelAtPeriodEnd: Boolean(cancelAtPeriodEnd),
      currentPeriodEnd,
      priceId,
      tier,
      entitled,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("resource_missing") || message.includes("No such subscription") || message.includes("not found")) {
      return {
        status: "missing",
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
        priceId: null,
        tier: null,
        entitled: false,
      };
    }
    throw error;
  }
}

export async function cancelStripeSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}

export async function resumeStripeSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  });
}

export const __stripeCheckoutTestHooks = {
  setStripeClientForTest(stripe: Stripe | null) {
    _stripe = stripe;
  },
};
