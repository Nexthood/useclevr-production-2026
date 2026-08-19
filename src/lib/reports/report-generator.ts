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
import type { ReportProfile } from './report-profiles';

// File-based storage path: use explicit temp directory to avoid broad project tracing in Next/Turbopack
const REPORTS_DIR = process.env.TEMP_DIR || '/tmp/useclevr-reports';
const REPORTS_FILE = path.join(REPORTS_DIR, 'reports.json');
export const REPORT_RUNTIME_VERSION = "report-runtime-v5";

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
  consultantCost?: number | null;
  otherCost?: number | null;
  totalProjectCost?: number | null;
  freelancerCost?: number | null;
  adSpend?: number | null;
  totalDirectCost?: number | null;
}

export interface ReportSemanticContext {
  datasetId: string;
  datasetType: string;
  mappings: Record<string, string | null>;
  confidence: number;
  dateField: string | null;
  revenueField: string | null;
  netProfitField: string | null;
  costFields: string[];
  expenseCategoryField: string | null;
  expenseAmountField: string | null;
  vendorField: string | null;
}

export interface ReportDiagnostics {
  datasetId: string;
  filename: string;
  persistedRowCount: number;
  loadedRowsLength: number;
  analysisRowsLength: number;
  rowCount: number;
  rowsUsedForKpis: number;
  rowsUsedForSummary: number;
  reportRowsLength: number;
  provenanceRowsLength: number;
  dateField: string | null;
  expenseCategoryField: string | null;
  expenseAmountField: string | null;
  vendorField: string | null;
  revenueField: string | null;
  netProfitField: string | null;
  validDateCount: number;
  validNetProfitCount: number;
  validExpenseCategoryCount: number;
  validExpenseAmountCount: number;
  validVendorCount: number;
  trendAvailable: boolean;
  analysisObjectKeys: string[];
  reportInputKeys: string[];
  templateName: string;
}

export interface ReportRecommendation {
  issue: string;
  businessImpact: string;
  recommendedAction: string;
  estimatedImpact?: string | null;
  confidence?: "High" | "Medium" | "Low";
  requiredData?: string[];
}

export interface RetailReportAnalysis {
  currentStock: number | null;
  inventoryValue: number | null;
  productCount: number | null;
  lowStockSkuCount: number | null;
  reorderRequiredCount: number | null;
  outOfStockSkuCount: number | null;
  averageTransactionValue: number | null;
  averageOrderValue?: {
    metric: "average_order_value";
    value: number | null;
    aovStatus?: "available" | "not_available";
    status: "available" | "not_available";
    orderCount: number | null;
    orderCountSource: "distinct_order_id" | "explicit_order_grain" | null;
    calculationMethod: string;
    sourceFields: string[];
    confidence: "high" | "low";
  };
  supplierCount: number | null;
  topProductsByRevenue: { name: string; value: number }[];
  revenueByCategory: { name: string; value: number }[];
  grossMarginByCategory: {
    name: string;
    category: string;
    value: number;
    revenue: number;
    cogs: number;
    grossProfit: number;
    grossMargin: number;
    revenueSource: string;
    cogsSource: string;
  }[];
  stockByCategory: { name: string; value: number }[];
  inventoryValueByProduct: { name: string; value: number }[];
  supplierExposure: { name: string; value: number }[];
  lowStockItems: { product: string; category?: string; supplier?: string; stock: number; reorderPoint: number }[];
}

export interface EcommerceReportAnalysis {
  orders: number | null;
  orderField: string | null;
  customers: number | null;
  customerField: string | null;
  ordersPerCustomer: number | null;
  revenuePerCustomer: number | null;
  averageOrderValue: number | null;
  unitsSold: number | null;
  products: number | null;
  productField: string | null;
  returnRate: number | null;
  returnedOrders: number | null;
  eligibleReturnOrders: number | null;
  returnStatusField: string | null;
  returnStatus: "available" | "not_available";
  shippingCost: number | null;
  shippingCostRate: number | null;
  averageShippingCostPerOrder: number | null;
  discounts: number | null;
  discountRate: number | null;
  averageDiscountPerOrder: number | null;
  revenueTrend: { name: string; value: number }[];
  ordersTrend: { name: string; value: number }[];
  categoryPerformance: { name: string; value: number }[];
  topProducts: { name: string; value: number }[];
  channelPerformance: { name: string; value: number; orders: number | null; aov: number | null; share: number | null }[];
  geography: { name: string; value: number; orders: number | null; share: number | null }[];
  paymentMethods: { name: string; value: number; orders: number | null }[];
}

