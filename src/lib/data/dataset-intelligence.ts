import {
  buildDatasetIntelligenceEngine,
  type DatasetIntelligenceEngineResult,
} from "./dataset-intelligence-engine";

/**
 * Dataset Intelligence Builder
 * 
 * Automatically analyzes uploaded datasets and generates structured metadata
 * that can be used by the AI assistant.
 */

export type ColumnType = 'numeric' | 'categorical' | 'date' | 'text' | 'boolean';

export interface DatasetRecord {
  [key: string]: string | number | boolean | null;
}

export interface ColumnStatistics {
  type: ColumnType;
  unique: number;
  nullCount: number;
  count: number;
  sum?: number;
  mean?: number;
  min?: number;
  max?: number;
  median?: number;
}

export interface DatasetSchema {
  columns: {
    name: string;
    type: 'numeric' | 'categorical' | 'date' | 'text' | 'boolean';
    nullable: boolean;
    sampleValues: string[];
  }[];
}

export interface DatasetMetrics {
  rowCount: number;
  columnCount: number;
  numericColumns: string[];
  categoricalColumns: string[];
  dateColumns: string[];
  numericStats: Record<string, {
    sum: number;
    average: number;
    min: number;
    max: number;
    median: number;
  }>;
}

export interface DatasetDimensions {
  timeColumns: string[];
  categoryColumns: string[];
  numericMetrics: string[];
  geographicColumns: string[];
}

export interface DatasetInsight {
  type: 'top_performer' | 'growth' | 'concentration' | 'distribution';
  field: string;
  value: string;
  metric: string;
  description: string;
}

export interface DatasetIntelligence {
  schema: DatasetSchema;
  metrics: DatasetMetrics;
  dimensions: DatasetDimensions;
  insights: DatasetInsight[];
  semanticMetadata: DatasetIntelligenceEngineResult;
  generatedAt: string;
}

export type DatasetKind = 'Retail' | 'Inventory' | 'Sales' | 'Finance' | 'SaaS' | 'Generic' | 'Investor';

const DATASET_TYPE_KEYWORDS: Record<DatasetKind, RegExp[]> = {
  Retail: [
    /retail|store|shop/i,
    /product|sku|item/i,
    /inventory|stock|reorder/i,
    /supplier|vendor/i,
    /unit|quantity|qty/i,
    /margin|refund|return/i,
  ],
  Inventory: [
    /inventory|stock|warehouse|on hand|onhand/i,
    /sku|item/i,
    /reorder|minimum|threshold/i,
    /supplier|vendor/i,
    /quantity|qty|unit cost|valuation/i,
  ],
  Sales: [
    /sales|revenue|amount|invoice/i,
    /customer|account/i,
    /order|deal/i,
    /pipeline|conversion/i,
    /region|rep|channel/i,
  ],
  Finance: [
    /finance|expense|cost|profit|loss/i,
    /cash|bank|balance/i,
    /budget|forecast/i,
    /invoice|payment/i,
    /margin|ebitda/i,
  ],
  SaaS: [
    /saas|subscription/i,
    /mrr|arr|recurring/i,
    /churn|retention|renewal/i,
    /activation|trial/i,
    /plan|seat|account/i,
    /ltv|cac/i,
  ],
  Investor: [
    /investor|investment|portfolio/i,
    /portfolio company|company_id|company_name/i,
    /investment_date|invested_amount|capital_deployed/i,
    /latest_valuation|valuation|ownership|stake/i,
    /annual_revenue|sector|stage/i,
  ],
  Generic: [/.^/],
};

export function detectDatasetTypeFromColumns(columns: string[], datasetName = ''): DatasetKind {
  const text = [datasetName, ...columns].join(' ').toLowerCase();
  const score = (kind: DatasetKind) =>
    DATASET_TYPE_KEYWORDS[kind].reduce((total, pattern) => total + (pattern.test(text) ? 1 : 0), 0);

  if (hasStrongInvestorPortfolioSchema(text)) return 'Investor';

  const ranked: DatasetKind[] = ['Retail', 'Inventory', 'SaaS', 'Finance', 'Sales', 'Investor'];
  const best = ranked
    .map((kind) => ({ kind, score: score(kind) }))
    .sort((a, b) => b.score - a.score)[0];

  if (!best || best.score === 0) return 'Generic';
  const hasRetailProductSignal = /product|sku|item/.test(text);
  const hasRetailStockSignal = /inventory|stock|reorder|supplier|vendor|unit|quantity|qty/.test(text);
  if (best.kind === 'Inventory' && /sales|revenue|margin|retail|store/.test(text) && hasRetailProductSignal) return 'Retail';
  if (best.kind === 'Sales' && hasRetailProductSignal && hasRetailStockSignal) return 'Retail';
  return best.kind;
}

