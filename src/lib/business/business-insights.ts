// ============================================================================
// Executive-Level Business Insights Engine
// ============================================================================

import { DatasetRecord, ColumnStatistics } from '../data/csv-analyzer';

// Helper function for percentage formatting with max 2 decimal places
const formatPercent = (val: number) => `${val.toFixed(2)}%`;

export interface ExecutiveKPIs {
  revenue_growth_pct: number | null;
  profit_margin_pct: number | null;
  top_20_customers_pct: number | null;
  revenue_concentration_pct: number | null;
  avg_order_value: number | null;
  customer_ltv_estimate: number | null;
  // New fields for executive summary
  total_revenue: number | null;
  total_profit: number | null;
  top_region: { name: string; revenue_pct: number } | null;
  top_product: { name: string; revenue_pct: number } | null;
}

export interface ExecutiveInsight {
  category: 'summary' | 'kpis' | 'insights' | 'risks' | 'opportunities';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  metric?: number;
}

export interface ExecutiveAnalysisResult {
  summary: string;
  kpis: ExecutiveKPIs;
  insights: ExecutiveInsight[];
  risks: string[];
  opportunities: string[];
}

// Detect revenue-related columns
function detectRevenueColumn(columns: string[]): string | null {
  const patterns = ['revenue', 'sales', 'amount', 'total', 'value'];
  for (const col of columns) {
    const lower = col.toLowerCase();
    if (patterns.some(p => lower.includes(p)) && !lower.includes('cost') && !lower.includes('profit')) {
      return col;
    }
  }
  return null;
}

// Detect cost-related columns
function detectCostColumn(columns: string[]): string | null {
  const patterns = ['cost', 'cogs', 'expense', 'spend'];
  for (const col of columns) {
    const lower = col.toLowerCase();
    if (patterns.some(p => lower.includes(p))) {
      return col;
    }
  }
  return null;
}

// Detect profit column
function detectProfitColumn(columns: string[]): string | null {
  const patterns = ['profit', 'net', 'income', 'margin'];
  for (const col of columns) {
    const lower = col.toLowerCase();
    if (patterns.some(p => lower.includes(p)) && !lower.includes('margin')) {
      return col;
    }
  }
  return null;
}

// Detect customer ID column
function detectCustomerColumn(columns: string[]): string | null {
  const patterns = ['customer', 'client', 'user', 'buyer'];
  for (const col of columns) {
    const lower = col.toLowerCase();
    if (patterns.some(p => lower.includes(p)) || lower.includes('_id')) {
      return col;
    }
  }
  return null;
}

// Detect product/item column
function detectProductColumn(columns: string[]): string | null {
  const patterns = ['product', 'item', 'sku', 'product_name', 'product_id', 'service'];
  for (const col of columns) {
    const lower = col.toLowerCase();
    if (patterns.some(p => lower.includes(p))) {
      return col;
    }
  }
  return null;
}

// Detect region/country column
function detectRegionColumn(columns: string[]): string | null {
  const patterns = ['region', 'country', 'area', 'zone', 'territory'];
  for (const col of columns) {
    const lower = col.toLowerCase();
    if (patterns.some(p => lower.includes(p))) {
      return col;
    }
  }
  return null;
}

// Detect channel column
function detectChannelColumn(columns: string[]): string | null {
  const patterns = ['channel', 'source', 'medium', 'campaign', 'traffic'];
  for (const col of columns) {
    const lower = col.toLowerCase();
    if (patterns.some(p => lower.includes(p))) {
      return col;
    }
  }
  return null;
}

// Detect date column
function detectDateColumn(columns: string[]): string | null {
  const patterns = ['date', 'time', 'period', 'month', 'year', 'created'];
  for (const col of columns) {
    const lower = col.toLowerCase();
    if (patterns.some(p => lower.includes(p))) {
      return col;
    }
  }
  return null;
}

