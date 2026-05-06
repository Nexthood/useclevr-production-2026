import { debugLog, debugError, debugWarn } from "@/lib/debug"

// app/api/debug/dataset/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { datasets, datasetRows } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

// ============================================================================
// DEBUG ENDPOINT - Dataset Verification
// Returns real SQL execution results for debugging
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

    // Execute real SQL to get row count
    const rowCountResult = await db.select({
      count: sql<number>`count(*)::int`,
    })
      .from(datasetRows)
      .where(eq(datasetRows.datasetId, datasetId));

    const rowCount = rowCountResult[0]?.count || 0;

    // Get sample rows
    const sampleRows = await db.query.datasetRows.findMany({
      where: eq(datasetRows.datasetId, datasetId),
      orderBy: (rows, { asc }) => [asc(rows.rowIndex)],
      limit: 5,
    });

    // Extract column names from first row
    const sampleData = sampleRows.map(r => r.data);
    const first = sampleData[0];
    const columns = first && typeof first === 'object' ? Object.keys(first) : [];

    debugLog('[DEBUG] Dataset verification:', {
      datasetId,
      rowCount,
      columns: columns.length,
      sampleColumns: columns.slice(0, 10),
    });

    return NextResponse.json({
      success: true,
      datasetId: dataset.id,
      name: dataset.name,
      rowCount,
      columns,
      columnCount: columns.length,
      sampleRow: sampleData[0] || null,
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
