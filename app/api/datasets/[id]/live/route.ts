// app/api/datasets/[id]/live/route.ts
// Live Data Mode - configure and manage scheduled data refresh

import { NextResponse } from 'next/server';

// In-memory store for live data configs (in production, use database)
const liveDataConfigs = new Map<string, {
  interval: '15min' | 'hourly' | 'daily' | null;
  enabled: boolean;
  sourceType: 'csv' | 'api' | 'cloud';
  sourceUrl?: string;
  lastUpdate?: string;
  nextUpdate?: string;
  status: 'active' | 'disabled' | 'error';
}>();

// GET - Get live data configuration
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  const config = liveDataConfigs.get(id);
  
  if (!config) {
    return NextResponse.json({
      enabled: false,
      interval: null,
      status: 'disabled',
      lastUpdate: null,
      nextUpdate: null
    });
  }
  
  return NextResponse.json({
    enabled: config.enabled,
    interval: config.interval,
    sourceType: config.sourceType,
    sourceUrl: config.sourceUrl,
    lastUpdate: config.lastUpdate,
    nextUpdate: config.nextUpdate,
    status: config.status
  });
}

// POST - Configure live data
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    const body = await request.json();
    const { interval, sourceType, sourceUrl } = body;
    
    if (!interval && interval !== null) {
      return NextResponse.json(
        { error: 'Interval is required' },
        { status: 400 }
      );
    }
    
    const validIntervals = ['15min', 'hourly', 'daily', null];
    if (!validIntervals.includes(interval)) {
      return NextResponse.json(
        { error: 'Invalid interval. Use: 15min, hourly, daily, or null to disable' },
        { status: 400 }
      );
    }
    
    const now = new Date();
    let nextUpdate: string | undefined;
    
    if (interval) {
      const next = new Date(now);
      switch (interval) {
        case '15min':
          next.setMinutes(now.getMinutes() + 15);
          break;
        case 'hourly':
          next.setHours(now.getHours() + 1);
          break;
        case 'daily':
          next.setDate(now.getDate() + 1);
          break;
      }
      nextUpdate = next.toISOString();
    }
    
    const config = {
      interval,
      enabled: interval !== null,
      sourceType: sourceType || 'csv',
      sourceUrl,
      lastUpdate: now.toISOString(),
      nextUpdate,
      status: interval ? 'active' as const : 'disabled' as const
    };
    
    liveDataConfigs.set(id, config);
    
    console.log(`[LIVE] Configured live data for ${id}: ${interval || 'disabled'}`);
    
    return NextResponse.json({
      success: true,
      enabled: config.enabled,
      interval: config.interval,
      sourceType: config.sourceType,
      sourceUrl: config.sourceUrl,
      lastUpdate: config.lastUpdate,
      nextUpdate: config.nextUpdate,
      status: config.status,
      message: interval 
        ? `Live data enabled - will refresh ${interval}` 
        : 'Live data disabled'
    });
    
  } catch (error: any) {
    console.error('[LIVE] Error:', error.message);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Disable live data
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  liveDataConfigs.set(id, {
    interval: null,
    enabled: false,
    sourceType: 'csv',
    status: 'disabled'
  });
  
  return NextResponse.json({
    success: true,
    message: 'Live data disabled'
  });
}
