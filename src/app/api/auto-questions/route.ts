import { debugError } from "@/lib/utils/debug";
import { auth } from '@/lib/auth/auth';

// app/api/auto-questions/route.ts
import { db } from '@/lib/db';
import { datasetRows, datasets } from '@/lib/db/schema';
import { generateAutoQuestions } from '@/lib/utils/auto-question-engine';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
      where: and(eq(datasets.id, datasetId), eq(datasets.userId, session.user.id)),
    });

    if (!dataset) {
      return NextResponse.json(
        { error: 'Dataset not found' },
        { status: 404 }
      );
    }

    // Get columns and sample data
    const columns = (dataset.columns as string[]) || [];
    let data = (dataset.data as Record<string, any>[]) || [];
    if (data.length === 0) {
      const rows = await db.query.datasetRows.findMany({
        where: eq(datasetRows.datasetId, datasetId),
        columns: { data: true },
        orderBy: (rows, { asc }) => [asc(rows.rowIndex)],
        limit: 10,
      });
      data = rows.map((row) => row.data as Record<string, any>);
    }
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
    debugError('[AUTO_QUESTIONS] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate questions' },
      { status: 500 }
    );
  }
}
