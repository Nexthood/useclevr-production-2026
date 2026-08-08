import { debugError, debugWarn } from "@/lib/utils/debug"

function getSquareApiBase(): string | null {
  const env = process.env.SQUARE_ENVIRONMENT
  if (env === "sandbox") return "https://connect.squareupsandbox.com"
  if (env === "production") return "https://connect.squareup.com"
  return null
}

function getSquareAccessToken(): string | null {
  return process.env.SQUARE_APPLICATION_SECRET?.trim() || process.env.SQUARE_ACCESS_TOKEN?.trim() || null
}

function getSquareVersion(): string {
  return process.env.SQUARE_VERSION?.trim() || "2026-07-23"
}

export class SquareCreditCheckoutConfigurationError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "SquareCreditCheckoutConfigurationError"
    this.code = code
  }
}

export interface CreateSquareCreditTopUpOptions {
  userId: string
  amountMinor: number
  currency: string
  idempotencyKey: string
  referenceId?: string
  metadata?: Record<string, string>
}

export interface SquareCreditTopUpResult {
  checkoutUrl: string | null
  checkoutId: string
}

export async function createSquareCreditTopUpCheckout({
  userId,
  amountMinor,
  currency,
  idempotencyKey,
}: CreateSquareCreditTopUpOptions): Promise<SquareCreditTopUpResult> {
  const apiBase = getSquareApiBase()
  if (!apiBase) {
    throw new SquareCreditCheckoutConfigurationError(
      "square_config_missing",
      "SQUARE_ENVIRONMENT must be set to 'production' or 'sandbox'.",
    )
  }

  const accessToken = getSquareAccessToken()
  if (!accessToken) {
    throw new SquareCreditCheckoutConfigurationError(
      "square_config_missing",
      "SQUARE_APPLICATION_SECRET is not configured.",
    )
  }

  const body: Record<string, unknown> = {
    idempotency_key: idempotencyKey,
    order: {
      location_id: process.env.SQUARE_LOCATION_ID?.trim() || "",
      line_items: [
        {
          catalog_object_id: process.env.SQUARE_CREDITS_CATALOG_ITEM_ID?.trim() || "",
          quantity: "1",
        },
      ],
    },
    ask_for_shipping_address: false,
    prefill_customer_details: {
      email: "",
    },
    redirect_url: process.env.SQUARE_CREDITS_REDIRECT_URL?.trim() || "",
  }

  const response = await fetch(`${apiBase}/v2/checkout`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Square-Version": getSquareVersion(),
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}))
    debugError("[square-credit-checkout] Square checkout creation failed:", errorPayload)
    throw new SquareCreditCheckoutConfigurationError(
      "square_checkout_failed",
      `Square checkout creation failed: ${JSON.stringify(errorPayload)}`,
    )
  }

  const payload = await response.json()
  const checkout = payload.checkout

  if (!checkout) {
    throw new SquareCreditCheckoutConfigurationError(
      "square_checkout_failed",
      "Square did not return a checkout URL.",
    )
  }

  debugWarn("[square-credit-checkout] Created Square checkout", {
    checkoutId: checkout.id,
    userId,
    amountMinor,
    currency,
  })

  return {
    checkoutUrl: checkout.url || null,
    checkoutId: checkout.id,
  }
}

export function getSquareCreditsCheckoutUrl(checkoutId: string): string | null {
  const apiBase = getSquareApiBase()
  if (!apiBase) return null
  return `${apiBase.replace("://", "://checkout.") || apiBase}/checkout/${checkoutId}`
}
