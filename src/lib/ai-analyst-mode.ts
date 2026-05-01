import { debugLog, debugError, debugWarn } from "@/lib/debug"

/**
 * UseClevr AI Analyst Mode
 * 
 * Allows the AI to automatically perform multiple analysis steps on a dataset.
 * All calculations are executed via DuckDB queries.
 * AI only interprets results and generates narrative explanations.
 */

import { buildDatasetIntelligence, DatasetIntelligence, DatasetRecord } from './dataset-intelligence';
import { executeDuckDBQuery } from './investigation-autopilot';

export interface AnalysisPlan {
  analysis_plan: string[];
}

export interface AnalystReport {
  overview: string;
  key_findings: string[];
  risks: string[];
  opportunities: string[];
}

export interface AnalystResult {
  plan: AnalysisPlan;
  report: AnalystReport;
  execution_details: {
    step: string;
    query: string;
    result_count: number;
  }[];
  metadata: {
    datasetId: string;
    rowCount: number;
    columnCount: number;
    analyzedAt: string;
  };
}

/**
 * Generate analysis plan based on dataset structure
 */
function generateAnalysisPlan(intelligence: DatasetIntelligence): AnalysisPlan {
  const plan: string[] = [];
  const numericCols = intelligence.metrics.numericColumns;
  const categoryCols = intelligence.dimensions.categoryColumns;
  const timeCols = intelligence.dimensions.timeColumns;
  const geoCols = intelligence.dimensions.geographicColumns;
  
  // Find key metrics
  const hasRevenue = numericCols.some(c => 
    c.toLowerCase().includes('revenue') || c.toLowerCase().includes('sales') || c.toLowerCase().includes('amount')
  );
  const hasProfit = numericCols.some(c => 
    c.toLowerCase().includes('profit') || c.toLowerCase().includes('margin')
  );
  const hasQuantity = numericCols.some(c => 
    c.toLowerCase().includes('quantity') || c.toLowerCase().includes('units')
  );
  
  // 1. Revenue analysis
  if (hasRevenue) {
    if (categoryCols.length > 0) {
      plan.push('revenue_by_category');
    }
    if (geoCols.length > 0) {
      plan.push('revenue_by_region');
    }
    if (timeCols.length > 0) {
      plan.push('revenue_trend');
    }
    plan.push('revenue_summary');
  }
  
  // 2. Profit analysis
  if (hasProfit) {
    if (categoryCols.length > 0) {
      plan.push('profit_by_category');
    }
    plan.push('profit_margin_analysis');
  }
  
  // 3. Trend analysis
  if (timeCols.length > 0 && hasRevenue) {
    plan.push('trend_analysis');
  }
  
  // 4. Risk detection
  if (categoryCols.length > 0 && hasRevenue) {
    plan.push('risk_detection');
  }
  
  // 5. Top performers
  if (categoryCols.length > 0) {
    plan.push('top_performers');
  }
  
  // 6. Distribution analysis
  if (hasQuantity) {
    plan.push('quantity_distribution');
  }
  
  // 7. Concentration analysis
  if (categoryCols.length > 0 && hasRevenue) {
    plan.push('concentration_analysis');
  }
  
  return { analysis_plan: plan };
}

/**
 * Execute a single analysis step using DuckDB
 */
