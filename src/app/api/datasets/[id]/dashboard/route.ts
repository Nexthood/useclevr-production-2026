import { debugError, debugLog } from "@/lib/utils/debug";
import { auth } from '@/lib/auth/auth';

// app/api/datasets/[id]/dashboard/route.ts
// Auto Dashboard Builder - generates KPIs and charts from dataset

import { buildDashboard } from '@/lib/data/dashboard-builder';
import { db } from '@/lib/db';
import { datasetRows, datasets } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    debugLog('[DASHBOARD] Building auto dashboard for dataset:', id);

    // Get dataset
    const dataset = await db.query.datasets.findFirst({
      where: and(eq(datasets.id, id), eq(datasets.userId, session.user.id)),
    });

    if (!dataset) {
      return NextResponse.json(
        { error: 'Dataset not found' },
        { status: 404 }
      );
    }

    let data = (dataset.data as Record<string, unknown>[]) || [];
    if (data.length === 0) {
      const rows = await db.query.datasetRows.findMany({
        where: eq(datasetRows.datasetId, id),
        columns: { data: true },
        orderBy: (rows, { asc }) => [asc(rows.rowIndex)],
      });
      data = rows.map((row) => row.data as Record<string, unknown>);
    }
    
    if (data.length === 0) {
      return NextResponse.json(
        { error: 'Dataset has no data' },
        { status: 400 }
      );
    }

    debugLog('[DASHBOARD] Building dashboard from', data.length, 'rows');

    // Build dashboard
    const dashboard = buildDashboard(id, data);

    debugLog('[DASHBOARD] Generated', dashboard.kpis.length, 'KPIs and', dashboard.charts.length, 'charts');

    return NextResponse.json({
      success: true,
      ...dashboard
    });

  } catch (error: any) {
    debugError('[DASHBOARD] Error:', error.message);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
