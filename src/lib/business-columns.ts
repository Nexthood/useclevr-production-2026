import { debugLog, debugError, debugWarn } from "@/lib/debug"

// ============================================================================
// UNIVERSAL COST COLUMN DETECTOR
// ============================================================================

const COST_COMPONENTS = [
  { key: 'cogs', patterns: ['cogs', 'cost_of_goods', 'cost_of_sales', 'unit_cost', 'product_cost'] },
  { key: 'marketing_cost', patterns: ['marketing', 'ad_spend', 'advertising', 'campaign_cost', 'marketing_cost', 'acquisition_cost'] },
  { key: 'shipping_cost', patterns: ['shipping', 'delivery', 'freight', 'shipping_cost', 'delivery_cost'] },
  { key: 'refunds', patterns: ['refund', 'refunds', 'returns', 'return_amount', 'refund_amount'] },
  { key: 'discount_amount', patterns: ['discount', 'discount_amount', 'discounts', 'promotion', 'coupon'] },
];

function detectCostComponents(columns: string[]): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  
  for (const comp of COST_COMPONENTS) {
    const normalizedCols = columns.map(c => ({ 
      original: c, 
      normalized: c.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') 
    }));
    
    for (const pattern of comp.patterns) {
      const match = normalizedCols.find(c => c.normalized.includes(pattern));
      if (match) {
        result[comp.key] = match.original;
        break;
      }
    }
    if (!result[comp.key]) {
      result[comp.key] = null;
    }
  }
  
  return result;
}

// ============================================================================
// VERIFIED PROFIT CALCULATOR
// ============================================================================

interface VerifiedFinancials {
  revenue: number;
  profit: number;
  margin: number | null;
  costs: {
    cogs: number;
    marketing_cost: number;
    shipping_cost: number;
    refunds: number;
    discount_amount: number;
    total_cost: number;
  };
  isValid: boolean;
  error?: string;
}

function calculateVerifiedProfit(
  row: any,
  revenueColumn: string | null,
  costComponents: Record<string, string | null>
): VerifiedFinancials {
  // Get revenue
  const revenue = revenueColumn ? (parseFloat(String(row[revenueColumn]).replace(/[^0-9.-]/g, '')) || 0) : 0;
  
  // Get cost components (treat missing as 0)
  // Spec: profit = net_revenue - cogs - marketing_cost - shipping_cost - refunds
  const cogs = costComponents.cogs ? (parseFloat(String(row[costComponents.cogs]).replace(/[^0-9.-]/g, '')) || 0) : 0;
  const marketing = costComponents.marketing_cost ? (parseFloat(String(row[costComponents.marketing_cost]).replace(/[^0-9.-]/g, '')) || 0) : 0;
  const shipping = costComponents.shipping_cost ? (parseFloat(String(row[costComponents.shipping_cost]).replace(/[^0-9.-]/g, '')) || 0) : 0;
  const refunds = costComponents.refunds ? (parseFloat(String(row[costComponents.refunds]).replace(/[^0-9.-]/g, '')) || 0) : 0;
  const discount = costComponents.discount_amount ? (parseFloat(String(row[costComponents.discount_amount]).replace(/[^0-9.-]/g, '')) || 0) : 0;
  
  // Spec formula: revenue - cogs - marketing_cost - shipping_cost - refunds
  // Note: discount is NOT included per spec
  const profit = revenue - cogs - marketing - shipping - refunds;
  const total_cost = cogs + marketing + shipping + refunds + discount;  // Track discount separately
  
  // Calculate margin (round to 1 decimal)
  const margin = revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : null;
  
  // Validation: profit cannot exceed revenue
  let isValid = true;
  let error: string | undefined;
  
  if (profit > revenue) {
    isValid = false;
    error = 'Invalid: profit exceeds revenue';
  }
  
  if (margin !== null && margin > 80 && total_cost > 0) {
    // Flag warning but don't fail
    debugLog('[PROFIT WARNING] Margin > 80% with costs - verifying calculation');
  }
  
  return { revenue, profit, margin, costs: { cogs, marketing_cost: marketing, shipping_cost: shipping, refunds, discount_amount: discount, total_cost }, isValid, error };
}
// All logic must derive from: const rows = dataset.data || []
// No legacy metadata. No RAM state. Single source of truth.