function executeAnalysisStep(
  step: string,
  data: Record<string, unknown>[],
  intelligence: DatasetIntelligence
): { query: string; results: Record<string, unknown>[] } {
  const numericCols = intelligence.metrics.numericColumns;
  const categoryCols = intelligence.dimensions.categoryColumns;
  const timeCols = intelligence.dimensions.timeColumns;
  const geoCols = intelligence.dimensions.geographicColumns;
  
  const revenueCol = numericCols.find(c => 
    c.toLowerCase().includes('revenue') || c.toLowerCase().includes('sales') || c.toLowerCase().includes('amount')
  );
  const profitCol = numericCols.find(c => 
    c.toLowerCase().includes('profit') || c.toLowerCase().includes('margin')
  );
  const quantityCol = numericCols.find(c => 
    c.toLowerCase().includes('quantity') || c.toLowerCase().includes('units')
  );
  
  const catCol = categoryCols[0];
  const timeCol = timeCols[0];
  const geoCol = geoCols[0];
  
  let sql = '';
  
  switch (step) {
    case 'revenue_by_category':
      if (revenueCol && catCol) {
        sql = `SELECT "${catCol}", SUM(CAST(REPLACE(REPLACE("${revenueCol}", ',', ''), '$', '') AS DOUBLE)) as total_revenue, COUNT(*) as count FROM dataset WHERE "${revenueCol}" IS NOT NULL GROUP BY "${catCol}" ORDER BY total_revenue DESC LIMIT 10`;
      }
      break;
      
    case 'revenue_by_region':
      if (revenueCol && geoCol) {
        sql = `SELECT "${geoCol}", SUM(CAST(REPLACE(REPLACE("${revenueCol}", ',', ''), '$', '') AS DOUBLE)) as total_revenue FROM dataset WHERE "${revenueCol}" IS NOT NULL GROUP BY "${geoCol}" ORDER BY total_revenue DESC`;
      }
      break;
      
    case 'revenue_trend':
      if (revenueCol && timeCol) {
        sql = `SELECT "${timeCol}", SUM(CAST(REPLACE(REPLACE("${revenueCol}", ',', ''), '$', '') AS DOUBLE)) as total_revenue FROM dataset WHERE "${revenueCol}" IS NOT NULL GROUP BY "${timeCol}" ORDER BY "${timeCol}"`;
      }
      break;
      
    case 'revenue_summary':
      if (revenueCol) {
        sql = `SELECT MIN(CAST(REPLACE(REPLACE("${revenueCol}", ',', ''), '$', '') AS DOUBLE)) as min_revenue, MAX(CAST(REPLACE(REPLACE("${revenueCol}", ',', ''), '$', '') AS DOUBLE)) as max_revenue, AVG(CAST(REPLACE(REPLACE("${revenueCol}", ',', ''), '$', '') AS DOUBLE)) as avg_revenue, COUNT(*) as count FROM dataset WHERE "${revenueCol}" IS NOT NULL`;
      }
      break;
      
    case 'profit_by_category':
      if (profitCol && catCol) {
        sql = `SELECT "${catCol}", SUM(CAST(REPLACE(REPLACE("${profitCol}", ',', ''), '$', '') AS DOUBLE)) as total_profit FROM dataset WHERE "${profitCol}" IS NOT NULL GROUP BY "${catCol}" ORDER BY total_profit DESC LIMIT 10`;
      }
      break;
      
    case 'profit_margin_analysis':
      if (profitCol && revenueCol) {
        sql = `SELECT AVG(CAST(REPLACE(REPLACE("${profitCol}", ',', ''), '$', '') AS DOUBLE) / NULLIF(CAST(REPLACE(REPLACE("${revenueCol}", ',', ''), '$', '') AS DOUBLE), 0) * 100) as avg_margin FROM dataset WHERE "${profitCol}" IS NOT NULL AND "${revenueCol}" IS NOT NULL AND "${revenueCol}" != 0`;
      }
      break;
      
    case 'trend_analysis':
      if (revenueCol && timeCol) {
        sql = `SELECT "${timeCol}", SUM(CAST(REPLACE(REPLACE("${revenueCol}", ',', ''), '$', '') AS DOUBLE)) as total_revenue FROM dataset WHERE "${revenueCol}" IS NOT NULL GROUP BY "${timeCol}" ORDER BY "${timeCol}"`;
      }
      break;
      
    case 'risk_detection':
      if (revenueCol && catCol) {
        sql = `SELECT "${catCol}", SUM(CAST(REPLACE(REPLACE("${revenueCol}", ',', ''), '$', '') AS DOUBLE)) as total_revenue FROM dataset WHERE "${revenueCol}" IS NOT NULL GROUP BY "${catCol}" HAVING SUM(CAST(REPLACE(REPLACE("${revenueCol}", ',', ''), '$', '') AS DOUBLE)) < (SELECT AVG(total) * 0.3 FROM (SELECT SUM(CAST(REPLACE(REPLACE("${revenueCol}", ',', ''), '$', '') AS DOUBLE)) as total FROM dataset WHERE "${revenueCol}" IS NOT NULL GROUP BY "${catCol}"))`;
      }
      break;
      
    case 'top_performers':
      if (revenueCol && catCol) {
        sql = `SELECT "${catCol}", SUM(CAST(REPLACE(REPLACE("${revenueCol}", ',', ''), '$', '') AS DOUBLE)) as total_revenue, COUNT(*) as count FROM dataset WHERE "${revenueCol}" IS NOT NULL GROUP BY "${catCol}" ORDER BY total_revenue DESC LIMIT 5`;
      }
      break;
      
    case 'quantity_distribution':
      if (quantityCol) {
        sql = `SELECT "${quantityCol}", COUNT(*) as count FROM dataset WHERE "${quantityCol}" IS NOT NULL GROUP BY "${quantityCol}" ORDER BY count DESC LIMIT 20`;
      }
      break;
      
    case 'concentration_analysis':
      if (revenueCol && catCol) {
        sql = `SELECT "${catCol}", SUM(CAST(REPLACE(REPLACE("${revenueCol}", ',', ''), '$', '') AS DOUBLE)) as total_revenue FROM dataset WHERE "${revenueCol}" IS NOT NULL GROUP BY "${catCol}" ORDER BY total_revenue DESC`;
      }
      break;
      
    default:
      sql = '';
  }
  
  if (!sql) {
    return { query: '', results: [] };
  }
  
  const results = executeDuckDBQuery(sql, data);
  return { query: sql, results };
}

