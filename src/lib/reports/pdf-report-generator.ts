import { debugLog } from "@/lib/utils/debug";

import * as fs from "fs";
import { jsPDF } from "jspdf";
import * as path from "path";
import type { Report, ReportFinancials, ReportRecommendation } from "./report-generator";

const PDF_DIR = path.join(process.env.TEMP_DIR || "/tmp/useclevr-reports", "pdfs");
const LOGO_PATH = path.join(process.cwd(), "src/assets/images/logos/useclevr-wordmark-dark.png");

type Rgb = [number, number, number];
type MetricKey = keyof NonNullable<ReportFinancials["metricSources"]>;
type MetricSourceKind = "source_value" | "derived_value" | "unavailable";
type TableRow = [string, string, string, string];

const colors = {
  ink: [17, 24, 39] as Rgb,
  body: [55, 65, 81] as Rgb,
  muted: [107, 114, 128] as Rgb,
  faint: [243, 244, 246] as Rgb,
  line: [209, 213, 219] as Rgb,
  brandPurple: [107, 70, 193] as Rgb,
  brandLilac: [167, 139, 250] as Rgb,
  brandCyan: [8, 145, 178] as Rgb,
  brandBlue: [37, 99, 235] as Rgb,
  green: [22, 163, 74] as Rgb,
  red: [220, 38, 38] as Rgb,
  blue: [37, 99, 235] as Rgb,
  white: [255, 255, 255] as Rgb,
};

const page = {
  margin: 18,
  top: 18,
  bottom: 22,
  width: 210,
  height: 297,
};

export function getPdfPath(reportId: string, datasetName: string): string | null {
  const filename = `${datasetName.replace(/[^a-z0-9]/gi, "_")}_report_${reportId}.pdf`;
  const filepath = path.join(PDF_DIR, filename);
  return fs.existsSync(filepath) ? filepath : null;
}

export async function generatePdfReport(report: Report): Promise<string> {
  ensurePdfDir();

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  doc.setProperties({
    title: "UseClevr Executive BI Report",
    subject: "AI-assisted executive business intelligence report",
    author: "UseClevr",
    keywords: "AI-assisted analysis, deterministic calculations, selected dataset, missing data disclosure",
    creator: "UseClevr",
  });

  const datasetName = cleanText(report.datasetName || "Selected dataset");
  const financials = normalizeFinancials(report);

  drawExecutiveOverview(doc, report, financials, datasetName);
  addDocumentPage(doc, "Financial Performance", datasetName);
  drawFinancialPerformance(doc, financials);
  addDocumentPage(doc, "Cost Intelligence", datasetName);
  drawCostIntelligence(doc, report, financials);
  addDocumentPage(doc, "Business Balanced Scorecard", datasetName);
  drawBalancedScorecard(doc, report);
  addDocumentPage(doc, "Executive Recommendations", datasetName);
  drawRecommendationsAndProvenance(doc, report, financials);

  addFooters(doc, report);

  const filename = `${report.datasetName.replace(/[^a-z0-9]/gi, "_")}_report_${report.id}.pdf`;
  const filepath = path.join(PDF_DIR, filename);
  fs.writeFileSync(filepath, Buffer.from(doc.output("arraybuffer")));

  debugLog("[PDF] Generated executive report:", filepath, `(${doc.getNumberOfPages()} page(s))`);
  return filepath;
}

function ensurePdfDir() {
  if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true });
}

function addDocumentPage(doc: jsPDF, title: string, datasetName: string) {
  doc.addPage();
  drawPageShell(doc, title, datasetName);
}

function drawPageShell(doc: jsPDF, title: string, datasetName: string) {
  doc.setFillColor(...colors.white);
  doc.rect(0, 0, page.width, page.height, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...colors.ink);
  doc.text(cleanText(title).toUpperCase(), page.margin, 26);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...colors.muted);
  doc.text(truncate(datasetName, 92), page.margin, 32);
  doc.setDrawColor(...colors.line);
  doc.setLineWidth(0.25);
  doc.line(page.margin, 36, page.width - page.margin, 36);
}

