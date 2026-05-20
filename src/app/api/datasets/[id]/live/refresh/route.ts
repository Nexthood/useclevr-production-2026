import { debugLog } from "@/lib/utils/debug";

// app/api/datasets/[id]/live/refresh/route.ts
// Trigger manual refresh for live data

import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  debugLog(`[LIVE-REFRESH] Manual refresh triggered for ${id}`);
  
  return NextResponse.json({
    success: true,
    message: 'Refresh accepted. No external live source is configured for this dataset.',
    rowsUpdated: 0,
    intelligenceRegenerated: false,
    dashboardRebuilt: false,
    predictionsGenerated: false,
    lastUpdate: new Date().toISOString()
  });
}