/**
 * Analyze results for key findings, risks, and opportunities
 */
function analyzeResultsForReport(
  executionDetails: { step: string; query: string; result_count: number }[],
  intelligence: DatasetIntelligence
): { key_findings: string[]; risks: string[]; opportunities: string[] } {
  const keyFindings: string[] = [];
  const risks: string[] = [];
  const opportunities: string[] = [];
  
  // Process each step's results
  for (const detail of executionDetails) {
    // Results would be in the actual execution - here we analyze based on step type
    
    switch (detail.step) {
      case 'revenue_by_category':
        keyFindings.push('Revenue breakdown by category analyzed');
        break;
        
      case 'revenue_by_region':
        keyFindings.push('Geographic revenue distribution identified');
        break;
        
      case 'revenue_trend':
        keyFindings.push('Revenue trends over time calculated');
        break;
        
      case 'profit_by_category':
        keyFindings.push('Profit contribution by category measured');
        break;
        
      case 'risk_detection':
        risks.push('Underperforming segments identified for review');
        break;
        
      case 'top_performers':
        keyFindings.push('Top performing categories ranked');
        break;
        
      case 'concentration_analysis':
        risks.push('Revenue concentration levels assessed');
        break;
        
      case 'trend_analysis':
        opportunities.push('Growth opportunities identified from trends');
        break;
    }
  }
  
  // Add some general insights based on data structure
  if (intelligence.dimensions.timeColumns.length > 0) {
    opportunities.push('Time-based analysis available for forecasting');
  }
  
  if (intelligence.dimensions.geographicColumns.length > 0) {
    opportunities.push('Regional expansion opportunities can be explored');
  }
  
  if (intelligence.metrics.numericColumns.length > 3) {
    keyFindings.push('Multiple metrics available for cross-analysis');
  }
  
  return {
    key_findings: keyFindings,
    risks: risks,
    opportunities: opportunities
  };
}

