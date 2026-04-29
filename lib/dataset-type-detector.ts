import { debugLog, debugError, debugWarn } from "@/lib/debug"

// ============================================================================
// DATASET TYPE DETECTOR - Auto Business Model Detection
// ============================================================================
// Detects the type of business data (SaaS, E-commerce, Startup Finance, etc.)
// using heuristics and semantic signals from column names and data patterns.
// ============================================================================

import { PreviewData, ColumnSchema } from './pipeline-types';

// ============================================================================
// DATASET TYPES
// ============================================================================

export type DatasetType = 
  | 'saas_metrics'
  | 'ecommerce_sales'
  | 'startup_finance'
  | 'marketing_campaign'
  | 'customer_churn'
  | 'financial_transactions'
  | 'inventory_management'
  | 'generic_business_data';

export interface DatasetTypeDetection {
  datasetType: DatasetType;
  confidence: number; // 0.0 - 1.0
  confidenceLevel: 'high' | 'medium' | 'low';
  detectedIndicators: string[];
  suggestedMetrics: string[];
  recommendedCharts: string[];
}

// ============================================================================
// COLUMN PATTERNS FOR EACH DATASET TYPE
// ============================================================================

// SaaS Metrics patterns
const SAAS_PATTERNS = {
  required: ['mrr', 'arr', 'churn', 'subscription', 'plan', 'customer'],
  optional: ['ltv', 'cac', 'arpu', ' ARR', 'mrr_growth', 'net_revenue_retention', 'gross_revenue_retention', ' churn_rate', 'logo', 'seat', 'usage', 'monthly_recurring', 'annual_recurring'],
  revenue: ['mrr', 'arr', 'subscription_revenue', 'recurring_revenue', 'monthly_revenue'],
  metrics: ['churn_rate', 'churn', 'ltv', 'cac', 'arpu', 'nps', 'retention'],
};

const ECOMMERCE_PATTERNS = {
  required: ['product', 'sku', 'order', 'quantity', 'price', 'units'],
  optional: ['sales', 'transaction', 'cart', 'checkout', 'order_id', 'item', 'product_name', 'category', 'subcategory'],
  revenue: ['revenue', 'sales', 'order_total', 'gmv', 'gross_merchandise', 'total_sales', 'net_sales'],
  metrics: ['units_sold', 'average_order_value', 'conversion_rate', 'cart_abandonment'],
};

const STARTUP_PATTERNS = {
  required: ['funding', 'burn', 'runway', 'revenue'],
  optional: ['marketing_spend', 'revenue_growth', 'founder', 'investment', 'valuation', 'cap_table', 'dilution', 'equity', 'seed', 'series'],
  revenue: ['revenue', 'income', 'sales', 'bookings'],
  metrics: ['burn_rate', 'runway', 'cac', 'ltv', 'growth_rate', 'moic', 'irr'],
};

const MARKETING_PATTERNS = {
  required: ['impression', 'click', 'conversion'],
  optional: ['cpc', 'ctr', 'cpm', 'campaign', 'ad', 'advertising', 'spend', 'budget', 'channel', 'source', 'medium'],
  revenue: ['revenue', 'conversion_value', 'sales', 'attributed_revenue'],
  metrics: ['cpc', 'ctr', 'cpm', 'conversion_rate', 'roi', 'roas', 'impression_share'],
};

const CHURN_PATTERNS = {
  required: ['churn', 'cancellation', '流失'],
  optional: ['cohort', 'retention', 'tenure', 'subscription', 'customer_lifetime', 'monthly_recurring'],
  revenue: ['revenue_lost', 'arr_churn', 'mrr_churn'],
  metrics: ['churn_rate', 'retention_rate', 'cohort_retention', 'customer_lifetime'],
};

const FINANCE_PATTERNS = {
  required: ['transaction', 'payment', 'amount'],
  optional: ['invoice', 'ledger', 'account', 'debit', 'credit', 'balance', 'expense'],
  revenue: ['revenue', 'income', 'transaction_amount'],
  metrics: ['transaction_count', 'average_transaction', 'payment_volume'],
};

