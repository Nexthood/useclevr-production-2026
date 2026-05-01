import { debugError, debugLog } from "@/lib/debug";

// ============================================================================
// CSV Data Analysis Library for SaaS Dataset Analysis
// ============================================================================

import {
  convertCurrency,
  detectCurrencyFromColumn,
  detectCurrencyFromValues,
  fetchExchangeRates,
  findCurrencyColumns,
  setSessionBaseCurrency
} from '../business/fx-service';
import { normalizeNumberString, parseNormalizedNumber } from '../utils/formatting';

import { ExecutiveAnalysisResult, generateExecutiveInsights } from '../business/business-insights';

// NEW: Import multi-currency processor
import {
  BusinessKPIs,
  calculateKPIs,
  ExecutiveSummary,
  generateExecutiveSummary,
  processMultiCurrencyDataset
} from '../business/multi-currency-processor';

// ============================================================================
// Type Definitions
// ============================================================================

export interface DatasetRecord {
  [key: string]: string | number | boolean | null;
}

export interface ColumnStatistics {
  type: "numeric" | "text" | "boolean" | "date";
  unique: number;
  nullCount: number;
  min?: number | string;
  max?: number | string;
  mean?: number;
  median?: number;
  stdDev?: number;
  sum?: number;
  count?: number; // Added for ID detection logic
}

export interface FileInfo {
  rows: number;
  columns: number;
  column_names: string[];
  inferred_type: string;
  main_date_column: string | null;
  date_range: string | null;
}

export interface DataQuality {
  missing_counts: Record<string, number>;
  duplicates: number;
  warnings: string[];
}

export interface NumericColumnStats {
  total: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  std: number;
}

export interface CategoricalTopValue {
  value: string;
  count: number;
  percentage: number;
}

export interface CategoricalColumnStats {
  top_values: CategoricalTopValue[];
  unique: number;
}

export interface KeyMetrics {
  numeric: Record<string, NumericColumnStats>;
  categorical: Record<string, CategoricalColumnStats>;
  business_insights: string[];
}

export interface EcommerceKPIs {
  total_revenue: number | null;
  average_order_value_aov: number | null;
  conversion_rate_pct: number | null;
  cart_abandonment_rate_pct: number | null;
  return_rate_pct: number | null;
  customer_lifetime_value_ltv_estimate: number | null;
  repeat_purchase_rate_pct: number | null;
  top_insights: string[];
  kpi_section_name: string; // Added: "E-Commerce KPIs" or "Revenue & Profit KPIs"
}

export interface FinancialMetrics {
  gross_profit: number | null;
  gross_margin_pct: number | null;
  net_profit_estimate: number | null;
  net_margin_pct: number | null;
  roi_pct: number | null;
  cac_estimate: number | null;
  ltv_to_cac_ratio: number | null;
  profit_insights: string[];
}

// Financial normalization result
export interface FinancialNormalization {
  detected_currency: string | null;
  base_currency: string;
  fx_rate_timestamp: string | null;
  fx_rate_source: string;
  conversion_warnings: string[];
  monetary_columns: MonetaryColumnInfo[];
}

// Info about a monetary column
export interface MonetaryColumnInfo {
  name: string;
  original_values: number[];
  normalized_base_values: number[];
  has_conversion_error: boolean[];
}

// ============================================================================
// Enhanced Categorical & Grouped Metrics Interfaces
// ============================================================================

export interface GroupedMetric {
  category: string;
  total: number;
  count: number;
  percentage: number;
}

export interface GroupedMetrics {
  revenue_by_region: Record<string, GroupedMetric>;
  revenue_by_country: Record<string, GroupedMetric>;
  revenue_by_product: Record<string, GroupedMetric>;
  revenue_by_channel: Record<string, GroupedMetric>;
  profit_by_region: Record<string, GroupedMetric>;
  profit_by_country: Record<string, GroupedMetric>;
  profit_by_product: Record<string, GroupedMetric>;
  units_by_region: Record<string, GroupedMetric>;
  units_by_country: Record<string, GroupedMetric>;
  units_by_product: Record<string, GroupedMetric>;
  units_by_channel: Record<string, GroupedMetric>;
}

export interface CategoricalOutliers {
  dominant_categories: { value: string; percentage: number }[];
  rare_categories: { value: string; percentage: number }[];
  imbalanced: boolean;
}

export interface CategoricalRanking {
  by_revenue: { category: string; total: number; rank: number; pct: number }[];
  by_profit: { category: string; total: number; rank: number; pct: number }[];
  by_units: { category: string; total: number; rank: number; pct: number }[];
}

export interface EnhancedCategoricalMetrics {
  total_unique: number;
  frequency_distribution: Record<string, number>;
  top_5_values: { value: string; count: number; percentage: number }[];
  outliers: CategoricalOutliers;
  revenue_aggregation: Record<string, number> | null;
  profit_aggregation: Record<string, number> | null;
  units_aggregation: Record<string, number> | null;
}

export interface EnhancedBusinessInsights {
  top_performing_region: { name: string; revenue_pct: number } | null;
  top_performing_country: { name: string; revenue_pct: number } | null;
  top_performing_product: { name: string; revenue: number } | null;
  highest_unit_volume_region: { name: string; units: number } | null;
  revenue_concentration_analysis: string;
  category_performance_ranking: { category: string; revenue: number; pct: number }[];
}

export interface VisualizationSuggestion {
  chart_type: "line" | "bar" | "pie" | "scatter" | "histogram" | "area";
  title: string;
  x: string;
  y?: string | string[];
  column?: string;
  aggregation: string;
  limit?: number;
  python_snippet: string;
}

export interface CSVAnalysisResult {
  file_info: FileInfo;
  data_quality: DataQuality;
  key_metrics: KeyMetrics;
  ecommerce_kpis: EcommerceKPIs;
  financial_metrics: FinancialMetrics;
  financial_normalization: FinancialNormalization;
  executive_insights: ExecutiveAnalysisResult;
  // NEW: Multi-currency business KPIs
  business_kpis: BusinessKPIs;
  // NEW: Executive summary from multi-currency processing
  executive_summary: ExecutiveSummary | null;
  // NEW: Processed data with Revenue_Base columns
  processed_data: DatasetRecord[];
  // NEW: Structured analysis with grouped metrics
  numericMetrics: Record<string, NumericColumnStats>;
  categoricalMetrics: Record<string, EnhancedCategoricalMetrics>;
  groupedMetrics: GroupedMetrics;
  enhancedBusinessInsights: EnhancedBusinessInsights;
  recommendations: string[];
  visualization_suggestions: VisualizationSuggestion[];
  follow_up_questions: string[];
  // NEW: Overview metrics (single source of truth for UI)
  total_rows: number;
  total_columns: number;
  numeric_columns: string[];
  date_columns: string[];
  categorical_columns: string[];
  column_types: Record<string, string>;
  // NEW: Dataset Summary (User's automatic analysis format)
  dataset_summary: DatasetSummary | null;
}

// ============================================================================
// Column Classification Functions
// ============================================================================

// Pattern matching for ID columns (technical identifiers to exclude from business metrics)
const ID_COLUMN_PATTERNS = [
  /_?id$/i,
  /_?uuid$/i,
  /^uid$/i,
  /record_?id/i,
  /entry_?id/i,
];

// Pattern matching for geographic columns
const GEO_COLUMN_PATTERNS = [
  /country/i,
  /region/i,
  /city/i,
  /state/i,
  /zip/i,
  /postal/i,
  /lat/i,
  /lng/i,
  /lon/i,
  /location/i,
];

// Pattern matching for financial columns
const FINANCIAL_COLUMN_PATTERNS = [
  /revenue/i,
  /sales/i,
  /amount/i,
  /price/i,
  /cost/i,
  /profit/i,
  /margin/i,
  /spend/i,
  /cpc/i,
  /cac/i,
  /ltv/i,
];

// Check if column is likely an ID/technical identifier
function isTechnicalIdColumn(columnName: string, stats: ColumnStatistics): boolean {
  // Check column name patterns
  const nameMatches = ID_COLUMN_PATTERNS.some(pattern => pattern.test(columnName));
  if (nameMatches) return true;

  // If it's numeric and unique count equals row count, it's likely an ID
  if (stats.type === "numeric" && stats.unique === stats.nullCount + (stats as any).count) {
    return true;
  }

  return false;
}

// Classify column into business-friendly categories
function classifyColumn(columnName: string, stats: ColumnStatistics):
  | "id"
  | "numeric"
  | "categorical"
  | "date"
  | "geo"
  | "text"
  | "boolean" {

  // Check for ID columns first
  if (isTechnicalIdColumn(columnName, stats)) {
    return "id";
  }

  // Check for geographic columns
  const geoMatch = GEO_COLUMN_PATTERNS.some(pattern => pattern.test(columnName));
  if (geoMatch && (stats.type === "text" || stats.type === "numeric")) {
    return "geo";
  }

  // Already typed columns
  if (stats.type === "numeric" || stats.type === "boolean" || stats.type === "date") {
    return stats.type;
  }

  // For text columns, check cardinality to determine if categorical
  if (stats.type === "text" && stats.unique < 50) {
    return "categorical";
  }

  return "text";
}

// Get business-meaningful numeric columns (exclude IDs)
function getBusinessNumericColumns(
  columns: string[],
  columnStats: Record<string, ColumnStatistics>
): string[] {
  return columns.filter(col => {
    const stats = columnStats[col];
    if (!stats) return false;
    const classification = classifyColumn(col, stats);
    return classification === "numeric";
  });
}

// Get business-meaningful categorical columns (exclude IDs)
function getBusinessCategoricalColumns(
  columns: string[],
  columnStats: Record<string, ColumnStatistics>
): string[] {
  return columns.filter(col => {
    const stats = columnStats[col];
    if (!stats) return false;
    const classification = classifyColumn(col, stats);
    return classification === "categorical" || classification === "geo";
  });
}

// Check if dataset has financial data
function hasFinancialData(columns: string[]): {
  hasRevenue: boolean;
  hasCost: boolean;
  hasProfit: boolean;
} {
  return {
    hasRevenue: columns.some(c => /revenue|sales|amount/i.test(c)),
    hasCost: columns.some(c => /cost|cogs|expense/i.test(c)),
    hasProfit: columns.some(c => /profit|net|income/i.test(c)),
  };
}

// ============================================================================
// Dataset Type Classification (User's Specific Categories)
// ============================================================================

export type DatasetTypeCategory =
  | "Sales / Revenue Dataset"
  | "Customer / CRM Dataset"
  | "E-commerce / Transaction Dataset"
  | "SaaS / Subscription Metrics Dataset"
  | "Startup Funding / Venture Capital Dataset"
  | "Product Analytics / Usage Dataset"
  | "Financial / Accounting Dataset"
  | "Marketing / Campaign Performance Dataset"
  | "HR / Employee Dataset"
  | "Inventory / Supply Chain Dataset"
  | "Generic Business / Operational Dataset"
  | "Other";

