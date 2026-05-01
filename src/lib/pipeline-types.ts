import { DatasetType, DatasetTypeDetection } from './dataset-type-detector';

// ============================================================================
// USELEVLR DETERMINISTIC PIPELINE - Core Types and Interfaces
// ============================================================================
// This file defines the core types for the new deterministic, scalable
// business analysis architecture with clear separation between:
// - Preview (schema detection, column inference, UI preview)
// - Full Analysis (KPI calculations, charts, executive summary)
// - AI Interpretation (explanations only, no computation)
// ============================================================================

// Re-export dataset type detection types
export type { DatasetType, DatasetTypeDetection };

// ============================================================================
// ANALYSIS STATUS
// ============================================================================

export type AnalysisStatus = 
  | 'uploading'
  | 'generating_preview'
  | 'detecting_schema'
  | 'cleaning_data'
  | 'running_analysis'
  | 'validating_results'
  | 'ready'
  | 'error';

export interface AnalysisStatusInfo {
  status: AnalysisStatus;
  progress: number; // 0-100
  message: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

// ============================================================================
// DATASET UPLOAD & METADATA
// ============================================================================

export interface DatasetMetadata {
  id: string;
  userId: string;
  name: string;
  filename: string;
  fileSize: number;
  mimeType: string;
  storageKey?: string; // For durable storage (S3, GCS, etc.)
  uploadTimestamp: string;
  rowCount: number;
  columnCount: number;
  columns: string[];
  checksum?: string; // For data integrity
  
  // Processing metadata
  status: AnalysisStatus;
  previewGenerated: boolean;
  previewRowCount: number;
  fullAnalysisCompleted: boolean;
}

// ============================================================================
// PREVIEW DATA (First 500-2000 rows)
// ============================================================================
// Preview is used ONLY for:
// - Schema detection
// - Column inference
// - UI preview
// - Mapping suggestions
// 
// Preview must NEVER be used for:
// - KPI calculations
// - Chart calculations
// - Totals, averages, percentages
// - Executive summary metrics
// - Recommendations
// - AI metric generation
// ============================================================================

export const PREVIEW_ROW_COUNT = 1000; // Default preview size
export const MAX_PREVIEW_ROWS = 2000;
export const MIN_PREVIEW_ROWS = 500;

export interface PreviewData {
  datasetId: string;
  rows: Record<string, any>[];
  rowCount: number;
  columns: string[];
  columnTypes: Record<string, ColumnType>;
  generatedAt: string;
  isPreview: true;
}

export type ColumnType = 'numeric' | 'currency' | 'date' | 'text' | 'boolean' | 'percentage';

export interface ColumnSchema {
  name: string;
  originalName: string;
  type: ColumnType;
  isNullable: boolean;
  sampleValues: any[];
  uniqueCount?: number;
  nullCount?: number;
}

// ============================================================================
// SEMANTIC COLUMN MAPPING
// ============================================================================
// Maps uploaded columns to internal business schema
// Stored per dataset and per user, editable in UI
// ============================================================================

export type BusinessColumnType = 
  | 'revenue'
  | 'cost'
  | 'profit'
  | 'date'
  | 'region'
  | 'country'
  | 'product'
  | 'customer'
  | 'category'
  | 'quantity'
  | 'currency'
  | 'discount'
  | 'refund'
  | 'shipping_cost'
  | 'marketing_cost'
  | 'cogs'
  | 'unknown';

export interface ColumnMapping {
  datasetId: string;
  userId: string;
  mappings: Record<BusinessColumnType, string | null>; // Maps business type to column name
  confidence: Record<BusinessColumnType, 'high' | 'medium' | 'low'>;
  isAutoDetected: boolean;
  lastUpdated: string;
  version: number; // For optimistic locking
  
