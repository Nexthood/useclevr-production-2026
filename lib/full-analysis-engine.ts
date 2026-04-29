import { debugLog, debugError, debugWarn } from "@/lib/debug"

// ============================================================================
// FULL DATASET ANALYSIS ENGINE - Deterministic KPI Computation
// ============================================================================
// Runs analysis ONLY on the FULL dataset (not preview).
// All computed metrics become the single source of truth for:
// - KPI cards
// - Charts
// - Executive summary
// - Recommendations
// - AI explanations
// ============================================================================

import {
  PrecomputedMetrics,
  DetectedBusinessColumns,
  CostComponents,
  CleaningStats,
  ColumnMapping,
  TopPerformer,
  WorstPerformer,
  RegionalMetric,
  ProductMetric,
  MonthlyAggregate,
  CategoryAggregate,
  ConsistencyValidationResult,
} from './pipeline-types';

// ============================================================================
// CONSTANTS
// ============================================================================

const ANALYSIS_VERSION = '2.0.0';
const MAX_TOP_ITEMS = 10;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse numeric value safely
 */
function parseNumeric(value: any): number {
  if (value === null || value === undefined) return 0;
  const num = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
  return isNaN(num) ? 0 : num;
}

/**
 * Format month from date string
 */
function getMonthKey(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'unknown';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  } catch {
    return 'unknown';
  }
}

/**
 * Calculate percentage with rounding
 */
function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 1000) / 10;
}

/**
 * Sort and get top N items
 */