export interface ColumnSemantic {
  columnName: string;
  interpretedMeaning: string;
  dataRole: "identifier" | "date" | "categorical" | "numerical metric" | "monetary" | "geographic" | "quantity" | "boolean" | "percentage" | "ID" | "name/text" | "other";
}

export interface DatasetSummary {
  datasetType: DatasetTypeCategory;
  columnSemantics: ColumnSemantic[];
  keyCharacteristics: {
    rowCount: number;
    timePeriod: { start: string; end: string } | null;
    mainEntity: string;
    granularity: string;
    currency: string | null;
    notes: string[];
  };
  suggestedQuestions: string[];
}

// Detect dataset category based on column patterns (User's specific categories)
function detectDatasetCategory(columns: string[]): DatasetTypeCategory {
  const colLower = columns.map(c => c.toLowerCase());
  const colStr = colLower.join(" ");

  // E-commerce / Transaction Dataset
  if (/order|transaction|purchase|cart|checkout|sku|product.*quantity|order.*value/i.test(colStr)) {
    return "E-commerce / Transaction Dataset";
  }

  // SaaS / Subscription Metrics
  if (/subscription|monthly.*recurring|arr|mrr|churn|license|seat|user.*count|active.*user/i.test(colStr)) {
    return "SaaS / Subscription Metrics Dataset";
  }

  // Customer / CRM Dataset
  if (/customer|client|contact|lead|account|company.*name|person.*name|email.*address/i.test(colStr) &&
      !/order|transaction|purchase/i.test(colStr)) {
    return "Customer / CRM Dataset";
  }

  // Sales / Revenue Dataset
  if (/revenue|sales.*amount|quota|deal.*value|pipeline|opportunity|closed.*won/i.test(colStr)) {
    return "Sales / Revenue Dataset";
  }

  // Financial / Accounting Dataset
  if (/profit|loss|income.*statement|balance.*sheet|cash.*flow|depreciation|amortization|expense.*report/i.test(colStr)) {
    return "Financial / Accounting Dataset";
  }

  // Marketing / Campaign Performance
  if (/campaign|ad.*spend|impression|click.*through|ctr|conversion.*rate|channel.*source|medium/i.test(colStr)) {
    return "Marketing / Campaign Performance Dataset";
  }

  // Startup Funding / VC
  if (/funding|venture.*capital|valuation|equity|investment|runway|burn.*rate|seed|series.*a/i.test(colStr)) {
    return "Startup Funding / Venture Capital Dataset";
  }

  // Product Analytics / Usage
  if (/page.*view|session|event|feature.*usage|engagement|retention|funnel|drop.*off|user.*journey/i.test(colStr)) {
    return "Product Analytics / Usage Dataset";
  }

  // HR / Employee Dataset
  if (/employee|staff|hire|firing|turnover|salary|bonus|performance.*review|department|headcount/i.test(colStr)) {
    return "HR / Employee Dataset";
  }

  // Inventory / Supply Chain
  if (/inventory|stock|warehouse|supplier|lead.*time|reorder|sku|fulfilled|shipment|logistics/i.test(colStr)) {
    return "Inventory / Supply Chain Dataset";
  }

  // Sales / Revenue fallback
  if (/revenue|sales|amount|price|cost/i.test(colStr)) {
    return "Sales / Revenue Dataset";
  }

  return "Generic Business / Operational Dataset";
}

// Detect semantic meaning and role for a single column
function detectColumnSemantic(columnName: string, stats: ColumnStatistics, sampleValues: any[]): ColumnSemantic {
  const colLower = columnName.toLowerCase();

  // ID columns
  if (/_?id$|uuid|record_?id|entry_?id/i.test(colLower)) {
    return { columnName, interpretedMeaning: "unique identifier", dataRole: "identifier" };
  }

  // Date columns
  if (stats.type === "date" || /date|created_?at|updated_?at|timestamp|period|month|year|quarter/i.test(colLower)) {
    return { columnName, interpretedMeaning: colLower.includes("created") ? "creation timestamp" : colLower.includes("updated") ? "update timestamp" : "date/time", dataRole: "date" };
  }

  // Geographic columns
  if (/country|region|city|state|zip|postal|location|lat|lng|lon/i.test(colLower)) {
    const meaning = /country/i.test(colLower) ? "country" : /region/i.test(colLower) ? "region" : /city/i.test(colLower) ? "city" : /state/i.test(colLower) ? "state" : /zip|postal/i.test(colLower) ? "postal code" : "location coordinates";
    return { columnName, interpretedMeaning: meaning, dataRole: "geographic" };
  }

  // Monetary columns
  if (/revenue|sales|amount|price|cost|profit|margin|spend|budget|value/i.test(colLower) && stats.type === "numeric") {
    if (/revenue|sales|amount/i.test(colLower)) {
      return { columnName, interpretedMeaning: "sales value", dataRole: "monetary" };
    }
    if (/cost|expense/i.test(colLower)) {
      return { columnName, interpretedMeaning: "cost/expense", dataRole: "monetary" };
    }
    if (/profit|net/i.test(colLower)) {
      return { columnName, interpretedMeaning: "profit", dataRole: "monetary" };
    }
    if (/price|value/i.test(colLower)) {
      return { columnName, interpretedMeaning: "price/unit value", dataRole: "monetary" };
    }
    return { columnName, interpretedMeaning: "monetary value", dataRole: "monetary" };
  }

  // Quantity columns
  if (/quantity|units|items|count|qty|volume/i.test(colLower) && stats.type === "numeric") {
    return { columnName, interpretedMeaning: "quantity/volume", dataRole: "quantity" };
  }

  // Percentage columns
  if (/percent|pct|rate|ratio/i.test(colLower) && stats.type === "numeric") {
    return { columnName, interpretedMeaning: "percentage/rate", dataRole: "percentage" };
  }

  // Boolean columns
  if (stats.type === "boolean" || /is_|has_|active|flag|status.*bool/i.test(colLower)) {
    return { columnName, interpretedMeaning: "boolean flag", dataRole: "boolean" };
  }

  // Categorical columns (low cardinality text)
  if (stats.type === "text" && stats.unique && stats.unique < 50) {
    if (/product|item|sku|name/i.test(colLower)) {
      return { columnName, interpretedMeaning: "product/item name", dataRole: "name/text" };
    }
    if (/category|segment|type|status/i.test(colLower)) {
      return { columnName, interpretedMeaning: "category/type", dataRole: "categorical" };
    }
    if (/channel|source|medium|campaign/i.test(colLower)) {
      return { columnName, interpretedMeaning: "marketing channel", dataRole: "categorical" };
    }
    if (/country|region|industry/i.test(colLower)) {
      return { columnName, interpretedMeaning: `${colLower.replace(/[^a-z]/g, '')} segment`, dataRole: "categorical" };
    }
    return { columnName, interpretedMeaning: "categorical dimension", dataRole: "categorical" };
  }

  // Numeric metric columns
  if (stats.type === "numeric") {
    return { columnName, interpretedMeaning: "numerical metric", dataRole: "numerical metric" };
  }

  // Name/text columns (high cardinality)
  if (stats.type === "text") {
    if (/name|email/i.test(colLower)) {
      return { columnName, interpretedMeaning: /email/i.test(colLower) ? "email address" : "name", dataRole: "name/text" };
    }
    return { columnName, interpretedMeaning: "text field", dataRole: "name/text" };
  }

  return { columnName, interpretedMeaning: "unknown", dataRole: "other" };
}

// Generate suggested analysis questions
function generateSuggestedQuestions(
  columns: string[],
  columnSemantics: ColumnSemantic[],
  hasDate: boolean,
  dateRangeInput: string | null,
  rowCount: number
): string[] {
  const questions: string[] = [];
  const colLower = columns.map(c => c.toLowerCase());

  // Parse date range for questions
  let dateRange: { start: string; end: string } | null = null;
  if (dateRangeInput) {
    const parts = dateRangeInput.split(" to ");
    if (parts.length === 2) {
      dateRange = { start: parts[0], end: parts[1] };
    }
  }

  // Get key columns
  const revenueCol = columnSemantics.find(s => s.dataRole === "monetary" && s.interpretedMeaning.includes("revenue"));
  const profitCol = columnSemantics.find(s => s.dataRole === "monetary" && s.interpretedMeaning.includes("profit"));
  const quantityCol = columnSemantics.find(s => s.dataRole === "quantity");
  const categoryCol = columnSemantics.find(s => s.dataRole === "categorical" || (s.dataRole === "name/text" && s.interpretedMeaning.includes("product")));
  const geoCol = columnSemantics.find(s => s.dataRole === "geographic");
  const dateCol = columnSemantics.find(s => s.dataRole === "date");

  // Time-based question
  if (hasDate && dateRange) {
    if (revenueCol) {
      questions.push(`What is the total ${revenueCol.columnName} by month?`);
    } else if (quantityCol) {
      questions.push(`How has ${quantityCol.columnName} trended over time?`);
    }
  }

  // Ranking/comparison question
  if (revenueCol && categoryCol) {
    questions.push(`What is the total ${revenueCol.columnName} by ${categoryCol.columnName}?`);
  } else if (quantityCol && categoryCol) {
    questions.push(`Which ${categoryCol.columnName} has the highest ${quantityCol.columnName}?`);
  }

  // Geographic segmentation
  if (revenueCol && geoCol) {
    questions.push(`Which ${geoCol.columnName} has the highest ${revenueCol.columnName}?`);
  }

  // Profit analysis (if available)
  if (profitCol) {
    if (categoryCol) {
      questions.push(`Which ${categoryCol.columnName} generates the most ${profitCol.columnName}?`);
    } else {
      questions.push(`What is the total ${profitCol.columnName}?`);
    }
  }

  // AOV / Average order value
  if (revenueCol && quantityCol) {
    questions.push(`What is the average ${revenueCol.columnName} per ${quantityCol.columnName}?`);
  }

  // Distribution question
  if (categoryCol && !questions.some(q => q.includes(categoryCol.columnName))) {
    questions.push(`What is the distribution of ${categoryCol.columnName}?`);
  }

  // Fallback generic questions if not enough specific ones
  if (questions.length < 4) {
    if (revenueCol) questions.push(`What is the total ${revenueCol.columnName}?`);
    if (quantityCol) questions.push(`What is the total ${quantityCol.columnName}?`);
    if (categoryCol && !questions.some(q => q.includes(categoryCol.columnName))) {
      questions.push(`What are the top 5 ${categoryCol.columnName}?`);
    }
  }

  return questions.slice(0, 6);
}