// Calculate revenue growth (period-over-period)
function calculateRevenueGrowth(data: DatasetRecord[], revenueCol: string, dateCol: string | null): number | null {
  if (!revenueCol) return null;
  
  const revenues: { date: string; value: number }[] = [];
  
  for (const row of data) {
    const rev = parseFloat(String(row[revenueCol] || 0));
    if (isNaN(rev)) continue;
    
    if (dateCol) {
      revenues.push({ date: String(row[dateCol]), value: rev });
    } else {
      // Use row index as pseudo-date if no date column
      revenues.push({ date: String(revenues.length), value: rev });
    }
  }
  
  if (revenues.length < 4) return null; // Need at least 2 periods
  
  // Sort by date
  revenues.sort((a, b) => a.date.localeCompare(b.date));
  
  const mid = Math.floor(revenues.length / 2);
  const firstHalf = revenues.slice(0, mid).reduce((sum, r) => sum + r.value, 0);
  const secondHalf = revenues.slice(mid).reduce((sum, r) => sum + r.value, 0);
  
  if (firstHalf === 0) return null;
  
  return ((secondHalf - firstHalf) / firstHalf) * 100;
}

// Calculate profit margin
function calculateProfitMargin(data: DatasetRecord[], revenueCol: string, costCol: string | null): number | null {
  if (!revenueCol) return null;
  
  let totalRevenue = 0;
  let totalCost = 0;
  
  for (const row of data) {
    const rev = parseFloat(String(row[revenueCol] || 0));
    const cost = costCol ? parseFloat(String(row[costCol] || 0)) : 0;
    
    if (!isNaN(rev)) totalRevenue += rev;
    if (!isNaN(cost)) totalCost += cost;
  }
  
  if (totalRevenue === 0) return null;
  
  return ((totalRevenue - totalCost) / totalRevenue) * 100;
}

// Calculate top 20% customers contribution
function calculateTopCustomersContribution(data: DatasetRecord[], customerCol: string, revenueCol: string): number | null {
  if (!customerCol || !revenueCol) return null;
  
  const customerRevenue: Record<string, number> = {};
  
  for (const row of data) {
    const customer = String(row[customerCol] || 'unknown');
    const revenue = parseFloat(String(row[revenueCol] || 0));
    
    if (!isNaN(revenue)) {
      customerRevenue[customer] = (customerRevenue[customer] || 0) + revenue;
    }
  }
  
  const customers = Object.entries(customerRevenue)
    .sort((a, b) => b[1] - a[1]);
  
  if (customers.length === 0) return null;
  
  const top20Count = Math.max(1, Math.ceil(customers.length * 0.2));
  const top20Revenue = customers.slice(0, top20Count).reduce((sum, c) => sum + c[1], 0);
  const totalRevenue = customers.reduce((sum, c) => sum + c[1], 0);
  
  if (totalRevenue === 0) return null;
  
  return (top20Revenue / totalRevenue) * 100;
}

// Calculate revenue concentration risk (Herfindahl-like index)
function calculateRevenueConcentration(data: DatasetRecord[], customerCol: string, revenueCol: string): number | null {
  if (!customerCol || !revenueCol) return null;
  
  const customerRevenue: Record<string, number> = {};
  
  for (const row of data) {
    const customer = String(row[customerCol] || 'unknown');
    const revenue = parseFloat(String(row[revenueCol] || 0));
    
    if (!isNaN(revenue)) {
      customerRevenue[customer] = (customerRevenue[customer] || 0) + revenue;
    }
  }
  
  const revenues = Object.values(customerRevenue);
  const totalRevenue = revenues.reduce((sum, r) => sum + r, 0);
  
  if (totalRevenue === 0 || revenues.length === 0) return null;
  
  // Calculate concentration (sum of squared market shares)
  const concentration = revenues.reduce((sum, r) => {
    const share = r / totalRevenue;
    return sum + (share * share);
  }, 0);
  
  // Return as percentage (0% = perfectly distributed, 100% = single customer)
  return concentration * 100;
}

