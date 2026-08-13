import { debugLog } from "@/lib/utils/debug";

import * as fs from "fs";
import { jsPDF } from "jspdf";
import * as path from "path";
import type { Report, ReportFinancials, ReportRecommendation } from "./report-generator";

const PDF_DIR = path.join(process.env.TEMP_DIR || "/tmp/useclevr-reports", "pdfs");

type Rgb = [number, number, number];
type PdfMetric = {
  title: string;
  value: string;
  accent: Rgb;
  missing?: string | null;
}

const colors = {
  navy: [9, 18, 38] as Rgb,
  navy2: [15, 23, 42] as Rgb,
  panel: [18, 31, 55] as Rgb,
  panel2: [30, 41, 59] as Rgb,
  text: [226, 232, 240] as Rgb,
  muted: [148, 163, 184] as Rgb,
  border: [51, 65, 85] as Rgb,
  cyan: [34, 211, 238] as Rgb,
  green: [52, 211, 153] as Rgb,
  violet: [167, 139, 250] as Rgb,
  amber: [251, 191, 36] as Rgb,
  red: [248, 113, 113] as Rgb,
  white: [255, 255, 255] as Rgb,
};

export function getPdfPath(reportId: string, datasetName: string): string | null {
  const filename = `${datasetName.replace(/[^a-z0-9]/gi, "_")}_report_${reportId}.pdf`;
  const filepath = path.join(PDF_DIR, filename);
  return fs.existsSync(filepath) ? filepath : null;
}

export async function generatePdfReport(report: Report): Promise<string> {
  ensurePdfDir();

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const reportTitle = report.reportType === "profitability"
    ? "Profitability Executive Report"
    : "Executive BI Report";
  const datasetName = cleanText(report.datasetName || "Selected dataset");
  const financials = normalizeFinancials(report);

  drawPageBackground(doc, pageWidth, pageHeight);
  drawHeader(doc, reportTitle, datasetName, pageWidth, margin);
  drawExecutiveOverview(doc, report, financials, margin, contentWidth);

  doc.addPage();
  drawPageBackground(doc, pageWidth, pageHeight);
  drawHeader(doc, "Financial Performance", datasetName, pageWidth, margin);
  drawFinancialPerformance(doc, financials, margin, contentWidth);

  doc.addPage();
  drawPageBackground(doc, pageWidth, pageHeight);
  drawHeader(doc, "Cost Intelligence", datasetName, pageWidth, margin);
  drawCostIntelligence(doc, financials, margin, contentWidth);

  doc.addPage();
  drawPageBackground(doc, pageWidth, pageHeight);
  drawHeader(doc, "Business Balanced Scorecard", datasetName, pageWidth, margin);
  drawBalancedScorecard(doc, report, margin, contentWidth);

  doc.addPage();
  drawPageBackground(doc, pageWidth, pageHeight);
  drawHeader(doc, "Executive Recommendations", datasetName, pageWidth, margin);
  drawRecommendations(doc, report, financials, margin, contentWidth);

  addFooters(doc, pageWidth, pageHeight, margin, report);

  const filename = `${report.datasetName.replace(/[^a-z0-9]/gi, "_")}_report_${report.id}.pdf`;
  const filepath = path.join(PDF_DIR, filename);
  const pdfBuffer = doc.output("arraybuffer");
  fs.writeFileSync(filepath, Buffer.from(pdfBuffer));

  debugLog("[PDF] Generated executive report:", filepath, `(${doc.getNumberOfPages()} page(s))`);
  return filepath;
}

function ensurePdfDir() {
  if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true });
}

function drawPageBackground(doc: jsPDF, pageWidth: number, pageHeight: number) {
  doc.setFillColor(...colors.navy);
  doc.rect(0, 0, pageWidth, pageHeight, "F");
  doc.setFillColor(11, 31, 52);
  doc.rect(0, 0, pageWidth, 30, "F");
  doc.setDrawColor(...colors.cyan);
  doc.setLineWidth(0.6);
  doc.line(0, 30, pageWidth, 30);
}

function drawHeader(doc: jsPDF, title: string, datasetName: string, pageWidth: number, margin: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...colors.cyan);
  doc.text("UseClevr", margin, 10);

  doc.setFontSize(19);
  doc.setTextColor(...colors.white);
  doc.text(cleanText(title), margin, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...colors.muted);
  doc.text(truncate(datasetName, 72), margin, 26);

  doc.setFillColor(...colors.violet);
  doc.roundedRect(pageWidth - margin - 24, 9, 24, 10, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...colors.navy);
  doc.text("BI REPORT", pageWidth - margin - 12, 15.6, { align: "center" });
}

