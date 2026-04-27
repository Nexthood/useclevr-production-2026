// ============================================================================
// SEMANTIC COLUMN MAPPER - Business Column Detection & User Override
// ============================================================================
// Maps uploaded columns to internal business schema:
// - revenue, cost, profit, date, region, product, customer, category
//
// Supports:
// - Heuristic detection
// - LLM classification (optional)
// - User override with re-analysis trigger
// ============================================================================

import {
  ColumnMapping,
  BusinessColumnType,
  MappingOverride,
  DetectedBusinessColumns,
  CostComponents,
  ColumnSchema,
  PreviewData,
} from './pipeline-types';

import { DatasetType } from './dataset-type-detector';

// ============================================================================
// CONSTANTS - Column Name Patterns
// ============================================================================

const REVENUE_PATTERNS = [
  'revenue', 'total_revenue', 'gmv', 'order_total', 'amount', 'sales',
  'income', 'gross_sales', 'net_sales', 'total_sales', 'order_value',
  'total', 'grand_total', 'subtotal', 'gross', 'net_revenue', 'sales_amount'
];

const COST_PATTERNS = [
  'cost', 'cogs', 'cost_of_goods', 'cost_of_sales', 'cost_of_revenue',
  'expense', 'expenses', 'unit_cost', 'product_cost', 'cost_price', 'total_cost'
];

const PROFIT_PATTERNS = [
  'profit', 'net_profit', 'gross_profit', 'margin', 'net_margin',
  'gross_margin', 'profit_margin', 'income', 'net_income'
];

const REGION_PATTERNS = [
  'region', 'country', 'geo', 'location', 'market', 'territory',
  'area', 'zone', 'state', 'province', 'country_code', 'country_iso', 'nation', 'geography'
];

const PRODUCT_PATTERNS = [
  'product', 'item', 'sku', 'variant', 'name', 'title', 'product_name',
  'item_name', 'product_title', 'goods', 'merchandise', 'description', 'product_description'
];

const CUSTOMER_PATTERNS = [
  'customer', 'client', 'user', 'buyer', 'email', 'customer_id', 'user_id', 'client_id'
];

const CATEGORY_PATTERNS = [
  'category', 'type', 'kind', 'group', 'segment', 'classification', 'department'
];

const DATE_PATTERNS = [
  'date', 'timestamp', 'datetime', 'created_at', 'updated_at', 'order_date',
  'transaction_date', 'sale_date', 'period', 'month', 'year', 'quarter'
];

const QUANTITY_PATTERNS = [
  'quantity', 'qty', 'units', 'volume', 'count', 'num_items', 'item_count'
];

const CURRENCY_PATTERNS = [
  'currency', 'iso_currency', 'currency_code', 'currency_iso'
];

const DISCOUNT_PATTERNS = [
  'discount', 'discount_amount', 'discounts', 'promotion', 'coupon', 'promo', 'discounts_amount'
];

const REFUND_PATTERNS = [
  'refund', 'refunds', 'returns', 'return_amount', 'refund_amount', 'return_value'
];

const SHIPPING_PATTERNS = [
  'shipping', 'delivery', 'freight', 'shipping_cost', 'delivery_cost', 'shipping_fee'
];

const MARKETING_PATTERNS = [
  'marketing', 'ad_spend', 'advertising', 'campaign_cost', 'marketing_cost', 'acquisition_cost'
];

