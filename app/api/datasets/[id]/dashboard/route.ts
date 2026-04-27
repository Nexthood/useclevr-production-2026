// app/api/datasets/[id]/dashboard/route.ts
// Auto Dashboard Builder - generates KPIs and charts from dataset

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { datasets } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { buildDashboard } from '@/lib/dashboard-builder';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log('[DASHBOARD] Building auto dashboard for dataset:', id);

    // Get dataset
    const dataset = await db.query.datasets.findFirst({
      where: eq(datasets.id, id),
    });

    if (!dataset) {
      return NextResponse.json(
        { error: 'Dataset not found' },
        { status: 404 }
      );
    }

    const data = (dataset.data as Record<string, unknown>[]) || [];
    
    if (data.length === 0) {
      return NextResponse.json(
        { error: 'Dataset has no data' },
        { status: 400 }
      );
    }

    console.log('[DASHBOARD] Building dashboard from', data.length, 'rows');

    // Build dashboard
    const dashboard = buildDashboard(id, data);

    console.log('[DASHBOARD] Generated', dashboard.kpis.length, 'KPIs and', dashboard.charts.length, 'charts');

    return NextResponse.json({
      success: true,
      ...dashboard
    });

  } catch (error: any) {
    console.error('[DASHBOARD] Error:', error.message);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