function drawExecutiveOverview(doc: jsPDF, report: Report, financials: ReportFinancials, margin: number, contentWidth: number) {
  let y = 42;
  const dataConfidence = financials.dataConfidence ?? report.bbsc?.overallScore ?? null;
  const meta = [
    ["Reporting period", financials.reportingPeriod || "Not available"],
    ["Generated", cleanText(report.localTime)],
    ["Rows analyzed", report.rowCount.toLocaleString()],
    ["Data confidence", dataConfidence === null ? "Not available" : `${Math.round(dataConfidence)}/100`],
  ];
  drawInfoGrid(doc, meta, margin, y, contentWidth);
  y += 32;

  const score = report.bbsc?.overallScore === null || report.bbsc?.overallScore === undefined
    ? "Not available"
    : `${report.bbsc.overallScore}/100`;
  const scoreTitle = financials.netProfit === null || financials.grossProfit === null
    ? "Source Data Completeness"
    : "Profitability Health Score";
  const metrics: PdfMetric[] = [
    metric("Revenue", financials.revenue, "currency", colors.cyan),
    metric("Gross Profit", financials.grossProfit, "currency", colors.green, missingLabel(financials, "Gross Profit")),
    metric("Operating Profit", financials.operatingProfit, "currency", colors.violet, missingLabel(financials, "Operating Profit")),
    metric("Net Profit", financials.netProfit, "currency", colors.amber, missingLabel(financials, "Net Profit")),
    metric("Gross Margin", financials.grossMargin, "percent", colors.green, missingLabel(financials, "Gross Margin")),
    metric("Operating Margin", financials.operatingMargin, "percent", colors.violet, missingLabel(financials, "Operating Margin")),
    metric("Net Margin", financials.netMargin, "percent", colors.amber, missingLabel(financials, "Net Margin")),
    { title: scoreTitle, value: score, accent: colors.cyan, missing: score === "Not available" ? "Missing scorecard inputs" : null },
  ];
  drawMetricGrid(doc, metrics, margin, y, contentWidth, 4);
  y += 72;

  drawSectionTitle(doc, "Executive Summary", margin, y);
  y += 9;
  drawPanelText(doc, managementSummary(report, financials), margin, y, contentWidth, 48);
}

function drawFinancialPerformance(doc: jsPDF, financials: ReportFinancials, margin: number, contentWidth: number) {
  let y = 42;
  const metrics: PdfMetric[] = [
    metric("Revenue", financials.revenue, "currency", colors.cyan),
    metric("COGS", financials.cogs, "currency", colors.amber, missingLabel(financials, "COGS")),
    metric("Gross Profit", financials.grossProfit, "currency", colors.green, missingLabel(financials, "Gross Profit")),
    metric("Operating Expenses", financials.operatingExpenses, "currency", colors.amber, missingLabel(financials, "Operating Expenses")),
    metric("Operating Profit", financials.operatingProfit, "currency", colors.violet, missingLabel(financials, "Operating Profit")),
    metric("Interest Expense", financials.interestExpense, "currency", colors.amber, missingLabel(financials, "Interest Expense")),
    metric("Tax Expense", financials.taxExpense, "currency", colors.amber, missingLabel(financials, "Tax Expense")),
    metric("Net Profit", financials.netProfit, "currency", colors.green, missingLabel(financials, "Net Profit")),
  ];
  drawMetricGrid(doc, metrics, margin, y, contentWidth, 4);
  y += 72;

  drawSectionTitle(doc, "Revenue vs Expenses", margin, y);
  y += 8;
  drawHorizontalBars(doc, [
    { name: "Revenue", value: financials.revenue, color: colors.cyan },
    { name: "COGS", value: financials.cogs, color: colors.amber },
    { name: "Operating Expenses", value: financials.operatingExpenses, color: colors.violet },
    { name: "Interest + Tax", value: financials.interestExpense !== null && financials.taxExpense !== null ? financials.interestExpense + financials.taxExpense : null, color: colors.red },
  ], margin, y, contentWidth, true);
  y += 58;

  drawSectionTitle(doc, "Profit and Margin Trend", margin, y);
  y += 8;
  drawTrendPanel(doc, financials, margin, y, contentWidth);
}