function drawExecutiveOverview(doc: jsPDF, report: Report, financials: ReportFinancials, datasetName: string) {
  drawBlankPage(doc);
  drawLogo(doc, page.margin, 16, 28);

  let y = 48;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(25);
  doc.setTextColor(...colors.ink);
  doc.text("EXECUTIVE BI REPORT", page.margin, y);
  y += 9;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(...colors.body);
  doc.text(truncate(datasetName, 90), page.margin, y);
  y += 14;

  const dataCompleteness = completenessScore(financials);
  drawMetaGrid(doc, [
    ["Reporting Period", financials.reportingPeriod || "Not available"],
    ["Generated", cleanText(report.localTime)],
    ["Rows Analyzed", report.rowCount.toLocaleString()],
    ["Data Confidence", dataCompleteness === null ? "Not available" : `${dataCompleteness}/100`],
  ], y);
  y += 35;

  drawSectionTitle(doc, "Executive Summary", y);
  y += 7;
  y = drawTextBox(doc, managementSummary(report, financials), page.margin, y, 174, 34) + 12;

  drawSectionTitle(doc, "Key Financial / Business Highlights", y);
  y += 7;
  drawMetricGrid(doc, [
    metricCard("Revenue", financials.revenue, "currency", "neutral", sourceNote(financials, "revenue")),
    metricCard("Gross Profit", financials.grossProfit, "currency", "missing", sourceNote(financials, "grossProfit")),
    metricCard("Operating Profit", financials.operatingProfit, "currency", "missing", sourceNote(financials, "operatingProfit")),
    metricCard("Net Profit", financials.netProfit, "currency", "missing", sourceNote(financials, "netProfit")),
    metricCard("Gross Margin", financials.grossMargin, "percent", "missing", sourceNote(financials, "grossMargin")),
    metricCard("Operating Margin", financials.operatingMargin, "percent", "missing", sourceNote(financials, "operatingMargin")),
    metricCard("Net Margin", financials.netMargin, "percent", "missing", sourceNote(financials, "netMargin")),
    { title: "Data Completeness", value: dataCompleteness === null ? "Not available" : `${dataCompleteness} / 100`, status: "neutral", note: "Recognized financial-field coverage." },
  ], y);
}

function drawFinancialPerformance(doc: jsPDF, financials: ReportFinancials) {
  let y = 48;
  drawSectionTitle(doc, "Financial Performance", y);
  y += 8;
  y = drawTable(doc, [
    ["Metric", "Value", "Status", "Source / Notes"],
    financialRow(financials, "Revenue", "revenue", "currency"),
    financialRow(financials, "COGS", "cogs", "currency"),
    financialRow(financials, "Gross Profit", "grossProfit", "currency"),
    financialRow(financials, "Operating Expenses", "operatingExpenses", "currency"),
    financialRow(financials, "Operating Profit", "operatingProfit", "currency"),
    financialRow(financials, "Interest Expense", "interestExpense", "currency"),
    financialRow(financials, "Tax Expense", "taxExpense", "currency"),
    financialRow(financials, "Net Profit", "netProfit", "currency"),
    financialRow(financials, "Gross Margin", "grossMargin", "percent"),
    financialRow(financials, "Operating Margin", "operatingMargin", "percent"),
    financialRow(financials, "Net Margin", "netMargin", "percent"),
  ], page.margin, y, [38, 32, 34, 70]);

  y += 12;
  drawSectionTitle(doc, "Revenue vs Expenses", y);
  y += 8;
  const expenseRows = [
    { label: "Revenue", value: financials.revenue, color: colors.brandCyan },
    { label: "COGS", value: financials.cogs, color: colors.brandPurple },
    { label: "Operating Expenses", value: financials.operatingExpenses, color: colors.brandBlue },
    { label: "Interest + Tax", value: financials.interestExpense !== null && financials.taxExpense !== null ? financials.interestExpense + financials.taxExpense : null, color: colors.brandLilac },
  ];
  if (expenseRows.slice(1).some((row) => row.value !== null) && financials.revenue !== null) {
    drawBars(doc, expenseRows, page.margin, y, 174, 45);
  } else {
    drawUnavailable(doc, "Chart unavailable", "Required expense fields are missing. The report does not draw zero-cost bars for unknown COGS or expenses.", page.margin, y, 174, 32);
  }

  y += 45;
  drawSectionTitle(doc, "Profit and Margin Trend", y);
  y += 8;
  drawTrendPanel(doc, financials, page.margin, y, 174, 52);
}