// Calculate profit margin by region
function calculateMarginByRegion(data: DatasetRecord[], regionCol: string, revenueCol: string, costCol: string | null): Record<string, number> {
  const regionMargins: Record<string, { revenue: number; cost: number }> = {};
  
  for (const row of data) {
    const region = String(row[regionCol] || 'Unknown');
    const revenue = parseFloat(String(row[revenueCol] || 0));
    const cost = costCol ? parseFloat(String(row[costCol] || 0)) : 0;
    
    if (isNaN(revenue)) continue;
    
    if (!regionMargins[region]) {
      regionMargins[region] = { revenue: 0, cost: 0 };
    }
    regionMargins[region].revenue += revenue;
    regionMargins[region].cost += cost;
  }
  
  const margins: Record<string, number> = {};
  for (const [region, data] of Object.entries(regionMargins)) {
    if (data.revenue > 0) {
      margins[region] = ((data.revenue - data.cost) / data.revenue) * 100;
    }
  }
  
  return margins;
}

// Calculate channel performance
function calculateChannelPerformance(data: DatasetRecord[], channelCol: string, revenueCol: string): Record<string, number> {
  const channelRevenue: Record<string, number> = {};
  
  for (const row of data) {
    const channel = String(row[channelCol] || 'Unknown');
    const revenue = parseFloat(String(row[revenueCol] || 0));
    
    if (!isNaN(revenue)) {
      channelRevenue[channel] = (channelRevenue[channel] || 0) + revenue;
    }
  }
  
  return channelRevenue;
}

// Check if dataset is too small for reliable insights
function isDatasetTooSmall(data: DatasetRecord[]): boolean {
  return data.length < 30;
}

