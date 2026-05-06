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
  generatedAt: string;
}

/**
 * Generate suggested questions based on dataset intelligence
 */
export function generateSuggestions(intelligence: DatasetIntelligence): string[] {
  const suggestions: string[] = [];
  const dims = intelligence.dimensions;
  const cols = intelligence.schema.columns;
  const numericCols = intelligence.metrics.numericColumns;
  
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
  
  // Remove duplicates and limit to 6
  const uniqueSuggestions = [...new Set(suggestions)].slice(0, 6);
  
  return uniqueSuggestions;
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
  const numericColumns = columns.filter(col => columnStats[col]?.type === 'numeric');
  const categoricalColumns = columns.filter(col => columnStats[col]?.type === 'categorical');
  const dateColumns = columns.filter(col => columnStats[col]?.type === 'date');
  
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
    timeColumns: detectTimeColumns(columns, columnStats),
    categoryColumns: detectCategoryColumns(columns, columnStats),
    numericMetrics: detectNumericMetrics(columns, columnStats),
    geographicColumns: detectGeographicColumns(columns)
  };
  
  // 4. Generate insights
  const insights = generateInsights(data, columns, columnStats, dimensions);
  
  // 5. Return complete intelligence
  return {
    schema,
    metrics,
    dimensions,
    insights,
    generatedAt: new Date().toISOString()
  };
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
  
  return parts.join('\n');
}
