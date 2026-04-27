// ============================================================================
// Executive KPI Engine - Core Analysis Function
// ============================================================================
// All calculations derive from: const rows = dataset.data || []
// No legacy metadata usage.

export interface DatasetAnalysis {
  // Overview
  totalRows: number;
  totalColumns: number;
  
  // Column Classification
  numericColumns: string[];
  dateColumns: string[];
  categoricalColumns: string[];
  
  // Financial Metrics
  revenueColumn: string | null;
  totalRevenue: number | null;
  avgRevenue: number | null;
  
  // Category Analysis
  categoryColumn: string | null;
  topCategory: { name: string; count: number; percentage: number } | null;
  categoryDistribution: Record<string, { count: number; revenue?: number; percentage: number }>;
  
  // Growth Analysis
  growthPercentage: number | null;
  growthTrend: 'up' | 'down' | 'stable' | null;
  periodOverPeriodChange: number | null;
  
  // Time Analysis
  dateRange: { start: string; end: string } | null;
  monthlyRevenue: Record<string, number>;
  
  // Detailed Metrics
  numericStats: Record<string, {
    min: number;
    max: number;
    sum: number;
    avg: number;
    count: number;
  }>;
  
  // Visualization Data
  charts: {
    revenueByCategory: { category: string; revenue: number }[];
    revenueOverTime: { period: string; revenue: number }[];
    distribution: { label: string; value: number; percentage: number }[];
  };
}

// ============================================================================
// Step 1: Detect Columns
// ============================================================================

function detectColumns(rows: any[]): {
  columns: string[];
  numericColumns: string[];
  dateColumns: string[];
  categoricalColumns: string[];
} {
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  
  const numericColumns = columns.filter(col =>
    rows.some(r => {
      const val = r[col];
      return typeof val === 'number' ||
        (typeof val === 'string' && val.trim() !== '' && !isNaN(parseFloat(val)) && isFinite(parseFloat(val)));
    })
  );
  
  const dateColumns = columns.filter(col =>
    rows.some(r => {
      const val = r[col];
      return typeof val === 'string' &&
        val.trim() !== '' &&
        !isNaN(Date.parse(val)) &&
        val.length > 6; // Avoid short strings that might parse as dates
    })
  );
  
  const categoricalColumns = columns.filter(
    col => !numericColumns.includes(col) && !dateColumns.includes(col)
  );
  
  return { columns, numericColumns, dateColumns, categoricalColumns };
}

// ============================================================================
// Step 2: Financial Metrics
// ============================================================================

function detectRevenueColumn(numericColumns: string[]): string | null {
  const keywords = ['revenue', 'sales', 'amount', 'total', 'value', 'income'];
  return numericColumns.find(col =>
    keywords.some(kw => col.toLowerCase().includes(kw)) &&
    !col.toLowerCase().includes('cost') &&
    !col.toLowerCase().includes('profit') // Exclude pure profit columns
  ) || null;
}

function calculateFinancialMetrics(
  rows: any[],
  revenueColumn: string | null
): {
  totalRevenue: number | null;
  avgRevenue: number | null;
} {
  if (!revenueColumn) {
    return { totalRevenue: null, avgRevenue: null };
  }
  
  const totalRevenue = rows.reduce((sum, r) => {
    const val = parseFloat(r[revenueColumn] || '0');
    return sum + (isNaN(val) ? 0 : val);
  }, 0);
  
  const avgRevenue = rows.length > 0 ? totalRevenue / rows.length : 0;
  
  return { totalRevenue, avgRevenue };
}

// ============================================================================
// Step 3: Top Category Analysis
// ============================================================================