function drawCostIntelligence(doc: jsPDF, report: Report, financials: ReportFinancials) {
  let y = 48;
  const semanticContext = report.semanticContext;
  drawSectionTitle(doc, "Top Cost Categories", y);
  y += 8;
  const categories = (financials.topCostCategories || []).filter((item) => Number.isFinite(item.value)).slice(0, 8);
  if (categories.length === 0) {
    y = drawUnavailable(doc, "Cost category analysis unavailable", "No expense category field found in the selected dataset.", page.margin, y, 174, 28) + 12;
  } else {
    const total = categories.reduce((sum, item) => sum + item.value, 0);
    y = drawTable(doc, [
      ["Category", "Amount", "Share", "Notes"],
      ...categories.map((item): TableRow => [
        item.name,
        formatCurrency(item.value),
        total > 0 ? formatPercent((item.value / total) * 100) : "Not available",
        "Source value from categorized expense data.",
      ]),
    ], page.margin, y, [50, 35, 28, 61]) + 12;
  }

  drawSectionTitle(doc, "Management Interpretation", y);
  y += 8;
  const top = categories[0];
  const total = categories.reduce((sum, item) => sum + item.value, 0);
  const interpretation = top && total > 0
    ? `${top.name} is the largest detected cost category at ${formatPercent((top.value / total) * 100)} of categorized expenses. This is a source-backed concentration signal, not a complete cost review.`
    : "Cost concentration cannot be assessed without categorized expense amounts.";
  y = drawTextBox(doc, interpretation, page.margin, y, 174, 26) + 11;

  drawSectionTitle(doc, "Cost Optimization Opportunities", y);
  y += 8;
  const opportunity = top && total > 0
    ? `Review ${top.name} contracts, vendors, staffing, or usage drivers first because it is the largest sourced cost category.`
    : "Add categorized expense data before ranking cost optimization opportunities.";
  y = drawTextBox(doc, opportunity, page.margin, y, 174, 24) + 11;

  drawSectionTitle(doc, "Data Requirements", y);
  y += 8;
  const hasExpenseCategory = Boolean(semanticContext?.expenseCategoryField);
  const hasExpenseAmount = Boolean(semanticContext?.expenseAmountField);
  const hasDateField = Boolean(semanticContext?.dateField);
  const hasVendor = Boolean(semanticContext?.vendorField);
  drawTable(doc, [
    ["Required Field", "Purpose", "Status", "Notes"],
    ["Expense Category", "Categorize and analyze costs", hasExpenseCategory ? "Available" : "Missing", hasExpenseCategory ? `Mapped from ${semanticContext?.expenseCategoryField}.` : "No matching source field."],
    ["Expense Amount", "Quantify total cost by category", hasExpenseAmount ? "Available" : "Missing", hasExpenseAmount ? `Mapped from ${semanticContext?.expenseAmountField}.` : "No matching source field."],
    ["Date / Period", "Analyze cost trends", hasDateField ? "Available" : "Missing", hasDateField ? `Mapped from ${semanticContext?.dateField}.` : "No matching source field."],
    ["Vendor / Supplier", "Identify vendor opportunities", hasVendor ? "Available" : "Missing", hasVendor ? `Mapped from ${semanticContext?.vendorField}.` : "No matching source field."],
  ], page.margin, y, [42, 55, 28, 49]);
}