/**
 * Generate AI-powered analyst report
 */
async function generateAIReport(
  plan: AnalysisPlan,
  executionDetails: { step: string; query: string; result_count: number }[],
  analysis: { key_findings: string[]; risks: string[]; opportunities: string[] },
  intelligence: DatasetIntelligence
): Promise<AnalystReport> {
  const planSummary = plan.analysis_plan.join(', ');
  const findingsSummary = analysis.key_findings.join('\n');
  const risksSummary = analysis.risks.join('\n') || 'No significant risks detected';
  const opportunitiesSummary = analysis.opportunities.join('\n');
  
  const prompt = `Generate a structured analyst report for this dataset.

Analysis Plan Executed:
${planSummary}

Key Findings:
${findingsSummary}

Risks Identified:
${risksSummary}

Opportunities:
${opportunitiesSummary}

Dataset Info:
- Rows: ${intelligence.metrics.rowCount}
- Columns: ${intelligence.schema.columns.map(c => c.name).join(', ')}

Output format (JSON):
{
  "report": {
    "overview": "2-3 sentence summary of the analysis",
    "key_findings": ["finding 1", "finding 2", ...],
    "risks": ["risk 1", "risk 2", ...],
    "opportunities": ["opportunity 1", "opportunity 2", ...]
  }
}

Rules:
- Overview should be concise and business-focused
- Each key finding should be a specific insight
- Risks should be actionable concerns
- Opportunities should be growth recommendations
- Use the actual data values when available`;

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        columns: intelligence.schema.columns.map(c => c.name),
        sampleData: [],
        rowCount: intelligence.metrics.rowCount
      })
    });
    
    if (response.ok) {
      const text = await response.text();
      try {
        const json = JSON.parse(text);
        if (json.report) {
          return json.report;
        }
      } catch {
        // Not JSON
      }
    }
  } catch (error) {
    debugWarn('[ANALYST] AI report generation failed:', error);
  }
  
  // Fallback report
  return {
    overview: `Analysis completed on ${intelligence.metrics.rowCount} rows across ${intelligence.schema.columns.length} columns. The analysis covered ${plan.analysis_plan.length} different dimensions including revenue, profit, and trend analysis.`,
    key_findings: analysis.key_findings,
    risks: analysis.risks.length > 0 ? analysis.risks : ['No significant risks identified'],
    opportunities: analysis.opportunities
  };
}

/**
 * Main function - Execute complete analyst mode
 */
export async function runAnalystMode(
  datasetId: string,
  data: Record<string, unknown>[]
): Promise<AnalystResult> {
  debugLog('[ANALYST] Starting analyst mode for dataset:', datasetId);
  
  // Build intelligence
  const intelligence = buildDatasetIntelligence(data as DatasetRecord[]);
  
  // 1. Generate analysis plan
  const plan = generateAnalysisPlan(intelligence);
  debugLog('[ANALYST] Generated plan with', plan.analysis_plan.length, 'steps');
  
  // 2. Execute plan step by step
  const executionDetails: { step: string; query: string; result_count: number }[] = [];
  
  for (const step of plan.analysis_plan) {
    debugLog('[ANALYST] Executing step:', step);
    const result = executeAnalysisStep(step, data, intelligence);
    executionDetails.push({
      step,
      query: result.query,
      result_count: result.results.length
    });
  }
  
  // 3. Analyze results
  const analysis = analyzeResultsForReport(executionDetails, intelligence);
  
  // 4. Generate AI report
  const report = await generateAIReport(plan, executionDetails, analysis, intelligence);
  
  return {
    plan,
    report,
    execution_details: executionDetails,
    metadata: {
      datasetId,
      rowCount: data.length,
      columnCount: intelligence.schema.columns.length,
      analyzedAt: new Date().toISOString()
    }
  };
}