  // Dataset type (business model)
  datasetType: DatasetType;
  datasetTypeConfidence: number;
}

export interface MappingOverride {
  businessType: BusinessColumnType;
  columnName: string;
  overrideBy: 'user' | 'ai' | 'system';
  timestamp: string;
}

// ============================================================================
// DATA CLEANING & NORMALIZATION
// ============================================================================

export interface CleaningStats {
  originalRowCount: number;
  validRowCount: number;
  invalidRowCount: number;
  invalidRowPercentage: number;
  missingValueCounts: Record<string, number>;
  cleanedValues: Record<string, number>;
  dateStandardizedCount: number;
  numericParsedCount: number;
  warnings: string[];
}

export interface DataQualityReport {
  datasetId: string;
  cleaningStats: CleaningStats;
  hasDataQualityIssues: boolean; // true if invalidRowPercentage > 10%
  needsAttention: boolean;
  generatedAt: string;
}

// ============================================================================
// FULL DATASET ANALYSIS - Precomputed Metrics
// ============================================================================
// These metrics are the SINGLE SOURCE OF TRUTH for all UI rendering
// and AI interpretation. All business numbers come from here.
// ============================================================================

export interface PrecomputedMetrics {
  // Unique identifier
  datasetId: string;
  analysisVersion: string;
  computedAt: string;
  fullDatasetRowCount: number;
  
  // Dataset type (business model)
  datasetType: DatasetType;
  datasetTypeConfidence: number;
  
  // === REVENUE METRICS ===
  totalRevenue: number;
  averageRevenuePerTransaction: number;
  revenueValidRowCount: number;
  
  // === PROFIT METRICS ===
  totalCost: number;
  totalProfit: number;
  profitMargin: number | null; // Percentage, rounded to 1 decimal
  profitReliability: 'verified' | 'derived' | 'unavailable';
  
  // === COST BREAKDOWN ===
  costBreakdown: {
    cogs: number;
    marketingCost: number;
    shippingCost: number;
    refunds: number;
    discount: number;
    totalCost: number;
  };
  
  // === GROWTH METRICS ===
  growthRate: number | null;
  growthTrend: 'up' | 'down' | 'stable' | null;
  growthValid: boolean;
  growthMessage: string;
  dateRange: {
    start: string;
    end: string;
  } | null;
  
  // === TOP PERFORMERS ===
  topProducts: TopPerformer[];
  topRegions: TopPerformer[];
  worstProducts: WorstPerformer[];
  
  // === REGIONAL PERFORMANCE ===
  regionalPerformance: RegionalMetric[];
  
  // === PRODUCT PERFORMANCE ===
  productPerformance: ProductMetric[];
  
  // === DATA QUALITY ===
  invalidRowCount: number;
  missingValueCount: number;
  cleaningStats: CleaningStats;
  
  // === DETECTED COLUMNS ===
  detectedColumns: DetectedBusinessColumns;
  
  // === CHART DATA (Pre-aggregated) ===
  chartData: {
    revenueByMonth: MonthlyAggregate[];
    revenueByProduct: CategoryAggregate[];
    revenueByRegion: CategoryAggregate[];
    profitByMonth: MonthlyAggregate[];
    profitByProduct: CategoryAggregate[];
    profitByRegion: CategoryAggregate[];
  };
  
  // === VALIDATION STATUS ===
  validationStatus: {
    isValid: boolean;
    totalRevenueMatchesSum: boolean;
    rowCountConsistent: boolean;
    errors: string[];
    warnings: string[];
  };
}

export interface TopPerformer {
  name: string;
  revenue: number;
  percentage: number; // Percentage of total
}

export interface WorstPerformer {
  name: string;
  profit: number; // Can be negative
}

export interface RegionalMetric {
  name: string;
  revenue: number;
  profit: number;
  margin: number | null;
  percentage: number;
}

export interface ProductMetric {
  name: string;
  revenue: number;
  profit: number;
  margin: number | null;
  quantity?: number;
  percentage: number;
}

export interface MonthlyAggregate {
  month: string; // YYYY-MM format
  revenue: number;
  profit: number;
  transactionCount: number;
}

export interface CategoryAggregate {
  category: string;
  value: number;
  percentage: number;
}

// ============================================================================
// DETECTED BUSINESS COLUMNS
// ============================================================================

export interface DetectedBusinessColumns {
  revenueColumn: string | null;
  profitColumn: string | null;
  costColumn: string | null;
  dateColumn: string | null;
  productColumn: string | null;
  regionColumn: string | null;
  fallbackRegionColumn: string | null;
  currencyColumn: string | null;
  quantityColumn: string | null;
  costComponents: CostComponents;
  confidence: Record<string, 'high' | 'medium' | 'low'>;
}

export interface CostComponents {
  cogs: string | null;
  marketing_cost: string | null;
  shipping_cost: string | null;
  refunds: string | null;
  discount_amount: string | null;
}

// ============================================================================
// AI INSIGHT LAYER - INPUT
// ============================================================================
// AI receives ONLY precomputed metrics, never raw data or computed values
// AI explains numbers, does not compute them
// ============================================================================

export interface AIInsightInput {
  // Core metrics (deterministic)
  totalRevenue: number;
  totalProfit: number;
  profitMargin: number | null;
  profitReliability: 'verified' | 'derived' | 'unavailable';
  growthRate: number | null;
  growthTrend: 'up' | 'down' | 'stable' | null;
  