function drawBalancedScorecard(doc: jsPDF, report: Report) {
  let y = 48;
  const bbsc = report.bbsc;
  if (!bbsc) {
    drawUnavailable(doc, "Business Balanced Scorecard unavailable", "The report has no scorecard payload.", page.margin, y, 174, 28);
    return;
  }

  drawMetricGrid(doc, [
    { title: "Score", value: bbsc.overallScore === null ? "Not available" : `${bbsc.overallScore} / 100`, status: "neutral", note: "Average of available perspectives only." },
    { title: "Available Perspectives", value: `${bbsc.availablePerspectiveCount} / 4`, status: "neutral", note: "Excluded perspectives are not estimated." },
    { title: "Strongest Perspective", value: bbsc.strongestPerspective?.shortTitle || "Not enough comparative data", status: "neutral", note: "Requires at least two perspectives." },
    { title: "Weakest Perspective", value: bbsc.weakestPerspective?.shortTitle || "Not enough comparative data", status: "neutral", note: "Requires at least two perspectives." },
  ], y);
  y += 48;

  drawSectionTitle(doc, "Perspectives", y);
  y += 8;
  drawTable(doc, [
    ["Perspective", "Score", "Status", "Reason"],
    ...Object.values(bbsc.perspectives).map((perspective): TableRow => [
      perspective.title,
      perspective.score === null ? "Not available" : `${perspective.score}/100`,
      perspective.status === "available" ? `${perspective.dataConfidence}% confidence` : "Insufficient data",
      perspective.status === "available"
        ? truncate(perspective.findings[0] || "Source-backed perspective score.", 64)
        : `Missing: ${perspective.requiredFields.slice(0, 3).join(", ")}`,
    ]),
  ], page.margin, y, [49, 24, 35, 66]);
  y += 67;

  drawSectionTitle(doc, "Score Semantics", y);
  y += 8;
  drawTextBox(doc, `${bbsc.scoreExplanation} ${bbsc.confidenceNote}`, page.margin, y, 174, 34);
}

function drawRecommendationsAndProvenance(doc: jsPDF, report: Report, financials: ReportFinancials) {
  let y = 48;
  drawSectionTitle(doc, "Executive Recommendations", y);
  y += 8;
  const recommendations = normalizeRecommendations(report, financials);
  if (recommendations.length === 0) {
    y = drawUnavailable(doc, "No grounded recommendations available", "The selected dataset does not contain enough supported signals for a management recommendation.", page.margin, y, 174, 28) + 12;
  } else {
    for (const [index, recommendation] of recommendations.entries()) {
      const priority = String(index + 1).padStart(2, "0");
      y = drawRecommendation(doc, priority, recommendation, y) + 7;
      if (y > 208 && index < recommendations.length - 1) {
        addDocumentPage(doc, "Executive Recommendations", cleanText(report.datasetName));
        y = 48;
      }
    }
  }

  if (y > 208) {
    addDocumentPage(doc, "Report Provenance", cleanText(report.datasetName));
    y = 48;
  }
  drawSectionTitle(doc, "Report Provenance", y);
  y += 8;
  y = drawTable(doc, [
    ["Item", "Value", "Status", "Notes"],
    ["Analysis Type", "AI-assisted analysis", "Available", "Narrative support with deterministic calculations where possible."],
    ["Calculation Basis", "Selected dataset only", "Available", "Server-side report input is rebuilt from the accessible dataset."],
    ["Rows Analyzed", report.rowCount.toLocaleString(), "Available", "Rows loaded for this report."],
    ["Missing Data", "Explicitly disclosed", "Available", "Unavailable metrics render as Not available."],
    ["Generated", cleanText(report.localTime), "Available", "Timestamp captured at report generation."],
  ], page.margin, y, [42, 45, 30, 57]) + 12;

  drawSectionTitle(doc, "About This Report", y);
  y += 8;
  drawTextBox(
    doc,
    "This report was generated automatically by UseClevr using the selected dataset. Metrics are derived from available source data. Missing or insufficient data is explicitly identified to reduce unsupported conclusions.",
    page.margin,
    y,
    174,
    28,
  );
}

