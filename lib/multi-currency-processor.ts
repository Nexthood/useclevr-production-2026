import { debugLog, debugError, debugWarn } from "@/lib/debug"

// ============================================================================
// Intelligent Business Dataset Processor - Preprocessing Normalization Layer
// ============================================================================

import { DatasetRecord } from './csv-analyzer';
import { fetchExchangeRates, isValidISOCurrency, ExchangeRates } from './fx-service';

// ============================================================================
// Type Definitions
// ============================================================================

export interface ProcessedDataset {
  data: DatasetRecord[];
  columns: string[];
  columnMappings: ColumnMappings;
  currencyInfo: CurrencyColumnInfo;
  fxRates: ExchangeRate | null;
  derivationLog: DerivationLog;
  canGenerateKPIs: boolean;
}

export interface ColumnMappings {
  quantity: string | null;
  price: string | null;
  revenue: string | null;
  cost: string | null;
  region: string | null;
  product: string | null;
  date: string | null;
  currency: string | null;
}

export interface DerivationLog {
  normalizedColumns: string[];
  derivedColumns: string[];
  warnings: string[];
  normalizationExamples: Record<string, string[]>;
}

export interface ExchangeRate {
  base: string;
  rates: Record<string, number>;
  timestamp: Date;
}

export interface CurrencyColumnInfo {
  codeColumn: string | null;
  detectedCurrency: string | null;
  baseCurrency: string;
  isMultiCurrency: boolean;
}

// ============================================================================
// Currency Symbol Patterns
// ============================================================================

const CURRENCY_SYMBOLS = /[€¥£₹₽₩₱₪₫₴฿₮₦₳₵¢]/g;

// Detect standalone currency symbols
function hasCurrencySymbol(value: string): boolean {
  const currencyCodes = /\b(EUR|GBP|JPY|CHF|CAD|AUD|NZD|INR|CNY|KRW|SEK|NOK|DKK|PLN|RUB|BRL|ZAR|MXN|SGD|HKD|TWD|THB|MYR|IDR|PHP|VND|TRY|ILS|AED|SAR|KWD|QAR|BHD|OMR)\b/i;
  if (currencyCodes.test(value)) return true;
  
  const symbolPattern = /(?:^|[\s,\d])([€$¥£₹₽₩₱₪₫₴฿₮₦₳₵¢])(?:[\s,]|$)/;
  if (symbolPattern.test(value)) return true;
  
  if (/\s\$/.test(value) || /^\$/.test(value)) return true;
  
  return false;
}

// Detect if a column contains monetary/numeric values
function isMonetaryColumn(values: unknown[]): boolean {
  const sample = values.slice(0, 20).filter(v => v !== null && v !== undefined && String(v).trim() !== '');
  if (sample.length === 0) return false;
  
  let hasCurrencySymbolFlag = false;
  let hasNumericPattern = false;
  
  for (const val of sample) {
    const str = String(val);
    if (hasCurrencySymbol(str)) {
      hasCurrencySymbolFlag = true;
      break;
    }
    
    if (/\d/.test(str) && /[.,]/.test(str)) {
      if (/^\d{1,3}([.,]\d{3})*[.,]?\d*$/.test(str.replace(/\s/g, ''))) {
        hasNumericPattern = true;
      }
    }
  }
  
  return hasCurrencySymbolFlag || hasNumericPattern;
}

// ============================================================================
// Enhanced Currency Normalization - Multi-character Support
// ============================================================================

