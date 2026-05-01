import { debugLog, debugError, debugWarn } from "@/lib/debug"

// app/api/debug/active-dataset/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { datasets } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// ============================================================================
// DEBUG ENDPOINT - Active Dataset Verification
// Returns: { datasetId, rowCount, columns, sampleRow }
// ============================================================================

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const datasetId = searchParams.get('datasetId');

  if (!datasetId) {
    return NextResponse.json(
      { success: false, error: 'datasetId query parameter required' },
      { status: 400 }
    );
  }

  try {
    // Get dataset info
    const dataset = await db.query.datasets.findFirst({
      where: eq(datasets.id, datasetId),
    });

    if (!dataset) {
      return NextResponse.json(
        { success: false, error: 'Dataset not found', datasetId },
        { status: 404 }
      );
    }

    // Get actual data from datasets.data column
    const data = dataset.data as Record<string, any>[] || [];
    const columns = dataset.columns as string[] || [];
    const sampleRow = data.length > 0 ? data[0] : null;

    debugLog('[DEBUG] Dataset verification:', {
      datasetId,
      rowCount: data.length,
      columns: columns.length,
      sampleColumns: columns.slice(0, 10),
    });

    return NextResponse.json({
      success: true,
      datasetId: dataset.id,
      name: dataset.name,
      rowCount: data.length,
      columns,
      columnCount: columns.length,
      sampleRow,
      createdAt: dataset.createdAt,
    });
  } catch (error) {
    debugError('[DEBUG] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dataset info', details: String(error) },
      { status: 500 }
    );
  }
}