const INVENTORY_PATTERNS = {
  required: ['inventory', 'stock', 'sku'],
  optional: ['warehouse', 'quantity', 'reorder', 'supplier', 'lead_time', 'turnover'],
  revenue: ['cost', 'value', 'stock_value'],
  metrics: ['stock_level', 'turnover_rate', 'reorder_point', 'days_on_hand'],
};

// ============================================================================
// DETECTION FUNCTIONS
// ============================================================================

/**
 * Calculate similarity score between column names and patterns
 */
function calculatePatternScore(columnNames: string[], patterns: string[]): number {
  const normalizedColumns = columnNames.map(c => c.toLowerCase().replace(/[^a-z0-9]/g, ''));
  let matchCount = 0;
  let partialMatchCount = 0;

  for (const pattern of patterns) {
    const normalizedPattern = pattern.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    for (const col of normalizedColumns) {
      if (col === normalizedPattern) {
        matchCount += 1;
      } else if (col.includes(normalizedPattern) || normalizedPattern.includes(col)) {
        partialMatchCount += 0.5;
      }
    }
  }

  return matchCount + partialMatchCount;
}

/**
 * Detect numeric columns that might contain revenue/profit
 */
function detectFinancialColumns(previewData: PreviewData): { hasRevenue: boolean; hasProfit: boolean; hasCost: boolean } {
  const columns = previewData.columns;
  const columnTypes = previewData.columnTypes;
  
  const revenuePatterns = ['revenue', 'sales', 'amount', 'total', 'income'];
  const profitPatterns = ['profit', 'margin', 'net'];
  const costPatterns = ['cost', 'cogs', 'expense'];
  
  let hasRevenue = false;
  let hasProfit = false;
  let hasCost = false;
  
  for (const col of columns) {
    const normalizedCol = col.toLowerCase();
    const colType = columnTypes[col];
    
    if (colType === 'currency' || colType === 'numeric') {
      if (revenuePatterns.some(p => normalizedCol.includes(p))) hasRevenue = true;
      if (profitPatterns.some(p => normalizedCol.includes(p))) hasProfit = true;
      if (costPatterns.some(p => normalizedCol.includes(p))) hasCost = true;
    }
  }
  
  return { hasRevenue, hasProfit, hasCost };
}

/**
 * Detect if dataset has time-series data
 */
function hasTimeSeriesData(previewData: PreviewData): boolean {
  const dateColumns = previewData.columns.filter(col => 
    previewData.columnTypes[col] === 'date'
  );
  return dateColumns.length > 0;
}

/**
 * Detect if dataset has geographic data
 */
function hasGeographicData(previewData: PreviewData): boolean {
  const geoPatterns = ['country', 'region', 'city', 'location', 'geo', 'state', 'province'];
  return previewData.columns.some(col => 
    geoPatterns.some(p => col.toLowerCase().includes(p))
  );
}

// ============================================================================
// MAIN DETECTION FUNCTION
// ============================================================================

/**
 * Detect dataset type from preview data
 * @param previewData - Preview data with column schemas
 * @returns Detection result with type, confidence, and recommendations
 */
