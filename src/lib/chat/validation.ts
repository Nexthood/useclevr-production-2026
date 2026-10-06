import { db } from '@/lib/db';
import { datasets } from '@/lib/db/schema';
import { isHistoricalDatasetLocked, HISTORICAL_DATA_LOCKED_CODE, HISTORICAL_DATA_LOCKED_MESSAGE } from '@/lib/billing/historical-unlock';
import { and, eq } from 'drizzle-orm';

export async function validateDatasetId(datasetId: string | undefined, userId: string): Promise<{
  valid: boolean;
  dataset?: any;
  error?: string;
  code?: string;
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

  // Preserved historical datasets are LOCKED READ-ONLY after the paid
  // subscription ended. AI question answering on that historical content
  // resumes when the subscription is reactivated or the one-time
  // historical data unlock is purchased.
  if (await isHistoricalDatasetLocked(userId, dataset.createdAt)) {
    return { valid: false, error: HISTORICAL_DATA_LOCKED_MESSAGE, code: HISTORICAL_DATA_LOCKED_CODE };
  }

  return { valid: true, dataset };
}