function questionListForDatasetType(kind: DatasetKind): string[] {
  const suggestions: Record<DatasetKind, string[]> = {
    Retail: [
      'What are the top selling products?',
      'Which products are low stock items?',
      'Which products are dead stock products?',
      'What is the current inventory valuation?',
      'Which products need reorder recommendations?',
      'Which products have the highest margin?',
      'Which suppliers drive the most revenue or risk?',
      'What are the revenue trends over time?',
      'Which products are slow moving inventory?',
      'What cash-flow risks are created by inventory and stock levels?',
      'Which categories generate the most gross profit?',
      'Which SKUs should be discounted, bundled, or stopped?',
    ],
    Inventory: [
      'Which items are below reorder point?',
      'What is the total inventory value?',
      'Which SKUs have the highest stock value stuck?',
      'Which items have no recent movement?',
      'Which products should be reordered first?',
      'Which suppliers create the largest inventory exposure?',
      'Which categories have too much stock?',
      'Which items are at risk of stockout?',
      'How long will current stock last?',
      'Which items should be discounted or bundled?',
      'What stock levels create cash-flow risk?',
      'Which products have the fastest inventory turnover?',
    ],
    Sales: [
      'What is total sales revenue?',
      'Which customers generate the most revenue?',
      'Which products or services sell best?',
      'What are the sales trends over time?',
      'Which regions or channels perform best?',
      'Which sales segments are declining?',
      'What is the average order value?',
      'Which customers or orders have the highest margin?',
      'Where are sales concentrated?',
      'What are the biggest revenue risks?',
      'Which opportunities should the owner prioritize?',
      'What changed compared with the previous period?',
    ],
    Finance: [
      'What is the total revenue, cost, and profit?',
      'What is the current gross margin?',
      'Which expenses are increasing fastest?',
      'What cash-flow risks appear in this data?',
      'Which categories have the largest cost impact?',
      'What is the profit trend over time?',
      'Where is margin under pressure?',
      'Which transactions look unusual?',
      'What tax or reserve risks should be reviewed?',
      'Which costs should be reduced first?',
      'What is the monthly operating run rate?',
      'What actions would improve net margin?',
    ],
    SaaS: [
      'What is current MRR or recurring revenue?',
      'Which plans generate the most revenue?',
      'What is the churn or cancellation trend?',
      'Which customers or accounts are highest value?',
      'What is the retention trend over time?',
      'Which cohorts perform best?',
      'What expansion revenue opportunities exist?',
      'Which accounts are at risk?',
      'What is average revenue per account?',
      'Which acquisition channels produce the best customers?',
      'What cash-flow risks appear from subscriptions?',
      'What should the team improve to grow recurring revenue?',
    ],
    Investor: [
      'What is the total portfolio company revenue?',
      'Which portfolio companies generate the most annual revenue?',
      'Which portfolio companies have the highest valuation?',
      'How is the portfolio distributed by sector?',
      'How is the portfolio distributed by stage?',
      'How is the portfolio distributed geographically?',
      'Which portfolio companies have the highest growth?',
      'Which companies have the shortest runway?',
      'Which companies have the highest monthly burn?',
      'What is the portfolio concentration risk?',
      'How has investment activity changed over time?',
      'How much capital has been invested?',
    ],
    Generic: [
      'What are the key insights in this dataset?',
      'Which columns drive the most important totals?',
      'What are the top 10 records by value?',
      'What trends appear over time?',
      'Which categories perform best?',
      'Where are values unusually high or low?',
      'What data quality issues should be reviewed?',
      'Which segments need attention?',
      'What risks does this data reveal?',
      'What actions should the owner take next?',
      'What should be compared against the previous period?',
      'What questions should I ask next about this dataset?',
    ],
  };

  return suggestions[kind];
}