export interface SaasReportAnalysis {
  mrr: number | null;
  mrrField: string | null;
  arr: number | null;
  arrField: string | null;
  customers: number | null;
  customerField: string | null;
  newCustomers: number | null;
  newCustomerField: string | null;
  churnedCustomers: number | null;
  eligibleChurnCustomers: number | null;
  churnRate: number | null;
  churnField: string | null;
  expansionMrr: number | null;
  expansionMrrField: string | null;
  contractionMrr: number | null;
  contractionMrrField: string | null;
  netExpansionMrr: number | null;
  cac: number | null;
  cacField: string | null;
  ltv: number | null;
  ltvField: string | null;
  ltvToCac: number | null;
  activeUsers: number | null;
  activeUsersField: string | null;
  supportTickets: number | null;
  supportTicketsField: string | null;
  burn: number | null;
  burnField: string | null;
  cashBalance: number | null;
  cashBalanceField: string | null;
  runwayMonths: number | null;
  runwayField: string | null;
  periodField: string | null;
  latestPeriod: string | null;
  dataConfidence: number;
  mrrTrend: { name: string; value: number }[];
  arrTrend: { name: string; value: number }[];
  customerTrend: { name: string; value: number }[];
  newCustomerTrend: { name: string; value: number }[];
  churnTrend: { name: string; value: number }[];
  expansionTrend: { name: string; value: number }[];
  contractionTrend: { name: string; value: number }[];
  activeUserTrend: { name: string; value: number }[];
  burnTrend: { name: string; value: number }[];
  cashTrend: { name: string; value: number }[];
  runwayTrend: { name: string; value: number }[];
  planPerformance: { name: string; customers: number | null; mrr: number | null; arr: number | null; share: number | null }[];
  geography: { name: string; customers: number | null; mrr: number | null; arr: number | null; share: number | null }[];
}

export interface MarketplaceReportAnalysis {
  gmv: number | null;
  gmvField: string | null;
  marketplaceRevenue: number | null;
  marketplaceRevenueField: string | null;
  takeRate: number | null;
  sellerPayout: number | null;
  sellerPayoutField: string | null;
  refunds: number | null;
  refundsField: string | null;
  refundRate: number | null;
  transactions: number | null;
  transactionField: string | null;
  averageTransactionValue: number | null;
  buyers: number | null;
  buyerField: string | null;
  sellers: number | null;
  sellerField: string | null;
  newBuyers: number | null;
  newBuyerField: string | null;
  newSellers: number | null;
  newSellerField: string | null;
  activeSellers: number | null;
  activeSellersField: string | null;
  activeSellersAggregation: "sum" | "latest_snapshot";
  listings: number | null;
  listingsField: string | null;
  listingsAggregation: "sum" | "latest_snapshot";
  completionRate: number | null;
  gmvTrend: { name: string; value: number }[];
  marketplaceRevenueTrend: { name: string; value: number }[];
  refundTrend: { name: string; value: number }[];
  categoryPerformance: { name: string; value: number }[];
  geography: { name: string; value: number }[];
}

export interface InvestorReportAnalysis {
  portfolioCompanies: number | null;
  totalInvested: number | null;
  totalValuation: number | null;
  avgOwnership: number | null;
  companiesByStatus: { status: string; count: number }[];
  companiesBySector: { sector: string; invested: number; valuation: number; count: number }[];
  companiesByStage: { stage: string; invested: number; valuation: number; count: number }[];
  revenueByCompany: { name: string; revenue: number }[];
  runwayRisk: number | null;
  highBurn: number | null;
  dataConfidence: number | null;
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
  runtimeVersion?: string;
  templateName?: string;
  reportProfile?: ReportProfile;
  
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
  retailAnalysis?: RetailReportAnalysis;
  ecommerceAnalysis?: EcommerceReportAnalysis;
  saasAnalysis?: SaasReportAnalysis;
  marketplaceAnalysis?: MarketplaceReportAnalysis;
  investorAnalysis?: InvestorReportAnalysis;
  semanticContext?: ReportSemanticContext;
  diagnostics?: ReportDiagnostics;
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
    semanticContext?: ReportSemanticContext;
    diagnostics?: ReportDiagnostics;
    reportProfile?: ReportProfile;
    retailAnalysis?: RetailReportAnalysis;
    ecommerceAnalysis?: EcommerceReportAnalysis;
    saasAnalysis?: SaasReportAnalysis;
    marketplaceAnalysis?: MarketplaceReportAnalysis;
    investorAnalysis?: InvestorReportAnalysis;
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
    runtimeVersion: REPORT_RUNTIME_VERSION,
    templateName: analysisData.reportProfile?.title || analysisData.diagnostics?.templateName || "executive-bi-report",
    reportProfile: analysisData.reportProfile,
    
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
    retailAnalysis: analysisData.retailAnalysis,
    ecommerceAnalysis: analysisData.ecommerceAnalysis,
    saasAnalysis: analysisData.saasAnalysis,
    marketplaceAnalysis: analysisData.marketplaceAnalysis,
    investorAnalysis: analysisData.investorAnalysis,
    semanticContext: analysisData.semanticContext,
    diagnostics: analysisData.diagnostics,
    alerts: (options.includeAlerts !== false) ? (analysisData.alerts || []) : [],
    
