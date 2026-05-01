import { debugLog, debugError, debugWarn } from "@/lib/debug"

// app/api/datasets/[id]/analyst/route.ts
// UseClevr AI Analyst Mode - Multi-step analysis with structured report

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { datasets } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { runAnalystMode } from '@/lib/ai-analyst-mode';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    debugLog('[ANALYST] Starting analyst mode for dataset:', id);

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

    debugLog('[ANALYST] Running analyst mode on', data.length, 'rows...');

    // Run complete analyst mode
    const result = await runAnalystMode(id, data);

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