const COGS_PATTERNS = [
  'cogs', 'cost_of_goods', 'cost_of_sales', 'unit_cost', 'product_cost', 'cost_price'
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Normalize column name for pattern matching
 */
function normalizeColumnName(col: string): string {
  return col
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

/**
 * Find column by pattern matching
 */
function findColumnByPatterns(
  columns: string[],
  patterns: string[]
): { column: string | null; confidence: 'high' | 'medium' | 'low' } {
  const normalizedCols = columns.map(c => ({
    original: c,
    normalized: normalizeColumnName(c)
  }));

  for (const pattern of patterns) {
    // Try exact match first (high confidence)
    const exactMatch = normalizedCols.find(c => c.normalized === pattern);
    if (exactMatch) {
      return { column: exactMatch.original, confidence: 'high' };
    }

    // Try contains match (medium confidence)
    const containsMatch = normalizedCols.find(c => c.normalized.includes(pattern));
    if (containsMatch) {
      return { column: containsMatch.original, confidence: 'medium' };
    }
  }

  return { column: null, confidence: 'low' };
}

/**
 * Validate numeric column (has at least 50% valid numbers)
 */
function isNumericColumn(rows: Record<string, any>[], column: string): boolean {
  const values = rows.map(r => r[column]);
  const validCount = values.filter(v => {
    if (v === null || v === undefined || v === '') return false;
    const num = parseFloat(String(v));
    return !isNaN(num) && isFinite(num);
  }).length;

  return validCount > values.length * 0.5 && validCount > 0;
}

/**
 * Check if column has non-zero values
 */
function hasNonZeroValues(rows: Record<string, any>[], column: string): boolean {
  return rows.some(r => {
    const val = parseFloat(r[column]);
    return !isNaN(val) && val !== 0;
  });
}

/**
 * Validate date column (at least 30% parseable, at least 2 distinct months)
 */
function isValidDateColumn(rows: Record<string, any>[], column: string): boolean {
  const parseableCount = rows.filter(r => {
    const val = r[column];
    return typeof val === 'string' && val.trim() !== '' && !isNaN(Date.parse(val));
  }).length;

  if (parseableCount < rows.length * 0.3) return false;

  // Check for at least 2 distinct months
  const months = new Set<string>();
  for (const row of rows) {
    const val = row[column];
    if (typeof val === 'string') {
      const date = new Date(val);
      if (!isNaN(date.getTime())) {
        months.add(`${date.getFullYear()}-${date.getMonth()}`);
      }
    }
  }

  return months.size >= 2;
}

// ============================================================================
// COST COMPONENTS DETECTION
// ============================================================================

/**
 * Detect cost component columns
 */
function detectCostComponents(
  columns: string[],
  rows: Record<string, any>[]
): CostComponents {
  const result: CostComponents = {
    cogs: null,
    marketing_cost: null,
    shipping_cost: null,
    refunds: null,
    discount_amount: null,
  };

  // COGS
  const cogsResult = findColumnByPatterns(columns, COGS_PATTERNS);
  if (cogsResult.column && isNumericColumn(rows, cogsResult.column)) {
    result.cogs = cogsResult.column;
  }

  // Marketing Cost
  const marketingResult = findColumnByPatterns(columns, MARKETING_PATTERNS);
  if (marketingResult.column && isNumericColumn(rows, marketingResult.column)) {
    result.marketing_cost = marketingResult.column;
  }

  // Shipping Cost
  const shippingResult = findColumnByPatterns(columns, SHIPPING_PATTERNS);
  if (shippingResult.column && isNumericColumn(rows, shippingResult.column)) {
    result.shipping_cost = shippingResult.column;
  }

  // Refunds
  const refundResult = findColumnByPatterns(columns, REFUND_PATTERNS);
  if (refundResult.column && isNumericColumn(rows, refundResult.column)) {
    result.refunds = refundResult.column;
  }

  // Discount
  const discountResult = findColumnByPatterns(columns, DISCOUNT_PATTERNS);
  if (discountResult.column && isNumericColumn(rows, discountResult.column)) {
    result.discount_amount = discountResult.column;
  }

  console.log('[MAPPER] Cost components detected:', result);
  return result;
}

// ============================================================================
// MAIN COLUMN MAPPER
// ============================================================================

/**
 * Detect business columns from preview data using heuristics
 * @param previewData - Preview data with column schemas
 * @returns Detected business columns with confidence levels
 */
export function detectBusinessColumnsFromPreview(
  previewData: PreviewData
): DetectedBusinessColumns {
  const { columns, rows } = previewData;

  // Initialize result
  const detected: DetectedBusinessColumns = {
    revenueColumn: null,
    profitColumn: null,
    costColumn: null,
    dateColumn: null,
    productColumn: null,
    regionColumn: null,
    fallbackRegionColumn: null,
    currencyColumn: null,
    quantityColumn: null,
    costComponents: { cogs: null, marketing_cost: null, shipping_cost: null, refunds: null, discount_amount: null },
    confidence: {},
  };

  // Revenue detection
  const revenueResult = findColumnByPatterns(columns, REVENUE_PATTERNS);
  if (revenueResult.column && isNumericColumn(rows, revenueResult.column) && hasNonZeroValues(rows, revenueResult.column)) {
    detected.revenueColumn = revenueResult.column;
    detected.confidence.revenueColumn = revenueResult.confidence;
  }

  // Profit detection
  const profitResult = findColumnByPatterns(columns, PROFIT_PATTERNS);
  if (profitResult.column && isNumericColumn(rows, profitResult.column)) {
    detected.profitColumn = profitResult.column;
    detected.confidence.profitColumn = profitResult.confidence;
  }

  // Cost detection (validated)
  let costColumn = findColumnByPatterns(columns, COST_PATTERNS).column;
  if (costColumn && isNumericColumn(rows, costColumn) && hasNonZeroValues(rows, costColumn)) {
    detected.costColumn = costColumn;
    detected.confidence.costColumn = 'medium';
  }

  // Date detection (strict validation)
  const dateColumn = columns.find(col => isValidDateColumn(rows, col)) || null;
  detected.dateColumn = dateColumn;
  if (dateColumn) {
    detected.confidence.dateColumn = 'high';
  }

  // Product detection
  const productResult = findColumnByPatterns(columns, PRODUCT_PATTERNS);
  if (productResult.column) {
    detected.productColumn = productResult.column;
    detected.confidence.productColumn = productResult.confidence;
  }

  // Region detection
  const regionResult = findColumnByPatterns(columns, REGION_PATTERNS.filter(p => p !== 'country'));
  if (regionResult.column) {
    detected.regionColumn = regionResult.column;
    detected.confidence.regionColumn = regionResult.confidence;
  }

  // Fallback to country
  const countryColumn = columns.find(col => /country|nation|geo|location/i.test(col)) || null;
  detected.fallbackRegionColumn = detected.regionColumn || countryColumn;

  // Currency detection
  const currencyResult = findColumnByPatterns(columns, CURRENCY_PATTERNS);
  if (currencyResult.column) {
    detected.currencyColumn = currencyResult.column;
    detected.confidence.currencyColumn = 'high';
  }

  // Quantity detection
  const quantityResult = findColumnByPatterns(columns, QUANTITY_PATTERNS);
  if (quantityResult.column && isNumericColumn(rows, quantityResult.column)) {
    detected.quantityColumn = quantityResult.column;
    detected.confidence.quantityColumn = quantityResult.confidence;
  }

  // Cost components
  detected.costComponents = detectCostComponents(columns, rows);

  console.log('[MAPPER] Business columns detected:', {
    revenue: detected.revenueColumn,
    profit: detected.profitColumn,
    cost: detected.costColumn,
    date: detected.dateColumn,
    product: detected.productColumn,
    region: detected.regionColumn,
    costComponents: detected.costComponents,
  });

  return detected;
}

/**
 * Create initial column mapping from detected columns
 * @param datasetId - Dataset ID
 * @param userId - User ID
 * @param detectedColumns - Detected business columns
 * @returns ColumnMapping object
 */
export function createColumnMapping(
  datasetId: string,
  userId: string,
  detectedColumns: DetectedBusinessColumns,
  datasetType: DatasetType = 'generic_business_data',
  datasetTypeConfidence: number = 0
): ColumnMapping {
  const mappings: Record<BusinessColumnType, string | null> = {
    revenue: detectedColumns.revenueColumn,
    cost: detectedColumns.costColumn,
    profit: detectedColumns.profitColumn,
    date: detectedColumns.dateColumn,
    region: detectedColumns.regionColumn,
    country: detectedColumns.fallbackRegionColumn,
    product: detectedColumns.productColumn,
    customer: null,
    category: null,
    quantity: detectedColumns.quantityColumn,
    currency: detectedColumns.currencyColumn,
    discount: detectedColumns.costComponents.discount_amount,
    refund: detectedColumns.costComponents.refunds,
    shipping_cost: detectedColumns.costComponents.shipping_cost,
    marketing_cost: detectedColumns.costComponents.marketing_cost,
    cogs: detectedColumns.costComponents.cogs,
    unknown: null,
  };

  const confidence: Record<BusinessColumnType, 'high' | 'medium' | 'low'> = {
    revenue: detectedColumns.confidence.revenueColumn || 'low',
    cost: detectedColumns.confidence.costColumn || 'low',
    profit: detectedColumns.confidence.profitColumn || 'low',
    date: detectedColumns.confidence.dateColumn || 'low',
    region: detectedColumns.confidence.regionColumn || 'low',
    country: detectedColumns.confidence.regionColumn || 'low',
    product: detectedColumns.confidence.productColumn || 'low',
    customer: 'low',
    category: 'low',
    quantity: detectedColumns.confidence.quantityColumn || 'low',
    currency: detectedColumns.confidence.currencyColumn || 'low',
    discount: 'low',
    refund: 'low',
    shipping_cost: 'low',
    marketing_cost: 'low',
    cogs: 'low',
    unknown: 'low',
  };

  return {
    datasetId,
    userId,
    mappings,
    confidence,
    isAutoDetected: true,
    lastUpdated: new Date().toISOString(),
    version: 1,
    datasetType,
    datasetTypeConfidence,
  };
}

/**
 * Apply user override to column mapping
 * @param currentMapping - Current column mapping
 * @param override - Override to apply
 * @returns Updated column mapping
 */
export function applyMappingOverride(
  currentMapping: ColumnMapping,
  override: MappingOverride
): ColumnMapping {
  const newMappings = { ...currentMapping.mappings };
  newMappings[override.businessType] = override.columnName;

  return {
    ...currentMapping,
    mappings: newMappings,
    isAutoDetected: false,
    lastUpdated: override.timestamp,
    version: currentMapping.version + 1,
  };
}

/**
 * Validate column mapping (check if referenced columns exist)
 * @param mapping - Column mapping to validate
 * @param availableColumns - Available column names
 * @returns true if mapping is valid
 */
export function validateColumnMapping(
  mapping: ColumnMapping,
  availableColumns: string[]
): boolean {
  const columnSet = new Set(availableColumns.map(c => c.toLowerCase()));

  for (const [, columnName] of Object.entries(mapping.mappings)) {
    if (columnName && !columnSet.has(columnName.toLowerCase())) {
      console.error('[MAPPER] Invalid mapping: column not found:', columnName);
      return false;
    }
  }

  return true;
}

// ============================================================================
// DATASET TYPE OVERRIDE
// ============================================================================

/**
 * Apply dataset type override
 * @param currentMapping - Current column mapping
 * @param newDatasetType - New dataset type
 * @returns Updated column mapping
 */
export function applyDatasetTypeOverride(
  currentMapping: ColumnMapping,
  newDatasetType: DatasetType
): ColumnMapping {
  return {
    ...currentMapping,
    datasetType: newDatasetType,
    datasetTypeConfidence: 1.0, // User override = 100% confidence
    isAutoDetected: false,
    lastUpdated: new Date().toISOString(),
    version: currentMapping.version + 1,
  };
}
