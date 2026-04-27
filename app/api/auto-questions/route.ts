// app/api/auto-questions/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { datasets } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { generateAutoQuestions } from '@/lib/auto-question-engine';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { datasetId } = body;

    if (!datasetId) {
      return NextResponse.json(
        { error: 'datasetId is required' },
        { status: 400 }
      );
    }

    // Get dataset from database
    const dataset = await db.query.datasets.findFirst({
      where: eq(datasets.id, datasetId),
    });

    if (!dataset) {
      return NextResponse.json(
        { error: 'Dataset not found' },
        { status: 404 }
      );
    }

    // Get columns and sample data
    const columns = (dataset.columns as string[]) || [];
    const data = (dataset.data as Record<string, any>[]) || [];
    const sampleData = data.slice(0, 10);
    const rowCount = dataset.rowCount || data.length;

    if (columns.length === 0) {
      return NextResponse.json(
        { error: 'Dataset has no columns' },
        { status: 400 }
      );
    }

    // Generate auto questions
    const result = await generateAutoQuestions(columns, sampleData, rowCount, columns.length);

    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('[AUTO_QUESTIONS] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate questions' },
      { status: 500 }
    );
  }
}
