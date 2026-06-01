import { randomBytes } from "node:crypto"

interface CheckoutTokenData {
  stripeSessionId: string | null
  userId: string
  createdAt: number
}

const tokenStore = new Map<string, CheckoutTokenData>()

const TOKEN_TTL_MS = 60 * 60 * 1000

function cleanupExpired() {
  const now = Date.now()
  for (const [token, data] of tokenStore) {
    if (now - data.createdAt > TOKEN_TTL_MS) {
      tokenStore.delete(token)
    }
  }
}

export function issueCheckoutToken(stripeSessionId: string | null, userId: string): string {
  cleanupExpired()
  const token = randomBytes(24).toString("hex")
  tokenStore.set(token, { stripeSessionId, userId, createdAt: Date.now() })
  return token
}

export function redeemCheckoutToken(token: string): { stripeSessionId: string | null; userId: string } | null {
  const data = tokenStore.get(token)
  if (!data) return null
  if (Date.now() - data.createdAt > TOKEN_TTL_MS) {
    tokenStore.delete(token)
    return null
  }
  tokenStore.delete(token)
  return { stripeSessionId: data.stripeSessionId, userId: data.userId }
}