function getTopN<T>(
  record: Record<string, number>,
  n: number,
  sortBy: 'desc' | 'asc' = 'desc'
): { key: string; value: number }[] {
  const entries = Object.entries(record)
    .filter(([, value]) => value !== 0)
    .sort((a, b) => sortBy === 'desc' ? b[1] - a[1] : a[1] - b[1]);
  
  return entries.slice(0, n).map(([key, value]) => ({ key, value }));
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Run full dataset analysis
 * @param cleanedRows - Cleaned dataset rows
 * @param columnMapping - Column mapping (which columns contain what business data)
 * @param detectedColumns - Detected business columns
 * @param cleaningStats - Data cleaning statistics
 * @returns Precomputed metrics (single source of truth)
 */
export function runFullDatasetAnalysis(
  cleanedRows: Record<string, any>[],
  columnMapping: ColumnMapping,
  detectedColumns: DetectedBusinessColumns,
  cleaningStats: CleaningStats
): PrecomputedMetrics {
  debugLog(`[ANALYSIS] Running full analysis on ${cleanedRows.length} rows`);

  const { mappings } = columnMapping;
  
  // Extract column names from mapping
  const revenueColumn = mappings.revenue;
  const profitColumn = mappings.profit;
  const costColumn = mappings.cost;
  const dateColumn = mappings.date;
  const productColumn = mappings.product;
  const regionColumn = mappings.region || mappings.country;
  const quantityColumn = mappings.quantity;
  
  // Cost components from mapping
  const cogsColumn = mappings.cogs;
  const marketingColumn = mappings.marketing_cost;
  const shippingColumn = mappings.shipping_cost;
  const refundColumn = mappings.refund;
  const discountColumn = mappings.discount;

  // Initialize accumulators
  let totalRevenue = 0;
  let totalCOGS = 0;
  let totalMarketing = 0;
  let totalShipping = 0;
  let totalRefunds = 0;
  let totalDiscount = 0;
  let validRevenueCount = 0;

  // Aggregation maps
  const revenueByProduct: Record<string, number> = {};
  const revenueByRegion: Record<string, number> = {};
  const revenueByMonth: Record<string, number> = {};
  
  const profitByProduct: Record<string, number> = {};
  const profitByRegion: Record<string, number> = {};
  const profitByMonth: Record<string, number> = {};
  
  const transactionCountByMonth: Record<string, number> = {};
  
  const quantityByProduct: Record<string, number> = {};

  // Track date range
  let minDate: string | null = null;
  let maxDate: string | null = null;

  // Process each row
  for (const row of cleanedRows) {
    // Get revenue value
    let revenue = 0;
    if (revenueColumn) {
      revenue = parseNumeric(row[revenueColumn]);
      if (revenue !== 0) {
        validRevenueCount++;
      }
    }

    // Get cost components
    const cogs = cogsColumn ? parseNumeric(row[cogsColumn]) : 0;
    const marketing = marketingColumn ? parseNumeric(row[marketingColumn]) : 0;
    const shipping = shippingColumn ? parseNumeric(row[shippingColumn]) : 0;
    const refunds = refundColumn ? parseNumeric(row[refundColumn]) : 0;
    const discount = discountColumn ? parseNumeric(row[discountColumn]) : 0;

    // Calculate profit per row (spec formula: revenue - cogs - marketing - shipping - refunds)
    const rowProfit = revenue - cogs - marketing - shipping - refunds;

    // Accumulate totals
    totalRevenue += revenue;
    totalCOGS += cogs;
    totalMarketing += marketing;
    totalShipping += shipping;
    totalRefunds += refunds;
    totalDiscount += discount;

    // Get product and region
    const product = productColumn ? String(row[productColumn] || 'Unknown') : 'Unknown';
    const region = regionColumn ? String(row[regionColumn] || 'Unknown') : 'Unknown';
    
    // Get date for monthly aggregation
    let monthKey = 'unknown';
    if (dateColumn && row[dateColumn]) {
      monthKey = getMonthKey(String(row[dateColumn]));
      
      // Update date range
      if (minDate === null || row[dateColumn] < minDate) {
        minDate = String(row[dateColumn]);
      }
      if (maxDate === null || row[dateColumn] > maxDate) {
        maxDate = String(row[dateColumn]);
      }
    }

    // Aggregate by product
    if (productColumn && revenue !== 0) {
      revenueByProduct[product] = (revenueByProduct[product] || 0) + revenue;
      profitByProduct[product] = (profitByProduct[product] || 0) + rowProfit;
    }

    // Aggregate by region
    if (regionColumn && revenue !== 0) {
      revenueByRegion[region] = (revenueByRegion[region] || 0) + revenue;
      profitByRegion[region] = (profitByRegion[region] || 0) + rowProfit;
    }

    // Aggregate by month
    if (dateColumn && revenue !== 0) {
      revenueByMonth[monthKey] = (revenueByMonth[monthKey] || 0) + revenue;
      profitByMonth[monthKey] = (profitByMonth[monthKey] || 0) + rowProfit;
      transactionCountByMonth[monthKey] = (transactionCountByMonth[monthKey] || 0) + 1;
    }

    // Aggregate quantity by product
    if (quantityColumn && productColumn) {
      const qty = parseNumeric(row[quantityColumn]);
      if (qty > 0) {
        quantityByProduct[product] = (quantityByProduct[product] || 0) + qty;
      }
    }
  }

  // Calculate derived metrics
  const totalCost = totalCOGS + totalMarketing + totalShipping + totalRefunds;
  const totalProfit = totalRevenue - totalCost;
  const profitMargin = totalRevenue > 0 
    ? Math.round((totalProfit / totalRevenue) * 1000) / 10 
    : null;
  const averageRevenuePerTransaction = validRevenueCount > 0 
    ? totalRevenue / validRevenueCount 
    : 0;

  // Calculate growth metrics
  const { growthRate, growthTrend, growthValid, growthMessage, sortedMonths } = 
    calculateGrowthMetrics(revenueByMonth, transactionCountByMonth);

  // Get top performers
  const topProducts = getTopPerformers(revenueByProduct, totalRevenue, MAX_TOP_ITEMS);
  const topRegions = getTopPerformers(revenueByRegion, totalRevenue, MAX_TOP_ITEMS);
  const worstProducts = getWorstPerformers(profitByProduct, MAX_TOP_ITEMS);

  // Build regional performance
  const regionalPerformance = buildRegionalMetrics(
    revenueByRegion,
    profitByRegion,
    totalRevenue
  );

  // Build product performance
  const productPerformance = buildProductMetrics(
    revenueByProduct,
    profitByProduct,
    quantityByProduct,
    totalRevenue
  );

  // Build chart data
  const chartData = buildChartData(
    revenueByMonth,
    profitByMonth,
    transactionCountByMonth,
    sortedMonths,
    revenueByProduct,
    revenueByRegion,
    profitByProduct,
    profitByRegion,
    totalRevenue
  );

  // Run consistency validation
  const validationStatus = runConsistencyValidation(
    totalRevenue,
    chartData,
    validRevenueCount,
    cleanedRows.length
  );

  debugLog('[ANALYSIS] Analysis complete:', {
    totalRevenue,
    totalProfit,
    profitMargin,
    growthRate,
    topProducts: topProducts.length,
    topRegions: topRegions.length,
  });

  return {
    datasetId: columnMapping.datasetId,
    analysisVersion: ANALYSIS_VERSION,
    computedAt: new Date().toISOString(),
    fullDatasetRowCount: cleanedRows.length,
    
    // Dataset type (business model)
    datasetType: columnMapping.datasetType,
    datasetTypeConfidence: columnMapping.datasetTypeConfidence,
    
    // Revenue metrics
    totalRevenue,
    averageRevenuePerTransaction,
    revenueValidRowCount: validRevenueCount,
    
    // Profit metrics
    totalCost,
    totalProfit,
    profitMargin,
    profitReliability: ((): 'verified' | 'derived' | 'unavailable' => {
      // Minimal, data-driven default derived from available components
      const hasDirectProfit = Boolean(mappings.profit);
      const hasCostBreakdown = Boolean(mappings.cogs || mappings.marketing_cost || mappings.shipping_cost || mappings.refund);
      if (hasDirectProfit) return 'verified';
      if (hasCostBreakdown) return 'derived';
      return 'unavailable';
    })(),
    
    // Cost breakdown
    costBreakdown: {
      cogs: totalCOGS,
      marketingCost: totalMarketing,
      shippingCost: totalShipping,
      refunds: totalRefunds,
      discount: totalDiscount,
      totalCost,
    },
    
    // Growth metrics
    growthRate,
    growthTrend,
    growthValid,
    growthMessage,
    dateRange: minDate && maxDate ? { start: minDate, end: maxDate } : null,
    
    // Top performers
    topProducts,
    topRegions,
    worstProducts,
    
    // Performance metrics
    regionalPerformance,
    productPerformance,
    
    // Data quality
    invalidRowCount: cleaningStats.invalidRowCount,
    missingValueCount: Object.values(cleaningStats.missingValueCounts).reduce((a, b) => a + b, 0),
    cleaningStats,
    
    // Detected columns
    detectedColumns,
    
    // Chart data
    chartData,
    
    // Validation status
    validationStatus,
  };
}

// ============================================================================
// GROWTH METRICS
// ============================================================================

function calculateGrowthMetrics(
  revenueByMonth: Record<string, number>,
  transactionCountByMonth: Record<string, number>
): {
  growthRate: number | null;
  growthTrend: 'up' | 'down' | 'stable' | null;
  growthValid: boolean;
  growthMessage: string;
  sortedMonths: string[];
} {
  // Sort months chronologically
  const sortedMonths = Object.keys(revenueByMonth).sort();
  
  if (sortedMonths.length < 2) {
    return {
      growthRate: null,
      growthTrend: null,
      growthValid: false,
      growthMessage: 'Insufficient data for growth analysis (need at least 2 months)',
      sortedMonths: [],
    };
  }

  // Compare first and last month
  const firstMonth = sortedMonths[0];
  const lastMonth = sortedMonths[sortedMonths.length - 1];
  const firstRevenue = revenueByMonth[firstMonth];
  const lastRevenue = revenueByMonth[lastMonth];

  if (firstRevenue === 0) {
    return {
      growthRate: null,
      growthTrend: null,
      growthValid: false,
      growthMessage: 'Cannot calculate growth: first month has zero revenue',
      sortedMonths,
    };
  }

  const growthRate = Math.round(((lastRevenue - firstRevenue) / firstRevenue) * 1000) / 10;
  
  let growthTrend: 'up' | 'down' | 'stable';
  if (growthRate > 5) {
    growthTrend = 'up';
  } else if (growthRate < -5) {
    growthTrend = 'down';
  } else {
    growthTrend = 'stable';
  }

  return {
    growthRate,
    growthTrend,
    growthValid: true,
    growthMessage: `Revenue ${growthTrend === 'up' ? 'grew' : growthTrend === 'down' ? 'declined' : 'remained stable'} by ${Math.abs(growthRate)}% from ${firstMonth} to ${lastMonth}`,
    sortedMonths,
  };
}

// ============================================================================
// TOP PERFORMERS
// ============================================================================

function getTopPerformers(
  revenueMap: Record<string, number>,
  totalRevenue: number,
  limit: number
): TopPerformer[] {
  const topItems = getTopN(revenueMap, limit, 'desc');
  
  return topItems.map(({ key, value }) => ({
    name: key,
    revenue: value,
    percentage: calculatePercentage(value, totalRevenue),
  }));
}

function getWorstPerformers(
  profitMap: Record<string, number>,
  limit: number
): WorstPerformer[] {
  const entries = Object.entries(profitMap)
    .sort((a, b) => a[1] - b[1]); // Sort ascending (worst first)
  
  return entries.slice(0, limit).map(([name, profit]) => ({
    name,
    profit,
  }));
}

// ============================================================================
// REGIONAL & PRODUCT METRICS
// ============================================================================

function buildRegionalMetrics(
  revenueByRegion: Record<string, number>,
  profitByRegion: Record<string, number>,
  totalRevenue: number
): RegionalMetric[] {
  const regions = new Set([...Object.keys(revenueByRegion), ...Object.keys(profitByRegion)]);
  const metrics: RegionalMetric[] = [];

  for (const region of regions) {
    const revenue = revenueByRegion[region] || 0;
    const profit = profitByRegion[region] || 0;
    const margin = revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : null;

    metrics.push({
      name: region,
      revenue,
      profit,
      margin,
      percentage: calculatePercentage(revenue, totalRevenue),
    });
  }

  // Sort by revenue descending
  return metrics.sort((a, b) => b.revenue - a.revenue);
}

function buildProductMetrics(
  revenueByProduct: Record<string, number>,
  profitByProduct: Record<string, number>,
  quantityByProduct: Record<string, number>,
  totalRevenue: number
): ProductMetric[] {
  const products = new Set([
    ...Object.keys(revenueByProduct),
    ...Object.keys(profitByProduct),
  ]);
  const metrics: ProductMetric[] = [];

  for (const product of products) {
    const revenue = revenueByProduct[product] || 0;
    const profit = profitByProduct[product] || 0;
    const quantity = quantityByProduct[product];
    const margin = revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : null;

    metrics.push({
      name: product,
      revenue,
      profit,
      margin,
      quantity,
      percentage: calculatePercentage(revenue, totalRevenue),
    });
  }

  // Sort by revenue descending
  return metrics.sort((a, b) => b.revenue - a.revenue);
}

// ============================================================================
// CHART DATA
// ============================================================================

function buildChartData(
  revenueByMonth: Record<string, number>,
  profitByMonth: Record<string, number>,
  transactionCountByMonth: Record<string, number>,
  sortedMonths: string[],
  revenueByProduct: Record<string, number>,
  revenueByRegion: Record<string, number>,
  profitByProduct: Record<string, number>,
  profitByRegion: Record<string, number>,
  totalRevenue: number
): PrecomputedMetrics['chartData'] {
  // Monthly aggregates
  const revenueByMonthArray: MonthlyAggregate[] = sortedMonths.map(month => ({
    month,
    revenue: revenueByMonth[month] || 0,
    profit: profitByMonth[month] || 0,
    transactionCount: transactionCountByMonth[month] || 0,
  }));

  // Product aggregates
  const revenueByProductArray: CategoryAggregate[] = getTopN(revenueByProduct, 10, 'desc').map(
    ({ key, value }) => ({
      category: key,
      value,
      percentage: calculatePercentage(value, totalRevenue),
    })
  );

  // Region aggregates
  const revenueByRegionArray: CategoryAggregate[] = getTopN(revenueByRegion, 10, 'desc').map(
    ({ key, value }) => ({
      category: key,
      value,
      percentage: calculatePercentage(value, totalRevenue),
    })
  );

  // Profit by product
  const profitByProductTotal = Object.values(profitByProduct).reduce((a, b) => a + b, 0);
  const profitByProductArray: CategoryAggregate[] = getTopN(profitByProduct, 10, 'desc').map(
    ({ key, value }) => ({
      category: key,
      value,
      percentage: calculatePercentage(value, profitByProductTotal),
    })
  );

  // Profit by region
  const profitByRegionTotal = Object.values(profitByRegion).reduce((a, b) => a + b, 0);
  const profitByRegionArray: CategoryAggregate[] = getTopN(profitByRegion, 10, 'desc').map(
    ({ key, value }) => ({
      category: key,
      value,
      percentage: calculatePercentage(value, profitByRegionTotal),
    })
  );

  return {
    revenueByMonth: revenueByMonthArray,
    revenueByProduct: revenueByProductArray,
    revenueByRegion: revenueByRegionArray,
    profitByMonth: revenueByMonthArray, // Same structure, different values
    profitByProduct: profitByProductArray,
    profitByRegion: profitByRegionArray,
  };
}

// ============================================================================
// CONSISTENCY VALIDATION
// ============================================================================

function runConsistencyValidation(
  totalRevenue: number,
  chartData: PrecomputedMetrics['chartData'],
  validRowCount: number,
  totalRowCount: number
): PrecomputedMetrics['validationStatus'] {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check 1: totalRevenue should equal sum of revenueByProduct
  const sumByProduct = chartData.revenueByProduct.reduce((sum, item) => sum + item.value, 0);
  const totalRevenueMatchesSumByProduct = Math.abs(totalRevenue - sumByProduct) < 0.01;
  
  if (!totalRevenueMatchesSumByProduct) {
    const diff = Math.abs(totalRevenue - sumByProduct);
    errors.push(`Total revenue (${totalRevenue}) doesn't match sum by product (${sumByProduct}). Difference: ${diff}`);
  }

  // Check 2: totalRevenue should equal sum of revenueByRegion
  const sumByRegion = chartData.revenueByRegion.reduce((sum, item) => sum + item.value, 0);
  const totalRevenueMatchesSumByRegion = Math.abs(totalRevenue - sumByRegion) < 0.01;
  
  if (!totalRevenueMatchesSumByRegion) {
    const diff = Math.abs(totalRevenue - sumByRegion);
    warnings.push(`Total revenue (${totalRevenue}) differs from sum by region (${sumByRegion}). Difference: ${diff}`);
  }

  // Check 3: Row count consistency
  const rowCountConsistent = validRowCount <= totalRowCount;
  if (!rowCountConsistent) {
    errors.push(`Valid row count (${validRowCount}) exceeds total row count (${totalRowCount})`);
  }

  return {
    isValid: errors.length === 0,
    totalRevenueMatchesSum: totalRevenueMatchesSumByProduct,
    rowCountConsistent,
    errors,
    warnings,
  };
}

/**
 * Validate precomputed metrics
 */
export function validatePrecomputedMetrics(
  metrics: PrecomputedMetrics
): ConsistencyValidationResult {
  const checks: { name: string; passed: boolean; message: string; severity: 'error' | 'warning'; }[] = [];

  // Check total revenue matches sum
  const sumByProduct = metrics.chartData.revenueByProduct.reduce((sum, item) => sum + item.value, 0);
  const revenueMatch = Math.abs(metrics.totalRevenue - sumByProduct) < 0.01;
  
  checks.push({
    name: 'totalRevenue_matches_sumByProduct',
    passed: revenueMatch,
    message: revenueMatch 
      ? 'Total revenue matches sum of product breakdown' 
      : `Total revenue (${metrics.totalRevenue}) doesn't match sum by product (${sumByProduct})`,
    severity: revenueMatch ? 'error' : 'warning',
  });

  // Check row count consistency
  const rowCountOk = metrics.revenueValidRowCount <= metrics.fullDatasetRowCount;
  checks.push({
    name: 'rowCount_consistent',
    passed: rowCountOk,
    message: rowCountOk 
      ? 'Row counts are consistent' 
      : `Valid row count (${metrics.revenueValidRowCount}) exceeds total (${metrics.fullDatasetRowCount})`,
    severity: 'error',
  });

  // Check profit doesn't exceed revenue
  const profitValid = metrics.totalProfit <= metrics.totalRevenue;
  checks.push({
    name: 'profit_valid',
    passed: profitValid,
    message: profitValid 
      ? 'Profit is valid (not greater than revenue)' 
      : `Profit (${metrics.totalProfit}) exceeds revenue (${metrics.totalRevenue})`,
    severity: 'error',
  });

  // Check margin is reasonable
  const marginReasonable = metrics.profitMargin === null || 
    (metrics.profitMargin >= -100 && metrics.profitMargin <= 100);
  checks.push({
    name: 'margin_reasonable',
    passed: marginReasonable,
    message: marginReasonable 
      ? 'Profit margin is within reasonable range' 
      : `Profit margin (${metrics.profitMargin}%) is outside reasonable range (-100% to 100%)`,
    severity: 'warning',
  });

  const passedCount = checks.filter(c => c.passed).length;
  const isValid = passedCount === checks.filter(c => c.severity === 'error').length;

  return {
    isValid,
    checks,
    validatedAt: new Date().toISOString(),
  };
}