function normalizeMonetaryValue(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  
  let str = String(value).trim();
  
  // Step 1: Remove multi-character currency prefixes (e.g., "USD 3,900", "EUR 4,200", "CHF 78,000", "C$5,600")
  // Handle special cases: C$, A$, NZ$ (dollar sign followed by number)
  
  // Handle C$5,600, A$1,200, NZ$ formats (dollar sign directly followed by number)
  str = str.replace(/^([A-Z]?\$)(\d)/, (match, dollar, digit) => digit);
  
  // Handle standard multi-char prefixes followed by space: "USD 3,900", "CHF 78,000"
  const currencyPrefixes = [
    'CHF', 'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'CNY', 'JPY', 'KRW', 
    'SGD', 'HKD', 'TWD', 'THB', 'MYR', 'IDR', 'PHP', 'VND', 'TRY', 'ILS', 
    'AED', 'SAR', 'KWD', 'QAR', 'BHD', 'OMR', 'NZD', 'SEK', 'NOK', 'DKK', 
    'PLN', 'RUB', 'BRL', 'ZAR', 'MXN'
  ];
  
  for (const prefix of currencyPrefixes) {
    if (str.startsWith(prefix)) {
      str = str.substring(prefix.length);
      break;
    }
  }
  
  // Step 2: Strip single-character currency symbols (€, $, ¥, £, ₹)
  str = str.replace(/(?:^[€¥£₹₽₩₱₪₫₴฿₮₦₳₵¢]|[€¥£₹₽₩₱₪₫₴฿₮₦₳₵¢]$)/g, '');
  str = str.replace(/\$\s?/g, '');
  
  // Step 3: Remove spaces
  str = str.replace(/\s/g, '');
  
  // Step 4: Handle thousand separators (EU vs US format)
  const hasComma = str.includes(',');
  const hasDot = str.includes('.');
  
  if (hasComma && hasDot) {
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    
    if (lastComma > lastDot) {
      // EU format: 1.234,56
      str = str.replace(/\./g, '');
      str = str.replace(',', '.');
    } else {
      // US format: 1,234.56
      str = str.replace(/,/g, '');
    }
  } else if (hasComma) {
    const parts = str.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      str = str.replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (hasDot) {
    const parts = str.split('.');
    if (parts.length === 2 && parts[1].length <= 2) {
      // Keep as is (US decimal)
    } else {
      // EU thousands: 1.234.567
      str = str.replace(/\./g, '');
    }
  }
  
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

// ============================================================================
// Semantic Column Detection Patterns - Enhanced Financial Keywords
// ============================================================================

// QUANTITY: Units sold, volume, quantity
const QUANTITY_PATTERNS = [
  /qty|quantity|units_sold|units sold|volume|count|pieces|items|num_purchased|number_sold|order_qty/i
];

// PRICE: Unit price, price, cost
const PRICE_PATTERNS = [
  /unit_?price_?local|unit_?price|price|unit_?cost|unit_cost|amount_per|rate|price_per_unit|item_price/i
];

// REVENUE: Revenue, sales, amount, gross
const REVENUE_PATTERNS = [
  /revenue_?local|revenue|sales|total_?amount|turnover|gross_?sales|net_?sales|gross_?amount|total_?sales|order_value|transaction_?total/i
];

// COST: Cost, expenses
const COST_PATTERNS = [
  /cost|cogs|expense|direct_?cost|unit_?cost|product_?cost|production_?cost/i
];

// REGION: Geographic fields
const REGION_PATTERNS = [
  /region|country|market|territory|location|area|zone|city|state|province/i
];

// PRODUCT: Product/service fields
const PRODUCT_PATTERNS = [
  /product|item|sku|merchandise|goods|service|offering|product_?name|item_?name/i
];

// DATE: Temporal fields
const DATE_PATTERNS = [
  /date|period|month|year|quarter|week|day|timestamp|created_?at|order_?date/i
];

// CURRENCY: Currency fields
const CURRENCY_PATTERNS = [
  /currency_?code|currency|iso_?currency|fx_?currency|curr/i
];

function detectColumnType(columnName: string): string | null {
  const lower = columnName.toLowerCase();
  if (QUANTITY_PATTERNS.some(p => p.test(lower))) return 'quantity';
  if (PRICE_PATTERNS.some(p => p.test(lower))) return 'price';
  if (REVENUE_PATTERNS.some(p => p.test(lower))) return 'revenue';
  if (COST_PATTERNS.some(p => p.test(lower))) return 'cost';
  if (REGION_PATTERNS.some(p => p.test(lower))) return 'region';
  if (PRODUCT_PATTERNS.some(p => p.test(lower))) return 'product';
  if (DATE_PATTERNS.some(p => p.test(lower))) return 'date';
  if (CURRENCY_PATTERNS.some(p => p.test(lower))) return 'currency';
  return null;
}

// ============================================================================
// Dataset Classification - Financial Data Detection
// ============================================================================

interface DatasetClassification {
  type: 'financial' | 'general' | 'ecommerce' | 'unknown';
  confidence: number;
  indicators: string[];
  hasCurrency: boolean;
  hasQuantity: boolean;
  hasPrice: boolean;
}

function classifyDataset(
  columns: string[],
  columnMappings: ColumnMappings,
  monetaryColumns: string[],
  currencyInfo: CurrencyColumnInfo
): DatasetClassification {
  const indicators: string[] = [];
  let hasCurrency = false;
  let hasQuantity = false;
  let hasPrice = false;
  
  // Check for currency
  if (currencyInfo.codeColumn || columnMappings.currency) {
    hasCurrency = true;
    indicators.push('Currency column detected');
  }
  
  // Check for quantity
  if (columnMappings.quantity) {
    hasQuantity = true;
    indicators.push('Quantity column detected');
  }
  
  // Check for price
  if (columnMappings.price) {
    hasPrice = true;
    indicators.push('Price column detected');
  }
  
  // Check for revenue
  if (columnMappings.revenue) {
    indicators.push('Revenue column detected');
  }
  
  // Check for cost
  if (columnMappings.cost) {
    indicators.push('Cost column detected');
  }
  
  // Check for region
  if (columnMappings.region) {
    indicators.push('Region column detected');
  }
  
  // Check for product
  if (columnMappings.product) {
    indicators.push('Product column detected');
  }
  
  // Financial data classification rules
  let type: 'financial' | 'general' | 'ecommerce' | 'unknown' = 'unknown';
  let confidence = 0;
  
  // Rule 1: Force Financial if currency + monetary numeric columns
  if (hasCurrency && monetaryColumns.length > 0) {
    type = 'financial';
    confidence = 0.95;
    indicators.push('FORCE: Currency + monetary columns = Financial Data');
  }
  // Rule 2: Financial if quantity + price (can derive revenue)
  else if (hasQuantity && hasPrice) {
    type = 'financial';
    confidence = 0.85;
    indicators.push('FORCE: Quantity + Price = Financial Data (derivable revenue)');
  }
  // Rule 3: Financial if revenue column exists
  else if (columnMappings.revenue && monetaryColumns.length > 0) {
    type = 'financial';
    confidence = 0.80;
    indicators.push('Revenue column present = Financial Data');
  }
  // Rule 4: Ecommerce if customer/product columns
  else if (columnMappings.product && columnMappings.quantity) {
    type = 'ecommerce';
    confidence = 0.70;
    indicators.push('Product + Quantity = E-Commerce Data');
  }
  // Default: General
  else {
    type = 'general';
    confidence = 0.50;
    indicators.push('Default classification: General Data');
  }
  
  return { type, confidence, indicators, hasCurrency, hasQuantity, hasPrice };
}

// ============================================================================
// Main Preprocessing Function
// ============================================================================

export async function processDataset(
  data: DatasetRecord[],
  baseCurrency: string = 'EUR'
): Promise<ProcessedDataset> {
  const derivationLog: DerivationLog = {
    normalizedColumns: [],
    derivedColumns: [],
    warnings: [],
    normalizationExamples: {},
  };
  
  debugLog('\n========== PREPROCESSING NORMALIZATION LAYER ==========');
  debugLog(`[NORMALIZE] Input: ${data.length} rows`);
  
  const columns = data.length > 0 ? Object.keys(data[0]) : [];
  
  // Identify currency code columns (should NOT be normalized)
  const currencyCodeColumns = new Set<string>();
  for (const col of columns) {
    if (/currency|iso_currency/i.test(col)) {
      currencyCodeColumns.add(col);
    }
  }
  debugLog(`[NORMALIZE] Currency code columns (will not normalize): ${[...currencyCodeColumns].join(', ')}`);
  
  // Detect monetary columns (excluding currency code columns)
  const monetaryColumns: string[] = [];
  
  for (const col of columns) {
    if (currencyCodeColumns.has(col)) continue;
    
    const values = data.map(row => row[col]);
    if (isMonetaryColumn(values)) {
      monetaryColumns.push(col);
      debugLog(`[NORMALIZE] ✓ Detected monetary column: ${col}`);
      
      const example = values.find(v => v !== null && v !== undefined && String(v).trim() !== '');
      if (example) {
        const cleaned = normalizeMonetaryValue(example);
        debugLog(`[NORMALIZE]   Example: "${example}" → ${cleaned}`);
        derivationLog.normalizationExamples[col] = [String(example), String(cleaned)];
      }
    }
  }
  
  // Normalize monetary columns IN PLACE
  debugLog(`[NORMALIZE] Normalizing ${monetaryColumns.length} monetary columns...`);
  
  for (const col of monetaryColumns) {
    for (const row of data) {
      const originalValue = row[col];
      const normalizedValue = normalizeMonetaryValue(originalValue);
      (row as any)[col] = normalizedValue;
    }
    derivationLog.normalizedColumns.push(col);
  }
  
  // Detect column semantics after normalization
  const columnTypes: Record<string, string> = {};
  for (const col of columns) {
    const type = detectColumnType(col);
    if (type) {
      columnTypes[type] = col;
    }
  }
  
  // Also detect from monetary columns
  for (const col of monetaryColumns) {
    if (!columnTypes.quantity && /units|qty|quantity|volume/i.test(col)) {
      columnTypes.quantity = col;
    }
    if (!columnTypes.price && /price|cost/i.test(col)) {
      columnTypes.price = col;
    }
    if (!columnTypes.revenue && /revenue|sales|amount/i.test(col)) {
      columnTypes.revenue = col;
    }
  }
  
  debugLog(`[NORMALIZE] Column mappings:`, columnTypes);
  
  // Auto-derive revenue if missing
  let quantityCol = columnTypes.quantity;
  let priceCol = columnTypes.price;
  let revenueCol = columnTypes.revenue;
  let costCol = columnTypes.cost;
  let regionCol = columnTypes.region;
  let productCol = columnTypes.product;
  let dateCol = columnTypes.date;
  let currencyCol = columnTypes.currency;
  
  if (!revenueCol && quantityCol && priceCol) {
    debugLog(`[NORMALIZE] ⚡ Auto-deriving REVENUE from ${quantityCol} × ${priceCol}`);
    
    for (const row of data) {
      const qty = Number(row[quantityCol!]) || 0;
      const price = Number(row[priceCol!]) || 0;
      (row as any)['REVENUE_LOCAL'] = qty * price;
    }
    
    revenueCol = 'REVENUE_LOCAL';
    derivationLog.derivedColumns.push(`REVENUE_LOCAL = ${quantityCol} × ${priceCol}`);
  }
  
  if (!revenueCol) {
    derivationLog.warnings.push('Revenue cannot be derived - missing quantity or price fields');
  }
  
  // Currency handling
  let detectedCurrency: string | null = null;
  let isMultiCurrency = false;
  let fxRates: ExchangeRate | null = null;
  
  if (currencyCol) {
    const currencies = [...new Set(data.map(row => String(row[currencyCol!] || '')).filter(Boolean))];
    isMultiCurrency = currencies.length > 1;
    debugLog(`[NORMALIZE] Currency column: ${currencyCol}, currencies: ${currencies.join(', ')}`);
    
    if (currencies.length > 0 && isValidISOCurrency(currencies[0])) {
      detectedCurrency = currencies[0].toUpperCase();
    }
  }
  
  // ============================================================================
  // Enhanced: Dataset Classification (after currency detection)
  // ============================================================================
  const classification = classifyDataset(columns, {
    quantity: quantityCol,
    price: priceCol,
    revenue: revenueCol,
    cost: costCol,
    region: regionCol,
    product: productCol,
    date: dateCol,
    currency: currencyCol,
  }, monetaryColumns, {
    codeColumn: currencyCol,
    detectedCurrency,
    baseCurrency,
    isMultiCurrency,
  });
  
  debugLog(`\n[CLASSIFY] ========== DATASET CLASSIFICATION ==========`);
  debugLog(`[CLASSIFY] Type: ${classification.type.toUpperCase()} (${Math.round(classification.confidence * 100)}% confidence)`);
  debugLog(`[CLASSIFY] Indicators:`);
  classification.indicators.forEach(ind => debugLog(`  - ${ind}`));
  debugLog(`[CLASSIFY] ========== CLASSIFICATION COMPLETE ==========\n`);
  
  // Debug log: detected numeric columns
  debugLog(`\n[NORMALIZE] ========== DETECTED NUMERIC COLUMNS (After Normalization) ==========`);
  debugLog(`[NORMALIZE] Normalized columns: ${derivationLog.normalizedColumns.join(', ')}`);
  debugLog(`[NORMALIZE] Total: ${derivationLog.normalizedColumns.length} columns converted to numeric`);
  debugLog(`[NORMALIZE] ========== NORMALIZATION COMPLETE ==========\n`);
  
  const canGenerateKPIs = !!revenueCol;
  
  return {
    data,
    columns: Object.keys(data[0] || {}),
    columnMappings: {
      quantity: quantityCol,
      price: priceCol,
      revenue: revenueCol,
      cost: costCol,
      region: regionCol,
      product: productCol,
      date: dateCol,
      currency: currencyCol,
    },
    currencyInfo: {
      codeColumn: currencyCol,
      detectedCurrency,
      baseCurrency,
      isMultiCurrency,
    },
    fxRates,
    derivationLog,
    canGenerateKPIs,
  };
}

// ============================================================================
// KPI Engine
// ============================================================================

export interface ExecutiveKPIs {
  status: 'success' | 'insufficient_data';
  reason?: string;
  total_revenue: number | null;
  total_cost?: number;
  total_units?: number;
  avg_order_value?: number;
  gross_profit?: number;
  margin_pct?: number;
  revenue_by_region: Record<string, number>;
  revenue_by_product: Record<string, number>;
  revenue_by_currency: Record<string, number>;
  revenue_by_time: Record<string, number>;
  top_contributor: { type: string; name: string; value: number; pct: number } | null;
  top_performing_market?: string | null;
  top_currency?: string | null;
  base_currency?: string;
  fx_rate_source?: string | null;
  fx_rate_date?: string | null;
  concentration_risk: string | null;
}

export function calculateKPIs(processed: ProcessedDataset): ExecutiveKPIs {
  const { data, columnMappings, currencyInfo, canGenerateKPIs, derivationLog } = processed;
  
  debugLog('\n========== KPI ENGINE ==========');
  
  if (!canGenerateKPIs) {
    debugLog('[KPI] Insufficient data - cannot generate KPIs');
    return {
      status: 'insufficient_data',
      reason: derivationLog.warnings[0] || 'Revenue cannot be derived',
      total_revenue: null,
      revenue_by_region: {},
      revenue_by_product: {},
      revenue_by_currency: {},
      revenue_by_time: {},
      top_contributor: null,
      concentration_risk: null,
    };
  }
  
  const revenueCol = columnMappings.revenue!;
  const costCol = columnMappings.cost;
  const regionCol = columnMappings.region;
  const productCol = columnMappings.product;
  const dateCol = columnMappings.date;
  const currencyCol = columnMappings.currency;
  
  let totalRevenue = 0;
  let totalCost = 0;
  
  const revenueByRegion: Record<string, number> = {};
  const revenueByProduct: Record<string, number> = {};
  const revenueByCurrency: Record<string, number> = {};
  const revenueByTime: Record<string, number> = {};
  
  for (const row of data) {
    const revenue = Number(row[revenueCol]) || 0;
    const cost = costCol ? Number(row[costCol]) || 0 : 0;
    const region = regionCol ? String(row[regionCol] || 'Unknown') : 'Unknown';
    const product = productCol ? String(row[productCol] || 'Unknown') : 'Unknown';
    const time = dateCol ? String(row[dateCol] || 'Unknown') : 'Unknown';
    const currency = currencyCol ? String(row[currencyCol] || currencyInfo.baseCurrency) : currencyInfo.baseCurrency;
    
    totalRevenue += revenue;
    totalCost += cost;
    
    revenueByRegion[region] = (revenueByRegion[region] || 0) + revenue;
    revenueByProduct[product] = (revenueByProduct[product] || 0) + revenue;
    revenueByCurrency[currency] = (revenueByCurrency[currency] || 0) + revenue;
    revenueByTime[time] = (revenueByTime[time] || 0) + revenue;
  }
  
  const grossProfit = totalRevenue - totalCost;
  const margin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  
  const topRegion = Object.entries(revenueByRegion).sort((a, b) => b[1] - a[1])[0];
  const total = totalRevenue;
  const concentrationIndex = total > 0 
    ? Object.values(revenueByRegion).reduce((sum, r) => sum + Math.pow(r / total, 2), 0)
    : 0;
  const concentrationRisk = concentrationIndex > 0.5 ? 'HIGH' : concentrationIndex > 0.25 ? 'MEDIUM' : 'LOW';
  
  debugLog(`[KPI] Total Revenue: ${totalRevenue}`);
  debugLog(`[KPI] Top Region: ${topRegion ? topRegion[0] : 'N/A'}`);
  debugLog('========== KPI COMPLETE ==========\n');
  
  return {
    status: 'success',
    total_revenue: Math.round(totalRevenue * 100) / 100,
    total_cost: Math.round(totalCost * 100) / 100,
    total_units: columnMappings.quantity ? data.reduce((sum, row) => sum + (Number(row[columnMappings.quantity!]) || 0), 0) : 0,
    avg_order_value: data.length > 0 ? Math.round((totalRevenue / data.length) * 100) / 100 : 0,
    gross_profit: Math.round(grossProfit * 100) / 100,
    margin_pct: Math.round(margin * 100) / 100,
    revenue_by_region: revenueByRegion,
    revenue_by_product: revenueByProduct,
    revenue_by_currency: revenueByCurrency,
    revenue_by_time: revenueByTime,
    top_contributor: topRegion ? { type: 'region', name: topRegion[0], value: topRegion[1], pct: Math.round(topRegion[1]/total*100) } : null,
    top_performing_market: topRegion ? topRegion[0] : null,
    top_currency: Object.entries(revenueByCurrency).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
    base_currency: currencyInfo.baseCurrency,
    concentration_risk: concentrationRisk,
  };
}

// ============================================================================
// Executive Insights
// ============================================================================

export interface ExecutiveInsight {
  type: string;
  title: string;
  value?: number | string;
  detail?: string;
  breakdown?: Record<string, number>;
  priority?: number;
}

export interface ExecutiveInsights {
  status: 'success' | 'insufficient_data';
  summary: string;
  total_revenue: number | null;
  breakdown: { by_region: Record<string, number>; by_product: Record<string, number>; by_currency: Record<string, number>; by_time: Record<string, number> };
  insights: ExecutiveInsight[];
  risks: string[];
  opportunities: string[];
}

export function generateExecutiveInsights(kpis: ExecutiveKPIs, mappings: ColumnMappings): ExecutiveInsights {
  debugLog('\n========== EXECUTIVE INSIGHTS ==========');
  
  if (kpis.status === 'insufficient_data') {
    return {
      status: 'insufficient_data',
      summary: kpis.reason || 'Revenue metrics cannot be derived',
      total_revenue: null,
      breakdown: { by_region: {}, by_product: {}, by_currency: {}, by_time: {} },
      insights: [],
      risks: ['No revenue data available'],
      opportunities: ['Add quantity and price columns'],
    };
  }
  
  const insights: ExecutiveInsight[] = [];
  const risks: string[] = [];
  const opportunities: string[] = [];
  
  insights.push({
    type: 'revenue_total',
    title: 'Total Revenue',
    value: kpis.total_revenue!,
    priority: 1,
  });
  
  if (kpis.top_contributor) {
    insights.push({
      type: 'top_contributor',
      title: 'Highest Revenue',
      value: kpis.top_contributor.name,
      detail: `${kpis.top_contributor.pct}%`,
      priority: 1,
    });
  }
  
  if (kpis.revenue_by_currency && Object.keys(kpis.revenue_by_currency).length > 1) {
    insights.push({
      type: 'revenue_by_currency',
      title: 'Revenue by Currency',
      breakdown: kpis.revenue_by_currency,
      priority: 3,
    });
  }
  
  if (kpis.concentration_risk === 'HIGH') {
    risks.push(`HIGH concentration risk - ${kpis.top_contributor?.name} dominates`);
  }
  
  const summary = `Total revenue: ${kpis.total_revenue?.toLocaleString()}. Top: ${kpis.top_contributor?.name} (${kpis.top_contributor?.pct}%)`;
  
  debugLog(`[INSIGHTS] Generated ${insights.length} insights`);
  debugLog('========== INSIGHTS COMPLETE ==========\n');
  
  return {
    status: 'success',
    summary,
    total_revenue: kpis.total_revenue,
    breakdown: {
      by_region: kpis.revenue_by_region,
      by_product: kpis.revenue_by_product,
      by_currency: kpis.revenue_by_currency,
      by_time: kpis.revenue_by_time,
    },
    insights,
    risks,
    opportunities,
  };
}

// ============================================================================
// Main Entry Point
// ============================================================================

export async function analyzeBusinessDataset(
  data: DatasetRecord[],
  baseCurrency: string = 'EUR'
): Promise<{ processed: ProcessedDataset; kpis: ExecutiveKPIs; insights: ExecutiveInsights }> {
  const processed = await processDataset(data, baseCurrency);
  const kpis = calculateKPIs(processed);
  const insights = generateExecutiveInsights(kpis, processed.columnMappings);
  return { processed, kpis, insights };
}

// ============================================================================
// Backward Compatibility Export - Aliases for csv-analyzer.ts
// ============================================================================

export { processDataset as processMultiCurrencyDataset };

// Aliases for backward compatibility with csv-analyzer.ts
export type BusinessKPIs = ExecutiveKPIs;
export type ExecutiveSummary = ExecutiveInsights;

// Alias function for backward compatibility
export function generateExecutiveSummary(
  kpis: ExecutiveKPIs, 
  mappings?: ColumnMappings
): ExecutiveInsights {
  return generateExecutiveInsights(kpis, mappings || {
    quantity: null,
    price: null,
    revenue: null,
    cost: null,
    region: null,
    product: null,
    date: null,
    currency: null,
  });
}
