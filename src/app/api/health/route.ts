import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();

  if (!db) {
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      mode: 'cloud',
      database: 'unavailable',
    });
  }

  try {
    await db.execute(sql`SELECT 1`);
  } catch {
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      mode: 'cloud',
      database: 'degraded',
    });
  }

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mode: 'cloud',
    database: 'ready',
  });
}

export async function HEAD() {
  const db = getDb();

  if (!db) {
    return new Response(null, { status: 200 });
  }

  try {
    await db.execute(sql`SELECT 1`);
  } catch {
    return new Response(null, {
      status: 200,
      headers: {
        'x-useclevr-database': 'degraded',
      },
    });
  }

  return new Response(null, {
    status: 200,
    headers: {
      'x-useclevr-database': 'ready',
    },
  });
}

export async function POST() {
  const db = getDb();

  if (!db) {
    return NextResponse.json({
      status: 'not-ready',
      timestamp: new Date().toISOString(),
      mode: 'cloud',
      database: 'unavailable',
    }, { status: 503 });
  }

  try {
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      mode: 'cloud',
      database: 'ready',
    });
  } catch {
    return NextResponse.json({
      status: 'not-ready',
      timestamp: new Date().toISOString(),
      mode: 'cloud',
      database: 'degraded',
    }, { status: 503 });
  }
}
