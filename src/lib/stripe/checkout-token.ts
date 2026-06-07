import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"

interface CheckoutTokenData {
  stripeSessionId: string | null
  userId: string
  createdAt: number
  nonce: string
}

const TOKEN_TTL_MS = 60 * 60 * 1000

function getSecret() {
  const secret = process.env.AUTH_SECRET || process.env.STRIPE_SECRET_KEY
  if (!secret) {
    throw new Error("Missing AUTH_SECRET or STRIPE_SECRET_KEY for checkout token signing")
  }
  return secret
}

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url")
}

function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8")
}

function sign(payload: string) {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url")
}

function signaturesMatch(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual)
  const expectedBuffer = Buffer.from(expected)
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
}

export function issueCheckoutToken(stripeSessionId: string | null, userId: string): string {
  const payload = encode(JSON.stringify({
    stripeSessionId,
    userId,
    createdAt: Date.now(),
    nonce: randomBytes(16).toString("hex"),
  } satisfies CheckoutTokenData))

  return `${payload}.${sign(payload)}`
}

export function redeemCheckoutToken(token: string): { stripeSessionId: string | null; userId: string } | null {
  const [payload, signature] = token.split(".")
  if (!payload || !signature || !signaturesMatch(signature, sign(payload))) return null

  let data: CheckoutTokenData
  try {
    data = JSON.parse(decode(payload)) as CheckoutTokenData
  } catch {
    return null
  }

  if (!data.userId || typeof data.createdAt !== "number") return null
  if (Date.now() - data.createdAt > TOKEN_TTL_MS) {
    return null
  }

  return { stripeSessionId: data.stripeSessionId, userId: data.userId }
}
