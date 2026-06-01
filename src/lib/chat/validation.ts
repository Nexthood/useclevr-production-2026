import { db } from '@/lib/db';
import { datasets } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function validateDatasetId(datasetId: string | undefined): Promise<{
  valid: boolean;
  dataset?: any;
  error?: string;
}> {
  if (!datasetId) {
    return { valid: false, error: 'No datasetId provided' };
  }

  const dataset = await db!.query.datasets.findFirst({
    where: eq(datasets.id, datasetId),
  });

  if (!dataset) {
    return { valid: false, error: 'Dataset not found' };
  }

  return { valid: true, dataset };
}