export function fallbackSuggestionsForDatasetType(kind: DatasetKind): string[] {
  return questionListForDatasetType(kind).slice(0, 12);
}

export function fallbackSuggestionsForBusinessModel(model: string): string[] {
  const suggestions: Record<string, string[]> = {
    local_retail: [
      'What were daily, weekly, and monthly store revenue trends?',
      'Which store or branch performs best?',
      'Which SKUs are low stock?',
      'Which products are dead stock?',
      'Which products create reorder risk?',
      'What is the sell-through rate by product?',
      'Which categories generate the most revenue?',
      'Which slow-moving products should be discounted or bundled?',
      'What is current inventory value?',
      'Which products have the highest margin?',
      'Which branches need stock rebalancing?',
      'What local store actions should happen next?',
    ],
    ecommerce: [
      'What is revenue by country?',
      'What are orders by region?',
      'What is average order value?',
      'Which channels perform best?',
      'What is the return or refund rate?',
      'Which countries have the highest shipping cost?',
      'Which customers are repeat customers?',
      'Which products sell best online?',
      'Where is ecommerce revenue concentrated?',
      'Which regions underperform?',
      'What changed in online sales over time?',
      'Which ecommerce actions should happen next?',
    ],
    saas: [
      'What is current MRR or ARR?',
      'What is churn by period?',
      'Which plans generate the most recurring revenue?',
      'What is CAC compared with LTV?',
      'How many active users or accounts are represented?',
      'Which cohorts retain best?',
      'What is the subscription growth trend?',
      'Which accounts are at risk?',
      'What is expansion revenue potential?',
      'What runway risk appears in this data?',
      'Which SaaS metric needs the fastest action?',
      'What should improve recurring revenue?',
    ],
    startup: [
      'What is the runway based on burn rate?',
      'What is monthly burn?',
      'How does revenue growth compare with costs?',
      'What is CAC compared with LTV?',
      'What active-user trend appears?',
      'Which growth metric is strongest?',
      'Which operating cost is increasing fastest?',
      'What funding or runway risk appears?',
      'Which segment drives growth?',
      'What should the startup prioritize next?',
      'Where is unit economics pressure highest?',
      'What milestone looks most at risk?',
    ],
    investor: [
      'What is the total portfolio company revenue?',
      'Which portfolio companies generate the most annual revenue?',
      'Which portfolio companies have the highest valuation?',
      'What is invested capital by sector?',
      'What is ownership by company?',
      'Which stages dominate the portfolio?',
      'Where is portfolio performance strongest?',
      'Which companies create concentration risk?',
      'What geography is relevant to the portfolio?',
      'Which portfolio companies have the highest growth?',
      'Which companies have the shortest runway?',
      'Which companies have the highest monthly burn?',
      'Which sectors underperform?',
      'Which investments have experienced the largest company valuation increase?',
      'Which investment needs review first?',
      'What portfolio actions should happen next?',
      'Where is follow-on capital most justified?',
    ],
    marketplace: [
      'What is GMV by period?',
      'What is take rate or commission revenue?',
      'Which sellers perform best?',
      'Which buyers or customer groups are most active?',
      'Which listings generate the most value?',
      'What marketplace liquidity risk appears?',
      'Which categories have the highest GMV?',
      'What is repeat buyer behavior?',
      'Which vendors underperform?',
      'Where is marketplace revenue concentrated?',
      'What operational action should happen next?',
      'Which side of the marketplace needs growth?',
    ],
    Investor: [
      'What is the total portfolio company revenue?',
      'Which portfolio companies generate the most annual revenue?',
      'Which portfolio companies have the highest valuation?',
      'How is the portfolio distributed by sector?',
      'How is the portfolio distributed by stage?',
      'How is the portfolio distributed geographically?',
      'Which portfolio companies have the highest growth?',
      'Which companies have the shortest runway?',
      'Which companies have the highest monthly burn?',
      'What is the portfolio concentration risk?',
      'How has investment activity changed over time?',
      'How much capital has been invested?',
    ],
  };

  return (suggestions[model] || questionListForDatasetType('Generic')).slice(0, 12);
}

/**
 * Generate suggested questions based on dataset intelligence
 */
