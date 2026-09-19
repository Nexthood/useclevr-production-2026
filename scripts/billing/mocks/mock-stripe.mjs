/**
 * In-memory replacement for the Stripe client exposed by
 * `@/services/stripe/credit-checkout`. Prices are seeded per test via
 * `priceCatalog`; no network or real Stripe calls are ever made.
 */

export const priceCatalog = new Map()
export const paymentIntentCatalog = new Map()
export const chargeCatalog = new Map()

export const stripeCalls = {
  priceRetrievals: [],
  paymentIntentRetrievals: [],
  chargeRetrievals: [],
}

export function setMockPrice(price) {
  priceCatalog.set(price.id, price)
}

export function setMockPaymentIntent(paymentIntent) {
  paymentIntentCatalog.set(paymentIntent.id, paymentIntent)
}

export function setMockCharge(charge) {
  chargeCatalog.set(charge.id, charge)
}

export function setMockPaymentRefundState({
  paymentIntentId,
  chargeId = `ch_mock_${paymentIntentId}`,
  amount,
  amountRefunded = 0,
  refunds = [],
}) {
  setMockCharge({
    id: chargeId,
    amount,
    amount_refunded: amountRefunded,
    receipt_url: "https://pay.stripe.com/receipts/mock",
    refunds: { data: refunds },
  })
  setMockPaymentIntent({
    id: paymentIntentId,
    amount,
    latest_charge: chargeId,
  })
}

export function resetStripeMock() {
  priceCatalog.clear()
  paymentIntentCatalog.clear()
  chargeCatalog.clear()
  stripeCalls.priceRetrievals.length = 0
  stripeCalls.paymentIntentRetrievals.length = 0
  stripeCalls.chargeRetrievals.length = 0
}

class NotFoundError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
    this.statusCode = 404
  }
}

export function getStripe() {
  return {
    prices: {
      retrieve: async (priceId) => {
        stripeCalls.priceRetrievals.push(priceId)
        const price = priceCatalog.get(priceId)
        if (!price) {
          throw new NotFoundError("resource_missing", `No such price: ${priceId}`)
        }
        return price
      },
    },
    paymentIntents: {
      retrieve: async (paymentIntentId) => {
        stripeCalls.paymentIntentRetrievals.push(paymentIntentId)
        return paymentIntentCatalog.get(paymentIntentId) ?? {
          id: paymentIntentId,
          amount: 0,
          latest_charge: `ch_mock_${paymentIntentId}`,
        }
      },
    },
    charges: {
      retrieve: async (chargeId) => {
        stripeCalls.chargeRetrievals.push(chargeId)
        return chargeCatalog.get(chargeId) ?? {
          id: chargeId,
          amount: 0,
          amount_refunded: 0,
          receipt_url: "https://pay.stripe.com/receipts/mock",
          refunds: { data: [] },
        }
      },
    },
    invoices: {
      retrieve: async (invoiceId) => ({
        id: invoiceId,
        hosted_invoice_url: "https://invoice.stripe.com/i/mock",
        invoice_pdf: "https://invoice.stripe.com/i/mock/pdf",
      }),
    },
    checkout: {
      sessions: {
        create: async () => {
          throw new Error("mock-stripe: checkout session creation is not available in tests")
        },
        retrieve: async () => {
          throw new Error("mock-stripe: session retrieval is not available in tests")
        },
      },
    },
    webhooks: {},
  }
}
