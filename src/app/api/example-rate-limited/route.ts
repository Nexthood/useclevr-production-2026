import { debugLog, debugError, debugWarn } from "@/lib/debug"

import { checkRateLimit } from '@/lib/rate-limiter'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Example: Rate limited API endpoint
 * Usage: Apply this pattern to any sensitive endpoint
 */
export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      'unknown'

    // Check rate limit: 10 requests per minute
    if (!checkRateLimit(`api:${ip}`, 10, 60 * 1000)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Try again in a minute.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    }

    // Your endpoint logic here
    const body = await request.json()
    // ... handle request ...

    return NextResponse.json({ success: true })
  } catch (error) {
    debugError('Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