export function generateSuggestions(intelligence: DatasetIntelligence, datasetName = ''): string[] {
  const suggestions: string[] = [];
  const dims = intelligence.dimensions;
  const cols = intelligence.schema.columns;
  const numericCols = intelligence.metrics.numericColumns;
  const datasetType = detectDatasetTypeFromColumns(cols.map((column) => column.name), datasetName);
  const semanticSaasSuggestions = intelligence.semanticMetadata.saas?.suggestedQuestions ?? [];

  if (datasetType === 'Investor') {
    const columnNames = cols.map((column) => column.name);
    const text = [datasetName, ...columnNames].join(' ').toLowerCase();
    const investorSuggestions: string[] = [];
    const hasAnnualRevenue = /annual_revenue|portfolio_company_revenue|company_revenue/.test(text);
    const hasCompany = /portfolio_company|company_id|company_name|\bcompany\b/.test(text);
    const hasInvestmentDate = /investment_date|invested_date|deal_date|funding_date/.test(text);
    const hasValuation = /latest_valuation|current_valuation|valuation/.test(text);
    const hasGrowth = /growth_rate|company_growth_rate|portfolio_company_growth_rate/.test(text);
    const hasRunway = /runway_months|company_runway_months/.test(text);
    const hasBurn = /burn_rate_monthly|monthly_burn|monthly_burn_rate/.test(text);
    const hasInvestedAmount = /invested_amount|investment_amount|invested_capital|capital_deployed/.test(text);
    const hasStage = /stage|investment_stage|company_stage/.test(text);
    const hasStatus = /status|portfolio_status|investment_status|company_status/.test(text);
    const hasSector = /sector|industry/.test(text);
    const hasGeography = /country|region|geography|location|market/.test(text);

    if (hasAnnualRevenue) investorSuggestions.push('What is the total portfolio company revenue?');
    if (hasAnnualRevenue && hasCompany) investorSuggestions.push('Which portfolio companies generate the most annual revenue?');
    if (hasValuation && hasCompany) investorSuggestions.push('Which portfolio companies have the highest valuation?');
    if (hasGrowth && hasCompany) investorSuggestions.push('Which portfolio companies have the highest growth?');
    if (hasRunway && hasCompany) investorSuggestions.push('Which companies have the shortest runway?');
    if (hasBurn && hasCompany) investorSuggestions.push('Which companies have the highest monthly burn?');
    if (hasInvestedAmount) investorSuggestions.push('How much capital has been invested?');
    if (hasInvestmentDate) investorSuggestions.push('How has investment activity changed over time?');
    if (hasSector) investorSuggestions.push('How is the portfolio distributed by sector?');
    if (hasStage) investorSuggestions.push('How is the portfolio distributed by stage?');
    if (hasGeography) investorSuggestions.push('How is the portfolio distributed geographically?');
    if (hasStatus) investorSuggestions.push('Which portfolio companies are on the watchlist?');
    if (hasCompany) investorSuggestions.push('What is the portfolio concentration risk?');
    return [...new Set(investorSuggestions)].slice(0, 12);
  }
  
  // Get actual column names for different categories
  const regionCol = dims.geographicColumns[0] || 
    cols.find(c => c.name.toLowerCase().includes('region') || c.name.toLowerCase().includes('area'))?.name;
  const countryCol = cols.find(c => c.name.toLowerCase().includes('country') || c.name.toLowerCase().includes('nation'))?.name;
  const productCol = dims.categoryColumns.find(c => 
    c.toLowerCase().includes('product') || c.toLowerCase().includes('item') || c.toLowerCase().includes('sku')
  ) || cols.find(c => c.name.toLowerCase().includes('product') || c.name.toLowerCase().includes('item'))?.name;
  const timeCol = dims.timeColumns[0] || 
    cols.find(c => c.name.toLowerCase().includes('date') || c.name.toLowerCase().includes('time') || c.name.toLowerCase().includes('month') || c.name.toLowerCase().includes('year'))?.name;
  const categoryCol = dims.categoryColumns[0];
  
  // Revenue/Profit questions
  const revenueCol = numericCols.find(c => 
    c.toLowerCase().includes('revenue') || c.toLowerCase().includes('sales') || c.toLowerCase().includes('amount')
  );
  const profitCol = numericCols.find(c => c.toLowerCase().includes('profit') || c.toLowerCase().includes('margin'));
  const costCol = numericCols.find(c => c.toLowerCase().includes('cost') || c.toLowerCase().includes('cogs'));
  const quantityCol = numericCols.find(c => 
    c.toLowerCase().includes('quantity') || c.toLowerCase().includes('units') || c.toLowerCase().includes('qty')
  );
  
  // Region/Geographic questions
  if (regionCol || countryCol) {
    const geoCol = regionCol || countryCol;
    if (revenueCol) {
      suggestions.push(`Which ${geoCol} generates the most ${revenueCol.toLowerCase()}?`);
      suggestions.push(`Which ${geoCol} has the lowest ${revenueCol.toLowerCase()}?`);
    }
    if (profitCol) {
      suggestions.push(`Which ${geoCol} is the most profitable?`);
    }
  }
  
  // Product questions
  if (productCol) {
    if (revenueCol) {
      suggestions.push(`Which ${productCol.toLowerCase()} performs best by ${revenueCol.toLowerCase()}?`);
    }
    if (quantityCol) {
      suggestions.push(`Which ${productCol.toLowerCase()} has the highest ${quantityCol.toLowerCase()}?`);
    }
    if (profitCol) {
      suggestions.push(`What is the ${profitCol.toLowerCase()} by ${productCol.toLowerCase()}?`);
    }
  }
  
  // Time/Trend questions
  if (timeCol && revenueCol) {
    suggestions.push(`What are the ${revenueCol.toLowerCase()} trends over time?`);
    suggestions.push(`Which time period had the highest ${revenueCol.toLowerCase()}?`);
  }
  
  // Category questions
  if (categoryCol && revenueCol) {
    suggestions.push(`How does ${revenueCol.toLowerCase()} vary by ${categoryCol.toLowerCase()}?`);
  }
  
  // Profitability questions
  if (revenueCol && costCol) {
    suggestions.push(`What is the total ${revenueCol.toLowerCase()} minus total ${costCol.toLowerCase()}?`);
  }
  if (revenueCol && profitCol) {
    suggestions.push(`What is the average ${profitCol.toLowerCase()} margin?`);
  }
  
  // General summary questions
  suggestions.push(`What is the total ${revenueCol || 'value'}?`);
  suggestions.push(`How many rows are in this dataset?`);
  
  const contextualSuggestions = questionListForDatasetType(datasetType);
  const uniqueSuggestions = [...new Set([...semanticSaasSuggestions, ...contextualSuggestions, ...suggestions])].slice(0, 12);
  
  return uniqueSuggestions;
}

