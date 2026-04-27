// app/api/insight/route.ts
import { NextResponse } from 'next/server';
import { getBusinessInsight } from '@/lib/business-insight-engine';

// Rate limiting storage (in-memory for demo)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 50;
const RATE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Check rate limit for user
 */
function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_WINDOW_MS });
    return true;
  }
  
  if (userLimit.count >= RATE_LIMIT) {
    return false;
  }
  
  userLimit.count++;
  return true;
}

export async function POST(request: Request) {
  try {
    // Get user ID from headers (or use IP as fallback)
    const userId = request.headers.get('x-user-id') || request.headers.get('x-forwarded-for') || 'anonymous';
    
    // Check rate limit
    if (!checkRateLimit(userId)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', suggestion: 'Try again in 5 minutes' },
        { status: 429 }
      );
    }
    
    const body = await request.json();
    const { datasetId, question } = body;

    if (!datasetId) {
      return NextResponse.json(
        { error: 'datasetId is required' },
        { status: 400 }
      );
    }

    if (!question) {
      return NextResponse.json(
        { error: 'question is required' },
        { status: 400 }
      );
    }

    // Get business insight
    const insight = await getBusinessInsight(datasetId, question);

    return NextResponse.json({
      success: true,
      ...insight
    });
  } catch (error) {
    console.error('[INSIGHT] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate insight' },
      { status: 500 }
    );
  }
}
