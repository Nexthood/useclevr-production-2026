import { debugError, debugLog } from "@/lib/utils/debug";

/**
 * Shareable Report Generator
 * 
 * Creates structured reports from dataset analysis.
 * Generates unique report IDs and stores reports for sharing.
 * Uses file-based storage for persistence.
 */

import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { BusinessBalancedScorecard } from '@/lib/business/balanced-scorecard';
import { generatePdfReport } from './pdf-report-generator';

// File-based storage path: use explicit temp directory to avoid broad project tracing in Next/Turbopack
const REPORTS_DIR = process.env.TEMP_DIR || '/tmp/useclevr-reports';
const REPORTS_FILE = path.join(REPORTS_DIR, 'reports.json');

debugLog('[REPORT] Reports file path:', REPORTS_FILE);

// Ensure reports directory exists
function ensureReportsDir() {
  try {
    if (!fs.existsSync(REPORTS_DIR)) {
      fs.mkdirSync(REPORTS_DIR, { recursive: true });
      debugLog('[REPORT] Created reports directory:', REPORTS_DIR);
    }
  } catch (error) {
    debugError('[REPORT] Error creating reports directory:', error);
  }
}

// Load reports from file
function loadReports(): Map<string, Report> {
  ensureReportsDir();
  try {
    if (fs.existsSync(REPORTS_FILE)) {
      const data = fs.readFileSync(REPORTS_FILE, 'utf-8');
      debugLog('[REPORT] Raw file data length:', data.length);
      const reportsArray = JSON.parse(data);
      debugLog('[REPORT] Parsed reports array:', JSON.stringify(reportsArray).substring(0, 200));
      
      // Array is [[id, report], [id, report], ...]
      // Need to convert to Map
      const result = new Map<string, Report>();
      for (const entry of reportsArray) {
        if (Array.isArray(entry) && entry.length === 2) {
          const [id, report] = entry;
          if (id && report) {
            result.set(String(id), report as Report);
          }
        }
      }
      debugLog('[REPORT] Loaded reports count:', result.size);
      return result;
    } else {
      debugLog('[REPORT] No reports file found, starting fresh');
    }
  } catch (error) {
    debugError('[REPORT] Error loading reports:', error);
  }
  return new Map();
}

// Save reports to file
function saveReports(reports: Map<string, Report>) {
  ensureReportsDir();
  try {
    const data = JSON.stringify(Array.from(reports.entries()));
    fs.writeFileSync(REPORTS_FILE, data, 'utf-8');
    debugLog('[REPORT] Saved reports, count:', reports.size);
  } catch (error) {
    debugError('[REPORT] Error saving reports:', error);
  }
}

// In-memory cache for fast access (synced with file)
let reportsCache: Map<string, Report> | null = null;

function getReports(): Map<string, Report> {
  if (!reportsCache) {
    reportsCache = loadReports();
    debugLog('[REPORT] getReports() returning count:', reportsCache.size);
  }
  return reportsCache;
}

function setReports(reports: Map<string, Report>) {
  reportsCache = reports;
  saveReports(reports);
}

export interface ReportSection {
  title: string;
  content: string;
}

export interface ReportChart {
  type: 'bar' | 'line' | 'pie';
  title: string;
  data: { name: string; value: number }[];
}

export interface ReportFinancials {
  reportingPeriod?: string | null;
  dataConfidence?: number | null;
  metricSources?: Partial<Record<keyof Omit<ReportFinancials, "metricSources" | "missingFields" | "topCostCategories" | "periodTrends">, {
    kind: "source_value" | "derived_value" | "unavailable";
    note: string;
  }>>;
  revenue: number | null;
  cogs: number | null;
  grossProfit: number | null;
  operatingExpenses: number | null;
  operatingProfit: number | null;
  interestExpense: number | null;
  taxExpense: number | null;
  netProfit: number | null;
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  revenueGrowth?: number | null;
  expenseRatio?: number | null;
  missingFields?: string[];
  topCostCategories?: { name: string; value: number }[];
  periodTrends?: Array<{
    period: string;
    revenue: number | null;
    cogs?: number | null;
    operatingExpenses?: number | null;
    interestExpense?: number | null;
    taxExpense?: number | null;
    grossProfit: number | null;
    operatingProfit: number | null;
    netProfit: number | null;
    grossMargin?: number | null;
    operatingMargin?: number | null;
    netMargin?: number | null;
  }>;
}

