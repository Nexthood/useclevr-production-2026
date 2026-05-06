import { debugLog, debugError, debugWarn } from "@/lib/debug"

// app/api/datasets/[id]/alerts/route.ts
// AI Alert System - detect significant changes and anomalies

import { NextResponse } from 'next/server';
import { generateAlerts } from '@/lib/alert-system';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    debugLog('[ALERTS] Generating alerts for dataset:', id);

    // Get data from request body
    const body = await request.json();
    const data = body.data || [];
    
    if (data.length === 0) {
      return NextResponse.json(
        { error: 'No data provided' },
        { status: 400 }
      );
    }

    debugLog('[ALERTS] Analyzing', data.length, 'rows');

    // Generate alerts
    const result = await generateAlerts(id, data);

    debugLog('[ALERTS] Generated', result.alerts.length, 'alerts');

    return NextResponse.json({
      success: true,
      ...result
    });

  } catch (error: any) {
    debugError('[ALERTS] Error:', error.message);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
