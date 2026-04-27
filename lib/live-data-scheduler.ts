/**
 * Live Data Scheduler
 * 
 * Manages scheduled data refresh for datasets.
 * Supports interval-based refresh (15min, hourly, daily).
 */

import { db } from '@/lib/db';
import { datasets } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { buildDatasetIntelligence } from './dataset-intelligence';
import { buildDashboard, DashboardConfig } from './dashboard-builder';
import { generatePredictions, PredictiveResult } from './predictive-engine';
import { investigateDataset, InvestigationResult } from './dataset-investigator';

export type RefreshInterval = '15min' | 'hourly' | 'daily' | null;

export interface LiveDataConfig {
  datasetId: string;
  interval: RefreshInterval;
  enabled: boolean;
  sourceType: 'csv' | 'api' | 'cloud';
  sourceUrl?: string;
  lastUpdate?: string;
  nextUpdate?: string;
  status: 'active' | 'disabled' | 'error';
}

export interface RefreshResult {
  success: boolean;
  rowsUpdated: number;
  intelligenceRegenerated: boolean;
  dashboardRebuilt: boolean;
  predictionsGenerated: boolean;
  investigationCompleted: boolean;
  error?: string;
}

// In-memory scheduler (in production, use Redis or database)
const scheduledJobs: Map<string, NodeJS.Timeout> = new Map();

/**
 * Configure live data for a dataset
 */
export async function configureLiveData(
  datasetId: string,
  config: {
    interval: RefreshInterval;
    sourceType: 'csv' | 'api' | 'cloud';
    sourceUrl?: string;
  }
): Promise<LiveDataConfig> {
  // Update dataset with live config
  await db.update(datasets)
    .set({
      // store live config inside analysis to avoid schema mismatch while preserving behavior
      analysis: {
        ...(await db.query.datasets.findFirst({ where: eq(datasets.id, datasetId) }))?.analysis ?? {},
        __liveConfig: {
          interval: config.interval,
          enabled: config.interval !== null,
          sourceType: config.sourceType,
          sourceUrl: config.sourceUrl,
          lastUpdate: new Date().toISOString(),
          nextUpdate: calculateNextUpdate(config.interval),
          status: config.interval ? 'active' : 'disabled'
        }
      } as any
    })
    .where(eq(datasets.id, datasetId));
  
  // Schedule or clear the job
  if (config.interval) {
    await scheduleRefresh(datasetId, config.interval);
  } else {
    await cancelRefresh(datasetId);
  }
  
  return {
    datasetId,
    interval: config.interval,
    enabled: config.interval !== null,
    sourceType: config.sourceType,
    sourceUrl: config.sourceUrl,
    status: config.interval ? 'active' : 'disabled'
  };
}

/**
 * Get live data configuration for a dataset
 */
export async function getLiveDataConfig(datasetId: string): Promise<LiveDataConfig | null> {
  const dataset = await db.query.datasets.findFirst({
    where: eq(datasets.id, datasetId)
  });
  const analysis = (dataset as any)?.analysis ?? {};
  const live = analysis.__liveConfig as LiveDataConfig | undefined;
  return live ?? null;
}

/**
 * Schedule a refresh job
 */
async function scheduleRefresh(datasetId: string, interval: RefreshInterval): Promise<void> {
  // Cancel existing job
  await cancelRefresh(datasetId);
  
  // Narrow away null interval to satisfy index type
  if (interval === null) {
    return;
  }

  const intervalMs = {
    '15min': 15 * 60 * 1000,
    'hourly': 60 * 60 * 1000,
    'daily': 24 * 60 * 60 * 1000
  }[interval];
  
  // Schedule recurring job
  const jobId = setInterval(async () => {
    try {
      console.log(`[SCHEDULER] Running scheduled refresh for ${datasetId}`);
      await performRefresh(datasetId);
    } catch (error) {
      console.error(`[SCHEDULER] Refresh failed for ${datasetId}:`, error);
    }
  }, intervalMs);
  
  scheduledJobs.set(datasetId, jobId);
  console.log(`[SCHEDULER] Scheduled ${interval} refresh for ${datasetId}`);
}

/**
 * Cancel a scheduled job
 */
async function cancelRefresh(datasetId: string): Promise<void> {
  const existingJob = scheduledJobs.get(datasetId);
  if (existingJob) {
    clearInterval(existingJob);
    scheduledJobs.delete(datasetId);
    console.log(`[SCHEDULER] Cancelled refresh for ${datasetId}`);
  }
}

/**
 * Calculate next update time
 */
function calculateNextUpdate(interval: RefreshInterval): string {
  const now = new Date();
  const next = new Date(now);
  
  switch (interval) {
    case '15min':
      next.setMinutes(now.getMinutes() + 15);
      break;
    case 'hourly':
      next.setHours(now.getHours() + 1);
      break;
    case 'daily':
      next.setDate(now.getDate() + 1);
      break;
  }
  
  return next.toISOString();
}