function drawCostIntelligence(doc: jsPDF, financials: ReportFinancials, margin: number, contentWidth: number) {
  let y = 42;
  const categories = (financials.topCostCategories || []).slice(0, 8);
  const total = categories.reduce((sum, item) => sum + Math.max(0, item.value), 0);
  drawSectionTitle(doc, "Top Cost Categories", margin, y);
  y += 9;

  if (categories.length === 0) {
    drawPanelText(doc, "Top cost categories are not available. Missing field: expense category.", margin, y, contentWidth, 32);
    y += 40;
  } else {
    drawCostTable(doc, categories, total, margin, y, contentWidth);
    y += 84;
  }

  const top = categories[0];
  const share = top && total > 0 ? (top.value / total) * 100 : null;
  const concentration = share === null
    ? "Not available because expense category data is incomplete."
    : share >= 50
      ? `${top.name} represents ${share.toFixed(1)}% of categorized expenses, creating high concentration risk.`
      : `${top.name} represents ${share.toFixed(1)}% of categorized expenses, which indicates manageable concentration.`;
  drawSectionTitle(doc, "Management Interpretation", margin, y);
  y += 9;
  drawPanelText(doc, concentration, margin, y, contentWidth, 34);
  y += 43;

  drawSectionTitle(doc, "Cost Optimization Opportunities", margin, y);
  y += 9;
  const opportunity = top && total > 0
    ? `Start with ${top.name}. A 5% improvement in this category equals ${formatCurrency(top.value * 0.05)} before secondary effects. Review vendors, staffing, volume drivers, or pricing pass-through options.`
    : "Add categorized expense data to quantify cost optimization opportunities.";
  drawPanelText(doc, opportunity, margin, y, contentWidth, 38);
}

function drawBalancedScorecard(doc: jsPDF, report: Report, margin: number, contentWidth: number) {
  let y = 42;
  const bbsc = report.bbsc;
  if (!bbsc) {
    drawPanelText(doc, "Business Balanced Scorecard is not available because the report has no scorecard payload.", margin, y, contentWidth, 34);
    return;
  }

  drawMetricGrid(doc, [
    { title: "Overall Business Score", value: bbsc.overallScore === null ? "Not available" : `${bbsc.overallScore}/100`, accent: colors.cyan },
    { title: "Available Perspectives", value: `${bbsc.availablePerspectiveCount}/4`, accent: colors.violet },
    { title: "Strongest Perspective", value: bbsc.strongestPerspective?.shortTitle || "Not enough data", accent: colors.green },
    { title: "Weakest Perspective", value: bbsc.weakestPerspective?.shortTitle || "Not enough data", accent: colors.amber },
  ], margin, y, contentWidth, 4);
  y += 40;

  const perspectives = Object.values(bbsc.perspectives);
  for (const perspective of perspectives) {
    const height = 35;
    const x = margin + (perspectives.indexOf(perspective) % 2) * ((contentWidth - 4) / 2 + 4);
    if (perspectives.indexOf(perspective) === 2) y += height + 5;
    drawCard(doc, x, y, (contentWidth - 4) / 2, height, perspective.status === "available" ? colors.panel : colors.panel2);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...colors.text);
    doc.text(perspective.title, x + 5, y + 7);
    doc.setFontSize(15);
    doc.setTextColor(...(perspective.status === "available" ? colors.cyan : colors.muted));
    doc.text(perspective.score === null ? "Not available" : `${perspective.score}/100`, x + 5, y + 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...colors.muted);
    const note = perspective.status === "available"
      ? `${perspective.dataConfidence}% data confidence`
      : `Missing: ${perspective.requiredFields.slice(0, 3).join(", ")}`;
    doc.text(doc.splitTextToSize(cleanText(note), (contentWidth - 4) / 2 - 10).slice(0, 2), x + 5, y + 26);
  }
  y += 78;

  drawSectionTitle(doc, "Source Data Completeness", margin, y);
  y += 8;
  const excluded = bbsc.scoringInputs.excludedPerspectives.length > 0
    ? bbsc.scoringInputs.excludedPerspectives.join(", ")
    : "No perspectives excluded.";
  drawPanelText(doc, `${bbsc.scoreExplanation} Excluded perspectives: ${excluded}. ${bbsc.confidenceNote}`, margin, y, contentWidth, 45);
}