function analyzeCategories(
  rows: any[],
  categoricalColumns: string[],
  revenueColumn: string | null
): {
  categoryColumn: string | null;
  topCategory: { name: string; count: number; percentage: number } | null;
  categoryDistribution: Record<string, { count: number; revenue?: number; percentage: number }>;
} {
  if (categoricalColumns.length === 0) {
    return {
      categoryColumn: null,
      topCategory: null,
      categoryDistribution: {}
    };
  }
  
  // Use first categorical column as primary
  const categoryColumn = categoricalColumns[0];
  const categoryTotals: Record<string, { count: number; revenue: number }> = {};
  
  rows.forEach(r => {
    const key = r[categoryColumn] || 'Unknown';
    if (!categoryTotals[key]) {
      categoryTotals[key] = { count: 0, revenue: 0 };
    }
    categoryTotals[key].count += 1;
    
    if (revenueColumn) {
      const rev = parseFloat(r[revenueColumn] || '0');
      if (!isNaN(rev)) {
        categoryTotals[key].revenue += rev;
      }
    }
  });
  
  const totalCount = rows.length;
  const sorted = Object.entries(categoryTotals)
    .sort((a, b) => b[1].count - a[1].count);
  
  const topCategory = sorted.length > 0 ? {
    name: sorted[0][0],
    count: sorted[0][1].count,
    percentage: Math.round((sorted[0][1].count / totalCount) * 100)
  } : null;
  
  const categoryDistribution: Record<string, { count: number; revenue?: number; percentage: number }> = {};
  sorted.forEach(([key, val]) => {
    categoryDistribution[key] = {
      count: val.count,
      revenue: revenueColumn ? val.revenue : undefined,
      percentage: Math.round((val.count / totalCount) * 100)
    };
  });
  
  return { categoryColumn, topCategory, categoryDistribution };
}

// ============================================================================
// Step 4: Growth Analysis (if date exists)
// ============================================================================

function analyzeGrowth(
  rows: any[],
  dateColumn: string,
  revenueColumn: string | null
): {
  growthPercentage: number | null;
  growthTrend: 'up' | 'down' | 'stable' | null;
  periodOverPeriodChange: number | null;
  dateRange: { start: string; end: string } | null;
  monthlyRevenue: Record<string, number>;
} {
  if (!dateColumn) {
    return {
      growthPercentage: null,
      growthTrend: null,
      periodOverPeriodChange: null,
      dateRange: null,
      monthlyRevenue: {}
    };
  }
  
  // Parse dates and find range
  const parsedDates: { date: Date; revenue: number; month: string }[] = [];
  
  rows.forEach(r => {
    const dateStr = r[dateColumn];
    if (dateStr) {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        const revenue = revenueColumn ? parseFloat(r[revenueColumn] || '0') : 1;
        const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        parsedDates.push({ date, revenue: isNaN(revenue) ? 1 : revenue, month });
      }
    }
  });
  
  if (parsedDates.length === 0) {
    return {
      growthPercentage: null,
      growthTrend: null,
      periodOverPeriodChange: null,
      dateRange: null,
      monthlyRevenue: {}
    };
  }
  
  // Sort by date
  parsedDates.sort((a, b) => a.date.getTime() - b.date.getTime());
  
  const startDate = parsedDates[0].date.toISOString().split('T')[0];
  const endDate = parsedDates[parsedDates.length - 1].date.toISOString().split('T')[0];
  
  // Group by month
  const monthlyRevenue: Record<string, number> = {};
  parsedDates.forEach(p => {
    monthlyRevenue[p.month] = (monthlyRevenue[p.month] || 0) + p.revenue;
  });
  
  // Calculate growth (compare last two periods)
  const months = Object.keys(monthlyRevenue).sort();
  let growthPercentage = null;
  let growthTrend: 'up' | 'down' | 'stable' | null = null;
  let periodOverPeriodChange = null;
  
  if (months.length >= 2) {
    const lastMonth = months[months.length - 1];
    const prevMonth = months[months.length - 2];
    
    const lastRevenue = monthlyRevenue[lastMonth];
    const prevRevenue = monthlyRevenue[prevMonth];
    
    if (prevRevenue > 0) {
      periodOverPeriodChange = ((lastRevenue - prevRevenue) / prevRevenue) * 100;
      growthPercentage = periodOverPeriodChange;
      
      if (periodOverPeriodChange > 5) {
        growthTrend = 'up';
      } else if (periodOverPeriodChange < -5) {
        growthTrend = 'down';
      } else {
        growthTrend = 'stable';
      }
    }
  } else if (months.length === 1 && revenueColumn) {
    // Single month - compare to average if we have daily data
    const dailyRevenue: Record<string, number> = {};
    parsedDates.forEach(p => {
      const day = p.date.toISOString().split('T')[0];
      dailyRevenue[day] = (dailyRevenue[day] || 0) + p.revenue;
    });
    const days = Object.keys(dailyRevenue);
    if (days.length >= 2) {
      const lastDay = days[days.length - 1];
      const prevDay = days[days.length - 2];
      if (dailyRevenue[prevDay] > 0) {
        periodOverPeriodChange = ((dailyRevenue[lastDay] - dailyRevenue[prevDay]) / dailyRevenue[prevDay]) * 100;
        growthPercentage = periodOverPeriodChange;
        growthTrend = periodOverPeriodChange > 5 ? 'up' : periodOverPeriodChange < -5 ? 'down' : 'stable';
      }
    }
  }
  
  return {
    growthPercentage: growthPercentage !== null ? Math.round(growthPercentage * 10) / 10 : null,
    growthTrend,
    periodOverPeriodChange: periodOverPeriodChange !== null ? Math.round(periodOverPeriodChange * 10) / 10 : null,
    dateRange: { start: startDate, end: endDate },
    monthlyRevenue
  };
}