export function detectDatasetType(previewData: PreviewData): DatasetTypeDetection {
  const columnNames = previewData.columns;
  const columnTypes = previewData.columnTypes;
  
  debugLog('[DATASET-TYPE] Starting detection for columns:', columnNames);
  
  // Calculate scores for each dataset type
  const scores: Record<DatasetType, number> = {
    saas_metrics: calculatePatternScore(columnNames, SAAS_PATTERNS.required) * 2 +
                  calculatePatternScore(columnNames, SAAS_PATTERNS.optional),
    ecommerce_sales: calculatePatternScore(columnNames, ECOMMERCE_PATTERNS.required) * 2 +
                      calculatePatternScore(columnNames, ECOMMERCE_PATTERNS.optional),
    startup_finance: calculatePatternScore(columnNames, STARTUP_PATTERNS.required) * 2 +
                     calculatePatternScore(columnNames, STARTUP_PATTERNS.optional),
    marketing_campaign: calculatePatternScore(columnNames, MARKETING_PATTERNS.required) * 2 +
                        calculatePatternScore(columnNames, MARKETING_PATTERNS.optional),
    customer_churn: calculatePatternScore(columnNames, CHURN_PATTERNS.required) * 2 +
                    calculatePatternScore(columnNames, CHURN_PATTERNS.optional),
    financial_transactions: calculatePatternScore(columnNames, FINANCE_PATTERNS.required) * 2 +
                             calculatePatternScore(columnNames, FINANCE_PATTERNS.optional),
    inventory_management: calculatePatternScore(columnNames, INVENTORY_PATTERNS.required) * 2 +
                          calculatePatternScore(columnNames, INVENTORY_PATTERNS.optional),
    generic_business_data: 0, // Fallback
  };
  
  // Check financial column patterns to differentiate
  const financialCols = detectFinancialColumns(previewData);
  const hasTimeSeries = hasTimeSeriesData(previewData);
  const hasGeo = hasGeographicData(previewData);
  
  // Adjust scores based on data patterns
  if (financialCols.hasRevenue) {
    scores.saas_metrics += 1;
    scores.ecommerce_sales += 1;
    scores.startup_finance += 1;
  }
  
  if (hasTimeSeries) {
    scores.saas_metrics += 1;
    scores.marketing_campaign += 1;
    scores.startup_finance += 1;
  }
  
  if (hasGeo) {
    scores.ecommerce_sales += 1;
    scores.marketing_campaign += 1;
  }
  
  // Find highest scoring type
  let maxScore = 0;
  let detectedType: DatasetType = 'generic_business_data';
  
  for (const [type, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      detectedType = type as DatasetType;
    }
  }
  
  // Calculate confidence (normalize to 0-1 range)
  const maxPossibleScore = 10; // Assume max reasonable score
  const confidence = Math.min(maxScore / maxPossibleScore, 1.0);
  
  // Determine confidence level
  let confidenceLevel: 'high' | 'medium' | 'low';
  if (confidence >= 0.7) {
    confidenceLevel = 'high';
  } else if (confidence >= 0.4) {
    confidenceLevel = 'medium';
  } else {
    confidenceLevel = 'low';
  }
  
  // Collect detected indicators
  const detectedIndicators: string[] = [];
  
  if (SAAS_PATTERNS.required.some(p => columnNames.some(c => c.toLowerCase().includes(p)))) {
    detectedIndicators.push('SaaS-specific columns detected');
  }
  if (ECOMMERCE_PATTERNS.required.some(p => columnNames.some(c => c.toLowerCase().includes(p)))) {
    detectedIndicators.push('E-commerce columns detected');
  }
  if (STARTUP_PATTERNS.required.some(p => columnNames.some(c => c.toLowerCase().includes(p)))) {
    detectedIndicators.push('Startup finance columns detected');
  }
  if (MARKETING_PATTERNS.required.some(p => columnNames.some(c => c.toLowerCase().includes(p)))) {
    detectedIndicators.push('Marketing campaign columns detected');
  }
  if (financialCols.hasRevenue) detectedIndicators.push('Revenue data detected');
  if (hasTimeSeries) detectedIndicators.push('Time-series data detected');
  if (hasGeo) detectedIndicators.push('Geographic data detected');
  
  // Get suggested metrics and charts based on type
  const { suggestedMetrics, recommendedCharts } = getRecommendationsForType(detectedType);
  
  debugLog('[DATASET-TYPE] Detection result:', {
    type: detectedType,
    confidence: `${(confidence * 100).toFixed(0)}%`,
    indicators: detectedIndicators,
  });
  
  return {
    datasetType: detectedType,
    confidence,
    confidenceLevel,
    detectedIndicators,
    suggestedMetrics,
    recommendedCharts,
  };
}

/**
 * Get recommended metrics and charts for dataset type
 */