function drawLogo(doc: jsPDF, x: number, y: number, width: number) {
  try {
    if (!fs.existsSync(LOGO_PATH)) return;
    const image = fs.readFileSync(LOGO_PATH).toString("base64");
    doc.addImage(`data:image/png;base64,${image}`, "PNG", x, y, width, width * (182 / 478), undefined, "FAST");
  } catch {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...colors.brandPurple);
    doc.text("UseClevr", x, y + 5);
  }
}

function drawBlankPage(doc: jsPDF) {
  doc.setFillColor(...colors.white);
  doc.rect(0, 0, page.width, page.height, "F");
}

function drawMetaGrid(doc: jsPDF, entries: string[][], y: number) {
  const gap = 4;
  const width = (174 - gap * 3) / 4;
  entries.forEach(([label, value], index) => {
    const x = page.margin + index * (width + gap);
    doc.setDrawColor(...colors.line);
    doc.setFillColor(...colors.white);
    doc.roundedRect(x, y, width, 22, 1.5, 1.5, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(...colors.muted);
    doc.text(label.toUpperCase(), x + 3, y + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.2);
    doc.setTextColor(...colors.ink);
    doc.text(doc.splitTextToSize(cleanText(value), width - 6).slice(0, 2), x + 3, y + 14);
  });
}

function drawMetricGrid(doc: jsPDF, metrics: Array<{ title: string; value: string; status: "good" | "neutral" | "risk" | "missing"; note: string }>, y: number) {
  const gap = 4;
  const cardWidth = (174 - gap * 3) / 4;
  const cardHeight = 33;
  metrics.forEach((item, index) => {
    const x = page.margin + (index % 4) * (cardWidth + gap);
    const cardY = y + Math.floor(index / 4) * (cardHeight + gap);
    doc.setFillColor(...colors.white);
    doc.setDrawColor(...colors.line);
    doc.roundedRect(x, cardY, cardWidth, cardHeight, 1.5, 1.5, "S");
    doc.setFillColor(...statusColor(item.status));
    doc.rect(x, cardY, 1.6, cardHeight, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(...colors.muted);
    doc.text(item.title.toUpperCase(), x + 4, cardY + 7);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(item.value.length > 22 ? 8.8 : item.value.length > 15 ? 10 : 12);
    doc.setTextColor(...colors.ink);
    doc.text(doc.splitTextToSize(cleanText(item.value), cardWidth - 8).slice(0, 2), x + 4, cardY + 17);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.4);
    doc.setTextColor(...colors.muted);
    doc.text(doc.splitTextToSize(cleanText(item.note), cardWidth - 8).slice(0, 2), x + 4, cardY + 25);
  });
}

function drawSectionTitle(doc: jsPDF, title: string, y: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...colors.ink);
  doc.text(cleanText(title).toUpperCase(), page.margin, y);
  doc.setDrawColor(...colors.brandPurple);
  doc.setLineWidth(0.45);
  doc.line(page.margin, y + 2.5, page.margin + 24, y + 2.5);
}

function drawTextBox(doc: jsPDF, text: string, x: number, y: number, width: number, height: number) {
  doc.setFillColor(...colors.white);
  doc.setDrawColor(...colors.line);
  doc.roundedRect(x, y, width, height, 1.5, 1.5, "S");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...colors.body);
  doc.text(doc.splitTextToSize(cleanText(text), width - 8).slice(0, Math.floor(height / 4.5)), x + 4, y + 7);
  return y + height;
}

