/**
 * Simple in-memory rate limiter for Railway deployments
 * Prevents abuse and DDoS attacks
 */

interface RateLimitEntry {
  count: number
  resetTime: number
}

const rateLimitMap = new Map<string, RateLimitEntry>()

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitMap.entries()) {
    if (entry.resetTime < now) {
      rateLimitMap.delete(key)
    }
  }
}, 5 * 60 * 1000)

/**
 * Check if request exceeds rate limit
 * @param identifier - IP address or user ID
 * @param limit - Max requests allowed
 * @param window - Time window in milliseconds (default: 60 seconds)
 */
export function checkRateLimit(
  identifier: string,
  limit: number = 100,
  window: number = 60 * 1000
): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(identifier)

  if (!entry || entry.resetTime < now) {
    // Create new entry
    rateLimitMap.set(identifier, {
      count: 1,
      resetTime: now + window,
    })
    return true
  }

  if (entry.count >= limit) {
    return false
  }

  entry.count++
  return true
}

/**
 * Get current rate limit info
 */
export function getRateLimitInfo(identifier: string) {
  const entry = rateLimitMap.get(identifier)
  if (!entry) return null

  return {
    count: entry.count,
    resetTime: new Date(entry.resetTime),
    remaining: Math.max(0, 100 - entry.count),
  }
}

/**
 * Reset rate limit for identifier
 */
export function resetRateLimit(identifier: string) {
  rateLimitMap.delete(identifier)
}