// Generate executive insights
export function generateExecutiveInsights(
  data: DatasetRecord[],
  columns: string[],
  columnStats: Record<string, ColumnStatistics>
): ExecutiveAnalysisResult {
  const result: ExecutiveAnalysisResult = {
    summary: '',
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
  };
  
  // Check for small dataset
  if (isDatasetTooSmall(data)) {
    result.summary = 'Dataset sample size too small for statistically reliable strategic conclusions.';
    result.insights.push({
      category: 'insights',
      title: 'Insufficient Data',
      description: 'Dataset sample size too small for statistically reliable strategic conclusions. Recommend collecting more data for meaningful analysis.',
      impact: 'low',
    });
    return result;
  }
  
  // Detect key columns
  const revenueCol = detectRevenueColumn(columns);
  const costCol = detectCostColumn(columns);
  const profitCol = detectProfitColumn(columns);
  const customerCol = detectCustomerColumn(columns);
  const regionCol = detectRegionColumn(columns);
  const channelCol = detectChannelColumn(columns);
  const dateCol = detectDateColumn(columns);
  const productCol = detectProductColumn(columns);
  
  // Calculate total revenue and profit
  let totalRevenue = 0;
  let totalProfit = 0;
  
  if (revenueCol) {
    totalRevenue = data.reduce((sum, row) => sum + (parseFloat(String(row[revenueCol] || 0).replace(/[^0-9.-]/g, '')) || 0), 0);
    result.kpis.total_revenue = totalRevenue;
    
    // Calculate total profit
    if (profitCol) {
      totalProfit = data.reduce((sum, row) => sum + (parseFloat(String(row[profitCol] || 0).replace(/[^0-9.-]/g, '')) || 0), 0);
    } else if (costCol) {
      const totalCost = data.reduce((sum, row) => sum + (parseFloat(String(row[costCol] || 0).replace(/[^0-9.-]/g, '')) || 0), 0);
      totalProfit = totalRevenue - totalCost;
    }
    result.kpis.total_profit = totalProfit;
  }
  
  // Calculate top region by revenue
  if (regionCol && revenueCol) {
    const regionRevenue: Record<string, number> = {};
    let totalRegionalRevenue = 0;
    for (const row of data) {
      const region = String(row[regionCol] || 'Unknown');
      const revenue = parseFloat(String(row[revenueCol] || 0).replace(/[^0-9.-]/g, '')) || 0;
      regionRevenue[region] = (regionRevenue[region] || 0) + revenue;
      totalRegionalRevenue += revenue;
    }
    const topRegionEntry = Object.entries(regionRevenue).sort((a, b) => b[1] - a[1])[0];
    if (topRegionEntry && totalRegionalRevenue > 0) {
      result.kpis.top_region = {
        name: topRegionEntry[0],
        revenue_pct: (topRegionEntry[1] / totalRegionalRevenue) * 100
      };
    }
  }
  
  // Calculate top product by revenue
  if (productCol && revenueCol) {
    const productRevenue: Record<string, number> = {};
    let totalProductRevenue = 0;
    for (const row of data) {
      const product = String(row[productCol] || 'Unknown');
      const revenue = parseFloat(String(row[revenueCol] || 0).replace(/[^0-9.-]/g, '')) || 0;
      productRevenue[product] = (productRevenue[product] || 0) + revenue;
      totalProductRevenue += revenue;
    }
    const topProductEntry = Object.entries(productRevenue).sort((a, b) => b[1] - a[1])[0];
    if (topProductEntry && totalProductRevenue > 0) {
      result.kpis.top_product = {
        name: topProductEntry[0],
        revenue_pct: (topProductEntry[1] / totalProductRevenue) * 100
      };
    }
  }
  
  // Calculate KPIs
  if (revenueCol && dateCol) {
    result.kpis.revenue_growth_pct = calculateRevenueGrowth(data, revenueCol, dateCol);
  }
  
  if (revenueCol) {
    const profitMargin = profitCol 
      ? calculateProfitMargin(data, profitCol, null)
      : calculateProfitMargin(data, revenueCol, costCol);
    result.kpis.profit_margin_pct = profitMargin;
    
    // AOV
    result.kpis.avg_order_value = data.length > 0 ? totalRevenue / data.length : null;
  }
  
  if (customerCol && revenueCol) {
    result.kpis.top_20_customers_pct = calculateTopCustomersContribution(data, customerCol, revenueCol);
    result.kpis.revenue_concentration_pct = calculateRevenueConcentration(data, customerCol, revenueCol);
  }
  
  // Generate insights
  const insights: ExecutiveInsight[] = [];
  const risks: string[] = [];
  const opportunities: string[] = [];
  
  // Revenue growth insight
  if (result.kpis.revenue_growth_pct !== null) {
    const growth = result.kpis.revenue_growth_pct;
    if (growth > 10) {
      insights.push({
        category: 'insights',
        title: 'Strong Revenue Growth',
        description: `Revenue has grown by ${formatPercent(growth)} period-over-period, indicating strong market traction.`,
        impact: 'high',
        metric: growth,
      });
      opportunities.push('Continue current growth trajectory with increased investment in top-performing channels');
    } else if (growth < 0) {
      insights.push({
        category: 'insights',
        title: 'Revenue Decline',
        description: `Revenue declined by ${Math.abs(growth).toFixed(2)}% period-over-period. Immediate investigation required.`,
        impact: 'high',
        metric: growth,
      });
      risks.push(`Revenue declining at ${Math.abs(growth).toFixed(2)}% - requires immediate attention`);
    }
  }
  
  // Profit data availability check - detect from columns
  const hasProfitCol = columns.some(c => /profit|net_profit/i.test(c));
  const hasCostCol = columns.some(c => /cost|cogs|expense/i.test(c));
  const hasProfitData = hasProfitCol || hasCostCol;
  
  if (!hasProfitData) {
    insights.push({
      category: 'insights',
      title: 'Profitability Data Missing',
      description: 'No cost or profit columns detected. Profitability cannot be assessed without this data.',
      impact: 'medium',
      metric: undefined,
    });
    risks.push('Profitability cannot be assessed due to missing cost data');
  }
  
  // Profit margin insights
  if (result.kpis.profit_margin_pct !== null) {
    const margin = result.kpis.profit_margin_pct;
    if (margin > 30) {
      insights.push({
        category: 'insights',
        title: 'Healthy Profit Margins',
        description: `Profit margin of ${formatPercent(margin)} indicates strong pricing power and cost efficiency.`,
        impact: 'high',
        metric: margin,
      });
    } else if (margin < 10 && margin > 0) {
      insights.push({
        category: 'insights',
        title: 'Thin Profit Margins',
        description: `Profit margin of ${formatPercent(margin)} is below industry average. Consider cost optimization.`,
        impact: 'high',
        metric: margin,
      });
      risks.push('Profit margins below 10% - review pricing strategy and cost structure');
    } else if (margin < 0) {
      insights.push({
        category: 'insights',
        title: 'Operating at a Loss',
        description: 'Current revenue does not cover costs. Urgent action required to avoid financial distress.',
        impact: 'high',
        metric: margin,
      });
      risks.push('Operating at a loss - immediate turnaround plan needed');
    }
  }
  
  // Customer concentration insights
  if (result.kpis.top_20_customers_pct !== null) {
    const concentration = result.kpis.top_20_customers_pct;
    if (concentration > 60) {
      insights.push({
        category: 'insights',
        title: 'High Customer Concentration',
        description: `Top 20% of customers contribute ${concentration.toFixed(2)}% of revenue - significant dependency risk.`,
        impact: 'high',
        metric: concentration,
      });
      risks.push(`Heavy reliance on top customers (${concentration.toFixed(2)}% of revenue)`);
      opportunities.push('Diversify customer base to reduce concentration risk');
    } else if (concentration < 40) {
      insights.push({
        category: 'insights',
        title: 'Healthy Customer Distribution',
        description: `Revenue well-distributed across customer base (top 20% = ${concentration.toFixed(2)}%).`,
        impact: 'medium',
        metric: concentration,
      });
    }
  }
  
  // Region performance
  if (regionCol && revenueCol) {
    const regionMargins = calculateMarginByRegion(data, regionCol, revenueCol, costCol);
    const regions = Object.entries(regionMargins).sort((a, b) => b[1] - a[1]);
    
    if (regions.length > 0) {
      const bestRegion = regions[0];
      const worstRegion = regions[regions.length - 1];
      
      if (regions.length > 1) {
        insights.push({
          category: 'insights',
          title: 'Regional Performance Variance',
          description: `Profit margins range from ${worstRegion[1].toFixed(2)}% (${worstRegion[0]}) to ${bestRegion[1].toFixed(2)}% (${bestRegion[0]}).`,
          impact: 'medium',
        });
        
        opportunities.push(`Expand operations in ${bestRegion[0]} (highest margin: ${bestRegion[1].toFixed(2)}%)`);
        
        if (worstRegion[1] < 0) {
          risks.push(`${worstRegion[0]} region operating at loss (${worstRegion[1].toFixed(2)}% margin)`);
        }
      }
    }
  }
  
  // Channel performance
  if (channelCol && revenueCol) {
    const channelPerf = calculateChannelPerformance(data, channelCol, revenueCol);
    const channels = Object.entries(channelPerf).sort((a, b) => b[1] - a[1]);
    
    if (channels.length > 1) {
      const topChannel = channels[0];
      const totalRevenue = channels.reduce((sum, c) => sum + c[1], 0);
      const topShare = (topChannel[1] / totalRevenue) * 100;
      
      if (topShare > 50) {
        insights.push({
          category: 'insights',
          title: 'Channel Concentration',
          description: `${topChannel[0]} channel contributes ${formatPercent(topShare)} of revenue.`,
          impact: 'medium',
        });
        risks.push(`Heavy reliance on ${topChannel[0]} channel (${formatPercent(topShare)} of revenue)`);
        opportunities.push('Test new channels to reduce dependency on single source');
      }
    }
  }
  
  // No financial data scenario
  if (!revenueCol) {
    result.summary = 'No revenue or financial columns detected in the dataset. Limited business insights available.';
    result.insights.push({
      category: 'insights',
      title: 'Financial Data Required',
      description: 'Revenue, cost, or profit columns not found. Add financial metrics for executive insights.',
      impact: 'low',
    });
    return result;
  }
  
  // Sort insights by impact
  const impactOrder = { high: 0, medium: 1, low: 2 };
  insights.sort((a, b) => impactOrder[a.impact] - impactOrder[b.impact]);
  
  // Limit to 5 insights
  result.insights = insights.slice(0, 5);
  result.risks = risks.slice(0, 3);
  result.opportunities = opportunities.slice(0, 3);
  
  // Generate summary - improved analytical format
  const formatCurrency = (val: number) => {
    if (val >= 1000000) return `${(val/1000000).toFixed(2)}M`;
    if (val >= 1000) return `${(val/1000).toFixed(2)}K`;
    return `${val.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  };
  
  // 
  const kpis = result.kpis;
  const hasRevenue = kpis.total_revenue && kpis.total_revenue > 0;
  const hasProfit = kpis.total_profit !== null;
  const hasMargin = kpis.profit_margin_pct !== null;
  const hasGrowth = kpis.revenue_growth_pct !== null;
  const hasRegion = kpis.top_region !== null;
  const hasProduct = kpis.top_product !== null;
  
  // Build analytical summary sentences
  const summaryParts: string[] = [];
  
  // Sentence 1: Revenue and profitability
  if (hasRevenue) {
    const revStr = formatCurrency(kpis.total_revenue!);
    if (hasProfit && hasMargin) {
      const profitStr = formatCurrency(kpis.total_profit!);
      const marginStr = formatPercent(kpis.profit_margin_pct!);
      summaryParts.push(`Total revenue reached ${revStr} for the analyzed dataset, generating ${profitStr} in profit with a ${marginStr} margin.`);
    } else if (hasRevenue) {
      summaryParts.push(`Total revenue reached ${revStr} for the analyzed dataset.`);
    }
  }
  
  // Sentence 2: Top performers and concentration risks
  if (hasRegion || hasProduct) {
    let performerText = '';
    if (hasRegion && hasProduct) {
      performerText = `${kpis.top_region!.name} is the leading region (${formatPercent(kpis.top_region!.revenue_pct)} of revenue), while ${kpis.top_product!.name} is the top product (${formatPercent(kpis.top_product!.revenue_pct)}).`;
    } else if (hasRegion) {
      performerText = `${kpis.top_region!.name} is the leading region, accounting for ${formatPercent(kpis.top_region!.revenue_pct)} of total revenue.`;
    } else if (hasProduct) {
      performerText = `${kpis.top_product!.name} is the top product, contributing ${formatPercent(kpis.top_product!.revenue_pct)} of revenue.`;
    }
    summaryParts.push(performerText);
  }
  
  // Sentence 3: Growth and risks
  const riskParts: string[] = [];
  
  if (hasGrowth) {
    const growth = kpis.revenue_growth_pct!;
    if (growth > 10) {
      riskParts.push(`Strong growth of ${formatPercent(growth)} indicates positive momentum`);
    } else if (growth < 0) {
      riskParts.push(`Revenue decline of ${formatPercent(Math.abs(growth))} requires attention`);
    }
  }
  
  if (hasRegion && kpis.top_region!.revenue_pct > 60) {
    riskParts.push(`High regional concentration in ${kpis.top_region!.name} (${formatPercent(kpis.top_region!.revenue_pct)}) presents dependency risk`);
  }
  
  if (kpis.revenue_concentration_pct && kpis.revenue_concentration_pct > 50) {
    riskParts.push(`Revenue concentration at ${formatPercent(kpis.revenue_concentration_pct)} indicates customer dependency risk`);
  }
  
  if (riskParts.length > 0) {
    summaryParts.push(riskParts.join(', ') + '.');
  }
  
  // Fallback if not enough data
  if (summaryParts.length < 2 && !hasRevenue) {
    result.summary = 'Insufficient revenue data for comprehensive analysis.';
  } else {
    result.summary = summaryParts.join(' ');
  }
  
  return result;
}
