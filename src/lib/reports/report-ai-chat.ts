import { debugLog, debugError, debugWarn } from "@/lib/debug"

/**
 * Report AI Chat
 * 
 * Provides AI chat capabilities for report pages.
 * Uses only the stored report snapshot context - no access to full dataset.
 */

import { Report } from './report-generator';

export interface ReportChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ReportChatResult {
  response: string;
  sources?: string[];
}

/**
 * Generate a context prompt from the report snapshot
 */
function generateReportContext(report: Report): string {
  let context = `You are analyzing a shared report for dataset: ${report.datasetName}\n\n`;
  
  context += `DATASET INFO:\n`;
  context += `- Rows: ${report.rowCount.toLocaleString()}\n`;
  context += `- Columns: ${report.columnCount}\n`;
  context += `- Created: ${new Date(report.createdAt).toLocaleDateString()}\n\n`;
  
  context += `EXECUTIVE SUMMARY:\n${report.summary}\n\n`;
  
  if (report.findings && report.findings.length > 0) {
    context += `KEY FINDINGS:\n`;
    report.findings.forEach((finding, i) => {
      context += `${i + 1}. ${finding}\n`;
    });
    context += '\n';
  }
  
  if (report.kpis && report.kpis.length > 0) {
    context += `KEY METRICS:\n`;
    report.kpis.forEach(kpi => {
      context += `- ${kpi.title}: ${kpi.value}\n`;
    });
    context += '\n';
  }
  
  if (report.aiInsights && report.aiInsights.length > 0) {
    context += `AI INSIGHTS:\n`;
    report.aiInsights.forEach((insight, i) => {
      context += `${i + 1}. ${insight}\n`;
    });
    context += '\n';
  }
  
  if (report.charts && report.charts.length > 0) {
    context += `VISUALIZATIONS:\n`;
    report.charts.forEach(chart => {
      context += `- ${chart.title} (${chart.type})\n`;
      chart.data.slice(0, 5).forEach(item => {
        context += `  - ${item.name}: ${item.value}\n`;
      });
    });
    context += '\n';
  }
  
  if (report.predictions && report.predictions.length > 0) {
    context += `PREDICTIONS:\n`;
    report.predictions.forEach((pred, i) => {
      context += `${i + 1}. ${pred}\n`;
    });
    context += '\n';
  }
  
  if (report.alerts && report.alerts.length > 0) {
    context += `ALERTS:\n`;
    report.alerts.forEach(alert => {
      context += `- [${alert.severity}] ${alert.message}\n`;
    });
    context += '\n';
  }
  
  context += `IMPORTANT: You must only answer questions based on the report data above. `;
  context += `Do not mention that you don't have access to the full dataset. `;
  context += `If a question cannot be answered from the report, explain what's available in the report.`;
  
  return context;
}

/**
 * Answer a question about the report
 */
export async function answerReportQuestion(
  report: Report,
  question: string
): Promise<ReportChatResult> {
  const context = generateReportContext(report);
  
  const prompt = `${context}\n\nUSER QUESTION:\n${question}\n\n`;
  
  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        columns: [],
        sampleData: [],
        rowCount: report.rowCount
      })
    });
    
    if (response.ok) {
      const text = await response.text();
      return {
        response: text,
        sources: ['Executive Summary', 'Findings', 'KPIs', 'Insights']
      };
    }
  } catch (error) {
    debugError('[REPORT-CHAT] Error:', error);
  }
  
  // Fallback response
  return {
    response: `I can help you understand the report "${report.datasetName}". ` +
      `The report includes ${report.findings?.length || 0} key findings, ` +
      `${report.kpis?.length || 0} metrics, and ${report.charts?.length || 0} visualizations. ` +
      `What would you like to know about this analysis?`,
    sources: []
  };
}

/**
 * Generate suggested questions for the report
 */
export function generateReportSuggestions(report: Report): string[] {
  const suggestions: string[] = [];
  
  // Dataset overview
  suggestions.push(`What is the main insight from this report?`);
  
  // KPIs
  if (report.kpis && report.kpis.length > 0) {
    suggestions.push(`What do the key metrics show?`);
  }
  
  // Findings
  if (report.findings && report.findings.length > 0) {
    suggestions.push(`Summarize the key findings`);
  }
  
  // Charts
  if (report.charts && report.charts.length > 0) {
    suggestions.push(`What trends are visible in the charts?`);
  }
  
  // Predictions
  if (report.predictions && report.predictions.length > 0) {
    suggestions.push(`What predictions were made?`);
  }
  
  // Alerts
  if (report.alerts && report.alerts.length > 0) {
    suggestions.push(`What alerts should I be aware of?`);
  }
  
  // Return top 4 suggestions
  return suggestions.slice(0, 4);
}