  // Top performers
  topRegion: { name: string; percentage: number } | null;
  topProduct: { name: string; percentage: number } | null;
  
  // Data quality
  invalidRowCount: number;
  totalRowCount: number;
  dataQualityIssue: boolean;
  
  // Date context
  dateRange: { start: string; end: string } | null;
  
  // Driver context (from Driver Detection Engine)
  driverContext?: string;
  
  // For generating explanations
  language?: 'en' | 'es' | 'fr' | 'de' | 'nl';
}

export interface AIInsightOutput {
  // AI-generated explanations (NOT computations)
  summary: string;
  keyTakeaways: string[];
  recommendations: string[];
  riskHighlights: string[];
  confidence: 'high' | 'medium' | 'low';
  
  // Metadata
  generatedAt: string;
  modelVersion: string;
}

// ============================================================================
// BACKGROUND JOB TYPES
// ============================================================================

export interface AnalysisJob {
  id: string;
  datasetId: string;
  userId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  priority: 'low' | 'normal' | 'high';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  retryCount: number;
  maxRetries: number;
}

export const LARGE_DATASET_THRESHOLD = 50000; // Rows that require background processing
export const AUTO_ANALYZE_THRESHOLD = 100000; // Rows that auto-analyze if desired

// ============================================================================
// CONSISTENCY VALIDATION RESULT
// ============================================================================

export interface ConsistencyValidationResult {
  isValid: boolean;
  checks: {
    name: string;
    passed: boolean;
    message: string;
    severity: 'error' | 'warning';
  }[];
  validatedAt: string;
}

// ============================================================================
// DRIVER DETECTION ENGINE - Root Cause Analysis
// ============================================================================
// The Driver Detection Engine identifies the primary causes behind
// changes in key business metrics. It uses contribution analysis to
// determine WHY a KPI changed, not just WHAT changed.
// ============================================================================

export type DriverType = 'region' | 'product' | 'category' | 'time_period' | 'customer_segment';

export interface DriverContribution {
  type: DriverType;
  name: string;
  value: number; // Absolute change (can be negative)
  percentage: number; // Percentage of total change (can be negative)
  currentValue?: number;
  previousValue?: number;
}

export interface MetricDriver {
  metric: string; // 'revenue' | 'profit' | 'margin' | 'growth'
  change: number; // Absolute change
  changePercent: number; // Percentage change
  direction: 'up' | 'down' | 'stable';
  drivers: DriverContribution[];
  significance: 'high' | 'medium' | 'low';
}

export interface DriverDetectionResult {
  datasetId: string;
  analyzedAt: string;
  hasSignificantChanges: boolean;
  drivers: MetricDriver[];
  summary: string;
}

// Configuration for driver detection thresholds
export interface DriverDetectionConfig {
  significanceThreshold: number; // Minimum contribution % to be considered significant (default: 10)
  minContributionValue: number; // Minimum absolute value to be considered (default: 1000)
  maxDriversPerMetric: number; // Maximum number of drivers to return (default: 5)
  includeTimeAnalysis: boolean; // Include time-based driver analysis
  includeNegativeDrivers: boolean; // Include negative contributors
}

export const DEFAULT_DRIVER_CONFIG: DriverDetectionConfig = {
  significanceThreshold: 10, // 10% contribution
  minContributionValue: 1000, // $1000 minimum
  maxDriversPerMetric: 5,
  includeTimeAnalysis: true,
  includeNegativeDrivers: true,
};