// Main function to generate dataset summary
function generateDatasetSummary(
  columns: string[],
  columnStats: Record<string, ColumnStatistics>,
  sampleData: DatasetRecord[],
  rowCount: number,
  dateRangeInput: string | null,
  currency: string | null
): DatasetSummary {
  // Parse date range string to object
  let dateRange: { start: string; end: string } | null = null;
  if (dateRangeInput) {
    const parts = dateRangeInput.split(" to ");
    if (parts.length === 2) {
      dateRange = { start: parts[0], end: parts[1] };
    }
  }

  // Detect dataset type (using user's specific categories)
  const datasetType = detectDatasetCategory(columns);

  // Detect semantic meaning for each column
  const columnSemantics: ColumnSemantic[] = columns.map(col => {
    const stats = columnStats[col] || { type: "text", unique: 0, nullCount: 0 };
    const sampleValues = sampleData.slice(0, 10).map(row => row[col]);
    return detectColumnSemantic(col, stats, sampleValues);
  });

  // Determine main entity and granularity
  let mainEntity = "records";
  let granularity = "per record";

  if (datasetType === "E-commerce / Transaction Dataset") {
    mainEntity = "orders";
    granularity = "per order";
  } else if (datasetType === "Customer / CRM Dataset") {
    mainEntity = "customers";
    granularity = "per customer";
  } else if (datasetType === "SaaS / Subscription Metrics Dataset") {
    mainEntity = "subscriptions";
    granularity = "per subscription";
  } else if (datasetType === "HR / Employee Dataset") {
    mainEntity = "employees";
    granularity = "per employee";
  }

  // Generate notes
  const notes: string[] = [];
  if (rowCount < 100) notes.push("Small dataset - limited statistical significance");
  if (rowCount > 100000) notes.push("Large dataset - analysis may take longer");

  // Detect main date column for key characteristics
  const hasDate = columnSemantics.some(s => s.dataRole === "date");

  // Generate suggested questions
  const suggestedQuestions = generateSuggestedQuestions(columns, columnSemantics, hasDate, dateRangeInput, rowCount);

  return {
    datasetType,
    columnSemantics,
    keyCharacteristics: {
      rowCount,
      timePeriod: dateRange,
      mainEntity,
      granularity,
      currency,
      notes
    },
    suggestedQuestions
  };
}

// DEBUG: Log column classification results
function logColumnClassification(
  columns: string[],
  columnStats: Record<string, ColumnStatistics>,
  rowCount: number
): void {
  debugLog("[ANALYZER] Column Classification Results:");
  debugLog("[ANALYZER] Total columns:", columns.length, "| Rows:", rowCount);

  const classificationCounts: Record<string, number> = {
    id: 0,
    numeric: 0,
    categorical: 0,
    date: 0,
    geo: 0,
    text: 0,
    boolean: 0,
  };

  columns.forEach(col => {
    const stats = columnStats[col];
    if (stats) {
      const classification = classifyColumn(col, stats);
      classificationCounts[classification]++;

      // Log ID columns for debugging
      if (classification === "id") {
        debugLog(`[ANALYZER] ID column detected: "${col}" (unique: ${stats.unique})`);
      }
    }
  });

  debugLog("[ANALYZER] Classification breakdown:", classificationCounts);

  const financial = hasFinancialData(columns);
  debugLog("[ANALYZER] Financial data:", financial);
}

function calculateSum(values: number[]): number {
  return values.reduce((acc, val) => acc + val, 0);
}

function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return calculateSum(values) / values.length;
}

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return 0;
  const mean = calculateMean(values);
  const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
  return Math.sqrt(calculateMean(squaredDiffs));
}

function isNumericValue(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  try {
    const normalized = normalizeNumberString(String(value));
    const num = parseFloat(normalized);
    return !isNaN(num) && isFinite(num);
  } catch {
    return false;
  }
}

function detectColumnType(values: unknown[]): "numeric" | "text" | "boolean" | "date" {
  const nonNullValues = values.filter((v) => v !== null && v !== undefined && v !== "");
  if (nonNullValues.length === 0) return "text";

  const booleanValues = nonNullValues.filter(
    (v) => v === true || v === false || v === "true" || v === "false" || v === "0" || v === "1"
  );
  if (booleanValues.length === nonNullValues.length) return "boolean";

  const numericValues = nonNullValues.filter(isNumericValue);
  if (numericValues.length / nonNullValues.length > 0.8 && numericValues.length > 0) return "numeric";

  const dateValues = nonNullValues.filter((v) => {
    if (typeof v === "string") {
      const parsed = new Date(v);
      return !isNaN(parsed.getTime());
    }
    return false;
  });
  if (dateValues.length / nonNullValues.length > 0.8) return "date";

  return "text";
}

function calculateColumnStats(values: unknown[], columnName: string): ColumnStatistics {
  const nonNullValues = values.filter((v) => v !== null && v !== undefined && v !== "");
  const nullCount = values.length - nonNullValues.length;
  const uniqueCount = new Set(nonNullValues.map(String)).size;

  const columnType = detectColumnType(values);

  const stats: ColumnStatistics = {
    type: columnType,
    unique: uniqueCount,
    nullCount,
  };

  if (columnType === "numeric") {
    const numericValues = nonNullValues.filter(isNumericValue).map(val => parseNormalizedNumber(String(val)));
    if (numericValues.length > 0) {
      const sum = calculateSum(numericValues);
      const mean = calculateMean(numericValues);
      const median = calculateMedian(numericValues);
      const stdDev = calculateStandardDeviation(numericValues);
      const min = Math.min(...numericValues);
      const max = Math.max(...numericValues);

      stats.min = Math.round(min * 100) / 100;
      stats.max = Math.round(max * 100) / 100;
      stats.mean = Math.round(mean * 100) / 100;
      stats.median = Math.round(median * 100) / 100;
      stats.stdDev = Math.round(stdDev * 100) / 100;
      stats.sum = Math.round(sum * 100) / 100;
    }
  } else if (columnType === "text" || columnType === "date" || columnType === "boolean") {
    const stringValues = nonNullValues.map(String);
    const sortedValues = [...stringValues].sort();
    stats.min = sortedValues[0] as string;
    stats.max = sortedValues[sortedValues.length - 1] as string;
  }

  return stats;
}