function drawUnavailable(doc: jsPDF, title: string, text: string, x: number, y: number, width: number, height: number) {
  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(252, 165, 165);
  doc.roundedRect(x, y, width, height, 1.5, 1.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...colors.red);
  doc.text(cleanText(title), x + 4, y + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.2);
  doc.setTextColor(...colors.body);
  doc.text(doc.splitTextToSize(cleanText(text), width - 8).slice(0, 3), x + 4, y + 15);
  return y + height;
}

function drawTable(doc: jsPDF, rows: TableRow[], x: number, y: number, widths: number[]) {
  const rowHeight = 8;
  rows.forEach((row, rowIndex) => {
    const isHeader = rowIndex === 0;
    let cellX = x;
    doc.setFillColor(...(isHeader ? colors.faint : colors.white));
    doc.setDrawColor(...colors.line);
    doc.rect(x, y + rowIndex * rowHeight, widths.reduce((sum, width) => sum + width, 0), rowHeight, "FD");
    row.forEach((cell, cellIndex) => {
      doc.setFont("helvetica", isHeader ? "bold" : "normal");
      doc.setFontSize(isHeader ? 7.2 : 7.5);
      doc.setTextColor(...(isHeader ? colors.ink : statusTextColor(cellIndex === 2 ? cell : "")));
      const text = doc.splitTextToSize(cleanText(cell), widths[cellIndex] - 4).slice(0, 1);
      doc.text(text, cellX + 2, y + rowIndex * rowHeight + 5.3);
      cellX += widths[cellIndex];
      if (cellIndex < widths.length - 1) {
        doc.setDrawColor(...colors.line);
        doc.line(cellX, y + rowIndex * rowHeight, cellX, y + (rowIndex + 1) * rowHeight);
      }
    });
  });
  return y + rows.length * rowHeight;
}

function drawBars(doc: jsPDF, rows: { label: string; value: number | null; color: Rgb }[], x: number, y: number, width: number, height: number) {
  doc.setDrawColor(...colors.line);
  doc.roundedRect(x, y, width, height, 1.5, 1.5, "S");
  const available = rows.filter((row): row is { label: string; value: number; color: Rgb } => row.value !== null);
  const max = Math.max(...available.map((row) => Math.abs(row.value)), 1);
  rows.forEach((row, index) => {
    const barY = y + 8 + index * 8.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...colors.body);
    doc.text(row.label, x + 4, barY + 4);
    doc.setFillColor(...colors.faint);
    doc.roundedRect(x + 44, barY, width - 86, 4.6, 1, 1, "F");
    if (row.value === null) {
      doc.setTextColor(...colors.red);
      doc.text("Not available", x + width - 4, barY + 4, { align: "right" });
    } else {
      doc.setFillColor(...row.color);
      doc.roundedRect(x + 44, barY, ((width - 86) * Math.abs(row.value)) / max, 4.6, 1, 1, "F");
      doc.setTextColor(...colors.ink);
      doc.text(formatCurrency(row.value), x + width - 4, barY + 4, { align: "right" });
    }
  });
}

