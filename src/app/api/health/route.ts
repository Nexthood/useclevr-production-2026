// app/api/health/route.ts
// Simple health check endpoint

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mode: 'cloud'
  });
}