export interface ReportRecommendation {
  issue: string;
  businessImpact: string;
  recommendedAction: string;
  estimatedImpact?: string | null;
  confidence?: "High" | "Medium" | "Low";
  requiredData?: string[];
}

export interface Report {
  id: string;
  datasetId: string;
  datasetName: string;
  createdAt: string;
  status?: 'pending' | 'processing' | 'ready' | 'failed';
  reportType?: string;
  businessModel?: string;
  userId?: string | null;
  workspaceId?: string | null;
  idempotencyKey?: string | null;
  
  // Timezone metadata
  timezone: string;
  timezoneOffset: number;
  localTime: string;
  
  visibility: 'private' | 'public';
  
  // PDF file path
  pdfPath?: string;
  pdfFilename?: string;
  
  // Report sections
  summary: string;
  financials?: ReportFinancials;
  bbsc?: BusinessBalancedScorecard;
  findings: string[];
  kpis: { title: string; value: string }[];
  charts: ReportChart[];
  aiInsights: string[];
  predictions: string[];
  recommendations?: ReportRecommendation[];
  alerts: { type: string; message: string; severity: string }[];
  
  // Metadata
  rowCount: number;
  columnCount: number;
}

/**
 * Generate a shareable report from dataset analysis
 */
export async function generateReport(
  datasetId: string,
  datasetName: string,
  options: {
    visibility?: 'private' | 'public';
    includePredictions?: boolean;
    includeAlerts?: boolean;
    timezone?: string;
    timezoneOffset?: number;
    status?: 'pending' | 'processing' | 'ready' | 'failed';
    reportType?: string;
    businessModel?: string;
    userId?: string | null;
    workspaceId?: string | null;
    idempotencyKey?: string | null;
  },
  analysisData: {
    summary?: string;
    findings?: string[];
    kpis?: { title: string; value: number; format: string }[];
    charts?: ReportChart[];
    aiInsights?: string[];
    predictions?: string[];
    alerts?: { type: string; message: string; severity: string }[];
    financials?: ReportFinancials;
    recommendations?: ReportRecommendation[];
    reportType?: string;
    businessModel?: string;
    bbsc?: BusinessBalancedScorecard;
    rowCount: number;
    columns: string[];
  }
): Promise<Report> {
  // Generate unique report ID
  const reportId = uuidv4().substring(0, 8);
  
  // Get timezone info - use provided or detect from browser context
  const now = new Date();
  const utcTimestamp = now.toISOString();
  
  // Get timezone from options or try to detect from Intl
  const timezone = options.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const timezoneOffset = options.timezoneOffset ?? now.getTimezoneOffset();
  
  // Format local time for display
  const localDateTime = new Date(now.getTime() - (timezoneOffset * 60000));
  const localTime = localDateTime.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone
  });
  
  // Format KPIs for display
  const formattedKPIs = (analysisData.kpis || []).map(kpi => ({
    title: kpi.title,
    value: formatKPIValue(kpi.value, kpi.format)
  }));
  
  const report: Report = {
    id: reportId,
    datasetId,
    datasetName,
    createdAt: utcTimestamp,
    status: options.status || 'ready',
    reportType: options.reportType || analysisData.reportType,
    businessModel: options.businessModel || analysisData.businessModel,
    userId: options.userId || null,
    workspaceId: options.workspaceId || options.userId || null,
    idempotencyKey: options.idempotencyKey || null,
    
    // Timezone metadata - stored internally
    timezone,
    timezoneOffset,
    localTime,
    
    visibility: options.visibility || 'private',
    
    // Report content
    summary: analysisData.summary || 'Analysis report for ' + datasetName,
    financials: analysisData.financials,
    bbsc: analysisData.bbsc,
    findings: analysisData.findings || [],
    kpis: formattedKPIs,
    charts: analysisData.charts || [],
    aiInsights: analysisData.aiInsights || [],
    predictions: (options.includePredictions !== false) ? (analysisData.predictions || []) : [],
    recommendations: analysisData.recommendations,
    alerts: (options.includeAlerts !== false) ? (analysisData.alerts || []) : [],
    
    // Metadata
    rowCount: analysisData.rowCount,
    columnCount: analysisData.columns.length
  };
  
  // Generate PDF report
  try {
    const pdfPath = await generatePdfReport(report);
    report.pdfPath = pdfPath;
    report.pdfFilename = `${datasetName.replace(/[^a-z0-9]/gi, '_')}_report_${reportId}.pdf`;
    debugLog(`[REPORT] PDF generated: ${pdfPath}`);
  } catch (pdfError) {
    debugError('[REPORT] PDF generation failed:', pdfError);
  }
  
  // Store report
  getReports().set(reportId, report);
  setReports(getReports());
  
  debugLog(`[REPORT] Generated report ${reportId} for dataset ${datasetId}`);
  debugLog(`[REPORT] Total reports in storage after save: ${getReports().size}`);
  
  return report;
}

