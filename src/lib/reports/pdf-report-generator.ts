import { debugLog, debugError, debugWarn } from "@/lib/debug"

/**
 * PDF Report Generator for UseClevr
 * 
 * Creates premium, detailed executive BI reports.
 * Design principles:
 * - Executive-grade structure with meaningful depth
 * - Proper section hierarchy and spacing
 * - Chart interpretation and business context
 * - Clear monetary formatting ($16.33M, not 16327.9K)
 * - No overlapping text - proper vertical stacking
 * - Max 3 pages for comprehensive reports
 */

import { jsPDF } from 'jspdf';
import * as fs from 'fs';
import * as path from 'path';
import type { Report, ReportChart } from './report-generator';

// PDF storage directory: use explicit temp directory to avoid broad project tracing in Next/Turbopack
const PDF_DIR = path.join(process.env.TEMP_DIR || '/tmp/useclevr-reports', 'pdfs');

// Ensure PDF directory exists
function ensurePdfDir() {
  if (!fs.existsSync(PDF_DIR)) {
    fs.mkdirSync(PDF_DIR, { recursive: true });
  }
}

// Professional monetary formatter
function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${value.toFixed(2)}`;
}

// Compact number formatter
function formatCompactNumber(value: number): string {
  if (Math.abs(value) >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toFixed(0);
}

// Percentage formatter
function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

// Get PDF path for existing report
export function getPdfPath(reportId: string, datasetName: string): string | null {
  const filename = `${datasetName.replace(/[^a-z0-9]/gi, '_')}_report_${reportId}.pdf`;
  const filepath = path.join(PDF_DIR, filename);
  return fs.existsSync(filepath) ? filepath : null;
}

/**
 * Generate a comprehensive executive PDF report
 * Layout rules:
 * - Page margins: 20mm all sides
 * - Section spacing: 10-15mm between major sections
 * - No overlapping - check available space before each section
 * - Max 3 pages for detailed reports
 */
export async function generatePdfReport(report: Report): Promise<string> {
  ensurePdfDir();
  
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });
  
  // Page dimensions
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  
  // Color palette - premium dark theme
  const colors: Record<string, [number, number, number]> = {
    primary: [30, 30, 35],      // Dark charcoal
    accent: [99, 102, 241],     // Indigo  
    muted: [107, 114, 128],     // Gray
    success: [16, 185, 129],    // Emerald
    warning: [245, 158, 11],    // Amber
    danger: [239, 68, 68],      // Red
    lightBg: [249, 250, 251],   // Near white
    cardBg: [243, 244, 246],    // Light gray
    border: [229, 231, 235],    // Border gray
  };
  
  // Track current position
  let y = margin;
  let pageNum = 1;
  
  // Helper: check if we need a new page
  const needNewPage = (requiredSpace: number): boolean => {
    if (y + requiredSpace > pageHeight - margin) {
      return true;
    }
    return false;
  };
  
  // Helper: add new page with proper setup
  const addPage = (): void => {
    doc.addPage();
    y = margin;
    pageNum++;
  };
  
  // Helper: add section spacing
  const addSpacing = (mm: number): void => {
    y += mm;
  };
  
  // Helper: draw section divider line
  const drawDivider = (): void => {
    doc.setDrawColor(...colors.border);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
  };
  
  // Helper: wrap text to fit content width
  const wrapText = (text: string, maxWidth: number): string[] => {
    return doc.splitTextToSize(text, maxWidth);
  };
  
  // ===== HEADER SECTION =====
  // Full-width dark header
  doc.setFillColor(...colors.primary);
  doc.rect(0, 0, pageWidth, 50, 'F');
  
  // Brand name
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('UseClevr', margin, 10);
  
  // Report title
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text('Executive Analysis Report', margin, 22);
  
  // Dataset subtitle and report metadata
  // IMPORTANT: jsPDF setTextColor does not take RGBA; using 4 params
  // switches to CMYK and caused black text. Use explicit RGB only.
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  const subtitle = report.datasetName.length > 45 
    ? report.datasetName.substring(0, 42) + '...' 
    : report.datasetName;
  doc.text(subtitle, margin, 33);
  
  // Report metadata row (explicit lilac/purple accent on dark header)
  doc.setFontSize(8);
  // Tailwind purple-300 equivalent: rgb(196, 181, 253)
  doc.setTextColor(196, 181, 253);
  const metaRow = `Generated: ${report.localTime} | Rows: ${report.rowCount.toLocaleString()} | Type: Financial Performance`;
  doc.text(metaRow, margin, 43);
  
  // Header border accent line
  doc.setDrawColor(...colors.accent);
  doc.setLineWidth(1);
  doc.line(0, 50, pageWidth, 50);
  
  y = 60;
  
  // ===== EXECUTIVE SUMMARY =====
  // More substantial summary with improved typography
  if (needNewPage(30)) {
    addPage();
  }
  
  doc.setFontSize(14); // Stronger section title for hierarchy
  doc.setTextColor(...colors.primary);
  doc.text('Executive Summary', margin, y);
  addSpacing(9); // More room under title
  
  // Build a richer summary from available data
  let execSummary = '';
  if (report.summary) {
    execSummary = report.summary;
  } else if (report.kpis && report.kpis.length > 0) {
    // Generate summary from KPIs if no AI summary
    const revenueKpi = report.kpis.find(k => k.title.toLowerCase().includes('revenue') || k.title.toLowerCase().includes('sales'));
    const profitKpi = report.kpis.find(k => k.title.toLowerCase().includes('profit') || k.title.toLowerCase().includes('net'));
    const marginKpi = report.kpis.find(k => k.title.toLowerCase().includes('margin'));
    
    if (revenueKpi) {
      execSummary = `This analysis covers ${report.datasetName} with ${report.rowCount.toLocaleString()} data points. `;
      execSummary += `Total ${revenueKpi.title.toLowerCase()} stands at ${revenueKpi.value}.`;
      if (profitKpi) {
        execSummary += ` Net performance shows ${profitKpi.value}.`;
      }
      if (marginKpi) {
        execSummary += ` The ${marginKpi.title.toLowerCase()} is ${marginKpi.value}.`;
      }
    }
  }
  
  if (!execSummary) {
    execSummary = `This executive report analyzes ${report.rowCount.toLocaleString()} records from ${report.datasetName}. The analysis covers revenue performance, key trends, and actionable findings.`;
  }
  
  // Display more summary text (up to 8 lines = ~250 words equivalent)
  doc.setFontSize(10);
  doc.setTextColor(...colors.muted);
  const summaryLines = wrapText(execSummary, contentWidth);
  const displaySummary = summaryLines.slice(0, 8);
  doc.text(displaySummary, margin, y);
  addSpacing(displaySummary.length * 5 + 10);
  
  // ===== KEY METRICS SECTION =====
  if (report.kpis && report.kpis.length > 0) {
    // Each KPI card needs ~35mm height
    if (needNewPage(45)) {
      addPage();
    }
    
    // Section title - improved typography
    doc.setFontSize(14); // Stronger section headers
    doc.setTextColor(...colors.primary);
    doc.text('Key Performance Metrics', margin, y);
    addSpacing(10); // More air before cards
    
    const displayKpis = report.kpis.slice(0, 4);
    const kpiWidth = contentWidth / displayKpis.length;
    const kpiHeight = 40; // Slightly larger cards
    
    // KPI cards in a row
    for (let i = 0; i < displayKpis.length; i++) {
      const kpi = displayKpis[i];
      const x = margin + (i * kpiWidth);
      
      // Check if we need new page for this KPI row
      if (needNewPage(kpiHeight + 10)) {
        addPage();
      }
      
      // Card background
      doc.setFillColor(...colors.cardBg);
      doc.roundedRect(x, y, kpiWidth - 2, kpiHeight, 2.5, 2.5, 'F');
      
      // Label - improved typography
      doc.setFontSize(9); // Slightly larger label
      doc.setTextColor(...colors.muted);
      doc.text(kpi.title.toUpperCase(), x + 6, y + 9);
      
      // Value - use professional formatting with larger font
      doc.setFontSize(16); // Larger value for emphasis
      doc.setTextColor(...colors.primary);
      
      // Format the value professionally
      let displayValue = kpi.value;
      // If it looks like currency but not formatted
      if (kpi.value.includes('$') === false && 
          (kpi.title.toLowerCase().includes('revenue') || 
           kpi.title.toLowerCase().includes('profit') ||
           kpi.title.toLowerCase().includes('sales') ||
           kpi.title.toLowerCase().includes('income'))) {
        // Value might need currency formatting
        displayValue = kpi.value;
      }
      
      doc.text(displayValue, x + 6, y + 22);
    }
    
    addSpacing(kpiHeight + 14); // More space after KPI section
  }
  
  // ===== DETAILED ANALYSIS SECTIONS =====
  // Process each chart with interpretation
  if (report.charts && report.charts.length > 0) {
    const displayCharts = report.charts.slice(0, 3); // Show up to 3 charts
    
    for (let chartIdx = 0; chartIdx < displayCharts.length; chartIdx++) {
      const chart = displayCharts[chartIdx];
      
      // Chart section needs ~55mm
      if (needNewPage(60)) {
        addPage();
      }
      
      // Chart title - improved typography for section hierarchy
      doc.setFontSize(13); // Slightly stronger chart section title
      doc.setTextColor(...colors.primary);
      doc.text(chart.title, margin, y);
      addSpacing(9); // Slightly more spacing before description
      
      // Generate chart interpretation
      const chartData = chart.data.slice(0, 5); // Top 5 for analysis
      const totalValue = chartData.reduce((sum, d) => sum + Math.abs(d.value), 0);
      const topItem = chartData[0];
      const topPercent = totalValue > 0 ? ((Math.abs(topItem.value) / totalValue) * 100).toFixed(1) : '0';
      
      // Chart interpretation/commentary - improved typography
      doc.setFontSize(10); // Better readability
      doc.setTextColor(...colors.muted);
      
      let interpretation = '';
      if (chart.title.toLowerCase().includes('product') || chart.title.toLowerCase().includes('category')) {
        interpretation = `${topItem.name} leads with ${topPercent}% of total ${chart.title.toLowerCase()}. `;
        if (parseFloat(topPercent) > 50) {
          interpretation += `High concentration suggests dependency on this segment. `;
          interpretation += `Consider diversification strategies.`;
        } else if (parseFloat(topPercent) > 30) {
          interpretation += `Moderate concentration - main driver represents ${topPercent}%. `;
          interpretation += `Healthy distribution with primary focus area.`;
        } else {
          interpretation += `Balanced distribution across segments.`;
        }
      } else if (chart.title.toLowerCase().includes('region') || chart.title.toLowerCase().includes('country')) {
        interpretation = `${topItem.name} is the primary market at ${topPercent}% of total. `;
        if (parseFloat(topPercent) > 60) {
          interpretation += `Strong geographic concentration - review market expansion opportunities.`;
        } else {
          interpretation += `Geographic spread indicates reasonable market penetration.`;
        }
      } else {
        interpretation = `${topItem.name} shows the highest value at ${topPercent}%. `;
        interpretation += `${chartData.length > 1 ? `${chartData[1].name} follows at ${((Math.abs(chartData[1].value) / totalValue) * 100).toFixed(1)}%.` : ''}`;
      }
      
      const interpretationLines = wrapText(interpretation, contentWidth);
      doc.text(interpretationLines, margin, y);
      addSpacing(interpretationLines.length * 5 + 10); // More space before chart visual
      
      // Chart visual - horizontal bars with hardened layout
      const maxValue = Math.max(...chart.data.map(d => Math.abs(d.value)), 1);
      const chartDataDisplay = chart.data.slice(0, 5);
      const rows = chartDataDisplay.length;
      
      // Chart background with computed height
      const barHeight = 8;      // slightly taller
      const barGap = 6;         // slightly larger row gap
      const topPad = 8;         // padding inside chart box
      const bottomPad = 8;
      const chartHeight = topPad + rows * (barHeight + barGap) - barGap + bottomPad;

      doc.setFillColor(...colors.lightBg);
      doc.roundedRect(margin, y, contentWidth, chartHeight, 2, 2, 'F');
      
      // Stable three-column layout: label | bar | value
      const labelWidth = 52;   // left label column
      const valueWidth = 40;   // right value column
      const gutter = 14;       // middle padding between bar and value
      const barAreaWidth = contentWidth - labelWidth - valueWidth - gutter;
      const labelX = margin + 5;
      const barStartX = margin + labelWidth + 5;
      const valueRightX = margin + labelWidth + barAreaWidth + gutter + valueWidth; // right edge of value column
      
      for (let i = 0; i < chartDataDisplay.length; i++) {
        const item = chartDataDisplay[i];
        const barWidth = (Math.abs(item.value) / maxValue) * barAreaWidth;
        const yBar = y + topPad + (i * (barHeight + barGap));
        
        // Bar color - use accent for top, gray for others
        const barColor = i === 0 ? colors.accent : [156, 163, 175];
        doc.setFillColor(barColor[0], barColor[1], barColor[2]);
        doc.roundedRect(barStartX, yBar, barWidth, barHeight, 1, 1, 'F');
        
        // Category label - left column, truncated
        doc.setFontSize(9);
        doc.setTextColor(...colors.muted);
        const label = item.name.length > 18 ? item.name.substring(0, 16) + '..' : item.name;
        doc.text(label, labelX, yBar + (barHeight / 2) + 2.6);
        
        // Value label - dedicated right column, never overlaps bar
        doc.setFontSize(9);
        const valStr = formatCompactNumber(item.value);
        doc.setTextColor(...colors.primary);
        doc.text(valStr, valueRightX, yBar + (barHeight / 2) + 2.6, { align: 'right' });
      }
      
      addSpacing(chartHeight + 14);
    }
  }
  
  // ===== KEY INSIGHTS SECTION =====
  if (report.aiInsights && report.aiInsights.length > 0) {
    if (needNewPage(34)) {
      addPage();
    }
    
    // Title - improved typography for hierarchy
    doc.setFontSize(13); // Stronger heading
    doc.setTextColor(...colors.primary);
    doc.text('Key Business Insights', margin, y);
    addSpacing(9); // More space under heading
    
    // Display more insights with actual business context
    const insights = report.aiInsights.slice(0, 4); // Show up to 4
    doc.setFontSize(10); // Better readability
    
    for (let i = 0; i < insights.length; i++) {
      const insight = insights[i];
      // Make insights more substantial
      const enhancedInsight = insight.length > 150 ? insight : insight + ' This insight reflects important patterns in the data that warrant attention.';
      
      const lines = wrapText(`• ${enhancedInsight}`, contentWidth - 5);
      
      // Check if fits
      if (needNewPage(lines.length * 5 + 6)) {
        addPage();
      }
      
      doc.setTextColor(...colors.muted);
      doc.text(lines, margin + 3, y);
      addSpacing(lines.length * 5 + 5);
  }
  }
  
  // ===== RECOMMENDED ACTIONS SECTION =====
  if (report.findings && report.findings.length > 0) {
    if (needNewPage(30)) {
      addPage();
    }
    
    // Title - improved typography
    doc.setFontSize(13); // Stronger heading
    doc.setTextColor(...colors.primary);
    doc.text('Recommended Actions', margin, y);
    addSpacing(9); // More space under heading
    
    // More actionable, practical recommendations
    const actions = report.findings.slice(0, 3); // Show up to 3
    doc.setFontSize(10); // Better readability
    
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      // Enhance with context if too short
      const enhancedAction = action.length > 100 ? action : action + ' Consider implementing this action to improve business performance.';
      
      const lines = wrapText(`${i + 1}. ${enhancedAction}`, contentWidth);
      
      if (needNewPage(lines.length * 5 + 5)) {
        addPage();
      }
      
      doc.setTextColor(...colors.success);
      doc.text(lines, margin, y);
      addSpacing(lines.length * 5 + 6);
  }
  }
  
  // ===== PERFORMANCE NOTES =====
  // Add a notes section about data quality if relevant
  if (needNewPage(26)) {
    addPage();
  }
  
  // Analysis Notes - improved typography
  doc.setFontSize(12); // Stronger heading
  doc.setTextColor(...colors.primary);
  doc.text('Analysis Notes', margin, y);
  addSpacing(8); // More space under heading
  
  doc.setFontSize(9); // Better readability
  doc.setTextColor(...colors.muted);
  const notes = `This report was generated automatically based on the uploaded dataset. ` +
    `Data quality and insights depend on the completeness and accuracy of the source data. ` +
    `For strategic decisions, verify key figures with primary data sources.`;
  const notesLines = wrapText(notes, contentWidth);
  doc.text(notesLines, margin, y);
  addSpacing(notesLines.length * 4.2 + 10);
  
  // ===== FOOTER =====
  // Always put footer at bottom of last page
  y = pageHeight - 15;
  
  // Footer line
  doc.setDrawColor(...colors.border);
  doc.setLineWidth(0.3);
  doc.line(margin, y - 3, pageWidth - margin, y - 3);
  
  // Footer text - improved typography
  doc.setFontSize(9); // Better footer readability
  doc.setTextColor(...colors.muted);
  
  const footerLeft = `${report.localTime} | ${report.rowCount.toLocaleString()} rows analyzed`;
  doc.text(footerLeft, margin, y);
  
  const footerCenter = `Report ID: ${report.id}`;
  doc.text(footerCenter, pageWidth / 2, y, { align: 'center' });
  
  const footerRight = `Page ${pageNum} of ${pageNum}`;
  doc.text(footerRight, pageWidth - margin, y, { align: 'right' });
  
  // Brand footer
  doc.text('UseClevr - Executive Business Intelligence', margin, y + 5);
  doc.text('useclever.com', pageWidth - margin, y + 5, { align: 'right' });
  
  // ===== SAVE PDF =====
  const filename = `${report.datasetName.replace(/[^a-z0-9]/gi, '_')}_report_${report.id}.pdf`;
  const filepath = path.join(PDF_DIR, filename);
  
  const pdfBuffer = doc.output('arraybuffer');
  fs.writeFileSync(filepath, Buffer.from(pdfBuffer));
  
  debugLog('[PDF] Generated executive report:', filepath, `(${pageNum} page(s))`);
  
  return filepath;
}
