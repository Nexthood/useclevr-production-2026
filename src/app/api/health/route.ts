// app/api/health/route.ts
// Simple health check endpoint

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  if (!db) {
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      mode: 'cloud',
      database: 'unavailable',
    }, { status: 503 });
  }

  try {
    await db.query.datasets.findFirst();
  } catch {
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      mode: 'cloud',
      database: 'unavailable',
    }, { status: 503 });
  }

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mode: 'cloud',
    database: 'ready',
  });
}