function getRecommendationsForType(type: DatasetType): { suggestedMetrics: string[]; recommendedCharts: string[] } {
  switch (type) {
    case 'saas_metrics':
      return {
        suggestedMetrics: ['MRR', 'ARR', 'MRR Growth Rate', 'Churn Rate', 'Net Revenue Retention', 'Customer LTV', 'CAC', 'ARPPU'],
        recommendedCharts: ['MRR Growth Line Chart', 'Churn Rate Trend', 'Revenue by Plan', 'Customer Cohort Analysis', 'LTV vs CAC Scatter'],
      };
    case 'ecommerce_sales':
      return {
        suggestedMetrics: ['Total Revenue', 'Units Sold', 'Average Order Value', 'Revenue by Product', 'Revenue by Region', 'Conversion Rate'],
        recommendedCharts: ['Revenue by Product Bar Chart', 'Sales by Region Map', 'Monthly Sales Trend', 'Top Products Table', 'Category Breakdown'],
      };
    case 'startup_finance':
      return {
        suggestedMetrics: ['Burn Rate', 'Runway (months)', 'Revenue Growth', 'CAC', 'LTV', 'Monthly Revenue', 'Expenses by Category'],
        recommendedCharts: ['Burn Rate Trend', 'Runway Forecast', 'Revenue vs Expenses', 'Expense Breakdown Pie', 'Growth Rate Line'],
      };
    case 'marketing_campaign':
      return {
        suggestedMetrics: ['Impressions', 'Clicks', 'Conversions', 'CPC', 'CTR', 'CPM', 'ROAS', 'Campaign Performance'],
        recommendedCharts: ['CTR Trend', 'CPC by Campaign', 'Conversion Funnel', 'Channel Performance Bar', 'ROAS Comparison'],
      };
    case 'customer_churn':
      return {
        suggestedMetrics: ['Churn Rate', 'Retention Rate', 'Cohort Retention', 'Customer Lifetime', 'Churned Revenue'],
        recommendedCharts: ['Cohort Retention Heatmap', 'Churn Rate Trend', 'Churn by Segment', 'Customer Lifetime Distribution'],
      };
    case 'financial_transactions':
      return {
        suggestedMetrics: ['Total Transaction Volume', 'Average Transaction Value', 'Transaction Count', 'Revenue by Account'],
        recommendedCharts: ['Transaction Volume Trend', 'Transaction Distribution', 'Top Accounts Table'],
      };
    case 'inventory_management':
      return {
        suggestedMetrics: ['Stock Level', 'Inventory Turnover', 'Reorder Point', 'Days on Hand', 'Stock Value'],
        recommendedCharts: ['Stock Levels Bar', 'Turnover Trend', 'Inventory Value Pie', 'Reorder Alerts'],
      };
    default:
      return {
        suggestedMetrics: ['Total Revenue', 'Total Cost', 'Profit Margin', 'Growth Rate', 'Top Products', 'Top Regions'],
        recommendedCharts: ['Revenue Trend', 'Product Breakdown', 'Regional Distribution', 'Profit Analysis'],
      };
  }
}

/**
 * Get display name for dataset type
 */
export function getDatasetTypeDisplayName(type: DatasetType): string {
  const displayNames: Record<DatasetType, string> = {
    saas_metrics: 'SaaS Metrics',
    ecommerce_sales: 'E-commerce Sales',
    startup_finance: 'Startup Finance',
    marketing_campaign: 'Marketing Campaign',
    customer_churn: 'Customer Churn',
    financial_transactions: 'Financial Transactions',
    inventory_management: 'Inventory Management',
    generic_business_data: 'Generic Business Data',
  };
  return displayNames[type];
}

/**
 * Get all available dataset types for dropdown
 */
export function getAllDatasetTypes(): { value: DatasetType; label: string }[] {
  return [
    { value: 'saas_metrics', label: 'SaaS Metrics' },
    { value: 'ecommerce_sales', label: 'E-commerce Sales' },
    { value: 'startup_finance', label: 'Startup Finance' },
    { value: 'marketing_campaign', label: 'Marketing Campaign' },
    { value: 'customer_churn', label: 'Customer Churn' },
    { value: 'financial_transactions', label: 'Financial Transactions' },
    { value: 'inventory_management', label: 'Inventory Management' },
    { value: 'generic_business_data', label: 'Generic Business Data' },
  ];
}
