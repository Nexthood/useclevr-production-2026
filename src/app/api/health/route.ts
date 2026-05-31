import { sql } from 'drizzle-orm';
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
    await db.execute(sql`SELECT 1`);
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