/**
 * Get report by ID
 */
export function getReport(reportId: string): Report | null {
  const report = getReports().get(reportId);
  
  if (!report) {
    return null;
  }
  
  if (report.visibility === 'private') {
    // TODO: check requesting user owns the report once auth context is threaded in
    return report;
  }

  return report;
}

/**
 * List all reports
 */
export function listAllReports(): Report[] {
  debugLog('[REPORTS] listAllReports called, Map size:', getReports().size);
  return Array.from(getReports().values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * List reports for a dataset
 */
export function listReports(datasetId: string): Report[] {
  return Array.from(getReports().values())
    .filter(r => r.datasetId === datasetId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Find an existing report generated for the same dataset operation.
 */
export function findReportByIdempotencyKey(datasetId: string, idempotencyKey: string): Report | null {
  return Array.from(getReports().values())
    .find((report) => report.datasetId === datasetId && report.idempotencyKey === idempotencyKey) || null;
}

/**
 * Delete a report
 */
export function deleteReport(reportId: string): boolean {
  const deleted = getReports().delete(reportId);
  if (deleted) {
    setReports(getReports());
  }
  return deleted;
}

/**
 * Delete every stored report linked to the given datasets.
 * Missing PDF files are treated as already clean and do not block report removal.
 */
export async function deleteReportsForDatasets(datasetIds: string[]): Promise<{ deletedReportIds: string[]; failed: { reportId: string; reason: string }[] }> {
  const datasetIdSet = new Set(datasetIds);
  const reports = getReports();
  const deletedReportIds: string[] = [];
  const failed: { reportId: string; reason: string }[] = [];

  for (const report of Array.from(reports.values())) {
    if (!datasetIdSet.has(report.datasetId)) continue;

    if (report.pdfPath) {
      try {
        if (fs.existsSync(report.pdfPath)) {
          fs.unlinkSync(report.pdfPath);
        }
      } catch (error) {
        failed.push({
          reportId: report.id,
          reason: error instanceof Error ? error.message : "PDF cleanup failed",
        });
      }
    }

    reports.delete(report.id);
    deletedReportIds.push(report.id);
  }

  if (deletedReportIds.length > 0) {
    setReports(reports);
  }

  return { deletedReportIds, failed };
}

/**
 * Update report visibility
 */
export function updateReportVisibility(
  reportId: string, 
  visibility: 'private' | 'public'
): Report | null {
  const report = getReports().get(reportId);
  
  if (!report) {
    return null;
  }
  
  report.visibility = visibility;
  getReports().set(reportId, report);
  setReports(getReports());
  
  return report;
}

/**
 * Format KPI value for display
 */
function formatKPIValue(value: number, format: string): string {
  if (format === 'currency') {
    const abs = Math.abs(value);
    if (abs >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (abs >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
  }
  
  if (format === 'percentage' || format === 'percent') {
    return `${value.toFixed(1)}%`;
  }
  
  if (format === 'number') {
    if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(2)}K`;
    return value.toLocaleString();
  }
  
  return String(value);
}
