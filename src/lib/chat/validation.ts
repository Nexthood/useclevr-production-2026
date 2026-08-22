import { db } from '@/lib/db';
import { datasets } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

export async function validateDatasetId(datasetId: string | undefined, userId: string): Promise<{
  valid: boolean;
  dataset?: any;
  error?: string;
}> {
  if (!datasetId) {
    return { valid: false, error: 'No datasetId provided' };
  }

  const dataset = await db!.query.datasets.findFirst({
    where: and(eq(datasets.id, datasetId), eq(datasets.userId, userId)),
  });

  if (!dataset) {
    return { valid: false, error: 'Dataset not found' };
  }

  return { valid: true, dataset };
}