    // Metadata
    rowCount: analysisData.rowCount,
    columnCount: analysisData.columns.length
  };

  if (report.diagnostics) {
    debugLog("[REPORT] validated analysis diagnostics", report.diagnostics);
  }

  traceReportRuntime("generateReport", {
    datasetId,
    filename: datasetName,
    persistedRowCount: report.diagnostics?.persistedRowCount ?? report.rowCount,
    loadedRowsLength: report.diagnostics?.loadedRowsLength ?? null,
    analysisRowsLength: report.diagnostics?.analysisRowsLength ?? null,
    summaryRowsLength: report.diagnostics?.rowsUsedForSummary ?? null,
    reportRowsLength: report.diagnostics?.reportRowsLength ?? report.rowCount,
    provenanceRowsLength: report.diagnostics?.provenanceRowsLength ?? report.rowCount,
    detectedDateField: report.semanticContext?.dateField ?? null,
    detectedExpenseCategoryField: report.semanticContext?.expenseCategoryField ?? null,
    detectedExpenseAmountField: report.semanticContext?.expenseAmountField ?? null,
    detectedVendorField: report.semanticContext?.vendorField ?? null,
    analysisObjectKeys: Object.keys(analysisData),
    reportInputKeys: Object.keys(report),
    templateName: report.templateName,
  });

  assertReportIntegrity(report);
  
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

export class ReportIntegrityError extends Error {
  constructor(message: string, readonly details: Record<string, unknown>) {
    super(message);
    this.name = "ReportIntegrityError";
  }
}

export function isCurrentReportRuntime(report: Report | null | undefined) {
  if (!report) return false;
  return (
    report.runtimeVersion === REPORT_RUNTIME_VERSION &&
    Boolean(report.reportProfile) &&
    Boolean(report.semanticContext) &&
    Boolean(report.diagnostics)
  );
}

export function traceReportRuntime(moduleName: string, details: Record<string, unknown>) {
  debugLog("[REPORT TRACE]", moduleName, details);
}

function assertReportIntegrity(report: Report) {
  if (!report.diagnostics || !report.semanticContext) return;
  const failures: string[] = [];
  if (report.rowCount !== report.diagnostics.rowCount) failures.push("report.rowCount differs from diagnostics.rowCount");
  if (report.diagnostics.rowsUsedForSummary !== report.diagnostics.rowCount) failures.push("summary row count differs from authoritative row count");
  if (report.diagnostics.reportRowsLength !== report.diagnostics.rowCount) failures.push("report row count differs from authoritative row count");
  if (report.diagnostics.provenanceRowsLength !== report.diagnostics.rowCount) failures.push("provenance row count differs from authoritative row count");
  if (report.diagnostics.rowsUsedForKpis !== report.diagnostics.rowCount) failures.push("KPI row count differs from authoritative row count");
  if (report.diagnostics.validDateCount > 0 && report.diagnostics.validNetProfitCount > 0 && !report.diagnostics.trendAvailable) {
    failures.push("trend is unavailable despite valid date and net-profit values");
  }
  if (report.diagnostics.validExpenseCategoryCount > 0 && !report.semanticContext.expenseCategoryField) {
    failures.push("expense categories exist but semantic context has no expense category field");
  }
  if (report.diagnostics.validExpenseAmountCount > 0 && !report.semanticContext.expenseAmountField) {
    failures.push("expense amounts exist but semantic context has no expense amount field");
  }
  if (report.diagnostics.validVendorCount > 0 && !report.semanticContext.vendorField) {
    failures.push("vendors exist but semantic context has no vendor field");
  }
  if (report.semanticContext.dateField !== report.diagnostics.dateField) failures.push("date semantic mapping changed before PDF rendering");
  if (report.semanticContext.expenseCategoryField !== report.diagnostics.expenseCategoryField) failures.push("expense category mapping changed before PDF rendering");
  if (report.semanticContext.expenseAmountField !== report.diagnostics.expenseAmountField) failures.push("expense amount mapping changed before PDF rendering");
  if (report.semanticContext.vendorField !== report.diagnostics.vendorField) failures.push("vendor mapping changed before PDF rendering");
  if (failures.length > 0) {
    throw new ReportIntegrityError("Report data integrity check failed before PDF rendering.", {
      reportId: report.id,
      datasetId: report.datasetId,
      failures,
      diagnostics: report.diagnostics,
      semanticContext: report.semanticContext,
    });
  }
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