function drawTrendPanel(doc: jsPDF, financials: ReportFinancials, x: number, y: number, width: number, height: number) {
  const trends = (financials.periodTrends || []).slice(-6);
  const series = trends.map((trend) => trend.netProfit).filter((value): value is number => value !== null);
  if (trends.length < 2 || series.length < 2) {
    drawUnavailable(doc, "Trend unavailable", "No valid reporting-period and net-profit series exists. Unsupported trends and percentages are omitted.", x, y, width, 28);
    return;
  }
  doc.setDrawColor(...colors.line);
  doc.roundedRect(x, y, width, height, 1.5, 1.5, "S");
  const chartX = x + 8;
  const chartY = y + 8;
  const chartW = width - 16;
  const chartH = height - 23;
  const max = Math.max(...series);
  const min = Math.min(...series);
  const range = Math.max(max - min, 1);
  doc.setDrawColor(...colors.line);
  doc.rect(chartX, chartY, chartW, chartH);
  doc.setDrawColor(...colors.brandPurple);
  doc.setLineWidth(0.8);
  let previous: { x: number; y: number } | null = null;
  series.forEach((value, index) => {
    const pointX = chartX + (index / Math.max(1, series.length - 1)) * chartW;
    const pointY = chartY + chartH - ((value - min) / range) * chartH;
    if (previous) doc.line(previous.x, previous.y, pointX, pointY);
    doc.setFillColor(...colors.brandCyan);
    doc.circle(pointX, pointY, 1.2, "F");
    previous = { x: pointX, y: pointY };
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...colors.muted);
  doc.text(`Revenue growth: ${financials.revenueGrowth === null || financials.revenueGrowth === undefined ? "Not available" : formatPercent(financials.revenueGrowth)}`, x + 6, y + height - 6);
  doc.text(`Net margin: ${financials.netMargin === null ? "Not available" : formatPercent(financials.netMargin)}`, x + 70, y + height - 6);
}

function drawRecommendation(doc: jsPDF, priority: string, recommendation: ReportRecommendation, y: number) {
  const height = 36;
  doc.setDrawColor(...colors.line);
  doc.roundedRect(page.margin, y, 174, height, 1.5, 1.5, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...colors.brandPurple);
  doc.text(priority, page.margin + 5, y + 9);
  doc.setTextColor(...colors.ink);
  doc.text(cleanText(recommendation.issue), page.margin + 18, y + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.6);
  doc.setTextColor(...colors.body);
  const detail = [
    `Reason: ${recommendation.businessImpact}`,
    `Action: ${recommendation.recommendedAction}`,
    recommendation.estimatedImpact ? `Impact: ${recommendation.estimatedImpact}` : null,
    `Effort: ${recommendation.requiredData?.length ? "Medium" : "Low"}`,
    `Confidence: ${recommendation.confidence || "High"}`,
  ].filter(Boolean).join("  ");
  doc.text(doc.splitTextToSize(cleanText(detail), 150).slice(0, 4), page.margin + 18, y + 16);
  return y + height;
}

function addFooters(doc: jsPDF, report: Report) {
  const totalPages = doc.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
    doc.setPage(pageNumber);
    doc.setDrawColor(...colors.line);
    doc.line(page.margin, page.height - 16, page.width - page.margin, page.height - 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...colors.muted);
    doc.text("UseClevr Executive BI Report", page.margin, page.height - 10);
    doc.text(`Page ${pageNumber} of ${totalPages}`, page.width - page.margin, page.height - 10, { align: "right" });
    doc.setFontSize(6.5);
    doc.text(`AI-assisted analysis | Selected dataset only | ${cleanText(report.id)}`, page.width / 2, page.height - 10, { align: "center" });
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
    metricSources: {
      revenue: revenue !== null ? { kind: "source_value", note: "Revenue was parsed from report KPIs." } : { kind: "unavailable", note: "No recognized revenue value." },
    },
  };
}

function financialRow(financials: ReportFinancials, label: string, key: MetricKey, format: "currency" | "percent"): TableRow {
  const value = financials[key];
  const source = metricSource(financials, key);
  return [
    label,
    typeof value === "number" && Number.isFinite(value) ? formatValue(value, format) : "Not available",
    statusLabel(source.kind),
    source.note,
  ];
}

function metricCard(title: string, value: number | null, format: "currency" | "percent", fallbackStatus: "neutral" | "missing", note: string) {
  return {
    title,
    value: value === null ? "Not available" : formatValue(value, format),
    status: value === null ? fallbackStatus : "neutral" as const,
    note,
  };
}

function metricSource(financials: ReportFinancials, key: MetricKey): { kind: MetricSourceKind; note: string } {
  return financials.metricSources?.[key] || {
    kind: financials[key] === null ? "unavailable" : "source_value",
    note: financials[key] === null ? `No supported ${String(key)} input exists.` : "Source value from report data.",
  };
}