function hasStrongInvestorPortfolioSchema(text: string) {
  const normalized = text.replace(/_/g, ' ');
  const hasCompany = /\bportfolio company\b|\bcompany id\b|\bcompany name\b/.test(normalized);
  const hasInvestmentEventDate = /\binvestment date\b|\binvested date\b|\bdeal date\b|\bfunding date\b/.test(normalized);
  const hasCapitalOrOwnership = /\binvested amount\b|\binvested capital\b|\binvestment amount\b|\bcapital deployed\b|\bownership\b|\bstake\b/.test(normalized);
  const hasCompanyValuation = /\bentry valuation\b|\blatest valuation\b|\bcurrent valuation\b|\bcompany valuation\b|\bvaluation\b/.test(normalized);
  const hasPortfolioDescriptor = /\binvestor\b|\bportfolio\b|\bfund\b|\bsector\b|\bstage\b|\bstatus\b/.test(normalized);
  return hasCompany && hasInvestmentEventDate && hasPortfolioDescriptor && (hasCapitalOrOwnership || hasCompanyValuation);
}

/**
 * Detect column data types
 */
function detectColumnType(values: (string | number | boolean | null)[]): 'numeric' | 'categorical' | 'date' | 'text' | 'boolean' {
  const nonNull = values.filter(v => v !== null && v !== undefined && v !== '');
  if (nonNull.length === 0) return 'text';
  
  const sample = nonNull.slice(0, 100);
  
  // Check for boolean
  const uniqueBool = new Set(sample.map(v => String(v).toLowerCase()));
  if (uniqueBool.size <= 2 && [...uniqueBool].every(v => ['true', 'false', '0', '1', 'yes', 'no'].includes(v))) {
    return 'boolean';
  }
  
  // Check for numeric
  const numericCount = sample.filter(v => !isNaN(Number(v))).length;
  if (numericCount / sample.length > 0.8) {
    return 'numeric';
  }
  
  // Check for date
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}/,  // ISO
    /^\d{2}\/\d{2}\/\d{4}/, // US
    /^\d{2}-\d{2}-\d{4}/,   // EU
  ];
  const dateCount = sample.filter(v => datePatterns.some(p => p.test(String(v)))).length;
  if (dateCount / sample.length > 0.8) {
    return 'date';
  }
  
  // Check for categorical (low cardinality)
  const unique = new Set(sample.map(String));
  if (unique.size <= 50) {
    return 'categorical';
  }
  
  return 'text';
}

