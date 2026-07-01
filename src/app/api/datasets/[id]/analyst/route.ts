import { debugError, debugLog } from "@/lib/utils/debug";
import { auth } from '@/lib/auth/auth';

// app/api/datasets/[id]/analyst/route.ts
// UseClevr AI Analyst Mode - Multi-step analysis with structured report

import { runAnalystMode } from '@/lib/ai/ai-analyst-mode';
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

    debugLog('[ANALYST] Starting analyst mode for dataset:', id);

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

    debugLog('[ANALYST] Running analyst mode on', data.length, 'rows...');

    // Run complete analyst mode
    const result = await runAnalystMode(id, data, session.user.id);

    debugLog('[ANALYST] Completed with plan:', result.plan.analysis_plan.length, 'steps');
    debugLog('[ANALYST] Report overview:', result.report.overview.substring(0, 100) + '...');

    return NextResponse.json({
      success: true,
      ...result
    });

  } catch (error: any) {
    debugError('[ANALYST] Error:', error.message);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
