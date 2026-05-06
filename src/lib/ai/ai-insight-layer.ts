// ============================================================================
// AI INSIGHT LAYER - Deterministic AI Interpretation
// ============================================================================
// AI receives ONLY precomputed metrics JSON (never raw data).
// AI explains numbers, does NOT compute them.
//
// Allowed:
// - Generate explanations
// - Key takeaways
// - Recommendations
// - Risk highlights
// - Summaries
//
// NOT Allowed:
// - Calculate totals
// - Calculate averages
// - Invent percentages
// - Infer metrics from preview rows
// - Produce business numbers outside deterministic metrics
// ============================================================================

import {
  PrecomputedMetrics,
  AIInsightInput,
  AIInsightOutput,
  DriverDetectionResult,
} from './pipeline-types';
import { detectDrivers } from '../data/driver-detection-engine';

// ============================================================================
// CONVERT PRECOMPUTED METRICS TO AI INPUT
// ============================================================================

/**
 * Convert precomputed metrics to AI input format
 * @param metrics - Precomputed metrics (single source of truth)
 * @returns AI input with only deterministic values
 */
export function metricsToAIInput(metrics: PrecomputedMetrics): AIInsightInput {
  return {
    // Core metrics (deterministic)
    totalRevenue: metrics.totalRevenue,
    totalProfit: metrics.totalProfit,
    profitMargin: metrics.profitMargin,
    profitReliability: metrics.profitReliability,
    growthRate: metrics.growthRate,
    growthTrend: metrics.growthTrend,
    
    // Top performers
    topRegion: metrics.topRegions[0] ? {
      name: metrics.topRegions[0].name,
      percentage: metrics.topRegions[0].percentage,
    } : null,
    topProduct: metrics.topProducts[0] ? {
      name: metrics.topProducts[0].name,
      percentage: metrics.topProducts[0].percentage,
    } : null,
    
    // Data quality
    invalidRowCount: metrics.invalidRowCount,
    totalRowCount: metrics.fullDatasetRowCount,
    dataQualityIssue: metrics.cleaningStats.invalidRowPercentage > 10,
    
    // Date context
    dateRange: metrics.dateRange,
  };
}

// ============================================================================
// DRIVER DETECTION INTEGRATION
// ============================================================================

/**
 * Generate driver detection from precomputed metrics
 * This runs after full analysis to identify root causes of metric changes
 */
export function generateDriverDetection(metrics: PrecomputedMetrics): DriverDetectionResult {
  return detectDrivers(metrics);
}

/**
 * Get drivers formatted for AI consumption
 * Returns a simplified driver object suitable for AI interpretation
 */
export function driversToAIContext(drivers: DriverDetectionResult): string {
  if (!drivers || drivers.drivers.length === 0) {
    return "No significant drivers detected.";
  }

  const driverContexts = drivers.drivers.map(driver => {
    const metricLabel = {
      revenue: 'Revenue',
      profit: 'Profit',
      margin: 'Margin',
      growth: 'Growth Rate',
    }[driver.metric] || driver.metric;

    const direction = driver.direction === 'up' ? 'increased' : driver.direction === 'down' ? 'decreased' : 'stable';
    
    const topDrivers = driver.drivers.slice(0, 3).map(d => {
      const sign = d.percentage >= 0 ? '+' : '';
      return `${d.name} (${sign}${d.percentage.toFixed(1)}% contribution)`;
    }).join(', ');

    return `${metricLabel} ${direction} by ${driver.changePercent.toFixed(1)}%. Main drivers: ${topDrivers}.`;
  });

  return driverContexts.join(' ');
}

// ============================================================================
// RULE-BASED INSIGHTS (Fallback when LLM unavailable)
// ============================================================================

/**
 * Generate insights from precomputed metrics without LLM
 * Uses deterministic rules to generate explanations
 */
export function generateRuleBasedInsights(input: AIInsightInput): AIInsightOutput {
  const summary = generateSummary(input);
  const keyTakeaways = generateKeyTakeaways(input);
  const recommendations = generateRecommendations(input);
  const riskHighlights = generateRiskHighlights(input);

  return {
    summary,
    keyTakeaways,
    recommendations,
    riskHighlights,
    confidence: 'high', // Rule-based is deterministic
    generatedAt: new Date().toISOString(),
    modelVersion: 'rule-based-v1',
  };
}

// ============================================================================
// SUMMARY GENERATION
// ============================================================================