/**
 * Calculate numeric statistics
 */
function calculateNumericStats(values: number[]): { sum: number; average: number; min: number; max: number; median: number } {
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = sum / values.length;
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  
  return {
    sum,
    average: avg,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    median
  };
}

/**
 * Detect time columns
 */
function detectTimeColumns(columns: string[], columnStats: Record<string, ColumnStatistics>): string[] {
  return columns.filter(col => {
    const stats = columnStats[col];
    if (!stats) return false;
    // Check type or name
    return stats.type === 'date' || /date|time|month|year|quarter|period/i.test(col);
  });
}

/**
 * Detect category columns
 */
function detectCategoryColumns(columns: string[], columnStats: Record<string, ColumnStatistics>): string[] {
  return columns.filter(col => {
    const stats = columnStats[col];
    if (!stats) return false;
    return stats.type === 'text' && stats.unique && stats.unique < 50;
  });
}

/**
 * Detect numeric metrics
 */
function detectNumericMetrics(columns: string[], columnStats: Record<string, ColumnStatistics>): string[] {
  return columns.filter(col => {
    const stats = columnStats[col];
    if (!stats) return false;
    return stats.type === 'numeric' && !/id|num|index/i.test(col);
  });
}

/**
 * Detect geographic columns
 */
function detectGeographicColumns(columns: string[]): string[] {
  const geoPatterns = [/country|region|city|state|zip|postal|location|lat|lng|lon/i];
  return columns.filter(col => geoPatterns.some(p => p.test(col)));
}

/**
 * Generate simple insights
 */