function drawRecommendations(doc: jsPDF, report: Report, financials: ReportFinancials, margin: number, contentWidth: number) {
  let y = 42;
  const recommendations = normalizeRecommendations(report, financials);
  for (const [index, recommendation] of recommendations.entries()) {
    const height = 38;
    drawCard(doc, margin, y, contentWidth, height, colors.panel);
    doc.setFillColor(...(index === 0 ? colors.cyan : index === 1 ? colors.violet : colors.amber));
    doc.roundedRect(margin + 5, y + 6, 9, 9, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...colors.navy);
    doc.text(String(index + 1), margin + 9.5, y + 12.2, { align: "center" });

    doc.setFontSize(9.5);
    doc.setTextColor(...colors.text);
    doc.text(cleanText(recommendation.issue), margin + 18, y + 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.8);
    doc.setTextColor(...colors.muted);
    const body = [
      `Impact: ${recommendation.businessImpact}`,
      `Action: ${recommendation.recommendedAction}`,
      recommendation.estimatedImpact ? `Estimated impact: ${recommendation.estimatedImpact}` : null,
      recommendation.confidence ? `Confidence: ${recommendation.confidence}` : null,
      recommendation.requiredData?.length ? `Required additional data: ${recommendation.requiredData.join(", ")}` : null,
    ].filter(Boolean).join("  ");
    doc.text(doc.splitTextToSize(cleanText(body), contentWidth - 26).slice(0, 4), margin + 18, y + 16);
    y += height + 6;
  }
}

function drawInfoGrid(doc: jsPDF, entries: string[][], x: number, y: number, width: number) {
  const gap = 4;
  const cardWidth = (width - gap * 3) / 4;
  entries.forEach(([label, value], index) => {
    const cardX = x + index * (cardWidth + gap);
    drawCard(doc, cardX, y, cardWidth, 24, colors.panel);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...colors.muted);
    doc.text(cleanText(label).toUpperCase(), cardX + 4, y + 7);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...colors.text);
    doc.text(doc.splitTextToSize(cleanText(value), cardWidth - 8).slice(0, 2), cardX + 4, y + 15);
  });
}

function drawMetricGrid(doc: jsPDF, metrics: PdfMetric[], x: number, y: number, width: number, columns: number) {
  const gap = 4;
  const cardWidth = (width - gap * (columns - 1)) / columns;
  const cardHeight = 30;
  metrics.forEach((item, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const cardX = x + col * (cardWidth + gap);
    const cardY = y + row * (cardHeight + gap);
    drawCard(doc, cardX, cardY, cardWidth, cardHeight, colors.panel);
    doc.setFillColor(...item.accent);
    doc.roundedRect(cardX + 4, cardY + 4, 2, 22, 1, 1, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...colors.muted);
    doc.text(cleanText(item.title).toUpperCase(), cardX + 9, cardY + 8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(item.value.length > 12 ? 12 : 14);
    doc.setTextColor(...colors.text);
    doc.text(cleanText(item.value), cardX + 9, cardY + 18);
    if (item.missing) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.8);
      doc.setTextColor(...colors.amber);
      doc.text(truncate(cleanText(item.missing), 24), cardX + 9, cardY + 25);
    }
  });
}

function drawSectionTitle(doc: jsPDF, title: string, x: number, y: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...colors.text);
  doc.text(cleanText(title), x, y);
  doc.setDrawColor(...colors.cyan);
  doc.setLineWidth(0.4);
  doc.line(x, y + 2.5, x + 34, y + 2.5);
}

function drawPanelText(doc: jsPDF, text: string, x: number, y: number, width: number, height: number) {
  drawCard(doc, x, y, width, height, colors.panel);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...colors.text);
  doc.text(doc.splitTextToSize(cleanText(text), width - 12).slice(0, Math.floor(height / 5)), x + 6, y + 9);
}

function drawCard(doc: jsPDF, x: number, y: number, width: number, height: number, fill: Rgb) {
  doc.setFillColor(...fill);
  doc.setDrawColor(...colors.border);
  doc.setLineWidth(0.25);
  doc.roundedRect(x, y, width, height, 3, 3, "FD");
}