/**
 * Perform data refresh
 */
export async function performRefresh(datasetId: string): Promise<RefreshResult> {
  const result: RefreshResult = {
    success: false,
    rowsUpdated: 0,
    intelligenceRegenerated: false,
    dashboardRebuilt: false,
    predictionsGenerated: false,
    investigationCompleted: false
  };
  
  try {
    // Get current dataset
    const dataset = await db.query.datasets.findFirst({
      where: eq(datasets.id, datasetId)
    });
    
    if (!dataset) {
      throw new Error('Dataset not found');
    }
    
    const analysis = (dataset as any)?.analysis ?? {};
    const config = analysis.__liveConfig as LiveDataConfig | undefined;
    if (!config || !config.enabled) {
      throw new Error('Live data not enabled');
    }
    
    // Fetch new data based on source type
    let newData: Record<string, unknown>[] = [];
    
    switch (config.sourceType) {
      case 'csv':
        if (config.sourceUrl) {
          newData = await fetchCSVData(config.sourceUrl);
        }
        break;
      case 'api':
        if (config.sourceUrl) {
          newData = await fetchAPIData(config.sourceUrl);
        }
        break;
      case 'cloud':
        // Placeholder for cloud storage
        console.log('[SCHEDULER] Cloud storage refresh not implemented');
        break;
    }
    
    if (newData.length === 0) {
      throw new Error('No new data fetched');
    }
    
    result.rowsUpdated = newData.length;
    
    // Update dataset with new data
    await db.update(datasets)
      .set({
        data: newData as any,
        updatedAt: new Date()
      })
      .where(eq(datasets.id, datasetId));
    
    // Regenerate analytics in background
    // Note: These run asynchronously to not block the refresh
    Promise.all([
      // Rebuild intelligence
      Promise.resolve(buildDatasetIntelligence(newData as any)).then(() => {
        result.intelligenceRegenerated = true;
      }),
      
      // Rebuild dashboard
      Promise.resolve(buildDashboard(datasetId, newData)).then(() => {
        result.dashboardRebuilt = true;
      }).catch(console.error),
      
      // Generate predictions
      Promise.resolve(generatePredictions(datasetId, newData)).then(() => {
        result.predictionsGenerated = true;
      }).catch(console.error),
      
      // Run investigation
      Promise.resolve(investigateDataset(datasetId, newData)).then(() => {
        result.investigationCompleted = true;
      }).catch(console.error)
    ]);
    
    // Update last update time
    const nextUpdate = calculateNextUpdate(config.interval);
    const current = await db.query.datasets.findFirst({ where: eq(datasets.id, datasetId) });
    const prevAnalysis = (current as any)?.analysis ?? {};
    await db.update(datasets)
      .set({
        analysis: {
          ...prevAnalysis,
          __liveConfig: {
            ...config,
            lastUpdate: new Date().toISOString(),
            nextUpdate
          }
        } as any
      })
      .where(eq(datasets.id, datasetId));
    
    result.success = true;
    console.log(`[SCHEDULER] Refresh completed for ${datasetId}: ${result.rowsUpdated} rows`);
    
    return result;
  } catch (error: any) {
    result.error = error.message;
    console.error(`[SCHEDULER] Refresh error for ${datasetId}:`, error);
    return result;
  }
}

/**
 * Fetch data from CSV URL
 */
async function fetchCSVData(url: string): Promise<Record<string, unknown>[]> {
  const response = await fetch(url);
  const text = await response.text();
  
  // Simple CSV parser
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const data: Record<string, unknown>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
    const row: Record<string, unknown> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });
    data.push(row);
  }
  
  return data;
}

/**
 * Fetch data from API endpoint
 */
async function fetchAPIData(url: string): Promise<Record<string, unknown>[]> {
  const response = await fetch(url);
  const json = await response.json();
  
  // Handle array response or { data: [...] } format
  if (Array.isArray(json)) {
    return json;
  } else if (json.data && Array.isArray(json.data)) {
    return json.data;
  }
  
  return [];
}

/**
 * Initialize scheduler from database (for server restart)
 */
export async function initializeScheduler(): Promise<void> {
  console.log('[SCHEDULER] Initializing scheduler...');
  
  const allDatasets = await db.query.datasets.findMany();
  
  for (const dataset of allDatasets) {
    const analysis = (dataset as any)?.analysis ?? {};
    const live = analysis.__liveConfig as LiveDataConfig | undefined;
    if (live) {
      const config = live;
      if (config.enabled && config.interval) {
        await scheduleRefresh(dataset.id, config.interval);
      }
    }
  }
  
  console.log(`[SCHEDULER] Initialized ${scheduledJobs.size} scheduled jobs`);
}