function generateInsights(
  data: DatasetRecord[],
  columns: string[],
  columnStats: Record<string, ColumnStatistics>,
  dimensions: DatasetDimensions
): DatasetInsight[] {
  const insights: DatasetInsight[] = [];
  
  // Find numeric metrics
  const numericMetrics = columns.filter(col => {
    const stats = columnStats[col];
    return stats?.type === 'numeric' && /revenue|sales|amount|profit|cost/i.test(col);
  });
  
  // Find category columns
  const categoryColumns = columns.filter(col => {
    const stats = columnStats[col];
    return stats?.type === 'text' && stats.unique && stats.unique < 30;
  });
  
  // Top performer insights (highest value in numeric columns grouped by category)
  for (const metric of numericMetrics.slice(0, 3)) {
    for (const category of categoryColumns.slice(0, 3)) {
      const grouped: Record<string, number> = {};
      for (const row of data) {
        const cat = String(row[category] || 'Unknown');
        const val = parseFloat(String(row[metric] || 0).replace(/[^0-9.-]/g, '')) || 0;
        grouped[cat] = (grouped[cat] || 0) + val;
      }
      
      const sorted = Object.entries(grouped).sort((a, b) => b[1] - a[1]);
      if (sorted.length > 0) {
        const top = sorted[0];
        const total = Object.values(grouped).reduce((a, b) => a + b, 0);
        const pct = ((top[1] / total) * 100).toFixed(2);
        
        insights.push({
          type: 'top_performer',
          field: category,
          value: top[0],
          metric: metric,
          description: `${top[0]} is the top ${category.toLowerCase()} with ${pct}% of total ${metric.toLowerCase()}`
        });
        break; // Only one insight per metric
      }
    }
  }
  
  // Growth/decline insight if time column exists
  if (dimensions.timeColumns.length > 0 && numericMetrics.length > 0) {
    const timeCol = dimensions.timeColumns[0];
    const metric = numericMetrics[0];
    
    // Group by time period
    const timeValues: Record<string, number> = {};
    for (const row of data) {
      const time = String(row[timeCol] || '').substring(0, 7); // YYYY-MM
      const val = parseFloat(String(row[metric] || 0).replace(/[^0-9.-]/g, '')) || 0;
      timeValues[time] = (timeValues[time] || 0) + val;
    }
    
    const periods = Object.entries(timeValues).sort();
    if (periods.length >= 2) {
      const first = periods[0][1];
      const last = periods[periods.length - 1][1];
      const change = ((last - first) / first) * 100;
      
      if (Math.abs(change) > 5) {
        insights.push({
          type: 'growth',
          field: timeCol,
          value: change > 0 ? 'growth' : 'decline',
          metric: `${change.toFixed(2)}%`,
          description: `${metric} shows ${change > 0 ? 'growth' : 'decline'} of ${Math.abs(change).toFixed(2)}% from ${periods[0][0]} to ${periods[periods.length - 1][0]}`
        });
      }
    }
  }
  
  // Concentration insight
  for (const category of categoryColumns.slice(0, 2)) {
    const counts: Record<string, number> = {};
    for (const row of data) {
      const cat = String(row[category] || 'Unknown');
      counts[cat] = (counts[cat] || 0) + 1;
    }
    
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) {
      const top = sorted[0];
      const pct = ((top[1] / data.length) * 100).toFixed(2);
      
      if (parseFloat(pct) > 50) {
        insights.push({
          type: 'concentration',
          field: category,
          value: top[0],
          metric: pct + '%',
          description: `${pct}% of records are ${top[0]} - high concentration in ${category.toLowerCase()}`
        });
      }
    }
  }
  
  return insights;
}

/**
 * Main function to build dataset intelligence
 */