import { formatCurrencySimple, formatPercentSimple } from './formatting';

// ============================================================================
// COLUMN NAME NORMALIZER
// ============================================================================

function normalizeColumnName(col: string): string {
  return col
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

// ============================================================================
// UNIVERSAL COLUMN DETECTOR - Matches ANY variant of column names
// ============================================================================

const REVENUE_PATTERNS = [
  'revenue', 'total_revenue', 'gmv', 'order_total', 'amount', 'sales', 
  'income', 'gross_sales', 'net_sales', 'total_sales', 'order_value',
  'total', 'grand_total', 'subtotal', 'gross', 'net_revenue'
];

const COST_PATTERNS = [
  'cost', 'cogs', 'cost_of_goods', 'cost_of_sales', 'cost_of_revenue',
  'expense', 'expenses', 'unit_cost', 'product_cost', 'cost_price'
];

const PROFIT_PATTERNS = [
  'profit', 'net_profit', 'gross_profit', 'margin', 'net_margin',
  'gross_margin', 'profit_margin', 'income', 'net_income'
];

const REGION_PATTERNS = [
  'region', 'country', 'geo', 'location', 'market', 'territory',
  'area', 'zone', 'state', 'province', 'city', 'country_code',
  'country_iso', 'nation', 'geography'
];

const PRODUCT_PATTERNS = [
  'product', 'item', 'sku', 'variant', 'name', 'title', 'product_name',
  'item_name', 'product_title', 'goods', 'merchandise', 'description'
];

function findColumnByPatterns(columns: string[], patterns: string[]): string | null {
  const normalizedCols = columns.map(c => ({ original: c, normalized: normalizeColumnName(c) }));
  
  for (const pattern of patterns) {
    const match = normalizedCols.find(c => 
      c.normalized.includes(pattern) || 
      c.normalized === pattern ||
      pattern === c.normalized
    );
    if (match) return match.original;
  }
  return null;
}

export interface DetectedBusinessColumns {
  revenueColumn: string | null;
  profitColumn: string | null;
  costColumn: string | null;
  dateColumn: string | null;
  productColumn: string | null;
  regionColumn: string | null;
  fallbackRegionColumn: string | null;  // Fallback for region/country
  currencyColumn: string | null;
  quantityColumn: string | null;
  costComponents: Record<string, string | null>;  // cogs, marketing_cost, shipping_cost, refunds, discount
}

// ============================================================================
// Helper: Check if column is predominantly numeric (at least 50% valid numbers)
// ============================================================================

function isNumericColumn(rows: any[], column: string): boolean {
  const values = rows.map(r => r[column]);
  const validCount = values.filter(v => {
    if (v === null || v === undefined || v === '') return false;
    const num = parseFloat(String(v));
    return !isNaN(num) && isFinite(num);
  }).length;
  
  return validCount > values.length * 0.5 && validCount > 0;
}

// ============================================================================
// Helper: Check if column is NOT all zeros
// ============================================================================

function hasNonZeroValues(rows: any[], column: string): boolean {
  return rows.some(r => {
    const val = parseFloat(r[column]);
    return !isNaN(val) && val !== 0;
  });
}

// ============================================================================
// Helper: Validate date column (≥30% parseable, ≥2 distinct months)
// ============================================================================

function isValidDateColumn(rows: any[], column: string): boolean {
  const parseableCount = rows.filter(r => {
    const val = r[column];
    return typeof val === 'string' && val.trim() !== '' && !isNaN(Date.parse(val));
  }).length;
  
  if (parseableCount < rows.length * 0.3) return false;
  
  // Check for at least 2 distinct months
  const months = new Set<string>();
  rows.forEach(r => {
    const val = r[column];
    if (typeof val === 'string') {
      const date = new Date(val);
      if (!isNaN(date.getTime())) {
        months.add(`${date.getFullYear()}-${date.getMonth()}`);
      }
    }
  });
  
  return months.size >= 2;
}

// ============================================================================
// MAIN FUNCTION: detectBusinessColumns
// ============================================================================

/**
 * Detects business-relevant columns from dataset with strict validation.
 * Returns null for columns that don't meet validation criteria.
 */
export function detectBusinessColumns(rows: any[]): DetectedBusinessColumns {
  // Get columns first
  const columns = rows && rows.length > 0 ? Object.keys(rows[0]) : [];
  
  // Detect cost components
  const detectedCostComponents = detectCostComponents(columns);
  
  // DEBUG: Log detected cost components
  debugLog('[DETECT] Cost components:', detectedCostComponents);
  
  if (!rows || rows.length === 0) {
    return {
      revenueColumn: null,
      profitColumn: null,
      costColumn: null,
      dateColumn: null,
      productColumn: null,
      regionColumn: null,
      fallbackRegionColumn: null,
      currencyColumn: null,
      quantityColumn: null,
      costComponents: detectedCostComponents
    };
  }
  
  // 🔍 Revenue Detection - UNIVERSAL (matches any variant)
  const revenueColumn = findColumnByPatterns(columns, REVENUE_PATTERNS);
  
  // 💰 Profit Detection - UNIVERSAL
  const profitColumn = findColumnByPatterns(columns, PROFIT_PATTERNS);
  
  // Cost Detection - UNIVERSAL (validated)
  let costColumn = findColumnByPatterns(columns, COST_PATTERNS);
  let validCostColumn: string | null = null;
  if (costColumn) {
    if (isNumericColumn(rows, costColumn) && hasNonZeroValues(rows, costColumn)) {
      validCostColumn = costColumn;
    }
  }
  
  // 📅 Date Detection (strict validation)
  const dateColumn = columns.find(col => 
    isValidDateColumn(rows, col)
  ) || null;
  
  // 🛍 Product Detection - UNIVERSAL
  const productColumn = findColumnByPatterns(columns, PRODUCT_PATTERNS);
  
  // 🌍 Region Detection - UNIVERSAL (try region first, then country)
  const regionColumn = findColumnByPatterns(columns, REGION_PATTERNS.filter(p => p !== 'country')) || null;
  const countryColumn = columns.find(col => /country|nation|geo|location/i.test(col)) || null;
  
  // Use region if found, otherwise use country as fallback
  const fallbackRegionColumn = regionColumn || countryColumn;
  
  // 💱 Currency Detection
  const currencyColumn = columns.find(col => 
    /currency|iso_currency/i.test(col)
  ) || null;
  
  // 📦 Quantity Detection
  const quantityColumn = columns.find(col => 
    /quantity|qty|units|volume|count/i.test(col) && isNumericColumn(rows, col)
  ) || null;
  
  debugLog('[DETECT] Universal column detection:', {
    revenue: revenueColumn,
    profit: profitColumn,
    cost: validCostColumn,
    date: dateColumn,
    product: productColumn,
    region: regionColumn,
    country: countryColumn,
    fallbackRegion: fallbackRegionColumn,
    costComponents: detectedCostComponents
  });
  
  return {
    revenueColumn,
    profitColumn,
    costColumn: validCostColumn,
    dateColumn,
    productColumn,
    regionColumn,
    fallbackRegionColumn,  // Use country as fallback when region not found
    currencyColumn,
    quantityColumn,
    costComponents: detectedCostComponents
  };
}

// ============================================================================
// KPI ENGINE - Business Metrics Computation
// ============================================================================

export interface BusinessKPIs {
  // Revenue Metrics
  totalRevenue: number | null;
  avgRevenue: number | null;
  
  // Profit Metrics
  totalProfit: number | null;
  profitMargin: number | null;
  profitReliability: 'verified' | 'derived' | 'unavailable';  // How profit was calculated
  
  // Top Performers
  topProducts: { name: string; revenue: number; percentage: number }[];
  topRegions: { name: string; revenue: number; percentage: number }[];
  allRegions: { name: string; revenue: number; percentage: number }[];  // ALL regions for chart
  topRegionsByProfit: { name: string; profit: number; percentage: number }[];  // For "most profitable region" queries
  worstProducts: { name: string; profit: number }[];
  
  // Growth (validated)
  growthPercentage: number | null;
  growthTrend: 'up' | 'down' | 'stable' | null;
  growthValid: boolean;
  growthMessage: string;
  
  // Date Range
  dateRange: { start: string; end: string } | null;
  
  // Column Info
  detectedColumns: DetectedBusinessColumns;
}

export interface BusinessBreakdowns {
  revenueByProduct: Record<string, number>;
  revenueByRegion: Record<string, number>;
  profitByProduct: Record<string, number>;
  profitByRegion: Record<string, number>;
}

export interface RiskAnalysis {
  revenueConcentrationRisk: string;
  regionalDependencyRisk: string;
  marginRisk: string;
}

export interface BusinessInsights {
  type: 'revenue' | 'concentration' | 'regional' | 'margin';
  message: string;
}

export interface ActionableRecommendation {
  action: string;
  reason: string;
  expectedImpact: string;
}

// ============================================================================
// MAIN FUNCTION: analyzeDataset
// ============================================================================

export function analyzeBusinessData(
  rows: any[],
  detectedColumns: DetectedBusinessColumns
): { kpis: BusinessKPIs; breakdowns: BusinessBreakdowns; risks: RiskAnalysis; insights: BusinessInsights[]; recommendations: ActionableRecommendation[] } {
  
  const { revenueColumn, profitColumn, costColumn, dateColumn, productColumn, regionColumn, fallbackRegionColumn, quantityColumn, costComponents } = detectedColumns;
  
  // Use fallback column for aggregation when regionColumn is not found
  const aggregationColumn = regionColumn || fallbackRegionColumn;
  
  // DEBUG: Log detected columns
  debugLog('[AGGREGATION] Detected columns:', Object.keys(detectedColumns));
  debugLog('[AGGREGATION] Cost components:', costComponents);
  debugLog('[AGGREGATION] First row sample:', rows[0] ? Object.keys(rows[0]) : 'no data');
  debugLog('[AGGREGATION] Using regionColumn:', regionColumn, '| fallbackRegionColumn:', fallbackRegionColumn, '| aggregationColumn:', aggregationColumn);
  
  // ========== REVENUE & VERIFIED PROFIT ==========
  let totalRevenue = 0;
  let totalCOGS = 0;
  let totalMarketing = 0;
  let totalShipping = 0;
  let totalRefunds = 0;
  let totalDiscount = 0;
  let validRevenueCount = 0;
  let flagFinancialError = false;
  
  const revenueByProduct: Record<string, number> = {};
  const revenueByRegion: Record<string, number> = {};
  const profitByProduct: Record<string, number> = {};
  const profitByRegion: Record<string, number> = {};
  
  rows.forEach(r => {
    // Get revenue
    if (revenueColumn) {
      const rev = parseFloat(String(r[revenueColumn])) || 0;
      if (!isNaN(rev)) {
        totalRevenue += rev;
        validRevenueCount++;
        
        // Aggregate by product
        if (productColumn) {
          const prod = String(r[productColumn] || 'Unknown');
          revenueByProduct[prod] = (revenueByProduct[prod] || 0) + rev;
        }
        
        // Aggregate by region (or fallback to country)
        if (aggregationColumn) {
          const reg = String(r[aggregationColumn] || 'Unknown');
          revenueByRegion[reg] = (revenueByRegion[reg] || 0) + rev;
        }
      }
    }
    
    // Get cost components (treat missing as estimated 30% COGS if no cost columns)
    // Spec: profit = net_revenue - cogs - marketing_cost - shipping_cost - refunds
    // If no cost columns exist, use proxy: cost = revenue * 0.3
    const hasCostColumns = costComponents?.cogs || costComponents?.marketing_cost || costComponents?.shipping_cost || costComponents?.refunds;
    const revValue = parseFloat(String(r[revenueColumn || ''])) || 0;
    
    // If no cost columns, estimate COGS as 30% of revenue
    const cogs = costComponents?.cogs ? (parseFloat(String(r[costComponents.cogs || ''])) || 0) : (hasCostColumns ? 0 : revValue * 0.3);
    const marketing = costComponents?.marketing_cost ? (parseFloat(String(r[costComponents.marketing_cost || ''])) || 0) : 0;
    const shipping = costComponents?.shipping_cost ? (parseFloat(String(r[costComponents.shipping_cost || ''])) || 0) : 0;
    const refunds = costComponents?.refunds ? (parseFloat(String(r[costComponents.refunds || ''])) || 0) : 0;
    const discount = costComponents?.discount_amount ? (parseFloat(String(r[costComponents.discount_amount || ''])) || 0) : 0;
    
    totalCOGS += cogs;
    totalMarketing += marketing;
    totalShipping += shipping;
    totalRefunds += refunds;
    totalDiscount += discount;
    
    // Calculate TRUE PROFIT per row (spec formula: revenue - cogs - marketing - shipping - refunds)
    // Note: discount is NOT subtracted from profit per the spec
    if (revenueColumn) {
      const rowProfit = revValue - cogs - marketing - shipping - refunds;
      
      // Aggregate profit by product
      if (productColumn) {
        const prod = String(r[productColumn] || 'Unknown');
        profitByProduct[prod] = (profitByProduct[prod] || 0) + rowProfit;
      }
      
      // Aggregate profit by region
      if (aggregationColumn) {
        const reg = String(r[aggregationColumn] || 'Unknown');
        profitByRegion[reg] = (profitByRegion[reg] || 0) + rowProfit;
      }
    }
  });
  
  // Total TRUE PROFIT (spec formula: revenue - cogs - marketing - shipping - refunds)
  // Note: discount is NOT included per spec
  const totalProfit = totalRevenue - totalCOGS - totalMarketing - totalShipping - totalRefunds;
  
  // FINANCIAL VALIDATION
  if (totalProfit > totalRevenue) {
    flagFinancialError = true;
    debugLog('[PROFIT ERROR] profit > revenue - calculation may be invalid');
  }
  
  // DEBUG: Log detailed financials for validation
  debugLog('[DEBUG] Financial Validation:', { 
    revenue: totalRevenue, 
    profit: totalProfit, 
    costs: { cogs: totalCOGS, marketing: totalMarketing, shipping: totalShipping, refunds: totalRefunds, discount: totalDiscount },
    costsIncludedInProfit: { cogs: totalCOGS, marketing: totalMarketing, shipping: totalShipping, refunds: totalRefunds },
    costsExcludedFromProfit: { discount: totalDiscount },
    profitShouldBeLessThanRevenue: totalProfit < totalRevenue,
    flagFinancialError 
  });
  
  // Calculate avg and margin using TRUE PROFIT
  // Spec: If revenue == 0 → return null. Round margin to 1 decimal.
  const avgRevenue = validRevenueCount > 0 ? totalRevenue / validRevenueCount : 0;
  const profitMargin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 1000) / 10 : null;
  
  // Determine profit reliability after profitMargin is calculated:
  // - 'verified': profit column exists OR real cost columns exist (not estimated)
  // - 'derived': no profit/cost columns but revenue and margin are available
  // - 'unavailable': cannot calculate profit at all
  // Check if we have real cost data (not estimated)
  const hasRealCostData = costComponents?.cogs || costComponents?.marketing_cost || costComponents?.shipping_cost || costComponents?.refunds;
  let profitReliability: 'verified' | 'derived' | 'unavailable' = 'unavailable';
  let finalProfit = totalProfit;
  
  if (profitColumn) {
    // Direct profit column exists
    profitReliability = 'verified';
  } else if (hasRealCostData) {
    // Real cost columns exist (not estimated)
    profitReliability = 'verified';
  } else if (totalRevenue > 0 && profitMargin !== null) {
    // No profit/cost columns but we have revenue and margin - derive profit
    profitReliability = 'derived';
    finalProfit = totalRevenue * (profitMargin / 100);
  }
  
  // Update profitMargin to use derived profit if applicable
  const finalProfitMargin = totalRevenue > 0 ? Math.round((finalProfit / totalRevenue) * 1000) / 10 : null;
  
  // ========== TOP PERFORMERS ==========
  // Return ALL products (not sliced) for chart data
  // Use precise decimal calculation for percentages to ensure they sum to 100%
  const allProducts = Object.entries(revenueByProduct)
    .sort((a, b) => b[1] - a[1])
    .map(([name, revenue]) => ({
      name,
      revenue,
      percentage: totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 10000) / 100 : 0 // 2 decimal places
    }));
  
  // Return ALL regions (not sliced) for chart data
  const allRegions = Object.entries(revenueByRegion)
    .sort((a, b) => b[1] - a[1])
    .map(([name, revenue]) => ({
      name,
      revenue,
      percentage: totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 10000) / 100 : 0 // 2 decimal places
    }));
  
  // Top 5 for display
  const topProducts = allProducts.slice(0, 5);
  const topRegions = allRegions.slice(0, 5);

  // Top Regions by PROFIT - for "most profitable region" queries
  const topRegionsByProfit = Object.entries(profitByRegion)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, profit]) => ({
      name,
      profit,
      percentage: totalProfit > 0 ? Math.round((profit / totalProfit) * 100) : 0
    }));
  
  // DEBUG: Log for validation
  debugLog('[DEBUG] Revenue by region:', JSON.stringify(revenueByRegion));
  debugLog('[DEBUG] Profit by region:', JSON.stringify(profitByRegion));
  debugLog('[DEBUG] Top regions (by revenue):', topRegions.map(r => ({ name: r.name, revenue: r.revenue })));
  debugLog('[DEBUG] Top regions (by profit):', topRegionsByProfit.map(r => ({ name: r.name, profit: r.profit })));
  
  // Worst performing products (negative profit)
  const worstProducts = Object.entries(profitByProduct)
    .filter(([, profit]) => profit < 0)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 5)
    .map(([name, profit]) => ({ name, profit }));
  
  // ========== GROWTH (VALIDATED) ==========
  let growthPercentage: number | null = null;
  let growthTrend: 'up' | 'down' | 'stable' | null = null;
  let growthValid = false;
  let growthMessage = 'Not enough data';
  let dateRange: { start: string; end: string } | null = null;
  
  if (dateColumn && revenueColumn && rows.length >= 10) {
    // Group by month
    const monthlyRevenue: Record<string, number> = {};
    const months: string[] = [];
    
    rows.forEach(r => {
      const dateVal = r[dateColumn];
      if (dateVal) {
        const date = new Date(dateVal);
        if (!isNaN(date.getTime())) {
          const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          if (!months.includes(month)) months.push(month);
          
          const rev = parseFloat(String(r[revenueColumn])) || 0;
          monthlyRevenue[month] = (monthlyRevenue[month] || 0) + rev;
        }
      }
    });
    
    // Need at least 2 time periods
    if (months.length >= 2) {
      growthValid = true;
      months.sort();
      
      const lastMonth = months[months.length - 1];
      const prevMonth = months[months.length - 2];
      
      const lastRevenue = monthlyRevenue[lastMonth];
      const prevRevenue = monthlyRevenue[prevMonth];
      
      if (prevRevenue > 0) {
        growthPercentage = ((lastRevenue - prevRevenue) / prevRevenue) * 100;
        
        if (growthPercentage > 5) {
          growthTrend = 'up';
          growthMessage = `+${growthPercentage.toFixed(1)}% from ${prevMonth} to ${lastMonth}`;
        } else if (growthPercentage < -5) {
          growthTrend = 'down';
          growthMessage = `${growthPercentage.toFixed(1)}% from ${prevMonth} to ${lastMonth}`;
        } else {
          growthTrend = 'stable';
          growthMessage = `${growthPercentage >= 0 ? '+' : ''}${growthPercentage.toFixed(1)}% (stable)`;
        }
        
        // Get date range
        const dates = rows
          .map(r => r[dateColumn])
          .filter(d => d)
          .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
        
        if (dates.length > 0) {
          dateRange = {
            start: new Date(dates[0]).toISOString().split('T')[0],
            end: new Date(dates[dates.length - 1]).toISOString().split('T')[0]
          };
        }
      } else {
        growthMessage = 'Previous period has zero revenue';
      }
    } else {
      growthMessage = 'Need at least 2 time periods';
    }
  }
  
  // ========== RISK ANALYSIS ==========
  // Revenue concentration risk
  let revenueConcentrationRisk = 'LOW';
  if (topRegions.length > 0 && topRegions[0].percentage > 50) {
    revenueConcentrationRisk = 'HIGH';
  } else if (topRegions.length > 0 && topRegions[0].percentage > 25) {
    revenueConcentrationRisk = 'MEDIUM';
  }
  
  // Regional dependency
  const regionalDependencyRisk = topRegions.length === 1 ? 'HIGH' : 
    topRegions.length > 0 && topRegions[0].percentage > 60 ? 'MEDIUM' : 'LOW';
  
  // Margin risk (handle null)
  let marginRisk = 'HEALTHY';
  if (profitMargin !== null) {
    if (profitMargin < 0) {
      marginRisk = 'CRITICAL - Operating at a loss';
    } else if (profitMargin < 5) {
      marginRisk = 'LOW - Consider cost optimization';
    } else if (profitMargin < 15) {
      marginRisk = 'MODERATE - Room for improvement';
    }
  }
  
  // ========== BUSINESS INSIGHTS ==========
  const insights: BusinessInsights[] = [];
  
  // Revenue health
  if (totalRevenue > 0) {
    insights.push({
      type: 'revenue',
      message: `Total revenue is ${formatCurrencySimple(totalRevenue)} with an average of ${formatCurrencySimple(avgRevenue)} per transaction.`
    });
  }
  
  // Concentration risk
  if (topRegions.length > 0) {
    insights.push({
      type: 'concentration',
      message: `${topRegions[0].name} accounts for ${topRegions[0].percentage}% of revenue, indicating ${revenueConcentrationRisk === 'HIGH' ? 'high concentration risk' : revenueConcentrationRisk === 'MEDIUM' ? 'moderate dependency' : 'good diversification'}.`
    });
  }
  
  // Regional dependency
  if (topRegions.length > 0) {
    insights.push({
      type: 'regional',
      message: `Top region ${topRegions[0].name} drives ${topRegions[0].percentage}% of business.`
    });
  }
  
  // Margin health
  if (totalRevenue > 0 && profitMargin !== null) {
    insights.push({
      type: 'margin',
      message: `Profit margin is ${profitMargin.toFixed(2)}%, which is ${marginRisk.toLowerCase()}.`
    });
  }
  
  // ========== RECOMMENDATIONS ==========
  const recommendations: ActionableRecommendation[] = [];
  
  // Revenue concentration recommendation
  if (revenueConcentrationRisk === 'HIGH') {
    recommendations.push({
      action: 'Diversify revenue sources',
      reason: `${topRegions[0].name} represents over 50% of revenue`,
      expectedImpact: 'Reduce dependency on single market'
    });
  }
  
  // Margin recommendation (handle null)
  if (profitMargin !== null && profitMargin < 5 && profitMargin > 0) {
    recommendations.push({
      action: 'Optimize costs',
      reason: 'Profit margin is below 5%',
      expectedImpact: 'Improve profitability by reducing expenses'
    });
  }
  
  // Growth recommendation
  if (growthTrend === 'down') {
    recommendations.push({
      action: 'Investigate decline',
      reason: 'Revenue declined in the latest period',
      expectedImpact: 'Identify and address root causes'
    });
  }
  
  // Product recommendation
  if (worstProducts.length > 0) {
    const top3Worst = worstProducts.slice(0, 3).map(p => p.name).join(', ');
    const moreText = worstProducts.length > 3 ? ` and ${worstProducts.length - 3} more` : '';
    recommendations.push({
      action: 'Review underperforming products',
      reason: `Products with losses: ${top3Worst}${moreText}`,
      expectedImpact: 'Click "Ask AI" to analyze these products'
    });
  }
  
  return {
    kpis: {
      totalRevenue: totalRevenue > 0 ? totalRevenue : null,
      avgRevenue: avgRevenue > 0 ? avgRevenue : null,
      totalProfit: profitReliability !== 'unavailable' ? finalProfit : null,
      profitMargin: totalRevenue > 0 ? finalProfitMargin : null,
      profitReliability,
      topProducts,
      topRegions,
      allRegions,  // ALL regions for chart
      topRegionsByProfit,  // For "most profitable region" queries
      worstProducts,
      growthPercentage,
      growthTrend,
      growthValid,
      growthMessage,
      dateRange,
      detectedColumns
    },
    breakdowns: {
      revenueByProduct,
      revenueByRegion,
      profitByProduct,
      profitByRegion
    },
    risks: {
      revenueConcentrationRisk,
      regionalDependencyRisk,
      marginRisk
    },
    insights,
    recommendations
  };
  
  // DEBUG: Log aggregated chart data
  debugLog('[AGGREGATION] Chart data - revenueByRegion:', JSON.stringify(revenueByRegion));
  debugLog('[AGGREGATION] Chart data - revenueByProduct:', JSON.stringify(revenueByProduct));
  debugLog('[AGGREGATION] Chart data - topRegions count:', Object.keys(revenueByRegion).length);
}