function sourceNote(financials: ReportFinancials, key: MetricKey) {
  return metricSource(financials, key).note;
}

function statusLabel(kind: MetricSourceKind) {
  if (kind === "source_value") return "Source value";
  if (kind === "derived_value") return "Valid derived";
  return "Not available";
}

function statusColor(status: "good" | "neutral" | "risk" | "missing") {
  if (status === "good") return colors.green;
  if (status === "risk" || status === "missing") return colors.red;
  return colors.blue;
}

function statusTextColor(value: string): Rgb {
  if (/not available|missing|insufficient|risk/i.test(value)) return colors.red;
  if (/source|derived|available|confidence/i.test(value)) return colors.blue;
  return colors.body;
}

function managementSummary(report: Report, financials: ReportFinancials) {
  const guarded = cleanText(report.summary || "");
  if (guarded && !/\b0(?:\.0)?%|\$0\b/.test(guarded)) return guarded;
  return [
    financials.revenue === null
      ? "Revenue is not available from recognized source fields in the selected dataset."
      : `Revenue is ${formatCurrency(financials.revenue)} from recognized source data.`,
    financials.netProfit === null
      ? "Profitability cannot be assessed reliably because required cost, expense, interest, or tax inputs are missing."
      : `Net profit is ${formatCurrency(financials.netProfit)} from explicit or fully supported financial inputs.`,
    hasTrendData(financials)
      ? "Trend analysis uses available period data."
      : "Trend analysis is unavailable because valid reporting-period data is not present.",
  ].join(" ");
}

function normalizeRecommendations(report: Report, financials: ReportFinancials): ReportRecommendation[] {
  const blocked = [/generated from \d+ rows/i, /primary kpi/i, /review the uploaded dataset/i, /revenue is included/i];
  const recommendations = (report.recommendations || []).filter((item) => {
    const text = `${item.issue} ${item.businessImpact} ${item.recommendedAction}`;
    return item.issue && item.businessImpact && item.recommendedAction && !blocked.some((pattern) => pattern.test(text));
  });
  if (recommendations.length > 0) return recommendations.slice(0, 4);

  const fallback: ReportRecommendation[] = [];
  if (financials.revenue !== null && financials.netProfit === null) {
    fallback.push({
      issue: "Validate profitability before making margin decisions.",
      businessImpact: "Revenue data is available, but cost and expense fields are missing. Profitability cannot currently be assessed reliably.",
      recommendedAction: "Add COGS, operating expenses, interest, and tax fields before using this report for margin decisions.",
      estimatedImpact: "High",
      confidence: "High",
      requiredData: ["COGS", "Operating Expenses", "Interest Expense", "Tax Expense"],
    });
  }
  if (!hasTrendData(financials)) {
    fallback.push({
      issue: "Add date or period data to enable trend analysis.",
      businessImpact: "No valid reporting-period field was detected, preventing revenue and margin trend analysis.",
      recommendedAction: "Add a date, month, or period column to future uploads.",
      estimatedImpact: "Medium",
      confidence: "High",
      requiredData: ["Date or Period"],
    });
  }
  return fallback.slice(0, 4);
}

function completenessScore(financials: ReportFinancials) {
  if (typeof financials.dataConfidence === "number" && Number.isFinite(financials.dataConfidence)) return Math.round(financials.dataConfidence);
  const keys: MetricKey[] = ["revenue", "cogs", "operatingExpenses", "interestExpense", "taxExpense"];
  const available = keys.filter((key) => financials[key] !== null).length;
  return Math.round((available / keys.length) * 100);
}

function hasTrendData(financials: ReportFinancials) {
  return (financials.periodTrends || []).length >= 2;
}

function formatValue(value: number, format: "currency" | "percent") {
  return format === "currency" ? formatCurrency(value) : formatPercent(value);
}

function formatCurrency(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
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