function formatCurrency(value: number, currency: string = "EUR"): string {
  // Detect user locale from browser
  const userLocale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
  return new Intl.NumberFormat(userLocale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number): string {
  // Detect user locale from browser
  const userLocale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
  return new Intl.NumberFormat(userLocale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// ============================================================================
// Financial Normalization Functions
// ============================================================================

/**
 * Detect and normalize monetary columns in the dataset
 */
async function normalizeFinancialData(
  data: DatasetRecord[],
  columns: string[],
  columnStats: Record<string, ColumnStatistics>,
  baseCurrency: string = 'EUR'
): Promise<FinancialNormalization> {
  const monetaryColumns: string[] = [];
  const financialNormalization: FinancialNormalization = {
    detected_currency: null,
    base_currency: baseCurrency,
    fx_rate_timestamp: null,
    fx_rate_source: 'Not processed',
    conversion_warnings: [],
    monetary_columns: [],
  };

  // Find monetary columns
  for (const col of columns) {
    const colLower = col.toLowerCase();
    const isMonetary = FINANCIAL_COLUMN_PATTERNS.some(pattern => pattern.test(colLower));
    const stats = columnStats[col];

    if (isMonetary && stats?.type === 'numeric') {
      monetaryColumns.push(col);
    }
  }

  if (monetaryColumns.length === 0) {
    return financialNormalization;
  }

  // Try to detect currency from column names or values
  let detectedCurrency: string | null = null;

  // Priority 1: Find explicit currency columns (Currency_Code, Currency_Symbol)
  const currencyColumns = findCurrencyColumns(columns);

  // Check Currency_Code column first (highest priority)
  if (currencyColumns.codeColumn) {
    const currencyValues = data.map(row => String(row[currencyColumns.codeColumn!] || '')).filter(Boolean);
    detectedCurrency = detectCurrencyFromValues(currencyValues);
    debugLog(`[FX] Detected from Currency_Code column: ${detectedCurrency}`);
  }

  // Check Currency_Symbol column if no code found
  if (!detectedCurrency && currencyColumns.symbolColumn) {
    const symbolValues = data.map(row => String(row[currencyColumns.symbolColumn!] || '')).filter(Boolean);
    detectedCurrency = detectCurrencyFromValues(symbolValues);
    debugLog(`[FX] Detected from Currency_Symbol column: ${detectedCurrency}`);
  }

  // If not found in currency columns, check monetary column names and values
  if (!detectedCurrency && monetaryColumns.length > 0) {
    const sampleValues = data.slice(0, 100).map(row => {
      const val = row[monetaryColumns[0]];
      return val !== null && val !== undefined ? String(val) : '';
    });
    detectedCurrency = detectCurrencyFromValues(sampleValues);

    // Also check column names
    if (!detectedCurrency) {
      for (const col of monetaryColumns) {
        const fromCol = detectCurrencyFromColumn(col);
        if (fromCol) {
          detectedCurrency = fromCol;
          break;
        }
      }
    }
  }

  financialNormalization.detected_currency = detectedCurrency;

  // If detected currency is different from base, fetch FX rates
  if (detectedCurrency && detectedCurrency !== baseCurrency) {
    try {
      const rates = await fetchExchangeRates(baseCurrency);
      financialNormalization.base_currency = baseCurrency;
      financialNormalization.fx_rate_timestamp = rates.timestamp.toISOString();
      financialNormalization.fx_rate_source = rates.source;

      // Convert monetary columns
      for (const col of monetaryColumns) {
        const originalValues: number[] = [];
        const normalizedBaseValues: number[] = [];
        const hasConversionError: boolean[] = [];

        for (const row of data) {
          const rawValue = row[col];
          const numValue = parseNormalizedNumber(String(rawValue));

          originalValues.push(numValue);

          if (numValue > 0) {
            const converted = convertCurrency(numValue, detectedCurrency!, baseCurrency, rates);
            if (converted !== null) {
              normalizedBaseValues.push(Math.round(converted * 10000) / 10000); // High precision
              hasConversionError.push(false);
            } else {
              normalizedBaseValues.push(numValue);
              hasConversionError.push(true);
              financialNormalization.conversion_warnings.push(
                `Conversion failed for ${col} value ${numValue}`
              );
            }
          } else {
            normalizedBaseValues.push(0);
            hasConversionError.push(false);
          }
        }

        financialNormalization.monetary_columns.push({
          name: col,
          original_values: originalValues,
          normalized_base_values: normalizedBaseValues,
          has_conversion_error: hasConversionError,
        });
      }
    } catch (error) {
      financialNormalization.conversion_warnings.push(
        `FX rate fetch failed: ${error}. Using original values.`
      );
    }
  } else if (!detectedCurrency) {
    financialNormalization.conversion_warnings.push(
      'No currency detected. Please specify the currency manually.'
    );
  }

  return financialNormalization;
}

// ============================================================================
// Conservative Dataset Type Detection
// ============================================================================

// Strict column detection patterns - require clear indicators
const STRICT_PATTERNS = {
  // Revenue must be explicit
  revenue: /^(revenue|sales|amount|total)$/i,
  // Cost must be explicit
  cost: /^(cost|cogs|expense|price)$/i,
  // Profit must be explicit
  profit: /^(profit|net|income)$/i,
  // Date columns
  date: /^(date|created_at|updated_at|timestamp|time)$/i,
  // Geographic - lat/lng are very explicit
  geo: /^(lat|lng|lon|latitude|longitude)$/i,
  // Customer ID - very explicit patterns
  customerId: /^(customer_id|customerid|customerNumber|customer_number)$/i,
  // Product ID
  productId: /^(product_id|productid|sku|item_id)$/i,
  // Order ID
  orderId: /^(order_id|orderid|transaction_id|order_number)$/i,
};

interface DatasetTypeResult {
  type: string;
  confidence: "high" | "medium" | "low";
  detectedColumns: string[];
}

function detectDatasetType(
  columns: string[],
  columnStats: Record<string, ColumnStatistics>
): DatasetTypeResult {
  const detectedColumns: string[] = [];

  // Check for explicit geographic data (lat/lng are definitive)
  const hasGeo = columns.some(c => STRICT_PATTERNS.geo.test(c));
  if (hasGeo) {
    const geoCols = columns.filter(c => STRICT_PATTERNS.geo.test(c));
    return {
      type: "Geographic Data",
      confidence: "high",
      detectedColumns: geoCols,
    };
  }

  // Check for explicit financial columns (require strict matches)
  const hasRevenue = columns.find(c => STRICT_PATTERNS.revenue.test(c));
  const hasCost = columns.find(c => STRICT_PATTERNS.cost.test(c));
  const hasProfit = columns.find(c => STRICT_PATTERNS.profit.test(c));
  const hasDate = columns.find(c => STRICT_PATTERNS.date.test(c));

  if (hasRevenue && hasCost) {
    const cols = [hasRevenue, hasCost].filter(Boolean) as string[];
    return {
      type: "Financial / Profit & Loss",
      confidence: "high",
      detectedColumns: cols,
    };
  }

  if (hasRevenue && hasProfit) {
    const cols = [hasRevenue, hasProfit].filter(Boolean) as string[];
    return {
      type: "Financial / Profit & Loss",
      confidence: "high",
      detectedColumns: cols,
    };
  }

  if (hasRevenue && hasDate) {
    const cols = [hasRevenue, hasDate].filter(Boolean) as string[];
    return {
      type: "Time-Series Sales",
      confidence: "high",
      detectedColumns: cols,
    };
  }

  if (hasRevenue) {
    return {
      type: "Sales / Revenue",
      confidence: "medium",
      detectedColumns: [hasRevenue],
    };
  }

  // Check for customer data (requires explicit customer_id)
  const hasCustomerId = columns.find(c => STRICT_PATTERNS.customerId.test(c));
  const hasOrderId = columns.find(c => STRICT_PATTERNS.orderId.test(c));
  const hasProductId = columns.find(c => STRICT_PATTERNS.productId.test(c));

  if (hasCustomerId && hasOrderId) {
    return {
      type: "Customer Orders",
      confidence: "high",
      detectedColumns: [hasCustomerId, hasOrderId],
    };
  }

  if (hasCustomerId && hasProductId) {
    return {
      type: "Product Catalog",
      confidence: "high",
      detectedColumns: [hasCustomerId, hasProductId],
    };
  }

  // Lower confidence patterns (secondary matches)
  const looseRevenue = columns.find(c => /revenue|sales|amount/i.test(c));
  const looseDate = columns.find(c => /date|created|updated/i.test(c));

  if (looseRevenue && looseDate) {
    return {
      type: "Time-Series Data",
      confidence: "medium",
      detectedColumns: [looseRevenue, looseDate],
    };
  }

  // Return generic classification if no strong patterns
  return {
    type: "General Data",
    confidence: "low",
    detectedColumns: columns.slice(0, 3), // Show first 3 columns as reference
  };
}

// ============================================================================
// Conservative Customer Column Detection
// ============================================================================

function findCustomerIdColumn(columns: string[]): string | null {
  // First try strict patterns
  const strictMatch = columns.find(c => STRICT_PATTERNS.customerId.test(c));
  if (strictMatch) return strictMatch;

  // Only use loose pattern if we have a numeric column with high unique count
  // (likely an actual customer ID, not an ID used for something else)
  return null; // Conservative: don't guess
}

function findOrderIdColumn(columns: string[]): string | null {
  const strictMatch = columns.find(c => STRICT_PATTERNS.orderId.test(c));
  if (strictMatch) return strictMatch;
  return null; // Conservative: don't guess
}

// ============================================================================
// Insight Generation with Traceability
// ============================================================================

interface Insight {
  text: string;
  sourceColumn?: string;
  sourceMetric?: string;
}

function generateTraceableInsights(
  data: DatasetRecord[],
  columns: string[],
  columnStats: Record<string, ColumnStatistics>,
  numericStats: Record<string, NumericColumnStats>,
  categoricalStats: Record<string, CategoricalColumnStats>
): Insight[] {
  const insights: Insight[] = [];

  // Revenue-based insights (only if explicit revenue column)
  const revenueCol = columns.find(c => STRICT_PATTERNS.revenue.test(c));
  if (revenueCol && numericStats[revenueCol]) {
    const total = numericStats[revenueCol].total;
    const mean = numericStats[revenueCol].mean;

    insights.push({
      text: `Total ${revenueCol}: ${formatCurrency(total)}`,
      sourceColumn: revenueCol,
      sourceMetric: "total"
    });

    insights.push({
      text: `Average ${revenueCol}: ${formatCurrency(mean)} per record`,
      sourceColumn: revenueCol,
      sourceMetric: "mean"
    });

    // Outlier detection
    const numericValues = data.map(row => Number(row[revenueCol])).filter(isNumericValue);
    const outlierCount = detectOutliers(numericValues, revenueCol);
    if (outlierCount > 0) {
      insights.push({
        text: `High-value outliers: ${outlierCount} records exceed 3σ from mean`,
        sourceColumn: revenueCol,
        sourceMetric: "outliers"
      });
    }
  }

  // Categorical insights (only for true categorical columns)
  const categoryCol = columns.find(c => /category|type|segment/i.test(c));
  if (categoryCol && categoricalStats[categoryCol]) {
    const topValue = categoricalStats[categoryCol].top_values[0];
    if (topValue) {
      insights.push({
        text: `Top ${categoryCol}: "${topValue.value}" (${topValue.percentage}% of records)`,
        sourceColumn: categoryCol,
        sourceMetric: "top_value"
      });
    }
  }

  // Geographic insights
  const countryCol = columns.find(c => /country|region|state/i.test(c));
  if (countryCol && categoricalStats[countryCol]) {
    const topCountry = categoricalStats[countryCol].top_values[0];
    if (topCountry) {
      insights.push({
        text: `Primary market: "${topCountry.value}" (${topCountry.percentage}% of records)`,
        sourceColumn: countryCol,
        sourceMetric: "top_value"
      });
    }
  }

  // Quantity/total insights
  const qtyCol = columns.find(c => /quantity|qty|count|units/i.test(c));
  if (qtyCol && numericStats[qtyCol]) {
    const totalQty = numericStats[qtyCol].total;
    insights.push({
      text: `Total quantity: ${formatNumber(totalQty)} units`,
      sourceColumn: qtyCol,
      sourceMetric: "total"
    });
  }

  // Data quality insights
  const missingCols = Object.entries(columnStats)
    .filter(([_, stats]) => stats.nullCount > 0)
    .map(([col, _]) => col);

  if (missingCols.length > 0) {
    const totalMissing = missingCols.reduce((sum, col) => sum + columnStats[col].nullCount, 0);
    insights.push({
      text: `Data completeness: ${totalMissing} missing values across ${missingCols.length} columns`,
      sourceColumn: "data_quality",
      sourceMetric: "missing_count"
    });
  }

  return insights;
}

function findMainDateColumn(columns: string[], columnStats: Record<string, ColumnStatistics>): string | null {
  const dateColumnPriority = ["date", "order_date", "created_at", "timestamp", "time", "period", "month", "year"];

  for (const priorityName of dateColumnPriority) {
    const match = columns.find((c) => c.toLowerCase().includes(priorityName));
    if (match && columnStats[match]?.type === "date") {
      return match;
    }
  }

  const dateColumns = columns.filter((c) => columnStats[c]?.type === "date");
  return dateColumns.length > 0 ? dateColumns[0] : null;
}

function getDateRange(dates: string[]): string | null {
  if (dates.length === 0) return null;

  const parsedDates = dates
    .map((d) => new Date(d))
    .filter((d) => !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  if (parsedDates.length === 0) return null;

  const formatDate = (d: Date) => d.toISOString().split("T")[0];
  return `${formatDate(parsedDates[0])} to ${formatDate(parsedDates[parsedDates.length - 1])}`;
}

function calculateNumericColumnStats(values: number[]): NumericColumnStats | null {
  if (values.length === 0) return null;

  const sum = calculateSum(values);
  const mean = calculateMean(values);
  const median = calculateMedian(values);
  const std = calculateStandardDeviation(values);
  const min = Math.min(...values);
  const max = Math.max(...values);

  return {
    total: Math.round(sum * 100) / 100,
    mean: Math.round(mean * 100) / 100,
    median: Math.round(median * 100) / 100,
    min: Math.round(min * 100) / 100,
    max: Math.round(max * 100) / 100,
    std: Math.round(std * 100) / 100,
  };
}

function calculateCategoricalTopValues(values: unknown[], totalCount: number): CategoricalTopValue[] {
  const valueCounts: Record<string, number> = {};
  values.forEach((v) => {
    const key = String(v);
    valueCounts[key] = (valueCounts[key] || 0) + 1;
  });

  return Object.entries(valueCounts)
    .map(([value, count]) => ({
      value,
      count,
      percentage: Math.round((count / totalCount) * 10000) / 100,
    }))
    .sort((a, b) => b.count - a.count);
}

function detectDuplicates(data: DatasetRecord[]): number {
  const seen = new Set<string>();
  let duplicates = 0;

  data.forEach((row) => {
    const signature = JSON.stringify(row);
    if (seen.has(signature)) {
      duplicates++;
    } else {
      seen.add(signature);
    }
  });

  return duplicates;
}

function detectOutliers(values: number[], columnName: string): number {
  if (values.length < 10) return 0;

  const mean = calculateMean(values);
  const std = calculateStandardDeviation(values);
  if (std === 0) return 0;

  const outliers = values.filter((v) => Math.abs(v - mean) > 3 * std);
  return outliers.length;
}

// ============================================================================
// Enhanced Categorical Metrics Calculation
// ============================================================================

function calculateEnhancedCategoricalMetrics(
  values: unknown[],
  data: DatasetRecord[],
  columns: string[]
): EnhancedCategoricalMetrics {
  const nonNullValues = values.filter((v) => v !== null && v !== undefined && v !== "");
  const totalCount = nonNullValues.length;
  const uniqueCount = new Set(nonNullValues.map(String)).size;

  // Frequency distribution using Map for O(n) performance
  const frequencyMap = new Map<string, number>();
  nonNullValues.forEach((v) => {
    const key = String(v);
    frequencyMap.set(key, (frequencyMap.get(key) || 0) + 1);
  });

  // Convert to frequency distribution record
  const frequencyDistribution: Record<string, number> = {};
  frequencyMap.forEach((count, value) => {
    frequencyDistribution[value] = count;
  });

  // Sort by count for top values
  const sortedEntries = Array.from(frequencyMap.entries()).sort((a, b) => b[1] - a[1]);

  // Top 5 values
  const top5Values = sortedEntries.slice(0, 5).map(([value, count]) => ({
    value,
    count,
    percentage: Math.round((count / totalCount) * 10000) / 100
  }));

  // Detect outliers - dominant (>50%) and rare (<2%) categories
  const dominantCategories: { value: string; percentage: number }[] = [];
  const rareCategories: { value: string; percentage: number }[] = [];

  sortedEntries.forEach(([value, count]) => {
    const pct = Math.round((count / totalCount) * 10000) / 100;
    if (pct > 50) {
      dominantCategories.push({ value, percentage: pct });
    }
    if (pct < 2 && pct > 0) {
      rareCategories.push({ value, percentage: pct });
    }
  });

  const outliers: CategoricalOutliers = {
    dominant_categories: dominantCategories.slice(0, 3),
    rare_categories: rareCategories.slice(0, 10),
    imbalanced: dominantCategories.length > 0 || rareCategories.length > 0
  };

  // Revenue, profit, units aggregation (placeholder - grouped metrics handle this)
  const revenueAggregation: Record<string, number> | null = null;
  const profitAggregation: Record<string, number> | null = null;
  const unitsAggregation: Record<string, number> | null = null;

  return {
    total_unique: uniqueCount,
    frequency_distribution: frequencyDistribution,
    top_5_values: top5Values,
    outliers,
    revenue_aggregation: revenueAggregation,
    profit_aggregation: profitAggregation,
    units_aggregation: unitsAggregation
  };
}

// ============================================================================
// Grouped Metrics Calculation
// ============================================================================

function calculateGroupedMetrics(
  data: DatasetRecord[],
  columns: string[],
  columnStats: Record<string, ColumnStatistics>
): GroupedMetrics {
  const groupedMetrics: GroupedMetrics = {
    revenue_by_region: {},
    revenue_by_country: {},
    revenue_by_product: {},
    revenue_by_channel: {},
    profit_by_region: {},
    profit_by_country: {},
    profit_by_product: {},
    units_by_region: {},
    units_by_country: {},
    units_by_product: {},
    units_by_channel: {}
  };

  // Identify columns
  const regionCol = columns.find(c => /region|territory|zone/i.test(c));
  const countryCol = columns.find(c => /country|nation/i.test(c));
  const productCol = columns.find(c => /product|item|sku|product_name/i.test(c));
  const channelCol = columns.find(c => /channel|source|medium/i.test(c));

  const revenueCol = columns.find(c => /revenue|sales|amount/i.test(c));
  const profitCol = columns.find(c => /profit|net.*income/i.test(c));
  const unitsCol = columns.find(c => /quantity|qty|units/i.test(c));

  // Calculate totals for percentage
  let totalRevenue = 0;
  let totalProfit = 0;
  let totalUnits = 0;

  data.forEach((row) => {
    if (revenueCol) {
      const val = parseNormalizedNumber(String(row[revenueCol] ?? ''));
      if (!isNaN(val)) totalRevenue += val;
    }
    if (profitCol) {
      const val = parseNormalizedNumber(String(row[profitCol] ?? ''));
      if (!isNaN(val)) totalProfit += val;
    }
    if (unitsCol) {
      const val = parseNormalizedNumber(String(row[unitsCol] ?? ''));
      if (!isNaN(val)) totalUnits += val;
    }
  });

  // Helper to aggregate by category
  const aggregate = (
    catCol: string | undefined,
    valCol: string | undefined,
    target: Record<string, GroupedMetric>,
    total: number
  ) => {
    if (!catCol || !valCol) return;
    const agg: Record<string, { t: number; c: number }> = {};
    data.forEach((row) => {
      const cat = String(row[catCol] ?? 'Unknown');
      const v = parseNormalizedNumber(String(row[valCol] ?? ''));
      if (!isNaN(v)) {
        if (!agg[cat]) agg[cat] = { t: 0, c: 0 };
        agg[cat].t += v;
        agg[cat].c++;
      }
    });
    Object.entries(agg).forEach(([k, vals]) => {
      target[k] = {
        category: k,
        total: Math.round(vals.t * 100) / 100,
        count: vals.c,
        percentage: total > 0 ? Math.round((vals.t / total) * 10000) / 100 : 0
      };
    });
  };

  // Revenue aggregations
  if (regionCol && revenueCol) aggregate(regionCol, revenueCol, groupedMetrics.revenue_by_region, totalRevenue);
  if (countryCol && revenueCol) aggregate(countryCol, revenueCol, groupedMetrics.revenue_by_country, totalRevenue);
  if (productCol && revenueCol) aggregate(productCol, revenueCol, groupedMetrics.revenue_by_product, totalRevenue);
  if (channelCol && revenueCol) aggregate(channelCol, revenueCol, groupedMetrics.revenue_by_channel, totalRevenue);

  // Profit aggregations
  if (regionCol && profitCol) aggregate(regionCol, profitCol, groupedMetrics.profit_by_region, totalProfit);
  if (countryCol && profitCol) aggregate(countryCol, profitCol, groupedMetrics.profit_by_country, totalProfit);
  if (productCol && profitCol) aggregate(productCol, profitCol, groupedMetrics.profit_by_product, totalProfit);

  // Units aggregations
  if (regionCol && unitsCol) aggregate(regionCol, unitsCol, groupedMetrics.units_by_region, totalUnits);
  if (countryCol && unitsCol) aggregate(countryCol, unitsCol, groupedMetrics.units_by_country, totalUnits);
  if (productCol && unitsCol) aggregate(productCol, unitsCol, groupedMetrics.units_by_product, totalUnits);
  if (channelCol && unitsCol) aggregate(channelCol, unitsCol, groupedMetrics.units_by_channel, totalUnits);

  return groupedMetrics;
}

// ============================================================================
// Enhanced Business Insights Engine
// ============================================================================

function generateEnhancedBusinessInsights(
  data: DatasetRecord[],
  columns: string[],
  groupedMetrics: GroupedMetrics,
  numericStats: Record<string, NumericColumnStats>
): EnhancedBusinessInsights {
  const insights: EnhancedBusinessInsights = {
    top_performing_region: null,
    top_performing_country: null,
    top_performing_product: null,
    highest_unit_volume_region: null,
    revenue_concentration_analysis: '',
    category_performance_ranking: []
  };

  // Top performing region
  const regionEntries = Object.entries(groupedMetrics.revenue_by_region);
  if (regionEntries.length > 0) {
    const topRegion = regionEntries.sort((a, b) => b[1].total - a[1].total)[0];
    insights.top_performing_region = {
      name: topRegion[0],
      revenue_pct: topRegion[1].percentage
    };
  }

  // Top performing country
  const countryEntries = Object.entries(groupedMetrics.revenue_by_country);
  if (countryEntries.length > 0) {
    const topCountry = countryEntries.sort((a, b) => b[1].total - a[1].total)[0];
    insights.top_performing_country = {
      name: topCountry[0],
      revenue_pct: topCountry[1].percentage
    };
  }

  // Top performing product
  const productEntries = Object.entries(groupedMetrics.revenue_by_product);
  if (productEntries.length > 0) {
    const topProduct = productEntries.sort((a, b) => b[1].total - a[1].total)[0];
    insights.top_performing_product = {
      name: topProduct[0],
      revenue: topProduct[1].total
    };
  }

  // Highest unit volume region
  const unitsRegionEntries = Object.entries(groupedMetrics.units_by_region);
  if (unitsRegionEntries.length > 0) {
    const topUnitsRegion = unitsRegionEntries.sort((a, b) => b[1].total - a[1].total)[0];
    insights.highest_unit_volume_region = {
      name: topUnitsRegion[0],
      units: topUnitsRegion[1].total
    };
  }

  // Revenue concentration analysis
  if (regionEntries.length > 0) {
    const sortedByRevenue = regionEntries.sort((a, b) => b[1].total - a[1].total);
    const top3Pct = sortedByRevenue.slice(0, 3).reduce((sum, [, v]) => sum + v.percentage, 0);

    if (top3Pct > 80) {
      insights.revenue_concentration_analysis = `High concentration: Top 3 regions account for ${top3Pct.toFixed(2)}% of revenue. Consider diversifying.`;
    } else if (top3Pct > 50) {
      insights.revenue_concentration_analysis = `Moderate concentration: Top 3 regions account for ${top3Pct.toFixed(2)}% of revenue. Healthy distribution.`;
    } else {
      insights.revenue_concentration_analysis = `Well-distributed: Revenue is spread across multiple regions (top 3 = ${top3Pct.toFixed(2)}%).`;
    }
  }

  // Category performance ranking
  if (productEntries.length > 0) {
    insights.category_performance_ranking = productEntries
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10)
      .map(([category, vals]) => ({
        category,
        revenue: vals.total,
        pct: vals.percentage
      }));
  }

  return insights;
}

// ============================================================================
// Insight Generation Functions
// ============================================================================

function generateBusinessInsights(
  data: DatasetRecord[],
  columns: string[],
  columnStats: Record<string, ColumnStatistics>,
  numericStats: Record<string, NumericColumnStats>,
  categoricalStats: Record<string, CategoricalColumnStats>
): string[] {
  const insights: string[] = [];

  // Revenue-based insights (only if explicit revenue column)
  const revenueCol = columns.find(c => STRICT_PATTERNS.revenue.test(c));
  if (revenueCol && numericStats[revenueCol]) {
    const totalRevenue = numericStats[revenueCol].total;
    const avgRevenue = numericStats[revenueCol].mean;

    insights.push(`Total ${revenueCol}: ${formatCurrency(totalRevenue)}`);
    insights.push(`Average ${revenueCol} per record: ${formatCurrency(avgRevenue)}`);

    const outlierCount = detectOutliers(
      data.map((row) => Number(row[revenueCol])).filter(isNumericValue),
      revenueCol
    );
    if (outlierCount > 0) {
      insights.push(`High-value outliers: ${outlierCount} records > 3σ from mean`);
    }
  }

  // Category/product insights
  const categoryCol = columns.find(c => /category|type|product/i.test(c) && !STRICT_PATTERNS.revenue.test(c));
  if (categoryCol && categoricalStats[categoryCol]) {
    const topCategory = categoricalStats[categoryCol].top_values[0];
    if (topCategory) {
      insights.push(`Top ${categoryCol}: "${topCategory.value}" (${topCategory.percentage}% of records)`);
    }
  }

  // Geographic insights
  const countryCol = columns.find(c => /country|region|state/i.test(c));
  if (countryCol && categoricalStats[countryCol]) {
    const topCountry = categoricalStats[countryCol].top_values[0];
    if (topCountry) {
      insights.push(`Primary market: "${topCountry.value}" (${topCountry.percentage}% of records)`);
    }
  }

  // Quantity insights
  const qtyCol = columns.find(c => /quantity|qty|count|units/i.test(c));
  if (qtyCol && numericStats[qtyCol]) {
    const totalQty = numericStats[qtyCol].total;
    insights.push(`Total quantity: ${formatNumber(totalQty)} units`);
  }

  // Customer insights - ONLY if explicit customer_id exists
  const customerCol = findCustomerIdColumn(columns);
  const orderCol = findOrderIdColumn(columns);
  if (customerCol && categoricalStats[customerCol]) {
    const uniqueCustomers = categoricalStats[customerCol].unique;
    insights.push(`Unique customers: ${formatNumber(uniqueCustomers)}`);

    if (orderCol) {
      const totalOrders = data.length;
      if (totalOrders > uniqueCustomers) {
        const repeatRate = ((totalOrders - uniqueCustomers) / totalOrders) * 100;
        insights.push(`Repeat purchase rate: ${repeatRate.toFixed(2)}%`);
      }
    }
  }

  // Return insights - only if explicit return column exists
  const returnCol = columns.find(c => /return|is_return/i.test(c));
  if (returnCol) {
    const returnValues = data.map((row) => String(row[returnCol]).toLowerCase());
    const returnCount = returnValues.filter((v) => v === "true" || v === "1" || v === "yes").length;
    const returnRate = (returnCount / data.length) * 100;

    if (returnRate > 0) {
      insights.push(`Return rate: ${returnRate.toFixed(2)}% (${returnCount} returns)`);
      if (returnRate > 15) {
        insights.push(`⚠️ Return rate above typical benchmark (10-15%)`);
      }
    }
  }

  return insights;
}

function generateEcommerceKPIs(
  data: DatasetRecord[],
  columns: string[],
  numericStats: Record<string, NumericColumnStats>,
  categoricalStats: Record<string, CategoricalColumnStats>
): EcommerceKPIs {
  // Detect business model for KPI section naming
  const isEcommerce = columns.some(c => /cart|checkout|online_order|session|web_visits|utm_source/i.test(c));
  const kpiSectionName = isEcommerce ? "E-Commerce KPIs" : "Revenue & Profit KPIs";

  const kpis: EcommerceKPIs = {
    total_revenue: null,
    average_order_value_aov: null,
    conversion_rate_pct: null,
    cart_abandonment_rate_pct: null,
    return_rate_pct: null,
    customer_lifetime_value_ltv_estimate: null,
    repeat_purchase_rate_pct: null,
    top_insights: [],
    kpi_section_name: kpiSectionName,
  };

  // Use strict pattern matching
  const revenueCol = columns.find(c => STRICT_PATTERNS.revenue.test(c));
  const orderCol = findOrderIdColumn(columns);
  const customerCol = findCustomerIdColumn(columns);
  const returnCol = columns.find(c => /return|is_return/i.test(c));

  // Only calculate revenue metrics if explicit revenue column exists
  if (revenueCol && numericStats[revenueCol]) {
    kpis.total_revenue = numericStats[revenueCol].total;

    // Calculate AOV explicitly as Revenue / Order_Count
    // Only if we have an explicit order_id column
    if (orderCol) {
      const orderCount = data.length; // Each row is an order
      kpis.average_order_value_aov = Math.round((kpis.total_revenue / orderCount) * 100) / 100;
    } else {
      // Use mean per record if no explicit order column
      kpis.average_order_value_aov = numericStats[revenueCol].mean;
    }
  }

  // Only calculate return rate if explicit return column exists
  if (returnCol) {
    const returnValues = data.map((row) => String(row[returnCol]).toLowerCase());
    const returnCount = returnValues.filter((v) => v === "true" || v === "1" || v === "yes").length;
    kpis.return_rate_pct = Math.round((returnCount / data.length) * 10000) / 100;
  }

  // Only calculate customer metrics if explicit customer_id exists
  if (customerCol && categoricalStats[customerCol]) {
    const uniqueCustomers = categoricalStats[customerCol].unique;
    const customerCounts: Record<string, number> = {};
    data.forEach((row) => {
      const customerId = String(row[customerCol]);
      customerCounts[customerId] = (customerCounts[customerId] || 0) + 1;
    });

    const repeatCustomers = Object.values(customerCounts).filter((count) => count > 1).length;
    kpis.repeat_purchase_rate_pct = uniqueCustomers > 0 ? Math.round((repeatCustomers / uniqueCustomers) * 10000) / 100 : null;

    // Only estimate LTV if we have both AOV and customer data
    if (kpis.average_order_value_aov && uniqueCustomers > 0 && orderCol) {
      const avgOrdersPerCustomer = data.length / uniqueCustomers;
      const avgLTV = kpis.average_order_value_aov * avgOrdersPerCustomer * 12;
      kpis.customer_lifetime_value_ltv_estimate = Math.round(avgLTV * 100) / 100;
    }
  }

  // Generate traceable insights only from confirmed columns
  if (kpis.total_revenue) {
    kpis.top_insights.push(`Total ${revenueCol}: ${formatCurrency(kpis.total_revenue)}`);
  }
  if (kpis.average_order_value_aov) {
    const formulaNote = orderCol ? " (Revenue ÷ Order Count)" : " (Mean per record)";
    kpis.top_insights.push(`AOV: ${formatCurrency(kpis.average_order_value_aov)}${formulaNote}`);
    if (kpis.average_order_value_aov < 50) {
      kpis.top_insights.push(`AOV below ${formatCurrency(50)} — consider product bundling`);
    }
  }
  if (kpis.repeat_purchase_rate_pct !== null) {
    const formattedRepeat = kpis.repeat_purchase_rate_pct.toFixed(2);
    if (kpis.repeat_purchase_rate_pct < 20) {
      kpis.top_insights.push(`Low repeat rate (${formattedRepeat}%) — focus on retention`);
    } else if (kpis.repeat_purchase_rate_pct > 40) {
      kpis.top_insights.push(`Strong loyalty — ${formattedRepeat}% repeat buyers`);
    }
  }
  if (kpis.return_rate_pct !== null) {
    const formattedReturn = kpis.return_rate_pct.toFixed(2);
    if (kpis.return_rate_pct > 15) {
      kpis.top_insights.push(`⚠️ High return rate (${formattedReturn}%)`);
    }
  }

  return kpis;
}

function generateFinancialMetrics(
  data: DatasetRecord[],
  columns: string[],
  numericStats: Record<string, NumericColumnStats>,
  categoricalStats: Record<string, CategoricalColumnStats>
): FinancialMetrics {
  const metrics: FinancialMetrics = {
    gross_profit: null,
    gross_margin_pct: null,
    net_profit_estimate: null,
    net_margin_pct: null,
    roi_pct: null,
    cac_estimate: null,
    ltv_to_cac_ratio: null,
    profit_insights: [],
  };

  // Use strict pattern matching - only calculate if explicit columns exist
  const revenueCol = columns.find(c => STRICT_PATTERNS.revenue.test(c));
  const costCol = columns.find(c => STRICT_PATTERNS.cost.test(c));
  const profitCol = columns.find(c => STRICT_PATTERNS.profit.test(c));
  const adSpendCol = columns.find(c => /ad_spend|marketing_spend|advertising/i.test(c));
  const customerCol = findCustomerIdColumn(columns);

  // Only calculate if we have explicit revenue
  if (revenueCol && numericStats[revenueCol]) {
    const revenue = numericStats[revenueCol].total;

    // Only calculate profit if we have explicit cost OR explicit profit column
    if (costCol && numericStats[costCol]) {
      const costs = numericStats[costCol].total;
      metrics.gross_profit = Math.round((revenue - costs) * 100) / 100;
      metrics.gross_margin_pct = costs > 0 ? Math.round(((revenue - costs) / revenue) * 10000) / 100 : null;
    } else if (profitCol && numericStats[profitCol]) {
      metrics.gross_profit = numericStats[profitCol].total;
      metrics.gross_margin_pct = Math.round((numericStats[profitCol].total / revenue) * 10000) / 100;
    } else {
      // Do NOT assume profit = revenue - that's misleading
      metrics.gross_profit = null;
      metrics.gross_margin_pct = null;
    }

    // Only estimate net profit if we have gross profit from actual data
    if (metrics.gross_profit !== null) {
      const estimatedOpCosts = revenue * 0.2;
      metrics.net_profit_estimate = Math.round((metrics.gross_profit - estimatedOpCosts) * 100) / 100;
      metrics.net_margin_pct = Math.round((metrics.net_profit_estimate / revenue) * 10000) / 100;
    }
  }

  // Only calculate ROI if explicit ad spend exists
  if (revenueCol && adSpendCol && numericStats[revenueCol] && numericStats[adSpendCol]) {
    const revenue = numericStats[revenueCol].total;
    const adSpend = numericStats[adSpendCol].total;
    metrics.roi_pct = adSpend > 0 ? Math.round(((revenue - adSpend) / adSpend) * 10000) / 100 : null;
  }

  // Only calculate CAC if explicit customer_id and ad spend exist
  if (customerCol && categoricalStats[customerCol] && adSpendCol && numericStats[adSpendCol]) {
    const uniqueCustomers = categoricalStats[customerCol].unique;
    const adSpend = numericStats[adSpendCol].total;
    metrics.cac_estimate = uniqueCustomers > 0 ? Math.round((adSpend / uniqueCustomers) * 100) / 100 : null;
  }

  // Only calculate LTV:CAC if we have actual CAC data
  if (metrics.cac_estimate && revenueCol && numericStats[revenueCol]) {
    const avgOrderValue = numericStats[revenueCol].mean;
    const estimatedLTV = avgOrderValue * 5;
    metrics.ltv_to_cac_ratio = metrics.cac_estimate > 0 ? Math.round((estimatedLTV / metrics.cac_estimate) * 100) / 100 : null;
  }

  // Generate insights only from confirmed data
  if (metrics.gross_margin_pct !== null) {
    const formattedMargin = metrics.gross_margin_pct.toFixed(2);
    if (metrics.gross_margin_pct > 60) {
      metrics.profit_insights.push(`Gross margin: ${formattedMargin}%`);
    } else if (metrics.gross_margin_pct > 40) {
      metrics.profit_insights.push(`Gross margin: ${formattedMargin}%`);
    } else {
      metrics.profit_insights.push(`Gross margin: ${formattedMargin}% — below typical benchmarks`);
    }
  }

  if (metrics.roi_pct !== null) {
    const formattedRoi = metrics.roi_pct.toFixed(2);
    metrics.profit_insights.push(`ROI: ${formattedRoi}%`);
  }

  if (metrics.ltv_to_cac_ratio !== null) {
    const formattedLtvCac = metrics.ltv_to_cac_ratio.toFixed(2);
    if (metrics.ltv_to_cac_ratio > 3) {
      metrics.profit_insights.push(`LTV:CAC ratio: ${formattedLtvCac}x`);
    } else if (metrics.ltv_to_cac_ratio > 1) {
      metrics.profit_insights.push(`LTV:CAC ratio: ${formattedLtvCac}x`);
    } else {
      metrics.profit_insights.push(`LTV:CAC ratio: ${formattedLtvCac}x — below 1.0 is unprofitable`);
    }
  }

  // Only add note if no financial data exists
  if (metrics.gross_profit === null && metrics.roi_pct === null) {
    metrics.profit_insights.push(`No explicit financial columns detected`);
  }

  return metrics;
}

function generateRecommendations(
  data: DatasetRecord[],
  columns: string[],
  numericStats: Record<string, NumericColumnStats>,
  categoricalStats: Record<string, CategoricalColumnStats>,
  ecommerceKPIs: EcommerceKPIs,
  financialMetrics: FinancialMetrics,
  columnStats: Record<string, ColumnStatistics>
): string[] {
  const recommendations: string[] = [];

  // Classify columns to get business columns
  const businessNumericCols = getBusinessNumericColumns(columns, columnStats);
  const businessCategoricalCols = getBusinessCategoricalColumns(columns, columnStats);
  const financial = hasFinancialData(columns);

  // Revenue-based recommendations (evidence-based on actual metrics)
  if (financial.hasRevenue && ecommerceKPIs.average_order_value_aov) {
    if (ecommerceKPIs.average_order_value_aov < 75) {
      recommendations.push(`AOV: ${ecommerceKPIs.average_order_value_aov.toFixed(2)} — below $75 benchmark`);
    }
    if (ecommerceKPIs.repeat_purchase_rate_pct && ecommerceKPIs.repeat_purchase_rate_pct < 30) {
      recommendations.push(`Repeat rate: ${ecommerceKPIs.repeat_purchase_rate_pct.toFixed(2)}% — below 30% benchmark`);
    }
  }

  // Product diversification recommendations (evidence-based on record frequency)
  const productCol = businessCategoricalCols.find(c => /product|item|sku/i.test(c));
  if (productCol && categoricalStats[productCol]) {
    const topProduct = categoricalStats[productCol].top_values[0];
    if (topProduct && topProduct.percentage > 40) {
      recommendations.push(`'${topProduct.value}' appears in ${topProduct.percentage}% of records — high concentration risk`);
    }
  }

  // Category recommendations (evidence-based)
  const categoryCol = businessCategoricalCols.find(c => /category|type/i.test(c));
  if (categoryCol && categoricalStats[categoryCol]) {
    const topCategory = categoricalStats[categoryCol].top_values[0];
    if (topCategory && topCategory.percentage > 50) {
      recommendations.push(`'${topCategory.value}' accounts for ${topCategory.percentage}% of entries — limited category diversity`);
    }
  }

  // Geographic recommendations (evidence-based)
  const countryCol = businessCategoricalCols.find(c => /country|region/i.test(c));
  if (countryCol && categoricalStats[countryCol]) {
    const topCountry = categoricalStats[countryCol].top_values[0];
    if (topCountry && topCountry.percentage > 30) {
      recommendations.push(`'${topCountry.value}' represents ${topCountry.percentage}% of entries — potential market concentration`);
    }
  }

  // Return rate recommendations (evidence-based on actual return_rate_pct)
  if (ecommerceKPIs.return_rate_pct && ecommerceKPIs.return_rate_pct > 10) {
    recommendations.push(`Return rate of ${ecommerceKPIs.return_rate_pct.toFixed(2)}% detected — exceeds 10% benchmark`);
  }

  // Margin recommendations (evidence-based on calculated metrics)
  if (financial.hasCost && financialMetrics.gross_margin_pct && financialMetrics.gross_margin_pct < 40) {
    recommendations.push(`Gross margin at ${financialMetrics.gross_margin_pct.toFixed(2)}% — below 40% industry benchmark`);
  }

  // If no specific recommendations, generate contextual ones based on data
  if (recommendations.length === 0) {
    if (businessNumericCols.length > 0) {
      const col = businessNumericCols[0];
      if (numericStats[col] && numericStats[col].std > numericStats[col].mean * 0.5) {
        recommendations.push(`High variability detected in '${col}' — consider investigating outliers`);
      } else {
        recommendations.push(`'${col}' shows consistent values — suitable for trend analysis`);
      }
    }

    if (businessCategoricalCols.length > 0) {
      const col = businessCategoricalCols[0];
      if (categoricalStats[col]) {
        const uniqueCount = categoricalStats[col].unique;
        if (uniqueCount < 10) {
          recommendations.push(`Low cardinality in '${col}' (${uniqueCount} values) — ideal for segmentation`);
        } else {
          recommendations.push(`'${col}' has ${uniqueCount} unique values — useful for grouping and analysis`);
        }
      }
    }

    // Fallback recommendation
    if (recommendations.length === 0) {
      recommendations.push(`This dataset has ${columns.length} columns and ${data.length} rows — ready for deeper analysis`);
    }
  }

  return recommendations;
}

function generateVisualizationSuggestions(
  columns: string[],
  columnStats: Record<string, ColumnStatistics>
): VisualizationSuggestion[] {
  const suggestions: VisualizationSuggestion[] = [];

  // Classify all columns first
  const classifiedCols: Record<string, string> = {};
  columns.forEach(col => {
    const stats = columnStats[col];
    if (stats) {
      // Add count for ID detection
      stats.count = 1000; // Default count
      classifiedCols[col] = classifyColumn(col, stats);
    }
  });

  // Identify key columns
  const dateCol = Object.entries(columnStats).find(([_, stats]) => stats.type === "date")?.[0];
  const revenueCol = columns.find((c) => /^(revenue|sales|amount)$/i.test(c));
  const costCol = columns.find((c) => /^(cost|expense)$/i.test(c));
  const profitCol = columns.find((c) => /^(profit|net_income)$/i.test(c));
  const regionCol = columns.find((c) => /country|region|state/i.test(c));
  const productCol = columns.find((c) => /product|item|sku|category/i.test(c) && classifiedCols[c] !== "id");
  const marginCol = columns.find((c) => /margin|gross_profit/i.test(c));

  // Derive profit if not explicit (revenue - cost)
  const hasProfit = !!profitCol;
  const hasMargin = !!marginCol;

  // === STRATEGIC VISUALIZATIONS (Priority 1) ===

  // Revenue vs Cost scatter plot - efficiency analysis
  if (revenueCol && costCol) {
    suggestions.push({
      chart_type: "scatter",
      title: `Revenue vs ${costCol} Efficiency`,
      x: costCol,
      y: revenueCol,
      aggregation: "none",
      python_snippet: `df.plot.scatter(x='${costCol}', y='${revenueCol}', title='Revenue vs Cost Efficiency')`,
    });
  }

  // Profit by Region - geographic performance
  if (regionCol && (hasProfit || (revenueCol && costCol))) {
    const profitMetric = hasProfit ? profitCol : `(${revenueCol} - ${costCol})`;
    suggestions.push({
      chart_type: "bar",
      title: `Profit by ${regionCol}`,
      x: regionCol,
      y: hasProfit ? profitCol : "calculated_profit",
      aggregation: "sum",
      limit: 10,
      python_snippet: hasProfit
        ? `df.groupby('${regionCol}')['${profitCol}'].sum().nlargest(10).plot(kind='bar', title='Profit by ${regionCol}')`
        : `df.groupby('${regionCol}').apply(lambda x: x['${revenueCol}'].sum() - x['${costCol}'].sum()).nlargest(10).plot(kind='bar', title='Profit by ${regionCol}')`,
    });
  }

  // Margin by Product - product profitability
  if (productCol && (hasMargin || hasProfit || (revenueCol && costCol))) {
    suggestions.push({
      chart_type: "bar",
      title: `Margin by ${productCol}`,
      x: productCol,
      y: hasMargin ? marginCol : (hasProfit ? profitCol : "calculated_margin"),
      aggregation: "mean",
      limit: 10,
      python_snippet: hasMargin
        ? `df.groupby('${productCol}')['${marginCol}'].mean().nlargest(10).plot(kind='bar', title='Margin by ${productCol}')`
        : `df.groupby('${productCol}').apply(lambda x: (x['${revenueCol}'].sum() - x['${costCol}'].sum()) / x['${revenueCol}'].sum()).nlargest(10).plot(kind='bar', title='Margin by ${productCol}')`,
    });
  }

  // Monthly Revenue Trend - time-series (already strategic)
  if (dateCol && revenueCol) {
    suggestions.push({
      chart_type: "line",
      title: "Monthly Revenue Trend",
      x: dateCol,
      y: revenueCol,
      aggregation: "sum",
      python_snippet: `df.groupby(pd.Grouper(key='${dateCol}', freq='M'))['${revenueCol}'].sum().plot(title='Monthly Revenue', kind='line')`,
    });
  }

  // === DESCRIPTIVE VISUALIZATIONS (Priority 2 - only if strategic ones are added) ===

  // Revenue by Category/Product (only if not already added as Margin chart)
  if (productCol && revenueCol && !hasMargin && !hasProfit) {
    suggestions.push({
      chart_type: "bar",
      title: `Top ${productCol}s by Revenue`,
      x: productCol,
      y: revenueCol,
      aggregation: "sum",
      limit: 10,
      python_snippet: `df.groupby('${productCol}')['${revenueCol}'].sum().nlargest(10).plot(kind='bar', title='Top ${productCol}s by Revenue')`,
    });
  }

  // === LIMIT RESULTS ===
  return suggestions.slice(0, 4);
}

function generateFollowUpQuestions(
  columns: string[],
  hasRevenue: boolean,
  hasCost: boolean,
  hasAdSpend: boolean,
  hasDate: boolean,
  rowCount: number
): string[] {
  const questions: string[] = [];

  if (!hasCost && hasRevenue) {
    questions.push("Do you have cost/profit data for margin analysis?");
  }
  if (!hasAdSpend) {
    questions.push("Would you like CAC or ad spend data for ROI calculations?");
  }
  if (!hasDate) {
    questions.push("Is there a date column for time-series trend analysis?");
  }
  if (rowCount < 1000) {
    questions.push("This is a small dataset — want me to analyze a larger sample?");
  }
  questions.push("Would you like cohort analysis by customer acquisition month?");

  return questions.slice(0, 4);
}

// ============================================================================
// Main Analysis Function
// ============================================================================

export async function analyzeCSV(data: DatasetRecord[], baseCurrency: string = 'EUR'): Promise<CSVAnalysisResult> {
  // Set session base currency
  setSessionBaseCurrency(baseCurrency);

  if (data.length === 0) {
    return {
      file_info: {
        rows: 0,
        columns: 0,
        column_names: [],
        inferred_type: "Other",
        main_date_column: null,
        date_range: null,
      },
      data_quality: {
        missing_counts: {},
        duplicates: 0,
        warnings: ["Empty dataset — no data to analyze"],
      },
      key_metrics: {
        numeric: {},
        categorical: {},
        business_insights: ["No data available for analysis"],
      },
      ecommerce_kpis: {
        total_revenue: null,
        average_order_value_aov: null,
        conversion_rate_pct: null,
        cart_abandonment_rate_pct: null,
        return_rate_pct: null,
        customer_lifetime_value_ltv_estimate: null,
        repeat_purchase_rate_pct: null,
        top_insights: ["No data available"],
        kpi_section_name: "Revenue & Profit KPIs",
      },
      financial_metrics: {
        gross_profit: null,
        gross_margin_pct: null,
        net_profit_estimate: null,
        net_margin_pct: null,
        roi_pct: null,
        cac_estimate: null,
        ltv_to_cac_ratio: null,
        profit_insights: ["No data available"],
      },
      financial_normalization: {
        detected_currency: null,
        base_currency: 'EUR',
        fx_rate_timestamp: null,
        fx_rate_source: 'N/A',
        conversion_warnings: [],
        monetary_columns: [],
      },
      executive_insights: {
        summary: 'No data available',
        kpis: {
          revenue_growth_pct: null,
          profit_margin_pct: null,
          top_20_customers_pct: null,
          revenue_concentration_pct: null,
          avg_order_value: null,
          customer_ltv_estimate: null,
          total_revenue: null,
          total_profit: null,
          top_region: null,
          top_product: null,
        },
        insights: [],
        risks: [],
        opportunities: [],
      },
      // NEW: Business KPIs
      business_kpis: {
        status: 'insufficient_data',
        total_revenue: 0,
        total_cost: 0,
        gross_profit: 0,
        margin_pct: 0,
        total_units: 0,
        avg_order_value: 0,
        revenue_by_region: {},
        revenue_by_product: {},
        revenue_by_currency: {},
        revenue_by_time: {},
        top_contributor: null,
        top_performing_market: null,
        top_currency: null,
        fx_rate_source: 'N/A',
        fx_rate_date: null,
        base_currency: baseCurrency,
        concentration_risk: null,
      },
      // NEW: Executive summary
      executive_summary: null,
      // NEW: Processed data
      processed_data: [],
      // NEW: Enhanced structured analysis
      numericMetrics: {},
      categoricalMetrics: {},
      groupedMetrics: {
        revenue_by_region: {},
        revenue_by_country: {},
        revenue_by_product: {},
        revenue_by_channel: {},
        profit_by_region: {},
        profit_by_country: {},
        profit_by_product: {},
        units_by_region: {},
        units_by_country: {},
        units_by_product: {},
        units_by_channel: {}
      },
      enhancedBusinessInsights: {
        top_performing_region: null,
        top_performing_country: null,
        top_performing_product: null,
        highest_unit_volume_region: null,
        revenue_concentration_analysis: '',
        category_performance_ranking: []
      },
      recommendations: ["Upload a dataset with data to receive recommendations"],
      visualization_suggestions: [],
      follow_up_questions: ["Upload a dataset to analyze"],
      // NEW: Overview metrics
      total_rows: 0,
      total_columns: 0,
      numeric_columns: [],
      date_columns: [],
      categorical_columns: [],
      column_types: {},
      // NEW: Dataset Summary (User's automatic analysis format)
      dataset_summary: null,
    };
  }

  const columns = Object.keys(data[0]);
  const rowCount = data.length;

  const columnStats: Record<string, ColumnStatistics> = {};
  const numericStats: Record<string, NumericColumnStats> = {};
  const categoricalStats: Record<string, CategoricalColumnStats> = {};

  for (const column of columns) {
    const values = data.map((row) => row[column]);
    const stats = calculateColumnStats(values, column);
    columnStats[column] = stats;

    // Add count property for ID detection
    stats.count = values.length;

    if (stats.type === "numeric") {
      const numericValues = values.filter(isNumericValue).map(Number);
      numericStats[column] = calculateNumericColumnStats(numericValues) || {
        total: 0,
        mean: 0,
        median: 0,
        min: 0,
        max: 0,
        std: 0,
      };
    }

    if (stats.type === "text" || stats.type === "boolean") {
      categoricalStats[column] = {
        top_values: calculateCategoricalTopValues(values, rowCount),
        unique: stats.unique,
      };
    }
  }

  // DEBUG: Log column classification
  logColumnClassification(columns, columnStats, rowCount);

  // Get business-meaningful columns (exclude IDs)
  const businessNumericCols = getBusinessNumericColumns(columns, columnStats);
  const businessCategoricalCols = getBusinessCategoricalColumns(columns, columnStats);
  const financial = hasFinancialData(columns);

  debugLog("[ANALYZER] Business numeric columns:", businessNumericCols);
  debugLog("[ANALYZER] Business categorical columns:", businessCategoricalCols);
  debugLog("[ANALYZER] Financial data present:", financial);

  // Normalize financial data (detect currency and convert to base)
  const financialNormalization = await normalizeFinancialData(
    data,
    columns,
    columnStats,
    baseCurrency
  );

  // NEW: Process multi-currency dataset
  let multiCurrencyProcessed: any = null;
  let businessKPIs: BusinessKPIs | null = null;
  let executiveSummary: ExecutiveSummary | null = null;

  try {
    debugLog('[ANALYZER] Starting multi-currency processing...');
    multiCurrencyProcessed = await processMultiCurrencyDataset(data, baseCurrency);

    if (multiCurrencyProcessed.monetaryColumns.length > 0) {
      debugLog('[ANALYZER] Calculating KPIs from processed data...');
      businessKPIs = calculateKPIs(multiCurrencyProcessed);
      executiveSummary = generateExecutiveSummary(businessKPIs);
      debugLog('[ANALYZER] Multi-currency processing complete:', {
        currencies: Object.keys(businessKPIs.revenue_by_currency),
        topMarket: businessKPIs.top_performing_market,
        baseCurrency: businessKPIs.base_currency,
      });
    }
  } catch (error) {
    debugError('[ANALYZER] Multi-currency processing error:', error);
  }

  const inferredTypeResult = detectDatasetType(columns, columnStats);
  const inferredType = inferredTypeResult.type;
  const mainDateColumn = findMainDateColumn(columns, columnStats);
  const dateColValues = mainDateColumn
    ? data.map((row) => String(row[mainDateColumn])).filter((v) => v)
    : [];
  const dateRange = getDateRange(dateColValues);

  // Generate dataset summary (User's automatic analysis format)
  const detectedCurrency = financialNormalization?.detected_currency || null;
  const dataset_summary = generateDatasetSummary(
    columns,
    columnStats,
    data,
    rowCount,
    dateRange,
    detectedCurrency
  );

  const missingCounts: Record<string, number> = {};
  for (const column of columns) {
    missingCounts[column] = columnStats[column]?.nullCount || 0;
  }
  const duplicates = detectDuplicates(data);

  const warnings: string[] = [];
  if (duplicates > 0) {
    warnings.push(`${duplicates} duplicate rows detected`);
  }

  const highMissingCols = Object.entries(missingCounts).filter(
    ([col, count]) => count > rowCount * 0.1
  );
  if (highMissingCols.length > 0) {
    warnings.push(
      `High missing values in: ${highMissingCols.map(([col]) => col).join(", ")}`
    );
  }

  const businessInsights = generateBusinessInsights(
    data,
    columns,
    columnStats,
    numericStats,
    categoricalStats
  );

  const hasRevenue = columns.some((c) => c.toLowerCase().includes("revenue"));
  const hasCost = columns.some((c) => c.toLowerCase().includes("cost"));
  const hasAdSpend = columns.some((c) => c.toLowerCase().includes("ad"));
  const hasDate = Object.values(columnStats).some((s) => s.type === "date");

  const ecommerceKPIs = generateEcommerceKPIs(data, columns, numericStats, categoricalStats);
  const financialMetrics = generateFinancialMetrics(data, columns, numericStats, categoricalStats);

  const recommendations = generateRecommendations(
    data,
    columns,
    numericStats,
    categoricalStats,
    ecommerceKPIs,
    financialMetrics,
    columnStats
  );

  const visualizationSuggestions = generateVisualizationSuggestions(columns, columnStats);
  const followUpQuestions = generateFollowUpQuestions(
    columns,
    hasRevenue,
    hasCost,
    hasAdSpend,
    hasDate,
    rowCount
  );

  // Generate executive-level business insights
  const executiveInsights = generateExecutiveInsights(data, columns, columnStats);

  return {
    file_info: {
      rows: rowCount,
      columns: columns.length,
      column_names: columns,
      inferred_type: inferredType,
      main_date_column: mainDateColumn,
      date_range: dateRange,
    },
    data_quality: {
      missing_counts: missingCounts,
      duplicates,
      warnings,
    },
    key_metrics: {
      numeric: numericStats,
      categorical: categoricalStats,
      business_insights: businessInsights,
    },
    ecommerce_kpis: ecommerceKPIs,
    financial_metrics: financialMetrics,
    financial_normalization: financialNormalization,
    executive_insights: executiveInsights,
    // NEW: Multi-currency business KPIs
    business_kpis: businessKPIs || {
      status: 'insufficient_data',
      total_revenue: 0,
      total_cost: 0,
      gross_profit: 0,
      margin_pct: 0,
      total_units: 0,
      avg_order_value: 0,
      revenue_by_region: {},
      revenue_by_product: {},
      revenue_by_currency: {},
      revenue_by_time: {},
      top_contributor: null,
      top_performing_market: null,
      top_currency: null,
      fx_rate_source: 'N/A',
      fx_rate_date: null,
      base_currency: baseCurrency,
      concentration_risk: null,
    },
    // NEW: Executive summary from multi-currency processing
    executive_summary: executiveSummary,
    // NEW: Processed data with Revenue_Base columns
    processed_data: multiCurrencyProcessed?.data || data,
    // NEW: Enhanced structured analysis
    numericMetrics: numericStats,
    categoricalMetrics: (() => {
      const enhanced: Record<string, EnhancedCategoricalMetrics> = {};
      // Use pre-calculated categoricalStats and enhance with outliers
      Object.entries(categoricalStats).forEach(([key, val]) => {
        // Get values for this column to calculate outliers
        const colValues = data.map(row => row[key]);
        const enhancedMetrics = calculateEnhancedCategoricalMetrics(colValues, data, columns);
        enhanced[key] = enhancedMetrics;
      });
      return enhanced;
    })(),
    groupedMetrics: calculateGroupedMetrics(data, columns, columnStats),
    enhancedBusinessInsights: generateEnhancedBusinessInsights(data, columns, calculateGroupedMetrics(data, columns, columnStats), numericStats),
    recommendations,
    visualization_suggestions: visualizationSuggestions,
    follow_up_questions: followUpQuestions,
    // NEW: Overview metrics - computed from data
    total_rows: rowCount,
    total_columns: columns.length,
    numeric_columns: columns.filter(col => columnStats[col]?.type === 'numeric'),
    date_columns: columns.filter(col => columnStats[col]?.type === 'date'),
    categorical_columns: columns.filter(col => columnStats[col]?.type === 'text'),
    column_types: Object.fromEntries(columns.map(col => [col, columnStats[col]?.type || 'unknown'])),
    // NEW: Dataset Summary (User's automatic analysis format)
    dataset_summary,
  };
}

// Re-export types for external use