function generateSummary(input: AIInsightInput): string {
  const { totalRevenue, totalProfit, profitMargin, growthRate, growthTrend, dateRange } = input;
  
  const revenueStr = formatCurrency(totalRevenue);
  const profitStr = formatCurrency(totalProfit);
  const marginStr = profitMargin !== null ? `${profitMargin}%` : 'N/A';
  
  let summary = `This dataset contains ${input.totalRowCount.toLocaleString()} transactions. `;
  
  summary += `Total revenue is ${revenueStr} with ${profitStr} profit (${marginStr} margin).`;
  
  if (growthRate !== null && growthTrend) {
    const trendWord = growthTrend === 'up' ? 'increased' : growthTrend === 'down' ? 'decreased' : 'remained stable';
    summary += ` Revenue ${trendWord} by ${Math.abs(growthRate)}% over the analysis period.`;
  }
  
  if (dateRange) {
    summary += ` The data spans from ${dateRange.start} to ${dateRange.end}.`;
  }
  
  return summary;
}

// ============================================================================
// KEY TAKEAWAYS GENERATION
// ============================================================================

function generateKeyTakeaways(input: AIInsightInput): string[] {
  const takeaways: string[] = [];
  
  // Revenue takeaway
  takeaways.push(`Total revenue: ${formatCurrency(input.totalRevenue)}`);
  
  // Profit takeaway
  if (input.totalProfit !== 0) {
    const profitDirection = input.totalProfit > 0 ? 'profit' : 'loss';
    takeaways.push(`Net ${profitDirection}: ${formatCurrency(Math.abs(input.totalProfit))} (${input.profitMargin}% margin)`);
  }
  
  // Top region
  if (input.topRegion) {
    takeaways.push(`${input.topRegion.name} is the top-performing region at ${input.topRegion.percentage}% of revenue`);
  }
  
  // Top product
  if (input.topProduct) {
    takeaways.push(`${input.topProduct.name} is the top-selling product at ${input.topProduct.percentage}% of revenue`);
  }
  
  // Growth
  if (input.growthRate !== null) {
    const direction = input.growthRate > 0 ? 'growth' : 'decline';
    takeaways.push(`Revenue ${direction}: ${Math.abs(input.growthRate)}%`);
  }
  
  // Data quality warning
  if (input.dataQualityIssue) {
    takeaways.push(`Warning: ${input.invalidRowCount} rows (${((input.invalidRowCount / input.totalRowCount) * 100).toFixed(1)}%) have data quality issues`);
  }
  
  return takeaways;
}

// ============================================================================
// RECOMMENDATIONS GENERATION
// ============================================================================

function generateRecommendations(input: AIInsightInput): string[] {
  const recommendations: string[] = [];
  
  // Based on margin
  if (input.profitMargin !== null) {
    if (input.profitMargin < 10) {
      recommendations.push('Profit margin is low. Consider reviewing pricing strategy and cost structure.');
    } else if (input.profitMargin > 30) {
      recommendations.push('Strong profit margin indicates healthy business. Consider reinvesting in growth.');
    }
  }
  
  // Based on growth
  if (input.growthRate !== null && input.growthTrend === 'down') {
    recommendations.push('Revenue is declining. Review market conditions and customer retention strategies.');
  } else if (input.growthRate !== null && input.growthTrend === 'up') {
    recommendations.push('Positive growth trend. Capitalize on momentum with increased marketing.');
  }
  
  // Based on concentration risk
  if (input.topRegion && input.topRegion.percentage > 50) {
    recommendations.push(`High concentration in ${input.topRegion.name}. Diversify geographic presence to reduce risk.`);
  }
  
  if (input.topProduct && input.topProduct.percentage > 40) {
    recommendations.push(`Heavy reliance on ${input.topProduct.name}. Develop complementary products to reduce dependence.`);
  }
  
  // Based on data quality
  if (input.dataQualityIssue) {
    recommendations.push('Improve data collection processes to reduce quality issues.');
  }
  
  return recommendations;
}

// ============================================================================
// RISK HIGHLIGHTS GENERATION
// ============================================================================

