// ============================================================================
// BACKGROUND JOB SYSTEM - Simple Queue for Large Dataset Processing
// ============================================================================
// Handles background processing for datasets above 50k rows
// Uses in-memory queue (can be replaced with BullMQ/Redis in production)
// ============================================================================

import { AnalysisJob, LARGE_DATASET_THRESHOLD } from './pipeline-types';

// ============================================================================
// JOB QUEUE (In-Memory)
// ============================================================================

// In-memory job storage (use Redis in production)
const jobQueue: Map<string, AnalysisJob> = new Map();
const pendingQueue: string[] = [];

// ============================================================================
// JOB MANAGEMENT
// ============================================================================

/**
 * Create a new analysis job
 */
export function createAnalysisJob(
  datasetId: string,
  userId: string,
  priority: 'low' | 'normal' | 'high' = 'normal'
): AnalysisJob {
  const job: AnalysisJob = {
    id: `job_${Date.now()}_${datasetId}`,
    datasetId,
    userId,
    status: 'queued',
    priority,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    maxRetries: 3,
  };
  
  jobQueue.set(job.id, job);
  pendingQueue.push(job.id);
  
  console.log(`[JOB] Created job ${job.id} for dataset ${datasetId}`);
  
  return job;
}

/**
 * Get job by ID
 */
export function getJob(jobId: string): AnalysisJob | null {
  return jobQueue.get(jobId) || null;
}

/**
 * Get all jobs for a dataset
 */
export function getJobsByDataset(datasetId: string): AnalysisJob[] {
  return Array.from(jobQueue.values())
    .filter(job => job.datasetId === datasetId);
}

/**
 * Get next job from queue
 */
export function getNextJob(): AnalysisJob | null {
  // Find highest priority job
  let nextJobId: string | null = null;
  let lowestPriority = 3; // high=1, normal=2, low=3
  
  for (const jobId of pendingQueue) {
    const job = jobQueue.get(jobId);
    if (job && job.status === 'queued') {
      const priorityNum = job.priority === 'high' ? 1 : job.priority === 'normal' ? 2 : 3;
      if (priorityNum < lowestPriority) {
        lowestPriority = priorityNum;
        nextJobId = jobId;
      }
    }
  }
  
  if (nextJobId) {
    const job = jobQueue.get(nextJobId)!;
    job.status = 'processing';
    job.startedAt = new Date().toISOString();
    
    // Remove from pending
    const idx = pendingQueue.indexOf(nextJobId);
    if (idx > -1) pendingQueue.splice(idx, 1);
    
    return job;
  }
  
  return null;
}

/**
 * Mark job as completed
 */
export function completeJob(jobId: string, error?: string): AnalysisJob | null {
  const job = jobQueue.get(jobId);
  if (!job) return null;
  
  job.status = error ? 'failed' : 'completed';
  job.completedAt = new Date().toISOString();
  job.error = error;
  
  console.log(`[JOB] Job ${jobId} ${error ? 'failed' : 'completed'}`);
  
  return job;
}

/**
 * Mark job for retry
 */
export function retryJob(jobId: string): AnalysisJob | null {
  const job = jobQueue.get(jobId);
  if (!job) return null;
  
  if (job.retryCount >= job.maxRetries) {
    job.status = 'failed';
    job.completedAt = new Date().toISOString();
    job.error = 'Max retries exceeded';
    console.log(`[JOB] Job ${jobId} failed: max retries exceeded`);
    return job;
  }
  
  job.retryCount++;
  job.status = 'queued';
  job.startedAt = undefined;
  pendingQueue.push(jobId);
  
  console.log(`[JOB] Job ${jobId} queued for retry (attempt ${job.retryCount}/${job.maxRetries})`);
  
  return job;
}

/**
 * Cancel a job
 */
export function cancelJob(jobId: string): AnalysisJob | null {
  const job = jobQueue.get(jobId);
  if (!job) return null;
  
  job.status = 'cancelled';
  job.completedAt = new Date().toISOString();
  
  // Remove from pending
  const idx = pendingQueue.indexOf(jobId);
  if (idx > -1) pendingQueue.splice(idx, 1);
  
  console.log(`[JOB] Job ${jobId} cancelled`);
  
  return job;
}

/**
 * Get queue statistics
 */
export function getQueueStats(): {
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
} {
  const jobs = Array.from(jobQueue.values());
  
  return {
    queued: jobs.filter(j => j.status === 'queued').length,
    processing: jobs.filter(j => j.status === 'processing').length,
    completed: jobs.filter(j => j.status === 'completed').length,
    failed: jobs.filter(j => j.status === 'failed').length,
    total: jobs.length,
  };
}

// ============================================================================
// BACKGROUND PROCESSOR (Simple Implementation)
// ============================================================================

let isProcessorRunning = false;
let processorInterval: NodeJS.Timeout | null = null;

/**
 * Start background job processor
 */
export function startJobProcessor(
  processFn: (job: AnalysisJob) => Promise<void>,
  intervalMs: number = 5000
): void {
  if (isProcessorRunning) {
    console.log('[PROCESSOR] Already running');
    return;
  }
  
  isProcessorRunning = true;
  
  processorInterval = setInterval(async () => {
    try {
      const job = getNextJob();
      if (job) {
        console.log(`[PROCESSOR] Processing job ${job.id}`);
        try {
          await processFn(job);
          completeJob(job.id);
        } catch (error: any) {
          console.error(`[PROCESSOR] Job ${job.id} failed:`, error.message);
          retryJob(job.id);
        }
      }
    } catch (error) {
      console.error('[PROCESSOR] Error in processing loop:', error);
    }
  }, intervalMs);
  
  console.log('[PROCESSOR] Started background job processor');
}

/**
 * Stop background job processor
 */
export function stopJobProcessor(): void {
  if (processorInterval) {
    clearInterval(processorInterval);
    processorInterval = null;
  }
  isProcessorRunning = false;
  console.log('[PROCESSOR] Stopped background job processor');
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if dataset should use background processing
 */
export function shouldUseBackgroundProcessing(rowCount: number): boolean {
  return rowCount > LARGE_DATASET_THRESHOLD;
}

/**
 * Get estimated processing time (rough estimate)
 */
export function estimateProcessingTime(rowCount: number): {
  estimatedMinutes: number;
  recommendation: string;
} {
  if (rowCount <= 10000) {
    return { estimatedMinutes: 1, recommendation: 'Immediate processing recommended' };
  } else if (rowCount <= 50000) {
    return { estimatedMinutes: 2, recommendation: 'Immediate processing recommended' };
  } else if (rowCount <= 100000) {
    return { estimatedMinutes: 5, recommendation: 'Background processing recommended' };
  } else if (rowCount <= 500000) {
    return { estimatedMinutes: 15, recommendation: 'Background processing required' };
  }
  return { estimatedMinutes: 30, recommendation: 'Chunked background processing required' };
}

/**
 * Clean up old completed jobs
 */
export function cleanupOldJobs(maxAgeHours: number = 24): number {
  const cutoff = Date.now() - (maxAgeHours * 60 * 60 * 1000);
  let cleaned = 0;
  
  for (const [jobId, job] of jobQueue.entries()) {
    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      const completedAt = job.completedAt ? new Date(job.completedAt).getTime() : 0;
      if (completedAt < cutoff) {
        jobQueue.delete(jobId);
        cleaned++;
      }
    }
  }
  
  if (cleaned > 0) {
    console.log(`[JOBS] Cleaned up ${cleaned} old jobs`);
  }
  
  return cleaned;
}