function drawHorizontalBars(
  doc: jsPDF,
  rows: { name: string; value: number | null; color: Rgb }[],
  x: number,
  y: number,
  width: number,
  currency: boolean,
) {
  drawCard(doc, x, y, width, 48, colors.panel);
  const availableRows = rows.filter((row): row is { name: string; value: number; color: Rgb } => row.value !== null);
  const max = Math.max(...availableRows.map((row) => Math.abs(row.value)), 1);
  rows.forEach((row, index) => {
    const barY = y + 8 + index * 9;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.6);
    doc.setTextColor(...colors.muted);
    doc.text(cleanText(row.name), x + 5, barY + 4);
    doc.setFillColor(...colors.panel2);
    doc.roundedRect(x + 48, barY, width - 88, 5, 1.5, 1.5, "F");
    doc.setFont("helvetica", "bold");
    if (row.value === null) {
      doc.setTextColor(...colors.amber);
      doc.text("Not available", x + width - 6, barY + 4, { align: "right" });
    } else {
      doc.setFillColor(...row.color);
      doc.roundedRect(x + 48, barY, ((width - 88) * Math.abs(row.value)) / max, 5, 1.5, 1.5, "F");
      doc.setTextColor(...colors.text);
      doc.text(currency ? formatCurrency(row.value) : formatNumber(row.value), x + width - 6, barY + 4, { align: "right" });
    }
  });
}

function drawTrendPanel(doc: jsPDF, financials: ReportFinancials, x: number, y: number, width: number) {
  drawCard(doc, x, y, width, 72, colors.panel);
  const trends = (financials.periodTrends || []).slice(-6);
  if (trends.length < 2) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...colors.muted);
    doc.text("Monthly or period trend is not available. Missing field: period/date.", x + 6, y + 14);
  } else {
    const chartX = x + 10;
    const chartY = y + 12;
    const chartW = width - 20;
    const chartH = 36;
    const series = trends.map((trend) => trend.netProfit).filter((value): value is number => value !== null);
    if (series.length < 2) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...colors.muted);
      doc.text("Profit trend is not available because valid net-profit periods are incomplete.", x + 6, y + 14);
    } else {
    const max = Math.max(...series, 1);
    const min = Math.min(...series, 0);
    const range = Math.max(max - min, 1);
    doc.setDrawColor(...colors.border);
    doc.rect(chartX, chartY, chartW, chartH);
    doc.setDrawColor(...colors.green);
    doc.setLineWidth(0.8);
    let previous: { x: number; y: number } | null = null;
    series.forEach((value, index) => {
      const pointX = chartX + (index / Math.max(1, series.length - 1)) * chartW;
      const pointY = chartY + chartH - ((value - min) / range) * chartH;
      if (previous) doc.line(previous.x, previous.y, pointX, pointY);
      doc.setFillColor(...colors.cyan);
      doc.circle(pointX, pointY, 1.3, "F");
      previous = { x: pointX, y: pointY };
    });
    }
  }
  const notes = [
    `Revenue growth: ${financials.revenueGrowth === null || financials.revenueGrowth === undefined ? "Not available" : formatPercent(financials.revenueGrowth)}`,
    `Expense ratio: ${financials.expenseRatio === null || financials.expenseRatio === undefined ? "Not available" : formatPercent(financials.expenseRatio)}`,
    `Net margin: ${financials.netMargin === null ? "Not available" : formatPercent(financials.netMargin)}`,
  ];
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...colors.text);
  notes.forEach((note, index) => doc.text(note, x + 8 + index * 58, y + 62));
}

function drawCostTable(doc: jsPDF, categories: { name: string; value: number }[], total: number, x: number, y: number, width: number) {
  drawCard(doc, x, y, width, 76, colors.panel);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...colors.muted);
  doc.text("Category", x + 6, y + 8);
  doc.text("% of expenses", x + width - 68, y + 8);
  doc.text("Amount", x + width - 6, y + 8, { align: "right" });
  categories.slice(0, 7).forEach((item, index) => {
    const rowY = y + 17 + index * 8;
    const share = total > 0 ? (item.value / total) * 100 : 0;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...colors.text);
    doc.text(truncate(cleanText(item.name), 36), x + 6, rowY);
    doc.setTextColor(...colors.cyan);
    doc.text(formatPercent(share), x + width - 48, rowY);
    doc.setTextColor(...colors.text);
    doc.text(formatCurrency(item.value), x + width - 6, rowY, { align: "right" });
  });
}