function generateRiskHighlights(input: AIInsightInput): string[] {
  const risks: string[] = [];
  
  // Profit risk
  if (input.totalProfit < 0) {
    risks.push('Business is operating at a loss. Immediate action needed to reduce costs or increase revenue.');
  }
  
  // Concentration risk
  if (input.topRegion && input.topRegion.percentage > 60) {
    risks.push(`High regional concentration: ${input.topRegion.percentage}% of revenue from ${input.topRegion.name}`);
  }
  
  if (input.topProduct && input.topProduct.percentage > 50) {
    risks.push(`Product concentration risk: ${input.topProduct.percentage}% of revenue from ${input.topProduct.name}`);
  }
  
  // Growth risk
  if (input.growthTrend === 'down') {
    risks.push('Declining revenue trend. Investigate causes and implement corrective measures.');
  }
  
  // Data quality risk
  if (input.dataQualityIssue && (input.invalidRowCount / input.totalRowCount) > 0.2) {
    risks.push(`Critical data quality: ${((input.invalidRowCount / input.totalRowCount) * 100).toFixed(1)}% of data is invalid`);
  }
  
  return risks;
}

// ============================================================================
// FORMAT HELPERS
// ============================================================================

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${value.toFixed(2)}`;
}

// ============================================================================
// LLM-BASED INSIGHTS (When available)
// ============================================================================

/**
 * Generate AI prompt for LLM-based insights
 * Only sends precomputed metrics, never raw data
 */
export function generateAIInsightPrompt(
  input: AIInsightInput,
  driverContext?: string
): string {
  return `You are a business analyst AI. Generate insights based on the following precomputed metrics from a business dataset.

IMPORTANT: 
- Do NOT calculate any numbers yourself - only explain the metrics provided
- Do NOT reference raw data rows or preview data
- Focus on explaining what the numbers mean for the business
${driverContext ? `\nDRIVER ANALYSIS (Root Causes):\n${driverContext}\n` : ''}
PRECOMPUTED METRICS:
- Total Revenue: ${formatCurrency(input.totalRevenue)}
- Total Profit: ${formatCurrency(input.totalProfit)}
- Profit Margin: ${input.profitMargin !== null ? `${input.profitMargin}%` : 'N/A'}
- Growth Rate: ${input.growthRate !== null ? `${input.growthRate}%` : 'N/A'}
- Growth Trend: ${input.growthTrend || 'N/A'}
- Top Region: ${input.topRegion ? `${input.topRegion.name} (${input.topRegion.percentage}%)` : 'N/A'}
- Top Product: ${input.topProduct ? `${input.topProduct.name} (${input.topProduct.percentage}%)` : 'N/A'}
- Total Rows: ${input.totalRowCount.toLocaleString()}
- Invalid Rows: ${input.invalidRowCount.toLocaleString()}
- Date Range: ${input.dateRange ? `${input.dateRange.start} to ${input.dateRange.end}` : 'N/A'}

Generate:
1. A brief summary (2-3 sentences)
2. 3-5 key takeaways
3. 2-4 actionable recommendations
4. Any risk highlights

Respond in a structured format.`;
}

/**
 * Parse LLM response into structured output
 */
export function parseLLMResponse(response: string): Partial<AIInsightOutput> {
  const result: Partial<AIInsightOutput> = {
    generatedAt: new Date().toISOString(),
    modelVersion: 'llm-v1',
  };
  
  // Simple parsing - split by section headers
  const lines = response.split('\n');
  let currentSection = '';
  
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    
    if (lowerLine.includes('summary')) {
      currentSection = 'summary';
    } else if (lowerLine.includes('takeaway') || lowerLine.includes('key')) {
      currentSection = 'takeaways';
    } else if (lowerLine.includes('recommend')) {
      currentSection = 'recommendations';
    } else if (lowerLine.includes('risk')) {
      currentSection = 'risks';
    } else if (currentSection === 'summary' && line.trim()) {
      result.summary = (result.summary || '') + line.trim() + ' ';
    } else if (line.trim().startsWith('-') || line.trim().startsWith('•')) {
      const item = line.trim().replace(/^[-•]\s*/, '');
      
      if (currentSection === 'takeaways') {
        result.keyTakeaways = result.keyTakeaways || [];
        result.keyTakeaways.push(item);
      } else if (currentSection === 'recommendations') {
        result.recommendations = result.recommendations || [];
        result.recommendations.push(item);
      } else if (currentSection === 'risks') {
        result.riskHighlights = result.riskHighlights || [];
        result.riskHighlights.push(item);
      }
    }
  }
  
  // Clean up summary
  if (result.summary) {
    result.summary = result.summary.trim();
  }
  
  return result;
}