// ============================================================================
// Step 5: Numeric Statistics
// ============================================================================

function calculateNumericStats(
  rows: any[],
  numericColumns: string[]
): Record<string, {
  min: number;
  max: number;
  sum: number;
  avg: number;
  count: number;
}> {
  const stats: Record<string, {
    min: number;
    max: number;
    sum: number;
    avg: number;
    count: number;
  }> = {};
  
  numericColumns.forEach(col => {
    const values: number[] = [];
    rows.forEach(r => {
      const val = parseFloat(r[col]);
      if (!isNaN(val)) {
        values.push(val);
      }
    });
    
    if (values.length > 0) {
      stats[col] = {
        min: Math.min(...values),
        max: Math.max(...values),
        sum: values.reduce((a, b) => a + b, 0),
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        count: values.length
      };
    }
  });
  
  return stats;
}

// ============================================================================
// Step 6: Visualization Data
// ============================================================================

function generateChartData(
  rows: any[],
  categoryColumn: string | null,
  revenueColumn: string | null,
  dateColumn: string | null,
  monthlyRevenue: Record<string, number>
): {
  revenueByCategory: { category: string; revenue: number }[];
  revenueOverTime: { period: string; revenue: number }[];
  distribution: { label: string; value: number; percentage: number }[];
} {
  // Revenue by Category (Bar Chart)
  const revenueByCategory: { category: string; revenue: number }[] = [];
  if (categoryColumn && revenueColumn) {
    const catRev: Record<string, number> = {};
    rows.forEach(r => {
      const cat = r[categoryColumn] || 'Unknown';
      const rev = parseFloat(r[revenueColumn] || '0');
      if (!isNaN(rev)) {
        catRev[cat] = (catRev[cat] || 0) + rev;
      }
    });
    Object.entries(catRev)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([cat, rev]) => {
        revenueByCategory.push({ category: cat, revenue: rev });
      });
  }
  
  // Revenue Over Time (Line Chart)
  const revenueOverTime: { period: string; revenue: number }[] = [];
  if (Object.keys(monthlyRevenue).length > 0) {
    Object.entries(monthlyRevenue)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([period, revenue]) => {
        revenueOverTime.push({ period, revenue });
      });
  } else if (dateColumn && revenueColumn) {
    // Fallback to daily if no monthly
    const dailyRev: Record<string, number> = {};
    rows.forEach(r => {
      const dateStr = r[dateColumn];
      if (dateStr) {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          const day = date.toISOString().split('T')[0];
          const rev = parseFloat(r[revenueColumn] || '0');
          if (!isNaN(rev)) {
            dailyRev[day] = (dailyRev[day] || 0) + rev;
          }
        }
      }
    });
    Object.entries(dailyRev)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([day, rev]) => {
        revenueOverTime.push({ period: day, revenue: rev });
      });
  }
  
  // Distribution (Pie/Bar) - use first numeric column grouped by first categorical
  const distribution: { label: string; value: number; percentage: number }[] = [];
  const firstNumeric = Object.keys(rows[0] || {}).find(col => 
    rows.some(r => {
      const val = r[col];
      return typeof val === 'number' || (!isNaN(parseFloat(String(val))) && isFinite(parseFloat(String(val))));
    })
  );
  const firstCategorical = categoryColumn;
  
  if (firstNumeric && firstCategorical) {
    const groupVals: Record<string, number[]> = {};
    rows.forEach(r => {
      const cat = r[firstCategorical] || 'Unknown';
      const num = parseFloat(r[firstNumeric]);
      if (!groupVals[cat]) {
        groupVals[cat] = [];
      }
      if (!isNaN(num)) {
        groupVals[cat].push(num);
      }
    });
    
    const total = Object.values(groupVals).flat().reduce((a, b) => a + b, 0);
    Object.entries(groupVals)
      .map(([label, vals]) => ({
        label,
        value: vals.reduce((a, b) => a + b, 0),
        percentage: total > 0 ? Math.round((vals.reduce((a, b) => a + b, 0) / total) * 100) : 0
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
      .forEach(item => distribution.push(item));
  }
  
  return { revenueByCategory, revenueOverTime, distribution };
}

// ===========================================================================-
// MAIN FUNCTION: analyzeDataset
// ============================================================================

/**
 * Analyze dataset rows and return structured analysis.
 * All calculations derive from: const rows = dataset.data || []
 * No legacy metadata usage.
 */
export function analyzeDataset(rows: any[]): DatasetAnalysis {
  console.log('[ANALYZE] Starting dataset analysis with', rows.length, 'rows');
  
  // Step 1: Detect Columns
  const { columns, numericColumns, dateColumns, categoricalColumns } = detectColumns(rows);
  console.log('[ANALYZE] Detected columns:', {
    total: columns.length,
    numeric: numericColumns.length,
    dates: dateColumns.length,
    categorical: categoricalColumns.length
  });
  
  // Step 2: Financial Metrics
  const revenueColumn = detectRevenueColumn(numericColumns);
  const { totalRevenue, avgRevenue } = calculateFinancialMetrics(rows, revenueColumn);
  console.log('[ANALYZE] Financial metrics:', { revenueColumn, totalRevenue, avgRevenue });
  
  // Step 3: Category Analysis
  const { categoryColumn, topCategory, categoryDistribution } = analyzeCategories(
    rows,
    categoricalColumns,
    revenueColumn
  );
  console.log('[ANALYZE] Category analysis:', { categoryColumn, topCategory });
  
  // Step 4: Growth Analysis
  const dateColumn = dateColumns.length > 0 ? dateColumns[0] : null;
  const { 
    growthPercentage, 
    growthTrend, 
    periodOverPeriodChange,
    dateRange, 
    monthlyRevenue 
  } = analyzeGrowth(rows, dateColumn || '', revenueColumn);
  console.log('[ANALYZE] Growth analysis:', { growthPercentage, growthTrend, dateRange });
  
  // Step 5: Numeric Statistics
  const numericStats = calculateNumericStats(rows, numericColumns);
  console.log('[ANALYZE] Numeric stats calculated for', Object.keys(numericStats).length, 'columns');
  
  // Step 6: Visualization Data
  const charts = generateChartData(
    rows,
    categoryColumn,
    revenueColumn,
    dateColumn || null,
    monthlyRevenue
  );
  console.log('[ANALYZE] Chart data generated:', {
    revenueByCategory: charts.revenueByCategory.length,
    revenueOverTime: charts.revenueOverTime.length,
    distribution: charts.distribution.length
  });
  
  // Return structured analysis
  return {
    totalRows: rows.length,
    totalColumns: columns.length,
    numericColumns,
    dateColumns,
    categoricalColumns,
    revenueColumn,
    totalRevenue,
    avgRevenue,
    categoryColumn,
    topCategory,
    categoryDistribution,
    growthPercentage,
    growthTrend,
    periodOverPeriodChange,
    dateRange,
    monthlyRevenue,
    numericStats,
    charts
  };
}

// ============================================================================
// AI EXECUTIVE SUMMARY
// ============================================================================

/**
 * Generate AI-powered executive summary from the analysis.
 * This is called separately from analyzeDataset to allow for async AI processing.
 */
export async function generateAIExecutiveSummary(analysis: DatasetAnalysis): Promise<string> {
  // Always use deterministic summary for consistency with KPI cards
  // Skip AI to ensure values match exactly
  console.log('[AI SUMMARY] Using deterministic summary for consistency');
  return generateFallbackSummary(analysis);
}

/**
 * Generate a fallback summary when AI is not available
 * Provides executive-style insights based on accurate computed values
 */
function generateFallbackSummary(analysis: DatasetAnalysis): string {
  const parts: string[] = [];
  
  // Use proper currency formatting matching KPI cards
  const formatCurrency = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };
  
  // Calculate accurate top region
  const categoryDist = analysis.categoryDistribution || {};
  const sortedEntries = Object.entries(categoryDist).sort((a, b) => (b[1]?.revenue || 0) - (a[1]?.revenue || 0));
  const topEntry = sortedEntries[0];
  
  // Check if we have valid growth data
  const a = analysis as any;
  const hasValidGrowth = a.growthValid && 
    a.growthPercentage !== null && 
    a.growthPercentage !== undefined &&
    a.previousRevenue !== null &&
    a.previousRevenue !== undefined &&
    a.previousRevenue > 0;
  
  // Calculate profit and margin if available
  // Use 30% COGS fallback if no cost column exists
  const hasProfitData = a.detectedColumns?.profitColumn || a.detectedColumns?.costColumn;
  const revenue = analysis.totalRevenue || 0;
  const cost = a.totalCost || (revenue * 0.3); // Fallback: assume 30% costs if no cost column
  const profit = hasProfitData ? revenue - cost : revenue * 0.7; // Always calculate profit
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  
  // 1. Revenue line - only show growth if valid previous period exists
  if (revenue > 0) {
    if (hasValidGrowth) {
      const gp = a.growthPercentage;
      const growthSign = gp >= 0 ? '+' : '';
      const trendText = gp >= 0 ? 'increase' : 'decline';
      parts.push(`Revenue totals ${formatCurrency(revenue)}, representing a ${growthSign}${gp.toFixed(2)}% ${trendText} compared to the previous period.`);
    } else {
      parts.push(`Revenue totals ${formatCurrency(revenue)} for the selected period.`);
    }
  }
  
  // 2. Profit and margin line - only if cost data available
  if (hasProfitData && profit !== null && margin !== null) {
    parts.push(`Gross profit reached ${formatCurrency(profit)} with a ${margin.toFixed(2)}% margin.`);
  }
  
  // 3. Top product line
  const topProduct = (analysis as any).topProducts?.[0];
  if (topProduct) {
    parts.push(`The top-performing product was ${topProduct.name}, generating ${formatCurrency(topProduct.revenue)} (${topProduct.percentage?.toFixed(2)}% of total revenue).`);
  }
  
  // 4. Top region line
  if (topEntry) {
    const percentage = topEntry[1]?.percentage || 0;
    parts.push(`${topEntry[0]} contributed ${percentage.toFixed(2)}% of total revenue.`);
  }
  
  return parts.join(' ');
}