function addFooters(doc: jsPDF, pageWidth: number, pageHeight: number, margin: number, report: Report) {
  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);
    doc.setDrawColor(...colors.border);
    doc.line(margin, pageHeight - 16, pageWidth - margin, pageHeight - 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...colors.muted);
    doc.text(`UseClevr executive BI report | ${cleanText(report.localTime)}`, margin, pageHeight - 10);
    doc.text(`Page ${page} of ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: "right" });
  }
}

function normalizeFinancials(report: Report): ReportFinancials {
  if (report.financials) return report.financials;
  const kpiValue = (title: string) => parseFormattedNumber(report.kpis.find((kpi) => kpi.title.toLowerCase() === title.toLowerCase())?.value);
  const revenue = kpiValue("Revenue");
  return {
    revenue,
    cogs: null,
    grossProfit: kpiValue("Gross Profit"),
    operatingExpenses: null,
    operatingProfit: kpiValue("Operating Profit"),
    interestExpense: null,
    taxExpense: null,
    netProfit: kpiValue("Net Profit"),
    grossMargin: parseFormattedPercent(report.kpis.find((kpi) => kpi.title.toLowerCase() === "gross margin")?.value),
    operatingMargin: parseFormattedPercent(report.kpis.find((kpi) => kpi.title.toLowerCase() === "operating margin")?.value),
    netMargin: parseFormattedPercent(report.kpis.find((kpi) => kpi.title.toLowerCase() === "net margin")?.value),
    missingFields: ["COGS", "Operating Expenses", "Interest Expense", "Tax Expense"].filter((field) => !report.kpis.some((kpi) => kpi.title === field)),
  };
}

function metric(title: string, value: number | null, format: "currency" | "percent" | "number", accent: Rgb, missing?: string | null): PdfMetric {
  return {
    title,
    value: value === null ? "Not available" : format === "currency" ? formatCurrency(value) : format === "percent" ? formatPercent(value) : formatNumber(value),
    accent,
    missing: value === null ? missing || `Missing field: ${title}` : null,
  };
}

function missingLabel(financials: ReportFinancials, field: string) {
  const match = (financials.missingFields || []).find((item) => item.toLowerCase() === field.toLowerCase());
  return match ? `Missing field: ${match}` : null;
}

function managementSummary(report: Report, financials: ReportFinancials) {
  if (report.summary) return cleanText(report.summary);
  return [
    `Revenue reached ${financials.revenue === null ? "Not available" : formatCurrency(financials.revenue)} with gross margin of ${financials.grossMargin === null ? "not available" : formatPercent(financials.grossMargin)}.`,
    `Net profitability is ${financials.netMargin === null ? "not available" : formatPercent(financials.netMargin)}.`,
    financials.topCostCategories?.[0] ? `${financials.topCostCategories[0].name} is the largest detected cost category.` : "Cost category detail is not available.",
  ].join(" ");
}

function normalizeRecommendations(report: Report, financials: ReportFinancials): ReportRecommendation[] {
  if (report.recommendations?.length) return report.recommendations.slice(0, 5);
  const recommendations: ReportRecommendation[] = [];
  if (financials.revenue !== null && financials.netProfit === null) {
    recommendations.push({
      issue: "Revenue is available, but profitability inputs are incomplete.",
      businessImpact: "Margin and profit decisions are not reliable until cost data is present.",
      recommendedAction: "Add COGS, operating expenses, interest, and tax fields before using the report for margin decisions.",
      estimatedImpact: null,
      requiredData: ["COGS", "Operating Expenses", "Interest Expense", "Tax Expense"],
    });
  }
  if ((financials.periodTrends || []).length < 2) {
    recommendations.push({
      issue: "Trend analysis is unavailable.",
      businessImpact: "The report cannot verify growth, seasonality, or period-over-period change.",
      recommendedAction: "Add a date, month, or period column to enable trend and growth analysis.",
      estimatedImpact: null,
      requiredData: ["Date or Period"],
    });
  }
  return recommendations.slice(0, 5);
}

function formatCurrency(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatNumber(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function parseFormattedNumber(value?: string) {
  if (!value) return null;
  const multiplier = value.includes("M") ? 1_000_000 : value.includes("K") ? 1_000 : 1;
  const parsed = Number.parseFloat(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed * multiplier : null;
}

function parseFormattedPercent(value?: string) {
  if (!value || !value.includes("%")) return null;
  const parsed = Number.parseFloat(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanText(value: string) {
  return value
    .replace(/\b(?:ds|pa|rep|report|dataset)_[a-z0-9_-]+\b/gi, "selected analysis")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "selected report")
    .replace(/profitability_analysis_id/gi, "profitability analysis")
    .replace(/dataset id/gi, "selected dataset")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}