export function buildDatasetIntelligence(data: DatasetRecord[]): DatasetIntelligence {
  if (!data || data.length === 0) {
    throw new Error('No data provided');
  }
  
  const columns = Object.keys(data[0]);
  const semanticMetadata = buildDatasetIntelligenceEngine({
    rows: data as Record<string, unknown>[],
    columns,
  });
  
  // 1. Detect schema
  const schema: DatasetSchema = {
    columns: columns.map(col => {
      const values = data.map(row => row[col]);
      const type = detectColumnType(values);
      const nonNull = values.filter(v => v !== null && v !== undefined);
      const unique = new Set(nonNull.map(String));
      
      return {
        name: col,
        type,
        nullable: nonNull.length < data.length,
        sampleValues: [...unique].slice(0, 5).map(String)
      };
    })
  };
  
  // Calculate column statistics
  const columnStats: Record<string, ColumnStatistics> = {};
  for (const col of columns) {
    const values = data.map(row => row[col]);
    const nonNull = values.filter(v => v !== null && v !== undefined);
    const type = detectColumnType(nonNull);
    
    columnStats[col] = {
      type,
      unique: new Set(nonNull.map(String)).size,
      nullCount: data.length - nonNull.length,
      count: data.length
    };
    
    if (type === 'numeric') {
      const nums = nonNull.map(v => parseFloat(String(v).replace(/[^0-9.-]/g, ''))).filter(n => !isNaN(n));
      if (nums.length > 0) {
        const stats = calculateNumericStats(nums);
        columnStats[col].sum = stats.sum;
        columnStats[col].mean = stats.average;
        columnStats[col].min = stats.min;
        columnStats[col].max = stats.max;
        columnStats[col].median = stats.median;
      }
    }
  }
  
  // 2. Generate metrics
  const numericColumns = columns.filter((col) =>
    columnStats[col]?.type === 'numeric' ||
    semanticMetadata.columns.some((column) => column.columnName === col && ["Revenue", "GMV", "Marketplace Revenue", "Commission", "Cost", "Merchant Payout", "Refund", "Profit", "Margin", "Quantity", "Percentage", "Metric"].includes(column.canonicalRole))
  );
  const categoricalColumns = columns.filter((col) =>
    columnStats[col]?.type === 'categorical' ||
    semanticMetadata.columns.some((column) => column.columnName === col && ["Category", "Product Category", "Geography", "Country", "Region", "City", "Product", "Customer", "Merchant", "Seller", "Buyer", "Status", "SKU"].includes(column.canonicalRole))
  );
  const dateColumns = columns.filter((col) =>
    columnStats[col]?.type === 'date' ||
    semanticMetadata.columns.some((column) => column.columnName === col && column.canonicalRole === "Date")
  );
  
  const metrics: DatasetMetrics = {
    rowCount: data.length,
    columnCount: columns.length,
    numericColumns,
    categoricalColumns,
    dateColumns,
    numericStats: {}
  };
  
  for (const col of numericColumns) {
    const nums = data
      .map(row => parseFloat(String(row[col] || 0).replace(/[^0-9.-]/g, '')))
      .filter(n => !isNaN(n));
    if (nums.length > 0) {
      metrics.numericStats[col] = calculateNumericStats(nums);
    }
  }
  
  // 3. Identify dimensions
  const dimensions: DatasetDimensions = {
    timeColumns: mergeUnique(
      detectTimeColumns(columns, columnStats),
      semanticMetadata.columns.filter((column) => column.canonicalRole === "Date").map((column) => column.columnName),
    ),
    categoryColumns: mergeUnique(
      detectCategoryColumns(columns, columnStats),
      semanticMetadata.columns
        .filter((column) => ["Category", "Product Category", "Product", "Customer", "Merchant", "Seller", "Buyer", "Status", "SKU"].includes(column.canonicalRole))
        .map((column) => column.columnName),
    ),
    numericMetrics: mergeUnique(
      detectNumericMetrics(columns, columnStats),
      semanticMetadata.columns
        .filter((column) => ["Revenue", "GMV", "Marketplace Revenue", "Commission", "Cost", "Merchant Payout", "Refund", "Profit", "Margin", "Quantity", "Percentage", "Metric"].includes(column.canonicalRole))
        .map((column) => column.columnName),
    ),
    geographicColumns: mergeUnique(
      detectGeographicColumns(columns),
      semanticMetadata.columns
        .filter((column) => ["Geography", "Country", "Region", "City"].includes(column.canonicalRole))
        .map((column) => column.columnName),
    )
  };
  
  // 4. Generate insights
  const insights = generateInsights(data, columns, columnStats, dimensions);
  
  // 5. Return complete intelligence
  return {
    schema,
    metrics,
    dimensions,
    insights,
    semanticMetadata,
    generatedAt: new Date().toISOString()
  };
}

function mergeUnique<T>(...groups: T[][]) {
  return Array.from(new Set(groups.flat()));
}

/**
 * Get a summary of dataset intelligence
 */
export function getIntelligenceSummary(intelligence: DatasetIntelligence): string {
  const parts: string[] = [];
  
  // Overview
  parts.push(`Dataset: ${intelligence.metrics.rowCount} rows, ${intelligence.metrics.columnCount} columns`);
  
  // Top insights
  if (intelligence.insights.length > 0) {
    parts.push('\nKey Insights:');
    for (const insight of intelligence.insights.slice(0, 3)) {
      parts.push(`- ${insight.description}`);
    }
  }
  
  // Available dimensions
  parts.push('\nDimensions:');
  if (intelligence.dimensions.timeColumns.length > 0) {
    parts.push(`- Time: ${intelligence.dimensions.timeColumns.join(', ')}`);
  }
  if (intelligence.dimensions.categoryColumns.length > 0) {
    parts.push(`- Categories: ${intelligence.dimensions.categoryColumns.join(', ')}`);
  }
  if (intelligence.dimensions.numericMetrics.length > 0) {
    parts.push(`- Metrics: ${intelligence.dimensions.numericMetrics.join(', ')}`);
  }
  parts.push(`\nSemantic Model: ${intelligence.semanticMetadata.businessModel.model} (${Math.round(intelligence.semanticMetadata.businessModel.confidence * 100)}% confidence)`);
  parts.push('Semantic Columns:');
  for (const column of intelligence.semanticMetadata.aiContext.semanticColumns.slice(0, 12)) {
    parts.push(`- ${column.columnName}: ${column.canonicalRole} (${Math.round(column.confidence * 100)}%)`);
  }
  
  return parts.join('\n');
}
