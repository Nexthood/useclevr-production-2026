import { debugLog } from "@/lib/utils/debug";

import * as fs from "fs";
import assert from "node:assert";
import { jsPDF } from "jspdf";
import * as path from "path";
import type { Report, ReportFinancials, ReportRecommendation, SaasReportAnalysis } from "./report-generator";

const PDF_DIR = path.join(process.env.TEMP_DIR || "/tmp/useclevr-reports", "pdfs");
const LOGO_PATH = path.join(process.cwd(), "src/assets/images/logos/useclevr-wordmark-dark.png");

type Rgb = [number, number, number];
type MetricKey = keyof NonNullable<ReportFinancials["metricSources"]>;
type MetricSourceKind = "source_value" | "derived_value" | "unavailable";
type TableRow = [string, string, string, string];
type SummaryMetric = { title: string; value: string };
type SummaryItem = { label: string; detail: string; tone?: "neutral" | "positive" | "risk" };
type FindingPriority =
  | "business_risk"
  | "negative_change"
  | "opportunity"
  | "positive_performance"
  | "concentration"
  | "operational"
  | "missing_data_unlock"
  | "data_observation";
type FindingCandidate = {
  text: string;
  priority: FindingPriority;
  sourceOrder: number;
};
type PdfLayoutContext = {
  title: string;
  datasetName: string;
};
type PdfBranchResolution = {
  resolvedReportType: string | null;
  resolvedModel: string | null;
  isAccountancyLedger: boolean;
};

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

const content = {
  top: 48,
  bottom: page.height - page.bottom - 2,
  width: page.width - page.margin * 2,
};

const layout = {
  sectionHeadingWithSpacing: 8,
  minimumNarrativeBlock: 24,
  minimumUnavailableBlock: 28,
  minimumTableStart: 24,
  metricCardHeight: 33,
  metricCardGap: 4,
  recommendationCardHeight: 36,
  sectionGap: 6,
};

const layoutContexts = new WeakMap<jsPDF, PdfLayoutContext>();

function resolvePdfBranch(report: Report): PdfBranchResolution {
  const resolvedReportType = normalizeBranchValue(report.reportType) || normalizeBranchValue(report.reportProfile?.id);
  const resolvedModel = normalizeBranchValue(report.reportProfile?.id) || normalizeBranchValue(report.businessModel);
  const branchValues = [resolvedReportType, resolvedModel];
  return {
    resolvedReportType,
    resolvedModel,
    isAccountancyLedger: branchValues.some((value) => value === "accountancy" || value === "accountancy_ledger"),
  };
}

function normalizeBranchValue(value?: string | null) {
  const normalized = (value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return normalized || null;
}

function kpiNumber(report: Report, title: string): number | null {
  const rawValue = report.kpiRawValues?.[title];
  if (typeof rawValue === "number" && Number.isFinite(rawValue)) return rawValue;

  const value = report.kpis.find((kpi) => kpi.title === title)?.value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed || /not available|undefined|nan/i.test(trimmed)) return null;

  const multiplier = /k$/i.test(trimmed) ? 1_000 : /m$/i.test(trimmed) ? 1_000_000 : 1;
  const numeric = Number(trimmed.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) ? numeric * multiplier : null;
}

export function getPdfPath(reportId: string, datasetName: string): string | null {
  const filename = `${datasetName.replace(/[^a-z0-9]/gi, "_")}_report_${reportId}.pdf`;
  const filepath = path.join(PDF_DIR, filename);
  return fs.existsSync(filepath) ? filepath : null;
}

export async function generatePdfReport(report: Report): Promise<string> {
  ensurePdfDir();

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  doc.setProperties({
    title: `UseClevr ${report.reportProfile?.title || "Executive BI Report"}`,
    subject: "AI-assisted executive business intelligence report",
    author: "UseClevr",
    keywords: "AI-assisted analysis, deterministic calculations, selected dataset, missing data disclosure",
    creator: "UseClevr",
  });

  const datasetName = cleanText(report.datasetName || "Selected dataset");
  const financials = normalizeFinancials(report);
  const branch = resolvePdfBranch(report);
  const totalDebits = kpiNumber(report, "Debit total");
  const totalCredits = kpiNumber(report, "Credit total");
  const operatingProfit = financials.operatingProfit;
  if (branch.isAccountancyLedger || report.datasetName?.toLowerCase().includes("accountancy") || report.datasetName?.toLowerCase().includes("ledger")) {
    debugLog("[DIAG] Accountancy Ledger PDF Branch Resolution:", {
      gitCommit: process.env.VERCEL_GIT_COMMIT_SHA || "local-dev",
      datasetName: report.datasetName,
      reportType: report.reportType,
      businessModel: report.businessModel,
      reportProfileId: report.reportProfile?.id,
      resolvedReportType: branch.resolvedReportType,
      resolvedModel: branch.resolvedModel,
      enteredAccountancyLedgerBranch: branch.isAccountancyLedger,
      operatingProfit,
      totalDebits,
      totalCredits,
      kpis: report.kpis?.map(k => ({ title: k.title, value: k.value })),
      kpiRawValues: report.kpiRawValues,
      financialsMetricSources: report.financials?.metricSources,
    });
  }
  if (branch.isAccountancyLedger) {
    assert.strictEqual(operatingProfit, null, "Accountancy ledger PDFs must not render operating profit from debit/credit columns");
    assert(Number.isFinite(totalDebits), "Accountancy ledger PDFs require a finite debit total before rendering");
    assert(Number.isFinite(totalCredits), "Accountancy ledger PDFs require a finite credit total before rendering");
  }
  layoutContexts.set(doc, { title: report.reportProfile?.title || "Executive BI Report", datasetName });
  tracePdfRuntime("renderPdf", report, financials);

  drawExecutiveOverview(doc, report, financials, datasetName);
  let renderedGenericFinancialPages = false;
  if (report.reportProfile?.id === "local_retail" && report.retailAnalysis) {
    addDocumentPage(doc, "Sales & Margin Performance", datasetName);
    drawRetailSalesPerformance(doc, report, financials);
    addDocumentPage(doc, "Inventory Intelligence", datasetName);
    drawRetailInventoryIntelligence(doc, report);
    addDocumentPage(doc, "Product / Category / Supplier Intelligence", datasetName);
    drawRetailProductIntelligence(doc, report, financials);
    addDocumentPage(doc, "Retail Recommendations + Provenance", datasetName);
    drawRecommendationsAndProvenance(doc, report, financials, "Retail Recommendations");
  } else if (report.reportProfile?.id === "ecommerce" && report.ecommerceAnalysis) {
    addDocumentPage(doc, "Sales Performance", datasetName);
    drawEcommerceSalesPerformance(doc, report, financials);
    addDocumentPage(doc, "Customer / Channel / Commercial Intelligence", datasetName);
    drawEcommerceCommercialIntelligence(doc, report, financials);
    addDocumentPage(doc, "Business Balanced Scorecard", datasetName);
    drawBalancedScorecard(doc, report);
    addDocumentPage(doc, "E-commerce Recommendations + Provenance", datasetName);
    drawRecommendationsAndProvenance(doc, report, financials, "E-commerce Recommendations");
  } else if (report.reportProfile?.id === "saas_startup" && report.saasAnalysis) {
    if (hasSaasCapability(report, "mrr_analysis") || hasSaasCapability(report, "arr_analysis") || hasSaasCapability(report, "subscription_metrics")) {
      addDocumentPage(doc, "Recurring Revenue & Growth", datasetName);
      drawSaasRecurringRevenue(doc, report);
    }
    if (hasSaasCapability(report, "customer_analysis") || hasSaasCapability(report, "unit_economics") || hasSaasCapability(report, "churn_analysis") || hasSaasCapability(report, "plan_performance") || hasSaasCapability(report, "geography_analysis")) {
      addDocumentPage(doc, "Customer & Unit Economics", datasetName);
      drawSaasCustomerEconomics(doc, report);
    }
    if (hasSaasCapability(report, "cash_analysis") || hasSaasCapability(report, "burn_analysis") || hasSaasCapability(report, "runway_analysis")) {
      addDocumentPage(doc, "Cash / Startup Health", datasetName);
      drawSaasCashHealth(doc, report);
    }
    addDocumentPage(doc, "Business Balanced Scorecard", datasetName);
    drawBalancedScorecard(doc, report);
    addDocumentPage(doc, "SaaS Recommendations + Provenance", datasetName);
    drawRecommendationsAndProvenance(doc, report, financials, "SaaS Recommendations");
  } else if (report.reportProfile?.id === "marketplace_startup" && report.marketplaceAnalysis) {
    addDocumentPage(doc, "Marketplace Economics", datasetName);
    drawMarketplaceEconomics(doc, report, financials);
    addDocumentPage(doc, "Buyer & Seller Intelligence", datasetName);
    drawMarketplaceBuyerSellerIntelligence(doc, report, financials);
    addDocumentPage(doc, "Category & Geography Performance", datasetName);
    drawMarketplaceCategoryGeography(doc, report, financials);
    addDocumentPage(doc, "Business Balanced Scorecard", datasetName);
    drawBalancedScorecard(doc, report);
    addDocumentPage(doc, "Marketplace Recommendations + Provenance", datasetName);
    drawRecommendationsAndProvenance(doc, report, financials, "Marketplace Recommendations");
  } else if (report.reportProfile?.id === "investor_portfolio" && report.investorAnalysis) {
    addDocumentPage(doc, "Investment & Valuation Performance", datasetName);
    drawInvestorInvestmentPerformance(doc, report, financials);
    addDocumentPage(doc, "Portfolio Company Performance", datasetName);
    drawInvestorCompanyPerformance(doc, report);
    addDocumentPage(doc, "Sector & Stage Allocation", datasetName);
    drawInvestorSectorStage(doc, report);
    addDocumentPage(doc, "Business Balanced Scorecard", datasetName);
    drawBalancedScorecard(doc, report);
    addDocumentPage(doc, "Investor Recommendations + Provenance", datasetName);
    drawRecommendationsAndProvenance(doc, report, financials, "Investor Recommendations");
  } else if (report.reportProfile?.id === "business_consulting") {
    addDocumentPage(doc, "Business Consulting Financials", datasetName);
    drawBusinessConsultingFinancials(doc, report, financials);
    addDocumentPage(doc, "Business Balanced Scorecard", datasetName);
    drawBalancedScorecard(doc, report);
    addDocumentPage(doc, "Executive Recommendations", datasetName);
    drawRecommendationsAndProvenance(doc, report, financials);
  } else if (report.reportProfile?.id === "professional_services") {
    addDocumentPage(doc, "Professional Services Financials", datasetName);
    drawProfessionalServicesFinancials(doc, report, financials);
    addDocumentPage(doc, "Business Balanced Scorecard", datasetName);
    drawBalancedScorecard(doc, report);
    addDocumentPage(doc, "Executive Recommendations", datasetName);
    drawRecommendationsAndProvenance(doc, report, financials);
  } else if (branch.isAccountancyLedger) {
    addDocumentPage(doc, "Accountancy Ledger Summary", datasetName);
    drawAccountancyLedgerSummary(doc, report, financials);
    addDocumentPage(doc, "Ledger Recommendations + Provenance", datasetName);
    drawRecommendationsAndProvenance(doc, report, financials, "Ledger Recommendations");
  } else {
    renderedGenericFinancialPages = true;
    addDocumentPage(doc, "Financial Performance", datasetName);
    drawFinancialPerformance(doc, financials);
    addDocumentPage(doc, "Cost Intelligence", datasetName);
    drawCostIntelligence(doc, report, financials);
    const profileId = report.reportProfile?.id as string | undefined;
    const isProfitabilityReport = profileId === "profitability_pnl" || profileId === "profitability";
    if (isProfitabilityReport && (financials.departmentProfitability?.length ?? 0) > 0) {
      addDocumentPage(doc, "Department Profitability", datasetName);
      drawDepartmentProfitability(doc, financials);
    }
    addDocumentPage(doc, "Business Balanced Scorecard", datasetName);
    drawBalancedScorecard(doc, report);
    addDocumentPage(doc, "Executive Recommendations", datasetName);
    drawRecommendationsAndProvenance(doc, report, financials);
  }

  if (report.reportProfile?.id === "marketplace_startup" && report.marketplaceAnalysis) {
    assert(
      !renderedGenericFinancialPages,
      "Marketplace report must not render generic Financial Performance or Cost Intelligence pages",
    );
  }
  if (report.reportProfile?.id === "investor_portfolio" && report.investorAnalysis) {
    assert(
      !renderedGenericFinancialPages,
      "Investor report must not render generic Financial Performance or Cost Intelligence pages",
    );
  }

  addDocumentPage(doc, resultsSummaryTitle(report), datasetName);
  drawExecutiveResultsSummary(doc, report, financials);

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
  layoutContexts.set(doc, { title, datasetName });
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

function addFlowPage(doc: jsPDF) {
  const context = layoutContexts.get(doc) || { title: "Executive BI Report", datasetName: "Selected dataset" };
  addDocumentPage(doc, context.title, context.datasetName);
  return content.top;
}

function ensureComponentFits(doc: jsPDF, y: number, height: number) {
  return y + height <= content.bottom ? y : addFlowPage(doc);
}

function ensureSectionStartSpace(doc: jsPDF, y: number, minimumFollowingHeight = layout.minimumNarrativeBlock) {
  return ensureComponentFits(doc, y, layout.sectionHeadingWithSpacing + minimumFollowingHeight);
}

function drawSectionHeading(doc: jsPDF, title: string, y: number, minimumFollowingHeight = layout.minimumNarrativeBlock) {
  const nextY = ensureSectionStartSpace(doc, y, minimumFollowingHeight);
  drawSectionTitle(doc, title, nextY);
  return nextY + layout.sectionHeadingWithSpacing;
}

function drawExecutiveOverview(doc: jsPDF, report: Report, financials: ReportFinancials, datasetName: string) {
  tracePdfRuntime("buildExecutiveSummary", report, financials);
  drawBlankPage(doc);
  drawLogo(doc, page.margin, 16, 28);

  let y = 48;
  const title = cleanText(report.reportProfile?.title || "Executive BI Report").toUpperCase();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(25);
  doc.setTextColor(...colors.ink);
  const titleWidth = doc.getTextWidth(title);
  if (titleWidth > 170) {
    doc.setFontSize(18);
    const wrappedTitle = doc.splitTextToSize(title, 170);
    doc.text(wrappedTitle, page.margin, y);
    y += wrappedTitle.length * 8;
  } else {
    doc.text(title, page.margin, y);
    y += 9;
  }
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

  y = drawSectionHeading(doc, "Executive Summary", y, 34);
  y = drawTextBox(doc, managementSummary(report, financials), page.margin, y, 174, 34) + 12;

  const overviewMetrics = overviewMetricCards(report, financials, dataCompleteness);
  if (overviewMetrics.length > 0) {
    y = drawSectionHeading(doc, report.reportProfile?.id === "local_retail" ? "Retail Executive KPIs" : report.reportProfile?.id === "marketplace_startup" ? "Marketplace KPIs" : report.reportProfile?.id === "investor_portfolio" ? "Portfolio Highlights" : "Key Financial / Business Highlights", y, layout.metricCardHeight);
    drawMetricGrid(doc, overviewMetrics, y);
  }
}

function overviewMetricCards(report: Report, financials: ReportFinancials, dataCompleteness: number | null) {
  if (report.reportProfile?.id === "local_retail" && report.retailAnalysis) {
    const retail = report.retailAnalysis;
    return [
      metricCard("Revenue", financials.revenue, "currency", "neutral", sourceNote(financials, "revenue")),
      metricCard("Gross Profit", financials.grossProfit, "currency", "missing", sourceNote(financials, "grossProfit")),
      metricCard("Gross Margin", financials.grossMargin, "percent", "missing", sourceNote(financials, "grossMargin")),
      numberMetricCard("Units Sold", report.kpis.find((kpi) => kpi.title === "Units Sold")?.value || "Not available", "Source retail quantity field."),
      numberMetricCard("Current Stock", retail.currentStock === null ? "Not available" : retail.currentStock.toLocaleString(), "Stock on hand from inventory fields."),
      metricCard("Inventory Value", retail.inventoryValue, "currency", "missing", "Stock multiplied by detected unit cost where available."),
      numberMetricCard("Products / SKUs", retail.productCount === null ? "Not available" : retail.productCount.toLocaleString(), "Distinct detected product or SKU values."),
      numberMetricCard("Reorder Required", retail.reorderRequiredCount === null ? "Not available" : retail.reorderRequiredCount.toLocaleString(), "Inventory positions at or below reorder point."),
    ];
  }
  if (report.reportProfile?.id === "ecommerce" && report.ecommerceAnalysis) {
    const ecommerce = report.ecommerceAnalysis;
    return [
      metricCard("Revenue", financials.revenue, "currency", "neutral", sourceNote(financials, "revenue")),
      numberMetricCard("Orders", ecommerce.orders === null ? "Not available" : ecommerce.orders.toLocaleString(), ecommerce.orderField ? `Distinct values from ${ecommerce.orderField}.` : "Requires reliable order ID."),
      metricCard("AOV", ecommerce.averageOrderValue, "currency", "missing", "Revenue divided by distinct order count."),
      numberMetricCard("Customers", ecommerce.customers === null ? "Not available" : ecommerce.customers.toLocaleString(), ecommerce.customerField ? `Distinct values from ${ecommerce.customerField}.` : "Requires customer ID."),
      numberMetricCard("Units Sold", ecommerce.unitsSold === null ? "Not available" : ecommerce.unitsSold.toLocaleString(), "Recognized quantity field."),
      numberMetricCard("Products", ecommerce.products === null ? "Not available" : ecommerce.products.toLocaleString(), ecommerce.productField ? `Distinct values from ${ecommerce.productField}.` : "Requires product field."),
      metricCard("Return Rate", ecommerce.returnRate, "percent", "missing", ecommerce.returnStatus === "available" && ecommerce.returnStatusField ? `Calculated from ${ecommerce.returnStatusField}.` : "Return status values could not be normalized reliably."),
      { title: "Data Confidence", value: dataCompleteness === null ? "Not available" : `${dataCompleteness} / 100`, status: "neutral" as const, note: "E-commerce field coverage." },
    ];
  }
  if (report.reportProfile?.id === "saas_startup" && report.saasAnalysis) {
    const saas = report.saasAnalysis;
    return [
      metricCard("MRR", saas.mrr, "currency", "missing", saas.mrrField ? `Latest-period source value from ${saas.mrrField}.` : "Requires MRR field."),
      metricCard("ARR", saas.arr, "currency", "missing", saas.arrField ? `Latest-period source value from ${saas.arrField}.` : "Requires ARR field."),
      numberMetricCard("Customers", saas.customers === null ? "Not available" : saas.customers.toLocaleString(), saasCustomerNote(saas)),
      numberMetricCard("New Customers", saas.newCustomers === null ? "Not available" : saas.newCustomers.toLocaleString(), saasNewCustomerNote(saas)),
      metricCard("Churn Rate", saas.churnRate, "percent", "missing", saasChurnRateNote(saas)),
      metricCard("CAC", saas.cac, "currency", "missing", saas.cacField ? `Latest-period average from ${saas.cacField}.` : "Requires CAC field."),
      metricCard("LTV", saas.ltv, "currency", "missing", saas.ltvField ? `Latest-period average from ${saas.ltvField}.` : "Requires LTV field."),
      numberMetricCard("Runway", saas.runwayMonths === null ? "Not available" : `${saas.runwayMonths.toFixed(1)} months`, saas.runwayField ? `Latest-period average from ${saas.runwayField}.` : "Requires runway field."),
      { title: "Data Confidence", value: `${saas.dataConfidence} / 100`, status: "neutral" as const, note: "SaaS field coverage." },
    ];
  }
  if (report.reportProfile?.id === "marketplace_startup" && report.marketplaceAnalysis) {
    const marketplace = report.marketplaceAnalysis;
    return [
      metricCard("GMV", marketplace.gmv, "currency", "neutral", marketplace.gmvField ? `Sum of ${marketplace.gmvField}.` : "No GMV field."),
      metricCard("Marketplace Revenue", marketplace.marketplaceRevenue, "currency", "neutral", marketplace.marketplaceRevenueField ? `Sum of ${marketplace.marketplaceRevenueField}.` : "No marketplace revenue field."),
      metricCard("Take Rate", marketplace.takeRate, "percent", "missing", "Marketplace Revenue divided by GMV."),
      metricCard("Seller Payout", marketplace.sellerPayout, "currency", "neutral", marketplace.sellerPayoutField ? `Sum of ${marketplace.sellerPayoutField}.` : "No seller payout field."),
      metricCard("Refund Amount", marketplace.refunds, "currency", "neutral", marketplace.refundsField ? `Sum of ${marketplace.refundsField}.` : "No refund field."),
      metricCard("Refund Rate", marketplace.refundRate, "percent", "missing", "Refund Amount divided by GMV."),
      numberMetricCard("Transactions", marketplace.transactions === null ? "Not available" : marketplace.transactions.toLocaleString(), marketplace.transactionField ? `Distinct values from ${marketplace.transactionField}.` : "Row count used as transaction proxy."),
      metricCard("Average Transaction Value", marketplace.averageTransactionValue, "currency", "missing", "GMV divided by transactions."),
      numberMetricCard("Buyers", marketplace.buyers === null ? "Not available" : marketplace.buyers.toLocaleString(), marketplace.buyerField ? `Distinct values from ${marketplace.buyerField}.` : "No buyer field."),
      numberMetricCard("Sellers", marketplace.sellers === null ? "Not available" : marketplace.sellers.toLocaleString(), marketplace.sellerField ? `Distinct values from ${marketplace.sellerField}.` : "No seller field."),
      numberMetricCard("New Buyers", marketplace.newBuyers === null ? "Not available" : marketplace.newBuyers.toLocaleString(), marketplace.newBuyerField ? `Normalized positives from ${marketplace.newBuyerField}.` : "No new buyer field."),
      numberMetricCard("New Sellers", marketplace.newSellers === null ? "Not available" : marketplace.newSellers.toLocaleString(), marketplace.newSellerField ? `Normalized positives from ${marketplace.newSellerField}.` : "No new seller field."),
      numberMetricCard("Active Sellers", marketplace.activeSellers === null ? "Not available" : marketplace.activeSellers.toLocaleString(), marketplace.activeSellersField ? (marketplace.activeSellersAggregation === "latest_snapshot" ? `Latest snapshot from ${marketplace.activeSellersField}.` : `Sum of ${marketplace.activeSellersField}.`) : "No active sellers field."),
      numberMetricCard("Listings", marketplace.listings === null ? "Not available" : marketplace.listings.toLocaleString(), marketplace.listingsField ? (marketplace.listingsAggregation === "latest_snapshot" ? `Latest snapshot from ${marketplace.listingsField}.` : `Sum of ${marketplace.listingsField}.`) : "No listing count field."),
      metricCard("Completion Rate", marketplace.completionRate, "percent", "missing", "Completed transactions divided by total transactions."),
      { title: "Data Confidence", value: dataCompleteness === null ? "Not available" : `${dataCompleteness} / 100`, status: "neutral" as const, note: "Marketplace field coverage." },
    ];
  }
  if (report.reportProfile?.id === "investor_portfolio" && report.investorAnalysis) {
    const investor = report.investorAnalysis;
    const activeCount = investor.companiesByStatus.find((s) => s.status.toLowerCase() === "active")?.count || 0;
    const exitedCount = investor.companiesByStatus.find((s) => s.status.toLowerCase() === "exited")?.count || 0;
    const watchlistCount = investor.companiesByStatus.find((s) => s.status.toLowerCase() === "watchlist")?.count || 0;
    return [
      numberMetricCard("Portfolio Companies", investor.portfolioCompanies === null ? "Not available" : investor.portfolioCompanies.toLocaleString(), investor.portfolioCompanies !== null ? "Count of distinct portfolio company IDs." : "Requires company_id field."),
      metricCard("Total Invested", investor.totalInvested, "currency", "neutral", investor.totalInvested !== null ? "Sum of invested_amount across portfolio." : "Requires invested_amount field."),
      metricCard("Aggregate Company Valuations", investor.totalValuation, "currency", "neutral", investor.totalValuation !== null ? "Sum of latest_valuation across portfolio." : "Requires valuation field."),
      metricCard("Average Ownership", investor.avgOwnership, "percent", "neutral", investor.avgOwnership !== null ? "Average ownership percentage across portfolio." : "Requires ownership or stake field."),
      numberMetricCard("Active Companies", activeCount.toString(), "Source value"),
      numberMetricCard("Exited Companies", exitedCount.toString(), "Source value"),
      numberMetricCard("Watchlist", watchlistCount.toString(), "Source value"),
      { title: "Data Confidence", value: dataCompleteness === null ? "Not available" : `${dataCompleteness} / 100`, status: "neutral" as const, note: "Investor portfolio field coverage." },
    ];
  }
  if (resolvePdfBranch(report).isAccountancyLedger) {
    const debitTotal = kpiNumber(report, "Debit total");
    const creditTotal = kpiNumber(report, "Credit total");
    const invoices = kpiNumber(report, "Invoices / documents");
    const accounts = kpiNumber(report, "Accounts");
    const netMovement: number | null = debitTotal !== null && creditTotal !== null ? debitTotal - creditTotal : null;
    return [
      metricCard("Total Debits", debitTotal, "currency", "neutral", "Sum of debit column from ledger."),
      metricCard("Total Credits", creditTotal, "currency", "neutral", "Sum of credit column from ledger."),
      metricCard("Net Movement", netMovement, "currency", "neutral", "Total Debits - Total Credits."),
      numberMetricCard("Invoices / Documents", invoices !== null ? String(invoices) : "Not available", "Count of distinct invoice or document references."),
      numberMetricCard("Accounts", accounts !== null ? String(accounts) : "Not available", "Count of distinct account entries."),
      { title: "Data Confidence", value: dataCompleteness === null ? "Not available" : `${dataCompleteness} / 100`, status: "neutral" as const, note: "Ledger field coverage." },
    ];
  }

  return [
    metricCard("Revenue", financials.revenue, "currency", "neutral", sourceNote(financials, "revenue")),
    metricCard("Gross Profit", financials.grossProfit, "currency", "missing", sourceNote(financials, "grossProfit")),
    metricCard("Operating Profit", financials.operatingProfit, "currency", "missing", sourceNote(financials, "operatingProfit")),
    metricCard("Net Profit", financials.netProfit, "currency", "missing", sourceNote(financials, "netProfit")),
    metricCard("Gross Margin", financials.grossMargin, "percent", "missing", sourceNote(financials, "grossMargin")),
    metricCard("Operating Margin", financials.operatingMargin, "percent", "missing", sourceNote(financials, "operatingMargin")),
    metricCard("Net Margin", financials.netMargin, "percent", "missing", sourceNote(financials, "netMargin")),
    { title: "Data Completeness", value: dataCompleteness === null ? "Not available" : `${dataCompleteness} / 100`, status: "neutral" as const, note: "Recognized financial-field coverage." },
  ];
}

function drawRetailSalesPerformance(doc: jsPDF, report: Report, financials: ReportFinancials) {
  let y = 48;
  const aov = report.retailAnalysis?.averageOrderValue;
  const aovAvailable = isRenderableAverageOrderValue(aov);
  y = drawSectionHeading(doc, "Retail Sales & Margin Performance", y);
  y = drawTable(doc, [
    ["Metric", "Value", "Status", "Source / Notes"],
    financialRow(financials, "Revenue", "revenue", "currency"),
    financialRow(financials, "COGS", "cogs", "currency"),
    financialRow(financials, "Gross Profit", "grossProfit", "currency"),
    financialRow(financials, "Gross Margin", "grossMargin", "percent"),
    ["Units Sold", report.kpis.find((kpi) => kpi.title === "Units Sold")?.value || "Not available", "Available", "Recognized units-sold or quantity field."],
    [
      "Average Order Value",
      aovAvailable ? formatCurrency(aov!.value!) : "Not available",
      aovAvailable ? "Available" : "Not available",
      aovAvailable ? "Revenue / distinct order count." : "No reliable order identifier or order-level transaction grain detected.",
    ],
  ], page.margin, y, [38, 32, 34, 70]) + 12;

  y = drawSectionHeading(doc, "Revenue and COGS", y);
  if (financials.revenue !== null && financials.cogs !== null) {
    y = drawBars(doc, [
      { label: "Revenue", value: financials.revenue, color: colors.brandCyan },
      { label: "COGS", value: financials.cogs, color: colors.brandPurple },
      { label: "Gross Profit", value: financials.grossProfit, color: colors.green },
    ], page.margin, y, 174, 38);
  } else {
    y = drawUnavailable(doc, "Sales and margin chart unavailable", "Revenue and COGS fields are required for a supported retail margin chart.", page.margin, y, 174, 28);
  }
  y += 10;

  y = drawSectionHeading(doc, "Gross Margin by Category", y);
  const margins = report.retailAnalysis?.grossMarginByCategory || [];
  if (margins.length === 0) {
    drawUnavailable(doc, "Category margin unavailable", "Category, revenue, and cost fields are required to calculate gross margin by category.", page.margin, y, 174, 28);
  } else {
    drawTable(doc, [
      ["Category", "Gross Margin", "Status", "Notes"],
      ...margins.map((item): TableRow => [
        item.name,
        formatPercent(item.value),
        item.value < 25 ? "Risk" : "Available",
        `${formatCurrency(item.grossProfit)} on ${formatCurrency(item.revenue)} revenue; COGS ${formatCurrency(item.cogs)}.`,
      ]),
    ], page.margin, y, [52, 34, 28, 60]);
  }
}

function isRenderableAverageOrderValue(aov: NonNullable<Report["retailAnalysis"]>["averageOrderValue"] | undefined) {
  if (!aov || typeof aov !== "object") return false;
  const source = aov.orderCountSource;
  return aov.status === "available"
    && aov.aovStatus === "available"
    && aov.value !== null
    && Number.isFinite(aov.value)
    && typeof aov.orderCount === "number"
    && aov.orderCount > 0
    && (source === "distinct_order_id" || source === "explicit_order_grain");
}

function drawRetailInventoryIntelligence(doc: jsPDF, report: Report) {
  const retail = report.retailAnalysis;
  if (!retail) return;
  let y = 48;
  y = drawSectionHeading(doc, "Inventory Intelligence", y, layout.metricCardHeight);
  y = drawMetricGrid(doc, [
    numberMetricCard("Current Stock", retail.currentStock === null ? "Not available" : retail.currentStock.toLocaleString(), "Stock units from source data."),
    metricCard("Inventory Value", retail.inventoryValue, "currency", "missing", "Estimated from stock and unit cost."),
    numberMetricCard("Low Stock Positions", retail.lowStockSkuCount === null ? "Not available" : retail.lowStockSkuCount.toLocaleString(), "At or below reorder point."),
    numberMetricCard("Out of Stock", retail.outOfStockSkuCount === null ? "Not available" : retail.outOfStockSkuCount.toLocaleString(), "Stock less than or equal to zero."),
  ], y);
  y += 10;

  y = drawSectionHeading(doc, "Low Stock Positions / Reorder Required", y);
  if (retail.lowStockItems.length === 0) {
    y = drawUnavailable(doc, "No reorder exceptions detected", "No products are at or below detected reorder point in the loaded data.", page.margin, y, 174, 28) + 12;
  } else {
    y = drawTable(doc, [
      ["Product", "Stock", "Reorder Point", "Supplier / Category"],
      ...retail.lowStockItems.map((item): TableRow => [
        item.product,
        item.stock.toLocaleString(),
        item.reorderPoint.toLocaleString(),
        [item.supplier, item.category].filter(Boolean).join(" / ") || "Not available",
      ]),
    ], page.margin, y, [56, 24, 34, 60]) + 12;
  }

  y = drawSectionHeading(doc, "Stock by Category", y);
  const stockRows = retail.stockByCategory;
  if (stockRows.length === 0) {
    drawUnavailable(doc, "Stock by category unavailable", "Category and stock fields are required for category inventory analysis.", page.margin, y, 174, 28);
  } else {
    drawTable(doc, [
      ["Category", "Stock", "Status", "Notes"],
      ...stockRows.map((item): TableRow => [item.name, item.value.toLocaleString(), "Available", "Source stock grouped by category."]),
    ], page.margin, y, [58, 34, 28, 54]);
  }
}

function drawRetailProductIntelligence(doc: jsPDF, report: Report, financials: ReportFinancials) {
  const retail = report.retailAnalysis;
  if (!retail) return;
  let y = 48;
  y = drawSectionHeading(doc, "Product / Category / Supplier Intelligence", y);
  const topProducts = retail.topProductsByRevenue;
  if (topProducts.length > 0) {
    y = drawTable(doc, [
      ["Product / SKU", "Revenue", "Share", "Notes"],
      ...topProducts.map((item): TableRow => [
        item.name,
        formatCurrency(item.value),
        financials.revenue ? formatPercent((item.value / financials.revenue) * 100) : "Not available",
        "Source revenue grouped by product.",
      ]),
    ], page.margin, y, [58, 34, 24, 58]) + 12;
  } else {
    y = drawUnavailable(doc, "Product revenue unavailable", "Product and revenue fields are required to rank products.", page.margin, y, 174, 28) + 12;
  }

  y = drawSectionHeading(doc, "Category and Supplier Exposure", y);
  const category = retail.revenueByCategory[0];
  const supplier = retail.supplierExposure[0];
  drawTable(doc, [
    ["Dimension", "Top Value", "Revenue / Value", "Notes"],
    ["Category", category?.name || "Not available", category ? formatCurrency(category.value) : "Not available", "Highest revenue category from source fields."],
    ["Supplier", supplier?.name || "Not available", supplier ? formatCurrency(supplier.value) : "Not available", "Highest revenue supplier from source fields."],
    ["Inventory Value", retail.inventoryValueByProduct[0]?.name || "Not available", retail.inventoryValueByProduct[0] ? formatCurrency(retail.inventoryValueByProduct[0].value) : "Not available", "Highest detected inventory value by product."],
    ["Supplier Count", retail.supplierCount === null ? "Not available" : retail.supplierCount.toLocaleString(), "Available", "Distinct recognized suppliers."],
  ], page.margin, y, [36, 54, 34, 50]);
}

function drawEcommerceSalesPerformance(doc: jsPDF, report: Report, financials: ReportFinancials) {
  const ecommerce = report.ecommerceAnalysis;
  if (!ecommerce) return;
  let y = 48;
  y = drawSectionHeading(doc, "E-commerce Sales Performance", y);
  y = drawTable(doc, [
    ["Metric", "Value", "Status", "Source / Notes"],
    financialRow(financials, "Revenue", "revenue", "currency"),
    ["Orders", ecommerce.orders === null ? "Not available" : ecommerce.orders.toLocaleString(), ecommerce.orders === null ? "Not available" : "Available", ecommerce.orderField ? `Distinct order count from ${ecommerce.orderField}.` : "No reliable order identifier."],
    ["Average Order Value", ecommerce.averageOrderValue === null ? "Not available" : formatCurrency(ecommerce.averageOrderValue), ecommerce.averageOrderValue === null ? "Not available" : "Available", "Revenue / distinct order count."],
    ["Units Sold", ecommerce.unitsSold === null ? "Not available" : ecommerce.unitsSold.toLocaleString(), ecommerce.unitsSold === null ? "Not available" : "Available", "Recognized quantity field."],
    financialRow(financials, "COGS", "cogs", "currency"),
    financialRow(financials, "Gross Profit", "grossProfit", "currency"),
    financialRow(financials, "Gross Margin", "grossMargin", "percent"),
  ], page.margin, y, [38, 32, 34, 70]) + 12;

  y = drawSectionHeading(doc, "Revenue Trend", y);
  if (ecommerce.revenueTrend.length >= 2) {
    y = drawTable(doc, [
      ["Period", "Revenue", "Status", "Notes"],
      ...ecommerce.revenueTrend.map((item): TableRow => [item.name, formatCurrency(item.value), "Available", "Grouped from order date and revenue."]),
    ], page.margin, y, [38, 32, 34, 70]) + 12;
  } else {
    y = drawUnavailable(doc, "Revenue trend unavailable", "Order date and revenue fields are required for e-commerce revenue trend.", page.margin, y, 174, 28) + 12;
  }

  y = drawSectionHeading(doc, "Category Performance", y);
  if (ecommerce.categoryPerformance.length > 0) {
    y = drawTable(doc, [
      ["Category", "Revenue", "Share", "Notes"],
        ...ecommerce.categoryPerformance.map((item): TableRow => [
        item.name,
        formatCurrency(item.value),
        financials.revenue ? formatPercent((item.value / financials.revenue) * 100) : "Not available",
        "Product category revenue.",
      ]),
    ], page.margin, y, [52, 34, 28, 60]) + 12;
  } else {
    y = drawUnavailable(doc, "Category performance unavailable", "Product category and revenue fields are required.", page.margin, y, 174, 28) + 12;
  }

  y = drawSectionHeading(doc, "Top Products", y);
  if (ecommerce.topProducts.length > 0) {
    drawTable(doc, [
      ["Product", "Revenue", "Share", "Notes"],
      ...ecommerce.topProducts.map((item): TableRow => [
        item.name,
        formatCurrency(item.value),
        financials.revenue ? formatPercent((item.value / financials.revenue) * 100) : "Not available",
        "Source revenue grouped by product.",
      ]),
    ], page.margin, y, [58, 34, 24, 58]);
  } else {
    drawUnavailable(doc, "Top products unavailable", "Product and revenue fields are required.", page.margin, y, 174, 28);
  }
}

function drawEcommerceCommercialIntelligence(doc: jsPDF, report: Report, financials: ReportFinancials) {
  const ecommerce = report.ecommerceAnalysis;
  if (!ecommerce) return;
  let y = 48;
  y = drawSectionHeading(doc, "Customer Metrics", y);
  y = drawTable(doc, [
    ["Metric", "Value", "Status", "Source / Notes"],
    ["Customers", ecommerce.customers === null ? "Not available" : ecommerce.customers.toLocaleString(), ecommerce.customers === null ? "Not available" : "Available", ecommerce.customerField ? `Distinct values from ${ecommerce.customerField}.` : "No customer identifier."],
    ["Orders per Customer", ecommerce.ordersPerCustomer === null ? "Not available" : ecommerce.ordersPerCustomer.toLocaleString(), ecommerce.ordersPerCustomer === null ? "Not available" : "Available", "Distinct orders divided by distinct customers."],
    ["Revenue per Customer", ecommerce.revenuePerCustomer === null ? "Not available" : formatCurrency(ecommerce.revenuePerCustomer), ecommerce.revenuePerCustomer === null ? "Not available" : "Available", "Revenue divided by distinct customers."],
    ["Returns", ecommerce.returnRate === null ? "Not available" : formatPercent(ecommerce.returnRate), ecommerce.returnRate === null ? "Not available" : "Available", ecommerce.returnStatus === "available" && ecommerce.returnStatusField ? `Returned orders from ${ecommerce.returnStatusField}.` : "Return status values could not be normalized reliably."],
  ], page.margin, y, [42, 35, 30, 67]) + 12;

  y = drawSectionHeading(doc, "Channel Performance", y);
  if (ecommerce.channelPerformance.length > 0) {
    y = drawTable(doc, [
      ["Channel", "Revenue", "Orders / AOV", "Notes"],
      ...ecommerce.channelPerformance.map((item): TableRow => [
        item.name,
        formatCurrency(item.value),
        `${item.orders === null ? "Not available" : item.orders.toLocaleString()} / ${item.aov === null ? "Not available" : formatCurrency(item.aov)}`,
        item.share === null ? "Revenue share unavailable." : `${formatPercent(item.share)} of revenue.`,
      ]),
    ], page.margin, y, [42, 34, 38, 60]) + 12;
  } else {
    y = drawUnavailable(doc, "Channel performance unavailable", "Channel and revenue fields are required.", page.margin, y, 174, 28) + 12;
  }

  y = drawSectionHeading(doc, "Geography / Commercial Costs", y);
  const geography = ecommerce.geography[0];
  y = drawTable(doc, [
    ["Metric", "Value", "Status", "Source / Notes"],
    ["Top Geography", geography?.name || "Not available", geography ? "Available" : "Not available", geography ? `${formatCurrency(geography.value)} revenue; ${geography.orders === null ? "order count not available" : geography.orders.toLocaleString() + " orders"}.` : "Country or region field is missing."],
    ["Shipping / Fulfillment Cost", ecommerce.shippingCost === null ? "Not available" : formatCurrency(ecommerce.shippingCost), ecommerce.shippingCost === null ? "Not available" : "Available", ecommerce.shippingCostRate === null ? "Tracked separately from COGS." : `${formatPercent(ecommerce.shippingCostRate)} of revenue; separate from COGS.`],
    ["Avg Shipping Cost / Order", ecommerce.averageShippingCostPerOrder === null ? "Not available" : formatCurrency(ecommerce.averageShippingCostPerOrder), ecommerce.averageShippingCostPerOrder === null ? "Not available" : "Available", "Shipping cost divided by distinct order count."],
    ["Total Discounts", ecommerce.discounts === null ? "Not available" : formatCurrency(ecommerce.discounts), ecommerce.discounts === null ? "Not available" : "Available", ecommerce.discountRate === null ? "Discount field missing or zero revenue." : `${formatPercent(ecommerce.discountRate)} of revenue.`],
  ], page.margin, y, [44, 40, 30, 60]);

  if (ecommerce.paymentMethods.length > 0) {
    y += 10;
    y = drawSectionHeading(doc, "Payment Method", y);
    drawTable(doc, [
      ["Payment Method", "Revenue", "Orders", "Notes"],
      ...ecommerce.paymentMethods.map((item): TableRow => [item.name, formatCurrency(item.value), item.orders === null ? "Not available" : item.orders.toLocaleString(), "Source revenue grouped by payment method."]),
    ], page.margin, y, [54, 34, 28, 58]);
  }
}

function drawSaasRecurringRevenue(doc: jsPDF, report: Report) {
  const saas = report.saasAnalysis;
  if (!saas) return;
  let y = 48;
  y = drawSectionHeading(doc, "Recurring Revenue Snapshot", y);
  y = drawTable(doc, [
    ["Metric", "Value", "Status", "Source / Notes"],
    saasRow("MRR", saas.mrr, "currency", saas.mrrField ? "Source value" : "Not available", saas.mrrField ? (saas.canonicalFields?.mrr_after === saas.mrrField ? `Latest-period active customer state from ${saas.mrrField}.` : `Latest-period sum from ${saas.mrrField}.`) : "No MRR field."),
    saasRow("ARR", saas.arr, "currency", saas.arrField ? "Source value" : "Not available", saas.arrField ? (saas.arrField === saas.mrrField ? `Annualized from source MRR field ${saas.arrField}.` : `Latest-period sum from ${saas.arrField}.`) : "No ARR or MRR field."),
    saasRow("New MRR", saas.newMrr ?? null, "currency", saas.newMrrField ? "Source movement" : "Not available", saas.newMrrField ? `Latest-period new movement from ${saas.newMrrField}.` : "No new MRR movement field."),
    saasRow("Expansion MRR", saas.expansionMrr, "currency", saas.expansionMrrField ? "Source value" : "Not available", saas.expansionMrrField ? `Latest-period sum from ${saas.expansionMrrField}.` : "No expansion MRR field."),
    saasRow("Contraction MRR", saas.contractionMrr, "currency", saas.contractionMrrField ? "Source value" : "Not available", saas.contractionMrrField ? `Latest-period sum from ${saas.contractionMrrField}.` : "No contraction MRR field."),
    saasRow("Churned MRR", saas.churnedMrr ?? null, "currency", saas.churnedMrrField ? "Source movement" : "Not available", saas.churnedMrrField ? `Latest-period churn movement from ${saas.churnedMrrField}.` : "No churned MRR movement field."),
    saasRow("Net Expansion MRR", saas.netExpansionMrr, "currency", saas.netExpansionMrr !== null ? "Valid derived" : "Not available", "Expansion MRR minus Contraction MRR."),
    ["Latest Period", saas.latestPeriod || "Not available", saas.latestPeriod ? "Available" : "Not available", saas.periodField ? `Mapped from ${saas.periodField}.` : "No period field."],
  ], page.margin, y, [42, 35, 30, 67]) + 12;

  y = drawSectionHeading(doc, "MRR Trend", y);
  y = drawSaasTrendTable(doc, saas.mrrTrend, y, "MRR") + 12;

  y = drawSectionHeading(doc, "Plan Performance", y);
  if (saas.planPerformance.length === 0) {
    drawUnavailable(doc, "Plan intelligence unavailable", "Plan and recurring-revenue fields are required for plan performance.", page.margin, y, 174, 28);
  } else {
    drawTable(doc, [
      ["Plan", "MRR", "ARR", "Notes"],
      ...saas.planPerformance.map((item): TableRow => [
        item.name,
        item.mrr === null ? "Not available" : formatCurrency(item.mrr),
        item.arr === null ? "Not available" : formatCurrency(item.arr),
        item.share === null ? `${item.customers ?? "Unknown"} customers.` : `${formatPercent(item.share)} of latest-period MRR; ${item.customers ?? "unknown"} customers.`,
      ]),
    ], page.margin, y, [45, 32, 32, 65]);
  }
}

function hasSaasCapability(report: Report, capability: string) {
  const saas = report.saasAnalysis;
  if (!saas) return false;
  if (saas.availableCapabilities?.includes(capability)) return true;
  if (!saas.availableCapabilities) return true;
  return false;
}

function drawSaasCustomerEconomics(doc: jsPDF, report: Report) {
  const saas = report.saasAnalysis;
  if (!saas) return;
  let y = 48;
  y = drawSectionHeading(doc, "Customer Metrics", y);
  y = drawTable(doc, [
    ["Metric", "Value", "Status", "Source / Notes"],
    ["Customers", saas.customers === null ? "Not available" : saas.customers.toLocaleString(), saas.customers === null ? "Not available" : "Available", saasCustomerNote(saas)],
    ["New Customers", saas.newCustomers === null ? "Not available" : saas.newCustomers.toLocaleString(), saas.newCustomers === null ? "Not available" : "Available", saasNewCustomerNote(saas)],
    ["Churned Customers", saas.churnedCustomers === null ? "Not available" : saas.churnedCustomers.toLocaleString(), saas.churnedCustomers === null ? "Not available" : "Available", saasChurnedCustomerNote(saas)],
    ["Churn Rate", saas.churnRate === null ? "Not available" : formatPercent(saas.churnRate), saas.churnRate === null ? "Not available" : saas.churnRateSource === "source_rate" ? "Source value" : "Valid derived", saasChurnRateNote(saas)],
    saasRow("CAC", saas.cac, "currency", saas.cacField ? "Source value" : "Not available", saas.cacField ? `Latest-period average from ${saas.cacField}.` : "No CAC field."),
    saasRow("LTV", saas.ltv, "currency", saas.ltvField ? "Source value" : "Not available", saas.ltvField ? `Latest-period average from ${saas.ltvField}.` : "No LTV field."),
    ["LTV/CAC", saas.ltvToCac === null ? "Not available" : `${saas.ltvToCac.toFixed(2)}x`, saas.ltvToCac === null ? "Not available" : "Valid derived", "LTV divided by CAC when both latest-period averages are available."],
    ["Active Users", saas.activeUsers === null ? "Not available" : saas.activeUsers.toLocaleString(), saas.activeUsers === null ? "Not available" : "Source value", saas.activeUsersField ? `Latest-period sum from ${saas.activeUsersField}.` : "No active users field."],
    ["Support Tickets", saas.supportTickets === null ? "Not available" : saas.supportTickets.toLocaleString(), saas.supportTickets === null ? "Not available" : "Source value", saas.supportTicketsField ? `Latest-period sum from ${saas.supportTicketsField}.` : "No support tickets field."],
  ], page.margin, y, [42, 35, 30, 67]) + 12;

  y = drawSectionHeading(doc, "Country Segmentation", y);
  if (saas.geography.length === 0) {
    drawUnavailable(doc, "Geography unavailable", "Country or region fields are required for SaaS geography.", page.margin, y, 174, 28);
  } else {
    drawTable(doc, [
      ["Country", "Customers", "MRR", "Notes"],
      ...saas.geography.map((item): TableRow => [
        item.name,
        item.customers === null ? "Not available" : item.customers.toLocaleString(),
        item.mrr === null ? "Not available" : formatCurrency(item.mrr),
        item.share === null ? "MRR share unavailable." : `${formatPercent(item.share)} of latest-period MRR.`,
      ]),
    ], page.margin, y, [45, 32, 32, 65]);
  }
}

function drawSaasCashHealth(doc: jsPDF, report: Report) {
  const saas = report.saasAnalysis;
  if (!saas) return;
  let y = 48;
  y = drawSectionHeading(doc, "Cash / Startup Health", y);
  y = drawTable(doc, [
    ["Metric", "Value", "Status", "Source / Notes"],
    saasRow("Burn", saas.burn, "currency", saas.burnField ? "Source value" : "Not available", saas.burnField ? `Latest-period average from ${saas.burnField}; not mapped to COGS or net loss.` : "No burn field."),
    saasRow("Cash Balance", saas.cashBalance, "currency", saas.cashBalanceField ? "Source value" : "Not available", saas.cashBalanceField ? `Latest-period average from ${saas.cashBalanceField}; snapshots are not summed.` : "No cash balance field."),
    ["Runway", saas.runwayMonths === null ? "Not available" : `${saas.runwayMonths.toFixed(1)} months`, saas.runwayMonths === null ? "Not available" : "Source value", saas.runwayField ? `Explicit latest-period average from ${saas.runwayField}.` : "No runway field."],
  ], page.margin, y, [42, 35, 30, 67]) + 12;

  y = drawSectionHeading(doc, "Burn / Cash / Runway Trends", y);
  y = drawSaasTrendTable(doc, saas.burnTrend, y, "Burn") + 10;
  y = drawSaasTrendTable(doc, saas.cashTrend, y, "Cash Balance") + 10;
  drawSaasTrendTable(doc, saas.runwayTrend, y, "Runway");
}

function saasRow(label: string, value: number | null, format: "currency" | "number", status: string, note: string): TableRow {
  return [
    label,
    value === null ? "Not available" : format === "currency" ? formatCurrency(value) : value.toLocaleString(),
    value === null ? "Not available" : status,
    note,
  ];
}

function saasCustomerNote(saas: SaasReportAnalysis) {
  if (!saas.customerField) return "Requires customer ID or customer-count snapshot.";
  if (saas.customerAggregation === "latest_snapshot") return `Latest-period source value from ${saas.customerField}.`;
  if (saas.customerAggregation === "distinct_ids") return `Distinct customer identifiers from ${saas.customerField}.`;
  return `Source value from ${saas.customerField}.`;
}

function saasNewCustomerNote(saas: SaasReportAnalysis) {
  if (!saas.newCustomerField) return "Requires new-customer field.";
  if (saas.newCustomerAggregation === "latest_snapshot") return `Latest-period source value from ${saas.newCustomerField}.`;
  return `Distinct customers with normalized positive ${saas.newCustomerField}.`;
}

function saasChurnedCustomerNote(saas: SaasReportAnalysis) {
  if (!saas.churnedCustomerField) return "No churned-customer field.";
  if (saas.churnedCustomerAggregation === "latest_snapshot") return `Latest-period source value from ${saas.churnedCustomerField}.`;
  return `Distinct customers with normalized positive ${saas.churnedCustomerField}.`;
}

function saasChurnRateNote(saas: SaasReportAnalysis) {
  if (saas.churnRateSource === "source_rate" && saas.churnRateField) return `Latest-period source value from ${saas.churnRateField}.`;
  if (saas.churnRateSource === "derived_from_counts" && saas.eligibleChurnCustomers !== null) {
    return `${saas.churnedCustomers} / ${saas.eligibleChurnCustomers} same-period customers.`;
  }
  if (saas.churnRateSource === "derived_from_status" && saas.eligibleChurnCustomers !== null) {
    return `${saas.churnedCustomers} / ${saas.eligibleChurnCustomers} customers with normalized churn status.`;
  }
  return "Requires source churn rate or compatible same-period churn count and customer base.";
}

function drawSaasTrendTable(doc: jsPDF, trend: { name: string; value: number }[], y: number, label: string) {
  if (trend.length < 2) {
    return drawUnavailable(doc, `${label} trend unavailable`, `At least two valid period values are required for ${label}.`, page.margin, y, 174, 26);
  }
  return drawTable(doc, [
    ["Period", label, "Status", "Notes"],
    ...trend.map((item): TableRow => [item.name, label === "Runway" ? `${item.value.toFixed(1)} months` : label === "Burn" || label === "Cash Balance" || label.includes("MRR") ? formatCurrency(item.value) : item.value.toLocaleString(), "Available", "Grouped by recognized SaaS period field."]),
  ], page.margin, y, [42, 36, 30, 66]);
}

function drawMarketplaceEconomics(doc: jsPDF, report: Report, financials: ReportFinancials) {
  const marketplace = report.marketplaceAnalysis;
  if (!marketplace) return;
  let y = 48;
  y = drawSectionHeading(doc, "Marketplace Economics", y);
  y = drawTable(doc, [
    ["Metric", "Value", "Status", "Source / Notes"],
    ["GMV", marketplace.gmv === null ? "Not available" : formatCurrency(marketplace.gmv), marketplace.gmv === null ? "Not available" : "Source value", marketplace.gmvField ? `Sum of ${marketplace.gmvField}.` : "No GMV field."],
    ["Marketplace Revenue", marketplace.marketplaceRevenue === null ? "Not available" : formatCurrency(marketplace.marketplaceRevenue), marketplace.marketplaceRevenue === null ? "Not available" : "Source value", marketplace.marketplaceRevenueField ? `Sum of ${marketplace.marketplaceRevenueField}.` : "No marketplace revenue field."],
    ["Take Rate", marketplace.takeRate === null ? "Not available" : `${marketplace.takeRate.toFixed(2)}%`, marketplace.takeRate === null ? "Not available" : "Derived", "Marketplace Revenue divided by GMV."],
    ["Seller Payout", marketplace.sellerPayout === null ? "Not available" : formatCurrency(marketplace.sellerPayout), marketplace.sellerPayout === null ? "Not available" : "Source value", marketplace.sellerPayoutField ? `Sum of ${marketplace.sellerPayoutField}.` : "No seller payout field."],
    ["Refund Amount", marketplace.refunds === null ? "Not available" : formatCurrency(marketplace.refunds), marketplace.refunds === null ? "Not available" : "Source value", marketplace.refundsField ? `Sum of ${marketplace.refundsField}.` : "No refund field."],
    ["Refund Rate", marketplace.refundRate === null ? "Not available" : `${marketplace.refundRate.toFixed(2)}%`, marketplace.refundRate === null ? "Not available" : "Derived", "Refund Amount divided by GMV."],
  ], page.margin, y, [42, 35, 30, 67]) + 12;

  y = drawSectionHeading(doc, "GMV and Revenue Trends", y);
  y = drawMarketplaceTrendTable(doc, marketplace.gmvTrend, y, "GMV") + 10;
  drawMarketplaceTrendTable(doc, marketplace.marketplaceRevenueTrend, y, "Marketplace Revenue");
}

function drawMarketplaceBuyerSellerIntelligence(doc: jsPDF, report: Report, financials: ReportFinancials) {
  const marketplace = report.marketplaceAnalysis;
  if (!marketplace) return;
  let y = 48;
  y = drawSectionHeading(doc, "Buyer & Seller Intelligence", y);
  y = drawTable(doc, [
    ["Metric", "Value", "Status", "Source / Notes"],
    ["Transactions", marketplace.transactions === null ? "Not available" : marketplace.transactions.toLocaleString(), marketplace.transactions === null ? "Not available" : "Source value", marketplace.transactionField ? `Distinct values from ${marketplace.transactionField}.` : "Row count used as transaction proxy."],
    ["Average Transaction Value", marketplace.averageTransactionValue === null ? "Not available" : formatCurrency(marketplace.averageTransactionValue), marketplace.averageTransactionValue === null ? "Not available" : "Derived", "GMV divided by transactions."],
    ["Buyers", marketplace.buyers === null ? "Not available" : marketplace.buyers.toLocaleString(), marketplace.buyers === null ? "Not available" : "Source value", marketplace.buyerField ? `Distinct values from ${marketplace.buyerField}.` : "No buyer field."],
    ["Sellers", marketplace.sellers === null ? "Not available" : marketplace.sellers.toLocaleString(), marketplace.sellers === null ? "Not available" : "Source value", marketplace.sellerField ? `Distinct values from ${marketplace.sellerField}.` : "No seller field."],
    ["New Buyers", marketplace.newBuyers === null ? "Not available" : marketplace.newBuyers.toLocaleString(), marketplace.newBuyers === null ? "Not available" : "Derived", marketplace.newBuyerField ? `Normalized positives from ${marketplace.newBuyerField}.` : "No new buyer field."],
    ["New Sellers", marketplace.newSellers === null ? "Not available" : marketplace.newSellers.toLocaleString(), marketplace.newSellers === null ? "Not available" : "Derived", marketplace.newSellerField ? `Normalized positives from ${marketplace.newSellerField}.` : "No new seller field."],
    ["Active Sellers", marketplace.activeSellers === null ? "Not available" : marketplace.activeSellers.toLocaleString(), marketplace.activeSellers === null ? "Not available" : "Source value", marketplace.activeSellersField ? (marketplace.activeSellersAggregation === "latest_snapshot" ? `Latest snapshot from ${marketplace.activeSellersField}.` : `Sum of ${marketplace.activeSellersField}.`) : "No active sellers field."],
    ["Listings", marketplace.listings === null ? "Not available" : marketplace.listings.toLocaleString(), marketplace.listings === null ? "Not available" : "Source value", marketplace.listingsField ? (marketplace.listingsAggregation === "latest_snapshot" ? `Latest snapshot from ${marketplace.listingsField}.` : `Sum of ${marketplace.listingsField}.`) : "No listing count field."],
    ["Completion Rate", marketplace.completionRate === null ? "Not available" : `${marketplace.completionRate.toFixed(1)}%`, marketplace.completionRate === null ? "Not available" : "Derived", "Completed transactions divided by total transactions."],
  ], page.margin, y, [55, 32, 28, 59]);
}

function drawMarketplaceCategoryGeography(doc: jsPDF, report: Report, financials: ReportFinancials) {
  const marketplace = report.marketplaceAnalysis;
  if (!marketplace) return;
  let y = 48;
  y = drawSectionHeading(doc, "Category & Geography Performance", y);
  if (marketplace.categoryPerformance.length > 0) {
    y = drawSectionHeading(doc, "GMV by Category", y);
    y = drawTable(doc, [
      ["Category", "GMV", "Share", "Notes"],
      ...marketplace.categoryPerformance.slice(0, 8).map((item): TableRow => [
        item.name,
        formatCurrency(item.value),
        marketplace.gmv && marketplace.gmv > 0 ? formatPercent((item.value / marketplace.gmv) * 100) : "Not available",
        "Source value from category and GMV fields.",
      ]),
    ], page.margin, y, [55, 35, 28, 56]) + 12;
  } else {
    y = drawUnavailable(doc, "Category performance unavailable", "No category field found in the selected dataset.", page.margin, y, 174, 26) + 12;
  }

  if (marketplace.geography.length > 0) {
    y = drawSectionHeading(doc, "GMV by Country", y);
    drawTable(doc, [
      ["Country", "GMV", "Share", "Notes"],
      ...marketplace.geography.slice(0, 8).map((item): TableRow => [
        item.name,
        formatCurrency(item.value),
        marketplace.gmv && marketplace.gmv > 0 ? formatPercent((item.value / marketplace.gmv) * 100) : "Not available",
        "Source value from country and GMV fields.",
      ]),
    ], page.margin, y, [55, 35, 28, 56]);
  } else {
    y = drawUnavailable(doc, "Geography performance unavailable", "No country field found in the selected dataset.", page.margin, y, 174, 26);
  }
}

function drawMarketplaceTrendTable(doc: jsPDF, trend: { name: string; value: number }[], y: number, label: string) {
  if (trend.length < 2) {
    return drawUnavailable(doc, `${label} trend unavailable`, `At least two valid period values are required for ${label}.`, page.margin, y, 174, 26);
  }
  return drawTable(doc, [
    ["Period", label, "Status", "Notes"],
    ...trend.map((item): TableRow => [item.name, formatCurrency(item.value), "Available", "Grouped by recognized date field."]),
  ], page.margin, y, [42, 36, 30, 66]);
}

function marketplaceRow(label: string, value: number | null, format: "currency" | "number", status: string, note: string): TableRow {
  return [
    label,
    value === null ? "Not available" : format === "currency" ? formatCurrency(value) : value.toLocaleString(),
    value === null ? "Not available" : status,
    note,
  ];
}

function drawBusinessConsultingFinancials(doc: jsPDF, report: Report, financials: ReportFinancials) {
  let y = 48;
  y = drawSectionHeading(doc, "Business Consulting Financials", y);
  const consultantCost = financials.consultantCost ?? null;
  const otherCost = financials.otherCost ?? null;
  const totalProjectCost = financials.totalProjectCost ?? null;
  const grossProfit = financials.grossProfit ?? null;
  const grossMargin = financials.grossMargin ?? null;
  y = drawTable(doc, [
    ["Metric", "Value", "Status", "Source / Notes"],
    ["Revenue", financials.revenue === null ? "Not available" : formatCurrency(financials.revenue), financials.revenue !== null ? "Available" : "Missing", "Source field: revenue"],
    ["Consultant Cost", consultantCost === null ? "Not available" : formatCurrency(consultantCost), consultantCost !== null ? "Available" : "Missing", "Source field: consultant_cost"],
    ["Other Cost", otherCost === null ? "Not available" : formatCurrency(otherCost), otherCost !== null ? "Available" : "Missing", "Source field: other_cost"],
    ["Total Project Cost", totalProjectCost === null ? "Not available" : formatCurrency(totalProjectCost), totalProjectCost !== null ? "Derived" : "N/A", "Consultant Cost + Other Cost"],
    ["Gross Profit", grossProfit === null ? "Not available" : formatCurrency(grossProfit), grossProfit !== null ? "Available" : "Missing", "Revenue - Total Project Cost"],
    ["Gross Margin", grossMargin === null ? "Not available" : formatPercent(grossMargin), grossMargin !== null ? "Available" : "Missing", "Gross Profit / Revenue"],
    ["Operating Expenses", financials.operatingExpenses === null ? "Not available" : formatCurrency(financials.operatingExpenses), "Not available", "Operating expense data not supplied"],
    ["Operating Profit", financials.operatingProfit === null ? "Not available" : formatCurrency(financials.operatingProfit), "Not available", "Requires operating expenses"],
    ["Net Profit", financials.netProfit === null ? "Not available" : formatCurrency(financials.netProfit), "Not available", "Requires operating expenses, interest, tax"],
  ], page.margin, y, [50, 35, 30, 59]) + 12;

  y = drawSectionHeading(doc, "Project Cost Breakdown", y, 45);
  const costRows: { label: string; value: number | null; color: Rgb }[] = [
    { label: "Revenue", value: financials.revenue, color: colors.brandCyan },
    { label: "Consultant Cost", value: consultantCost, color: colors.brandPurple },
    { label: "Other Cost", value: otherCost, color: colors.brandBlue },
    { label: "Gross Profit", value: grossProfit, color: colors.green },
  ].filter((row): row is { label: string; value: number; color: Rgb } => row.value !== null);

  if (costRows.length >= 2 && financials.revenue !== null) {
    y = drawBars(doc, costRows, page.margin, y, 174, 45);
  } else {
    y = drawUnavailable(doc, "Chart unavailable", "Revenue and cost data are required for project cost visualization.", page.margin, y, 174, 32) + 12;
  }
}

function drawProfessionalServicesFinancials(doc: jsPDF, report: Report, financials: ReportFinancials) {
  let y = 48;
  y = drawSectionHeading(doc, "Professional Services Financials", y);
  const freelancerCost = financials.freelancerCost ?? null;
  const adSpend = financials.adSpend ?? null;
  const totalDirectCost = financials.totalDirectCost ?? null;
  const grossProfit = financials.grossProfit ?? null;
  const grossMargin = financials.grossMargin ?? null;
  y = drawTable(doc, [
    ["Metric", "Value", "Status", "Source / Notes"],
    ["Revenue", financials.revenue === null ? "Not available" : formatCurrency(financials.revenue), financials.revenue !== null ? "Available" : "Missing", "Source field: revenue"],
    ["Freelancer Cost", freelancerCost === null ? "Not available" : formatCurrency(freelancerCost), freelancerCost !== null ? "Available" : "Missing", "Source field: freelancer_cost"],
    ["Ad Spend", adSpend === null ? "Not available" : formatCurrency(adSpend), adSpend !== null ? "Available" : "Missing", "Source field: ad_spend"],
    ["Total Direct Cost", totalDirectCost === null ? "Not available" : formatCurrency(totalDirectCost), totalDirectCost !== null ? "Derived" : "N/A", "Freelancer Cost + Ad Spend"],
    ["Gross Profit", grossProfit === null ? "Not available" : formatCurrency(grossProfit), grossProfit !== null ? "Available" : "Missing", "Revenue - Total Direct Cost"],
    ["Gross Margin", grossMargin === null ? "Not available" : formatPercent(grossMargin), grossMargin !== null ? "Available" : "Missing", "Gross Profit / Revenue"],
    ["Operating Expenses", financials.operatingExpenses === null ? "Not available" : formatCurrency(financials.operatingExpenses), "Not available", "Operating expense data not supplied"],
    ["Operating Profit", financials.operatingProfit === null ? "Not available" : formatCurrency(financials.operatingProfit), "Not available", "Requires operating expenses"],
    ["Net Profit", financials.netProfit === null ? "Not available" : formatCurrency(financials.netProfit), "Not available", "Requires operating expenses, interest, tax"],
  ], page.margin, y, [50, 35, 30, 59]) + 12;

  y = drawSectionHeading(doc, "Direct Cost Breakdown", y, 45);
  const costRows: { label: string; value: number | null; color: Rgb }[] = [
    { label: "Revenue", value: financials.revenue, color: colors.brandCyan },
    { label: "Freelancer Cost", value: freelancerCost, color: colors.brandPurple },
    { label: "Ad Spend", value: adSpend, color: colors.brandBlue },
    { label: "Gross Profit", value: grossProfit, color: colors.green },
  ].filter((row): row is { label: string; value: number; color: Rgb } => row.value !== null);

  if (costRows.length >= 2 && financials.revenue !== null) {
    y = drawBars(doc, costRows, page.margin, y, 174, 45);
  } else {
    y = drawUnavailable(doc, "Chart unavailable", "Revenue and cost data are required for direct cost visualization.", page.margin, y, 174, 32) + 12;
  }
}

function drawFinancialPerformance(doc: jsPDF, financials: ReportFinancials) {
  let y = 48;
  y = drawSectionHeading(doc, "Financial Performance", y);
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

  const expenseRows = [
    { label: "Revenue", value: financials.revenue, color: colors.brandCyan },
    { label: "COGS", value: financials.cogs, color: colors.brandPurple },
    { label: "Operating Expenses", value: financials.operatingExpenses, color: colors.brandBlue },
    { label: "Interest + Tax", value: financials.interestExpense !== null && financials.taxExpense !== null ? financials.interestExpense + financials.taxExpense : null, color: colors.brandLilac },
  ];
  y += 12;
  y = drawSectionHeading(doc, "Revenue vs Expenses", y, financials.revenue !== null && expenseRows.slice(1).some((row) => row.value !== null) ? 45 : layout.minimumUnavailableBlock);
  if (expenseRows.slice(1).some((row) => row.value !== null) && financials.revenue !== null) {
    y = drawBars(doc, expenseRows, page.margin, y, 174, 45);
  } else {
    y = drawUnavailable(doc, "Chart unavailable", "Required expense fields are missing. The report does not draw zero-cost bars for unknown COGS or expenses.", page.margin, y, 174, 32);
  }

  y += 10;
  y = drawSectionHeading(doc, "Profit and Margin Trend", y, 52);
  drawTrendPanel(doc, financials, page.margin, y, 174, 52);
}

function drawCostIntelligence(doc: jsPDF, report: Report, financials: ReportFinancials) {
  tracePdfRuntime("buildCostIntelligence", report, financials);
  let y = 48;
  const semanticContext = report.semanticContext;
  y = drawSectionHeading(doc, "Top Cost Categories", y);
  const categories = (financials.topCostCategories || []).filter((item) => Number.isFinite(item.value));
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

  y = drawSectionHeading(doc, "Management Interpretation", y, 26);
  const top = categories[0];
  const total = categories.reduce((sum, item) => sum + item.value, 0);
  const interpretation = top && total > 0
    ? `${top.name} is the largest detected cost category at ${formatPercent((top.value / total) * 100)} of categorized expenses. This is a source-backed concentration signal, not a complete cost review.`
    : "Cost concentration cannot be assessed without categorized expense amounts.";
  y = drawTextBox(doc, interpretation, page.margin, y, 174, 26) + 11;

  y = drawSectionHeading(doc, "Cost Optimization Opportunities", y, 24);
  const opportunity = top && total > 0
    ? `Review ${top.name} contracts, vendors, staffing, or usage drivers first because it is the largest sourced cost category.`
    : "Add categorized expense data before ranking cost optimization opportunities.";
  y = drawTextBox(doc, opportunity, page.margin, y, 174, 24) + 11;

  y = drawSectionHeading(doc, "Data Requirements", y);
  const pairedExpenseSource = report.reportType === "profitability" || report.reportProfile?.id === "profitability_pnl";
  const hasPairedCostCategories = pairedExpenseSource && categories.length > 0;
  const hasPairedExpenseAmount = pairedExpenseSource && financials.operatingExpenses !== null;
  const hasPairedPeriod = pairedExpenseSource && ((financials.periodTrends?.length ?? 0) > 0 || Boolean(financials.reportingPeriod));
  const hasExpenseCategory = Boolean(semanticContext?.expenseCategoryField) || hasPairedCostCategories;
  const hasExpenseAmount = Boolean(semanticContext?.expenseAmountField) || hasPairedExpenseAmount;
  const hasDateField = Boolean(semanticContext?.dateField) || hasPairedPeriod;
  const hasVendor = Boolean(semanticContext?.vendorField);
  drawTable(doc, [
    ["Required Field", "Purpose", "Status", "Notes"],
    ["Expense Category", "Categorize and analyze costs", hasExpenseCategory ? "Available" : "Missing", semanticContext?.expenseCategoryField ? `Mapped from ${semanticContext.expenseCategoryField}.` : hasPairedCostCategories ? "Available from paired expense input." : "No matching source field."],
    ["Expense Amount", "Quantify total cost by category", hasExpenseAmount ? "Available" : "Missing", semanticContext?.expenseAmountField ? `Mapped from ${semanticContext.expenseAmountField}.` : hasPairedExpenseAmount ? "Available from paired expense input." : "No matching source field."],
    ["Date / Period", "Analyze cost trends", hasDateField ? "Available" : "Missing", semanticContext?.dateField ? `Mapped from ${semanticContext.dateField}.` : hasPairedPeriod ? "Available from paired profitability period data." : "No matching source field."],
    ["Vendor / Supplier", "Identify vendor opportunities", hasVendor ? "Available" : "Missing", hasVendor ? `Mapped from ${semanticContext?.vendorField}.` : "No matching source field."],
  ], page.margin, y, [42, 55, 28, 49]);
}

function drawDepartmentProfitability(doc: jsPDF, financials: ReportFinancials) {
  tracePdfRuntime("drawDepartmentProfitability", {} as Report, financials);
  let y = 48;
  const departments = financials.departmentProfitability || [];
  if (departments.length === 0) {
    drawUnavailable(doc, "Department Profitability unavailable", "No department field found in the selected dataset.", page.margin, y, 174, 28);
    return;
  }
  y = drawSectionHeading(doc, "DEPARTMENT PROFITABILITY", y);
  y = drawTable(doc, [
    ["Department", "Revenue", "Net Profit", "Net Margin"],
    ...departments.map((dept): TableRow => [
      dept.name,
      formatCurrency(dept.revenue),
      formatCurrency(dept.netProfit),
      dept.netMargin !== null ? formatPercent(dept.netMargin) : "N/A",
    ]),
  ], page.margin, y, [55, 40, 40, 39]) + 12;

  y = drawTable(doc, [
    ["Department", "Gross Profit", "Operating Profit", "Notes"],
    ...departments.map((dept): TableRow => [
      dept.name,
      formatCurrency(dept.grossProfit),
      formatCurrency(dept.operatingProfit),
      "Source values from dataset",
    ]),
  ], page.margin, y, [55, 40, 40, 39]) + 12;

  const highestNetProfit = departments.reduce((max, dept) => dept.netProfit > max.netProfit ? dept : max, departments[0]);
  const highestNetMargin = departments.reduce((max, dept) => (dept.netMargin ?? -999) > (max.netMargin ?? -999) ? dept : max, departments[0]);
  const lowestNetMargin = departments.reduce((min, dept) => (dept.netMargin ?? 999) < (min.netMargin ?? 999) ? dept : min, departments[0]);

  y = drawSectionHeading(doc, "Key Findings", y);
  const findings = [
    `Highest Net Profit: ${highestNetProfit.name} (${formatCurrency(highestNetProfit.netProfit)})`,
    highestNetProfit.name !== highestNetMargin.name ? `Highest Net Margin: ${highestNetMargin.name} (${highestNetMargin.netMargin}%)` : null,
    lowestNetMargin.name !== highestNetMargin.name && lowestNetMargin.name !== highestNetProfit.name ? `Weakest Net Margin: ${lowestNetMargin.name} (${lowestNetMargin.netMargin}%)` : null,
  ].filter(Boolean);
  for (const finding of findings) {
    y = drawTextBox(doc, finding!, page.margin, y, 174, 20) + 8;
  }
}

function drawBalancedScorecard(doc: jsPDF, report: Report) {
  let y = 48;
  const bbsc = report.bbsc;
  if (!bbsc) {
    drawUnavailable(doc, "Business Balanced Scorecard unavailable", "The report has no scorecard payload.", page.margin, y, 174, 28);
    return;
  }

  y = drawMetricGrid(doc, [
    { title: "Score", value: bbsc.overallScore === null ? "Not available" : `${bbsc.overallScore} / 100`, status: "neutral", note: "Average of available perspectives only." },
    { title: "Available Perspectives", value: `${bbsc.availablePerspectiveCount} / 4`, status: "neutral", note: "Excluded perspectives are not estimated." },
    { title: "Strongest Perspective", value: bbsc.strongestPerspective?.shortTitle || "Not enough comparative data", status: "neutral", note: "Requires at least two perspectives." },
    { title: "Weakest Perspective", value: bbsc.weakestPerspective?.shortTitle || "Not enough comparative data", status: "neutral", note: "Requires at least two perspectives." },
  ], y);
  y += 10;

  y = drawSectionHeading(doc, "Perspectives", y);
  y = drawTable(doc, [
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
  y += 12;

  y = drawSectionHeading(doc, "Score Semantics", y, 34);
  drawTextBox(doc, `${bbsc.scoreExplanation} ${bbsc.confidenceNote}`, page.margin, y, 174, 34);
}

function drawRecommendationsAndProvenance(doc: jsPDF, report: Report, financials: ReportFinancials, title = "Executive Recommendations") {
  let y = 48;
  const recommendations = normalizeRecommendations(report, financials);
  y = drawSectionHeading(doc, title, y, recommendations.length > 0 ? layout.recommendationCardHeight : layout.minimumUnavailableBlock);
  if (recommendations.length === 0) {
    y = drawUnavailable(doc, "No grounded recommendations available", "The selected dataset does not contain enough supported signals for a management recommendation.", page.margin, y, 174, 28) + 12;
  } else {
    for (const [index, recommendation] of recommendations.entries()) {
      const priority = String(index + 1).padStart(2, "0");
      y = drawRecommendation(doc, priority, recommendation, y) + 7;
    }
  }

  y = drawSectionHeading(doc, "Report Provenance", y);
  y = drawTable(doc, [
    ["Item", "Value", "Status", "Notes"],
    ["Analysis Type", "AI-assisted analysis", "Available", "Narrative support with deterministic calculations where possible."],
    ["Calculation Basis", "Selected dataset only", "Available", "Server-side report input is rebuilt from the accessible dataset."],
    ["Rows Analyzed", report.rowCount.toLocaleString(), "Available", "Rows loaded for this report."],
    ["Missing Data", "Explicitly disclosed", "Available", "Unavailable metrics render as Not available."],
    ["Generated", cleanText(report.localTime), "Available", "Timestamp captured at report generation."],
  ], page.margin, y, [42, 45, 30, 57]) + 12;

  y = drawSectionHeading(doc, "About This Report", y, 28);
  drawTextBox(
    doc,
    "This report was generated automatically by UseClevr using the selected dataset. Metrics are derived from available source data. Missing or insufficient data is explicitly identified to reduce unsupported conclusions.",
    page.margin,
    y,
    174,
    28,
  );
}

function drawExecutiveResultsSummary(doc: jsPDF, report: Report, financials: ReportFinancials) {
  let y = 48;
  const summary = buildResultsSummary(report, financials);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...colors.body);
  const introText = "Final management snapshot from the canonical metrics, findings, recommendations, scorecard, and provenance in this report.";
  const introLines = doc.splitTextToSize(introText, 174);
  doc.text(introLines, page.margin, y);
  y += introLines.length * 10 + 8;

  if (summary.metrics.length > 0) {
    y = drawSectionHeading(doc, "Key Results", y, 30);
    y = drawSummaryMetricGrid(doc, summary.metrics, y) + layout.sectionGap;
  }

  if (summary.highlights.length > 0) {
    y = drawSummarySection(doc, "Performance Highlights", summary.highlights, y, 2, 8, 70) + layout.sectionGap;
  }

  if (summary.health.length > 0) {
    y = drawSummarySection(doc, "Business Health", summary.health, y, 2, 8, 55) + layout.sectionGap;
  }

  if (report.reportProfile?.id === "saas_startup" && summary.actions.length > 0) {
    y = drawSummarySection(doc, "Priority Actions", summary.actions, y, 3, 8) + layout.sectionGap;
  }

  if (summary.findings.length > 0) {
    y = drawSummarySection(doc, "Top Findings", summary.findings, y, 3, 8) + layout.sectionGap;
  }

  if (report.reportProfile?.id !== "saas_startup" && summary.actions.length > 0) {
    y = drawSummarySection(doc, "Priority Actions", summary.actions, y, 3, 8) + layout.sectionGap;
  }

  if (summary.status.length > 0 && y < 250) {
    y = drawSectionHeading(doc, "Data / Analysis Status", y, summaryItemHeight(doc, summary.status[0], 8));
    drawSummaryItems(doc, summary.status, y, 1, 8);
  }
}

function buildResultsSummary(report: Report, financials: ReportFinancials) {
  const recommendations = normalizeRecommendations(report, financials);
  const confidence = profileDataConfidence(report, financials);
  return {
    metrics: selectSummaryMetrics(report),
    highlights: selectPerformanceHighlights(report, financials),
    health: selectBusinessHealth(report, confidence),
    findings: selectTopFindings(report),
    actions: recommendations.slice(0, 4).map((recommendation, index): SummaryItem => ({
      label: String(index + 1).padStart(2, "0"),
      detail: [
        recommendation.recommendedAction,
        recommendation.businessImpact ? `Impact: ${recommendation.businessImpact}` : null,
        recommendation.estimatedImpact ? `Estimated impact: ${recommendation.estimatedImpact}` : null,
      ].filter(Boolean).join(" "),
      tone: recommendation.confidence === "Low" ? "risk" : "neutral",
    })),
    status: selectDataStatus(report, financials, confidence),
  };
}

function resultsSummaryTitle(report: Report) {
  if (resolvePdfBranch(report).isAccountancyLedger) return "Accountancy Results Summary";

  switch (report.reportProfile?.id) {
    case "local_retail":
      return "Retail Results Summary";
    case "ecommerce":
      return "E-commerce Results Summary";
    case "saas_startup":
      return "SaaS Results Summary";
    case "marketplace_startup":
      return "Marketplace Results Summary";
    case "investor_portfolio":
      return "Portfolio Results Summary";
    case "professional_services":
      return "Professional Services Results Summary";
    case "profitability_pnl":
      return "Profitability Results Summary";
    case "accountancy_ledger":
      return "Accountancy Results Summary";
    case "business_consulting":
    case "generic_business":
    default:
      return "Business Results Summary";
  }
}

function selectSummaryMetrics(report: Report): SummaryMetric[] {
  const available = report.kpis.filter((kpi) => isAvailableSummaryValue(kpi.value));
  const priorities = [
    ...(report.reportProfile?.primaryMetrics || []),
    ...(report.reportProfile?.secondaryMetrics || []),
    ...profileSummaryMetricAliases(report.reportProfile?.id),
  ];
  const selected: SummaryMetric[] = [];
  for (const priority of priorities) {
    const match = available.find((kpi) => matchesMetricPriority(kpi.title, priority) && !selected.some((item) => item.title === kpi.title));
    if (match) selected.push({ title: match.title, value: match.value });
    if (selected.length >= 8) return selected;
  }
  for (const kpi of available) {
    if (!selected.some((item) => item.title === kpi.title)) selected.push({ title: kpi.title, value: kpi.value });
    if (selected.length >= 8) break;
  }
  return selected;
}

function profileSummaryMetricAliases(profileId?: string): string[] {
  if (profileId === "local_retail") return ["Units Sold", "Current Stock", "Low Stock Positions", "AOV"];
  if (profileId === "ecommerce") return ["AOV", "Average Order Value", "Units Sold", "Return Rate", "Shipping / Fulfillment Cost"];
  if (profileId === "saas_startup") return ["MRR", "ARR", "Customers", "New Customers", "Churn Rate", "Net Expansion MRR", "CAC", "LTV", "Runway"];
  if (profileId === "marketplace_startup") return ["GMV", "Marketplace Revenue", "Take Rate", "Seller Payout", "Refund Amount", "Transactions", "Buyers", "Sellers"];
  if (profileId === "investor_portfolio") return ["Invested capital", "Portfolio valuation", "Average ownership"];
  if (profileId === "business_consulting" || profileId === "professional_services") return ["Billable hours", "Utilization revenue", "Project margin", "Client count"];
  if (profileId === "profitability_pnl") return ["Revenue", "COGS", "Gross Profit", "Operating Profit", "Net Profit", "Gross Margin", "Net Margin"];
  if (profileId === "accountancy_ledger") return ["Debit total", "Credit total", "Invoices / documents", "Accounts"];
  return ["Revenue", "Gross Profit", "Gross Margin", "Operating Profit", "Net Profit", "Costs"];
}

function matchesMetricPriority(title: string, priority: string) {
  const normalizedTitle = normalizeMetricName(title);
  const normalizedPriority = normalizeMetricName(priority);
  return normalizedTitle === normalizedPriority
    || normalizedTitle.includes(normalizedPriority)
    || normalizedPriority.includes(normalizedTitle);
}

function normalizeMetricName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function isAvailableSummaryValue(value: string) {
  return Boolean(value && !/not available|undefined|nan/i.test(value));
}

function selectPerformanceHighlights(report: Report, financials: ReportFinancials): SummaryItem[] {
  const highlights: SummaryItem[] = [];
  const profileId = report.reportProfile?.id as string | undefined;
  const isProfitabilityReport = profileId === "profitability_pnl" || profileId === "profitability" || report.reportType === "profitability";
  if (isProfitabilityReport) {
    if (financials.netMargin !== null) {
      highlights.push({
        label: "Net Margin",
        detail: `${financials.netMargin.toFixed(1)}%`,
      });
    }
    if (financials.revenueGrowth !== null && financials.revenueGrowth !== undefined) {
      highlights.push({
        label: "Revenue Growth",
        detail: `${financials.revenueGrowth > 0 ? "+" : ""}${financials.revenueGrowth.toFixed(1)}%`,
      });
    }
    if (financials.netProfit !== null) {
      highlights.push({
        label: "Net Profit",
        detail: formatCurrency(financials.netProfit),
      });
    }
    if (financials.operatingMargin !== null && financials.grossMargin !== null) {
      highlights.push({
        label: "Margin Gap",
        detail: `Gross ${financials.grossMargin.toFixed(1)}% vs Operating ${financials.operatingMargin.toFixed(1)}%`,
      });
    }
    if (financials.departmentProfitability && financials.departmentProfitability.length > 0) {
      const depts = financials.departmentProfitability;
      const highestNetProfit = depts.reduce((max, dept) => dept.netProfit > max.netProfit ? dept : max, depts[0]);
      const highestNetMargin = depts.reduce((max, dept) => (dept.netMargin ?? -999) > (max.netMargin ?? -999) ? dept : max, depts[0]);
      const lowestNetMargin = depts.reduce((min, dept) => (dept.netMargin ?? 999) < (min.netMargin ?? 999) ? dept : min, depts[0]);
      if (highestNetProfit) {
        highlights.push({
          label: "Highest Net Profit",
          detail: `${highestNetProfit.name}: ${formatCurrency(highestNetProfit.netProfit)}`,
        });
      }
      if (highestNetMargin && highestNetMargin.name !== highestNetProfit.name) {
        highlights.push({
          label: "Highest Net Margin",
          detail: `${highestNetMargin.name}: ${highestNetMargin.netMargin}%`,
        });
      }
    }
  }
  for (const chart of report.charts || []) {
    if (highlights.length >= 4) break;
    const top = chart.data?.find((item) => Number.isFinite(item.value));
    if (top) {
      highlights.push({
        label: truncate(chart.title, 32),
        detail: `${truncate(top.name, 42)}: ${formatSummaryChartValue(top.value, chart.title)}`,
      });
    }
  }
  for (const finding of report.findings || []) {
    if (highlights.length >= 4) break;
    const lowerFinding = finding.toLowerCase();
    if (!lowerFinding.includes("loaded rows") && !lowerFinding.includes("available from") && !lowerFinding.includes("recognized source")) {
      highlights.push({ label: "Report result", detail: findingToneDetail(finding), tone: classifyFindingTone(finding) });
    }
  }
  return dedupeSummaryItems(highlights).slice(0, 4);
}

function selectBusinessHealth(report: Report, confidence: number | null): SummaryItem[] {
  const health: SummaryItem[] = [];
  if (report.bbsc?.overallScore !== null && report.bbsc?.overallScore !== undefined) {
    health.push({ label: "Balanced Scorecard", detail: `${report.bbsc.overallScore} / 100` });
  }
  if (confidence !== null) {
    health.push({ label: "Data Confidence", detail: `${confidence} / 100` });
  }
  if (report.bbsc?.strongestPerspective) {
    health.push({ label: "Strongest Perspective", detail: `${report.bbsc.strongestPerspective.shortTitle || report.bbsc.strongestPerspective.title}: ${report.bbsc.strongestPerspective.score ?? "Not available"} / 100`, tone: "positive" });
  }
  if (report.bbsc?.weakestPerspective) {
    health.push({ label: "Priority Perspective", detail: `${report.bbsc.weakestPerspective.shortTitle || report.bbsc.weakestPerspective.title}: ${report.bbsc.weakestPerspective.score ?? "Not available"} / 100`, tone: "risk" });
  }
  return health.slice(0, 4);
}

function selectTopFindings(report: Report): SummaryItem[] {
  const candidates = collectSummaryFindingCandidates(report)
    .filter((candidate) => cleanText(candidate.text).length > 0)
    .sort((a, b) => findingPriorityRank(a.priority) - findingPriorityRank(b.priority) || a.sourceOrder - b.sourceOrder);
  const businessCandidates = candidates.filter((candidate) => candidate.priority !== "data_observation");
  const selected = businessCandidates.length > 0 ? businessCandidates : candidates;
  return dedupeSummaryItems(
    selected.map((candidate): SummaryItem => ({
      label: findingPriorityLabel(candidate.priority),
      detail: findingToneDetail(candidate.text),
      tone: classifyFindingTone(candidate.text),
    })),
  ).slice(0, 5);
}

function collectSummaryFindingCandidates(report: Report): FindingCandidate[] {
  const candidates: FindingCandidate[] = [];
  let sourceOrder = 0;
  const add = (text: string | null | undefined, sourceBias = 0) => {
    const cleaned = cleanText(text || "");
    if (!cleaned) return;
    candidates.push({
      text: cleaned,
      priority: classifyFindingPriority(cleaned),
      sourceOrder: sourceOrder + sourceBias,
    });
    sourceOrder += 1;
  };

  for (const recommendation of report.recommendations || []) {
    add(summaryRecommendationFinding(recommendation), -200);
  }

  for (const chart of report.charts || []) {
    const validData = chart.data?.filter((item) => Number.isFinite(item.value)) || [];
    const top = validData.length > 0 ? validData.reduce((max, item) => item.value > max.value ? item : max, validData[0]) : null;
    if (top) add(`${truncate(chart.title, 48)}: ${truncate(top.name, 48)} leads at ${formatSummaryChartValue(top.value, chart.title)}.`, -100);
  }

  for (const finding of report.findings || []) {
    add(finding);
  }

  if (report.reportProfile?.id === "saas_startup" && report.saasAnalysis) {
    const saas = report.saasAnalysis;
    if (saas.churnRate !== null) add(`Churn is ${formatPercent(saas.churnRate)} from ${saas.churnRateSource === "source_rate" ? "source churn rate" : "compatible SaaS customer metrics"}.`, -150);
    if (saas.mrr !== null) add(`MRR is ${formatCurrency(saas.mrr)} in the latest SaaS reporting period.`, -140);
    if (saas.customers !== null) add(`Customers total ${saas.customers.toLocaleString()} using ${saas.customerAggregation === "latest_snapshot" ? "latest-period SaaS snapshot" : "distinct SaaS customer"} semantics.`, -130);
    if (saas.netExpansionMrr !== null) add(`Net Expansion MRR is ${formatCurrency(saas.netExpansionMrr)} from expansion minus contraction.`, -120);
    if (saas.runwayMonths !== null) add(`Runway is ${saas.runwayMonths.toFixed(1)} months from explicit SaaS runway data.`, -110);
  }

  return candidates;
}

function summaryRecommendationFinding(recommendation: ReportRecommendation) {
  return [
    recommendation.issue,
    recommendation.businessImpact ? `Business impact: ${recommendation.businessImpact}` : null,
  ].filter(Boolean).join(" ");
}

function classifyFindingPriority(finding: string): FindingPriority {
  const text = finding.toLowerCase();
  if (isTechnicalFinding(text)) return "data_observation";
  if (/missing|unavailable|insufficient|limited|cannot|no recognized|without|incomplete/.test(text)) {
    return /field|source|data|column|identifier|order|customer|cogs|cost|expense|date|period/.test(text)
      ? "missing_data_unlock"
      : "business_risk";
  }
  if (/risk|exposure|stockout|reorder|below|low|weak|declin|drop|fall|decrease|loss|refund|return|churn|burn|runway|cash|overdue|uncategorized|duplicate/.test(text)) {
    return "business_risk";
  }
  if (/opportun|unlock|upsell|cross-sell|expand|improve|rebalance|prioritize|focus|protect|recover/.test(text)) {
    return "opportunity";
  }
  if (/concentration|largest|top supplier|supplier|merchant|customer share|dependency|allocation|portfolio|sector|stage/.test(text)) {
    return "concentration";
  }
  if (/highest|strongest|leads|growth|profitable|positive|above|best|top product|top category|revenue category/.test(text)) {
    return "positive_performance";
  }
  if (/inventory|stock|sku|product|category|channel|shipping|fulfillment|orders|customers|margin|revenue|gross profit|mrr|arr|gmv|take rate|billable|utilization|ledger|debit|credit/.test(text)) {
    return "operational";
  }
  if (/trend|material|performance|change/.test(text)) return "negative_change";
  return "data_observation";
}

function isTechnicalFinding(text: string) {
  return /loaded rows|recognized source field|source field was recognized|classified as|analyzed as|selected dataset only|uses only source|uses only .* values|from recognized source data|kpis prioritize|included from .* columns|treated as .* not an expense category|calculated from .* values present|geography uses only|distinct recognized|source channel values|data confidence|analysis basis/.test(text);
}

function findingPriorityRank(priority: FindingPriority) {
  switch (priority) {
    case "business_risk":
      return 1;
    case "negative_change":
      return 2;
    case "opportunity":
      return 3;
    case "positive_performance":
      return 4;
    case "concentration":
      return 5;
    case "operational":
      return 6;
    case "missing_data_unlock":
      return 7;
    case "data_observation":
    default:
      return 8;
  }
}

function findingPriorityLabel(priority: FindingPriority) {
  if (priority === "business_risk") return "Risk / gap";
  if (priority === "negative_change") return "Negative change";
  if (priority === "opportunity") return "Opportunity";
  if (priority === "positive_performance") return "Positive";
  if (priority === "concentration") return "Exposure";
  if (priority === "operational") return "Operational";
  if (priority === "missing_data_unlock") return "Data unlock";
  return "Finding";
}

function selectDataStatus(report: Report, financials: ReportFinancials, confidence: number | null): SummaryItem[] {
  const status: SummaryItem[] = [];
  if (report.reportProfile?.id === "saas_startup") {
    status.push(...selectSaasDataStatus(report.saasAnalysis));
  } else if (report.reportProfile?.id === "investor_portfolio") {
    status.push({ label: "Data Coverage", detail: "Investor portfolio fields sufficiently covered for current analysis." });
  } else if (report.reportProfile?.id === "business_consulting") {
    const available: string[] = [];
    const optional: string[] = [];
    if (financials.revenue !== null) available.push("Revenue");
    if (financials.consultantCost !== null) available.push("Consultant Cost");
    if (financials.otherCost !== null) available.push("Other Cost");
    if (financials.grossProfit !== null) available.push("Gross Profit");
    if (financials.grossMargin !== null) available.push("Gross Margin");
    if (financials.operatingExpenses === null) optional.push("Operating Expenses");
    if (financials.operatingProfit === null) optional.push("Operating Profit");
    if (financials.interestExpense === null) optional.push("Interest Expense");
    if (financials.taxExpense === null) optional.push("Tax Expense");
    if (financials.netProfit === null) optional.push("Net Profit");
    if (available.length > 0) {
      status.push({ label: "Available", detail: `${available.join(", ")}.` });
    }
    if (optional.length > 0) {
      status.push({ label: "Optional for Deeper Analysis", detail: `${optional.join(", ")}: add to extend from gross to operating/net profitability.` });
    }
  } else if (report.reportProfile?.id === "professional_services") {
    const available: string[] = [];
    const optional: string[] = [];
    if (financials.revenue !== null) available.push("Revenue");
    if (financials.freelancerCost !== null) available.push("Freelancer Cost");
    if (financials.adSpend !== null) available.push("Ad Spend");
    if (financials.grossProfit !== null) available.push("Gross Profit");
    if (financials.grossMargin !== null) available.push("Gross Margin");
    if (financials.operatingExpenses === null) optional.push("Operating Expenses");
    if (financials.operatingProfit === null) optional.push("Operating Profit");
    if (financials.interestExpense === null) optional.push("Interest Expense");
    if (financials.taxExpense === null) optional.push("Tax Expense");
    if (financials.netProfit === null) optional.push("Net Profit");
    if (available.length > 0) {
      status.push({ label: "Available", detail: `${available.join(", ")}.` });
    }
    if (optional.length > 0) {
      status.push({ label: "Optional for Deeper Analysis", detail: `${optional.join(", ")}: add to extend from gross to operating/net profitability.` });
    }
  } else {
    const missing = [
      ...(financials.missingFields || []),
      ...Object.entries(financials.metricSources || {})
        .filter(([, source]) => source?.kind === "unavailable")
        .map(([key]) => labelFromCamelCase(key)),
    ].filter((value, index, list) => value && list.indexOf(value) === index);
    if (missing.length > 0) {
      status.push({
        label: "Missing Data Unlock",
        detail: `${missing.slice(0, 4).join(", ")}: add supported source fields to unlock related analysis.`,
        tone: "risk",
      });
    }
  }
  if (confidence !== null) {
    status.push({ label: "Confidence", detail: `Summary uses the report confidence value of ${confidence} / 100.` });
  }
  if (report.semanticContext?.datasetId) {
    status.push({ label: "Analysis Basis", detail: "Selected dataset only; no cross-dataset blending." });
  }
  return status.slice(0, 3);
}

function selectSaasDataStatus(saas?: SaasReportAnalysis): SummaryItem[] {
  if (!saas) return [];
  const gaps: SummaryItem[] = [];
  if (saas.profile) {
    gaps.push({ label: "SaaS Subtype", detail: `${saas.profile.replace(/_/g, " ")} with ${saas.capabilityCoverage ?? saas.dataConfidence} / 100 capability coverage.` });
  }
  const unavailable = saas.unavailableCapabilities?.slice(0, 2) || [];
  for (const capability of unavailable) {
    gaps.push({
      label: `${labelFromCamelCase(capability.id.replace(/_/g, " "))} Unavailable`,
      detail: capability.reason,
      tone: "risk",
    });
  }
  return gaps.slice(0, 2);
}

function profileDataConfidence(report: Report, financials: ReportFinancials) {
  if (report.saasAnalysis && Number.isFinite(report.saasAnalysis.dataConfidence)) return Math.round(report.saasAnalysis.dataConfidence);
  if (typeof financials.dataConfidence === "number" && Number.isFinite(financials.dataConfidence)) return Math.round(financials.dataConfidence);
  if (typeof report.semanticContext?.confidence === "number" && Number.isFinite(report.semanticContext.confidence)) return Math.round(report.semanticContext.confidence);
  const score = completenessScore(financials);
  return Number.isFinite(score) ? score : null;
}

function formatSummaryChartValue(value: number, title: string) {
  return /margin|rate|share|percent|%/i.test(title) ? formatPercent(value) : formatCurrency(value);
}

function findingToneLabel(finding: string) {
  const tone = classifyFindingTone(finding);
  if (tone === "positive") return "Positive";
  if (tone === "risk") return "Risk / gap";
  return "Finding";
}

function findingToneDetail(finding: string) {
  return cleanText(finding);
}

function classifyFindingTone(finding: string): SummaryItem["tone"] {
  if (/missing|cannot|risk|declin|low|weak|unavailable|insufficient/i.test(finding)) return "risk";
  if (/available|strong|growth|highest|positive|improv|profitable/i.test(finding)) return "positive";
  return "neutral";
}

function dedupeSummaryItems(items: SummaryItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.label}:${item.detail}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function labelFromCamelCase(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());
}

function drawSummaryMetricGrid(doc: jsPDF, metrics: SummaryMetric[], y: number) {
  const columns = 4;
  const gap = 4;
  const cardWidth = (174 - gap * (columns - 1)) / columns;
  const baseCardHeight = 22;
  const labelMaxWidth = cardWidth - 8;
  const valueMaxWidth = cardWidth - 8;
  const labelLineHeight = 6;
  const valueLineHeight = 7;

  const getCardHeight = (metric: SummaryMetric) => {
    const labelLines = doc.splitTextToSize(cleanText(metric.title).toUpperCase(), labelMaxWidth);
    const valueLines = doc.splitTextToSize(cleanText(metric.value), valueMaxWidth);
    const labelHeight = labelLines.length * labelLineHeight;
    const valueHeight = valueLines.length * valueLineHeight;
    return Math.max(baseCardHeight, labelHeight + valueHeight + 6);
  };

  const metricsSubset = metrics.slice(0, 8);
  const cardHeights = metricsSubset.map(getCardHeight);
  const rowHeights = [0, 1].map(row => {
    const rowMetrics = cardHeights.slice(row * 4, row * 4 + 4);
    return rowMetrics.length > 0 ? Math.max(...rowMetrics) : 0;
  });

  const totalHeight = rowHeights[0] + rowHeights[1] + gap;
  let cursorY = ensureComponentFits(doc, y, totalHeight);

  metricsSubset.forEach((metric, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const cardHeight = cardHeights[index];
    const rowHeight = rowHeights[row];
    const x = page.margin + column * (cardWidth + gap);
    let cardY = cursorY;
    for (let r = 0; r < row; r++) {
      cardY += rowHeights[r] + gap;
    }
    doc.setFillColor(...colors.white);
    doc.setDrawColor(...colors.line);
    doc.roundedRect(x, cardY, cardWidth, cardHeight, 1.5, 1.5, "S");
    doc.setFillColor(...colors.brandCyan);
    doc.rect(x, cardY, 1.4, cardHeight, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.2);
    doc.setTextColor(...colors.muted);
    const labelLines = doc.splitTextToSize(cleanText(metric.title).toUpperCase(), labelMaxWidth);
    let labelY = cardY + 4;
    labelLines.forEach((line: string) => {
      doc.text(line, x + 4, labelY);
      labelY += labelLineHeight;
    });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(metric.value.length > 15 ? 8.5 : 10);
    doc.setTextColor(...colors.ink);
    const valueLines = doc.splitTextToSize(cleanText(metric.value), valueMaxWidth);
    let valueY = labelY + 2;
    valueLines.forEach((line: string) => {
      doc.text(line, x + 4, valueY);
      valueY += valueLineHeight;
    });
  });

  return cursorY + totalHeight;
}

function summaryItemHeight(doc: jsPDF, item: SummaryItem, rowHeight: number, labelWidth = 38) {
  const lineHeight = 7.5;
  const labelColumnWidth = labelWidth;
  const detailWidth = 174 - labelColumnWidth - 8;
  const labelLines = doc.splitTextToSize(cleanText(item.label), labelColumnWidth - 4);
  const detailLines = doc.splitTextToSize(cleanText(item.detail), detailWidth);
  const maxLines = Math.max(labelLines.length, detailLines.length);
  return Math.max(rowHeight, maxLines * lineHeight + 4);
}

function drawSummarySection(doc: jsPDF, title: string, items: SummaryItem[], y: number, limit: number, rowHeight: number, labelWidth = 38) {
  const minimumFollowingHeight = items
    .slice(0, limit)
    .reduce((total, item) => total + summaryItemHeight(doc, item, rowHeight, labelWidth), 0) || layout.minimumNarrativeBlock;
  const sectionY = drawSectionHeading(doc, title, y, minimumFollowingHeight);
  return drawSummaryItems(doc, items, sectionY, limit, rowHeight, labelWidth);
}

function drawSummaryItems(doc: jsPDF, items: SummaryItem[], y: number, limit: number, rowHeight: number, labelWidth = 38) {
  const fontSize = 6.8;
  const lineHeight = 7.5;
  const labelColumnWidth = labelWidth;
  const detailWidth = 174 - labelColumnWidth - 8;

  const getItemHeight = (item: SummaryItem) => {
    return summaryItemHeight(doc, item, rowHeight, labelColumnWidth);
  };

  const itemsSubset = items.slice(0, limit);
  const itemHeights = itemsSubset.map(getItemHeight);
  const totalHeight = itemHeights.reduce((sum, h) => sum + h, 0);

  let cursorY = ensureComponentFits(doc, y, totalHeight);
  let currentY = cursorY;

  itemsSubset.forEach((item, index) => {
    const itemHeight = itemHeights[index];
    const itemY = currentY;

    doc.setFillColor(...colors.white);
    doc.setDrawColor(...colors.line);
    doc.roundedRect(page.margin, itemY, 174, itemHeight - 2, 1.3, 1.3, "S");
    doc.setFillColor(...summaryToneColor(item.tone));
    doc.rect(page.margin, itemY, 1.4, itemHeight - 2, "F");

    const labelLines = doc.splitTextToSize(cleanText(item.label), labelColumnWidth - 4);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fontSize);
    doc.setTextColor(...colors.ink);
    let labelY = itemY + 4;
    labelLines.forEach((line: string) => {
      doc.text(line, page.margin + 4, labelY);
      labelY += lineHeight;
    });

    const detailLines = doc.splitTextToSize(cleanText(item.detail), detailWidth);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(...colors.body);
    let detailY = itemY + 4;
    detailLines.forEach((line: string) => {
      doc.text(line, page.margin + labelColumnWidth + 4, detailY);
      detailY += lineHeight;
    });

    currentY += itemHeight;
  });

  return cursorY + totalHeight;
}

function summaryToneColor(tone: SummaryItem["tone"]): Rgb {
  if (tone === "positive") return colors.green;
  if (tone === "risk") return colors.red;
  return colors.brandPurple;
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
  if (metrics.length === 0) return y;
  const gap = layout.metricCardGap;
  const cardWidth = (174 - gap * 3) / 4;
  const cardHeight = layout.metricCardHeight;
  const rows = Math.ceil(metrics.length / 4);
  let cursorY = y;
  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    const rowY = ensureComponentFits(doc, cursorY, cardHeight);
    const row = metrics.slice(rowIndex * 4, rowIndex * 4 + 4);
    row.forEach((item, index) => {
      const x = page.margin + index * (cardWidth + gap);
      doc.setFillColor(...colors.white);
      doc.setDrawColor(...colors.line);
      doc.roundedRect(x, rowY, cardWidth, cardHeight, 1.5, 1.5, "S");
      doc.setFillColor(...statusColor(item.status));
      doc.rect(x, rowY, 1.6, cardHeight, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.8);
      doc.setTextColor(...colors.muted);
      doc.text(item.title.toUpperCase(), x + 4, rowY + 7);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(item.value.length > 22 ? 8.8 : item.value.length > 15 ? 10 : 12);
      doc.setTextColor(...colors.ink);
      doc.text(doc.splitTextToSize(cleanText(item.value), cardWidth - 8).slice(0, 2), x + 4, rowY + 17);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.4);
      doc.setTextColor(...colors.muted);
      doc.text(doc.splitTextToSize(cleanText(item.note), cardWidth - 8).slice(0, 2), x + 4, rowY + 25);
    });
    cursorY = rowY + cardHeight + (rowIndex < rows - 1 ? gap : 0);
  }
  return cursorY;
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
  const startY = ensureComponentFits(doc, y, height);
  doc.setFillColor(...colors.white);
  doc.setDrawColor(...colors.line);
  doc.roundedRect(x, startY, width, height, 1.5, 1.5, "S");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...colors.body);
  doc.text(doc.splitTextToSize(cleanText(text), width - 8).slice(0, Math.floor(height / 4.5)), x + 4, startY + 7);
  return startY + height;
}

function drawUnavailable(doc: jsPDF, title: string, text: string, x: number, y: number, width: number, height: number) {
  const startY = ensureComponentFits(doc, y, height);
  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(252, 165, 165);
  doc.roundedRect(x, startY, width, height, 1.5, 1.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...colors.red);
  doc.text(cleanText(title), x + 4, startY + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.2);
  doc.setTextColor(...colors.body);
  doc.text(doc.splitTextToSize(cleanText(text), width - 8).slice(0, 3), x + 4, startY + 15);
  return startY + height;
}

function drawTable(doc: jsPDF, rows: TableRow[], x: number, y: number, widths: number[]) {
  const rowHeight = 8;
  if (rows.length === 0) return y;
  const tableWidth = widths.reduce((sum, width) => sum + width, 0);
  const header = rows[0];
  const bodyRows = rows.slice(1);
  const minimumStartRows = bodyRows.length >= 2 ? 3 : bodyRows.length > 0 ? 2 : 1;
  let cursorY = ensureComponentFits(doc, y, rowHeight * minimumStartRows);
  const drawRow = (row: TableRow, rowIndex: number, drawY: number) => {
    const isHeader = rowIndex === 0;
    let cellX = x;
    doc.setFillColor(...(isHeader ? colors.faint : colors.white));
    doc.setDrawColor(...colors.line);
    doc.rect(x, drawY, tableWidth, rowHeight, "FD");
    row.forEach((cell, cellIndex) => {
      doc.setFont("helvetica", isHeader ? "bold" : "normal");
      doc.setFontSize(isHeader ? 7.2 : 7.5);
      doc.setTextColor(...(isHeader ? colors.ink : statusTextColor(cellIndex === 2 ? cell : "")));
      const text = doc.splitTextToSize(cleanText(cell), widths[cellIndex] - 4).slice(0, 1);
      doc.text(text, cellX + 2, drawY + 5.3);
      cellX += widths[cellIndex];
      if (cellIndex < widths.length - 1) {
        doc.setDrawColor(...colors.line);
        doc.line(cellX, drawY, cellX, drawY + rowHeight);
      }
    });
  };
  drawRow(header, 0, cursorY);
  cursorY += rowHeight;
  bodyRows.forEach((row) => {
    if (cursorY + rowHeight > content.bottom) {
      cursorY = addFlowPage(doc);
      drawRow(header, 0, cursorY);
      cursorY += rowHeight;
    }
    drawRow(row, 1, cursorY);
    cursorY += rowHeight;
  });
  return cursorY;
}

function drawBars(doc: jsPDF, rows: { label: string; value: number | null; color: Rgb }[], x: number, y: number, width: number, height: number) {
  const startY = ensureComponentFits(doc, y, height);
  doc.setDrawColor(...colors.line);
  doc.roundedRect(x, startY, width, height, 1.5, 1.5, "S");
  const available = rows.filter((row): row is { label: string; value: number; color: Rgb } => row.value !== null);
  const max = Math.max(...available.map((row) => Math.abs(row.value)), 1);
  rows.forEach((row, index) => {
    const barY = startY + 8 + index * 8.5;
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
  return startY + height;
}

function drawTrendPanel(doc: jsPDF, financials: ReportFinancials, x: number, y: number, width: number, height: number) {
  debugLog("[REPORT TRACE]", "buildTrendAnalysis", {
    validTrendPeriods: financials.periodTrends?.length || 0,
    validNetProfitTrendCount: (financials.periodTrends || []).filter((trend) => trend.netProfit !== null).length,
  });
  const trends = (financials.periodTrends || []).slice(-6);
  const series = trends.map((trend) => trend.netProfit).filter((value): value is number => value !== null);
  if (trends.length < 2 || series.length < 2) {
    return drawUnavailable(doc, "Trend unavailable", "No valid reporting-period and net-profit series exists. Unsupported trends and percentages are omitted.", x, y, width, 28);
  }
  const startY = ensureComponentFits(doc, y, height);
  doc.setDrawColor(...colors.line);
  doc.roundedRect(x, startY, width, height, 1.5, 1.5, "S");
  const chartX = x + 8;
  const chartY = startY + 8;
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
  doc.text(`Revenue growth: ${financials.revenueGrowth === null || financials.revenueGrowth === undefined ? "Not available" : formatPercent(financials.revenueGrowth)}`, x + 6, startY + height - 6);
  doc.text(`Net margin: ${financials.netMargin === null ? "Not available" : formatPercent(financials.netMargin)}`, x + 70, startY + height - 6);
  return startY + height;
}

function drawRecommendation(doc: jsPDF, priority: string, recommendation: ReportRecommendation, y: number) {
  const height = 36;
  const startY = ensureComponentFits(doc, y, height);
  doc.setDrawColor(...colors.line);
  doc.roundedRect(page.margin, startY, 174, height, 1.5, 1.5, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...colors.brandPurple);
  doc.text(priority, page.margin + 5, startY + 9);
  doc.setTextColor(...colors.ink);
  doc.text(cleanText(recommendation.issue), page.margin + 18, startY + 8);
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
  doc.text(doc.splitTextToSize(cleanText(detail), 150).slice(0, 4), page.margin + 18, startY + 16);
  return startY + height;
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
    doc.text(`UseClevr ${cleanText(report.reportProfile?.title || "Executive BI Report")}`, page.margin, page.height - 10);
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

function tracePdfRuntime(moduleName: string, report: Report, financials: ReportFinancials) {
  debugLog("[REPORT TRACE]", moduleName, {
    datasetId: report.datasetId,
    filename: report.datasetName,
    persistedRowCount: report.diagnostics?.persistedRowCount ?? report.rowCount,
    loadedRowsLength: report.diagnostics?.loadedRowsLength ?? null,
    analysisRowsLength: report.diagnostics?.analysisRowsLength ?? null,
    summaryRowsLength: report.diagnostics?.rowsUsedForSummary ?? null,
    reportRowsLength: report.diagnostics?.reportRowsLength ?? report.rowCount,
    provenanceRowsLength: report.diagnostics?.provenanceRowsLength ?? report.rowCount,
    detectedDateField: report.semanticContext?.dateField ?? null,
    detectedExpenseCategoryField: report.semanticContext?.expenseCategoryField ?? null,
    detectedExpenseAmountField: report.semanticContext?.expenseAmountField ?? null,
    detectedVendorField: report.semanticContext?.vendorField ?? null,
    revenueField: report.semanticContext?.revenueField ?? null,
    netProfitField: report.semanticContext?.netProfitField ?? null,
    validDateCount: report.diagnostics?.validDateCount ?? null,
    validNetProfitCount: report.diagnostics?.validNetProfitCount ?? null,
    validExpenseCategoryCount: report.diagnostics?.validExpenseCategoryCount ?? null,
    validExpenseAmountCount: report.diagnostics?.validExpenseAmountCount ?? null,
    validVendorCount: report.diagnostics?.validVendorCount ?? null,
    trendAvailable:
      report.diagnostics?.trendAvailable ??
      (financials.periodTrends || []).filter((trend) => trend.netProfit !== null).length > 0,
    analysisObjectKeys: report.diagnostics?.analysisObjectKeys ?? [],
    reportInputKeys: report.diagnostics?.reportInputKeys ?? Object.keys(report),
    templateName: report.templateName ?? "legacy-report",
  });
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

function numberMetricCard(title: string, value: string, note: string) {
  return {
    title,
    value,
    status: value === "Not available" ? "missing" as const : "neutral" as const,
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
  if (report.reportProfile?.id === "investor_portfolio" && report.investorAnalysis) {
    const investor = report.investorAnalysis;
    const parts: string[] = [];
    if (investor.portfolioCompanies !== null) {
      parts.push(`The portfolio contains ${investor.portfolioCompanies} companies with ${formatCurrency(investor.totalInvested || 0)} in invested capital.`);
    }
    if (investor.totalValuation !== null) {
      parts.push(`Aggregate latest company valuations total ${formatCurrency(investor.totalValuation)}.`);
    }
    const activeCount = investor.companiesByStatus.find((s) => s.status.toLowerCase() === "active")?.count || 0;
    const exitedCount = investor.companiesByStatus.find((s) => s.status.toLowerCase() === "exited")?.count || 0;
    const watchlistCount = investor.companiesByStatus.find((s) => s.status.toLowerCase() === "watchlist")?.count || 0;
    if (activeCount + exitedCount + watchlistCount > 0) {
      parts.push(`The portfolio includes ${activeCount} Active, ${exitedCount} Exited, and ${watchlistCount} Watchlist companies.`);
    }
    return parts.join(" ") || "Portfolio analysis complete.";
  }
  if (report.reportProfile?.id === "business_consulting") {
    const parts: string[] = [];
    if (financials.revenue !== null) {
      parts.push(`Revenue is ${formatCurrency(financials.revenue)} from recognized source data.`);
    }
    if (financials.grossProfit !== null) {
      parts.push(`Gross profit is ${formatCurrency(financials.grossProfit)} with a gross margin of ${financials.grossMargin?.toFixed(1)}%.`);
    }
    if (financials.netProfit === null) {
      parts.push("Operating and net profitability require additional inputs (operating expenses, interest, tax).");
    }
    if (hasTrendData(financials)) {
      parts.push("Trend analysis uses available project date data.");
    }
    return parts.join(" ") || "Business consulting analysis complete.";
  }
  if (report.reportProfile?.id === "professional_services") {
    const parts: string[] = [];
    if (financials.revenue !== null) {
      parts.push(`Revenue is ${formatCurrency(financials.revenue)} from recognized source data.`);
    }
    if (financials.grossProfit !== null) {
      parts.push(`Gross profit is ${formatCurrency(financials.grossProfit)} with a gross margin of ${financials.grossMargin?.toFixed(1)}%.`);
    }
    if (financials.netProfit === null) {
      parts.push("Operating and net profitability require additional inputs (operating expenses, interest, tax).");
    }
    if (hasTrendData(financials)) {
      parts.push("Trend analysis uses available date data.");
    }
    return parts.join(" ") || "Professional services analysis complete.";
  }
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

  const isBusinessConsulting = report.reportProfile?.id === "business_consulting";
  const fallback: ReportRecommendation[] = [];

  if (isBusinessConsulting) {
    if (financials.grossProfit === null && financials.revenue !== null) {
      fallback.push({
        issue: "Add project cost data to calculate gross profit.",
        businessImpact: "Revenue is available, but consultant_cost and other_cost fields are missing for project cost analysis.",
        recommendedAction: "Add consultant_cost and other_cost fields to enable gross profit and margin analysis.",
        estimatedImpact: "High",
        confidence: "High",
        requiredData: ["Consultant Cost", "Other Cost"],
      });
    }
    if (financials.revenue !== null && financials.netProfit === null) {
      fallback.push({
        issue: "Add operating expense data to extend profitability analysis.",
        businessImpact: "Gross profitability is available, but operating and net profitability require operating expenses, interest, and tax inputs.",
        recommendedAction: "Add operating expenses, interest, and tax data to extend analysis from gross to operating and net profitability.",
        estimatedImpact: "Medium",
        confidence: "High",
        requiredData: ["Operating Expenses", "Interest Expense", "Tax Expense"],
      });
    }
    if (!hasTrendData(financials)) {
      fallback.push({
        issue: "Add project date data to enable trend analysis.",
        businessImpact: "Project start and end dates are missing, preventing revenue and profitability trend analysis.",
        recommendedAction: "Add project_start and project_end fields to enable project-based trend analysis.",
        estimatedImpact: "Medium",
        confidence: "High",
        requiredData: ["Project Start", "Project End"],
      });
    }
    return fallback.slice(0, 4);
  }

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
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
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
  if (!value) return "";
  return String(value)
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

function drawInvestorInvestmentPerformance(doc: jsPDF, report: Report, financials: ReportFinancials) {
  const investor = report.investorAnalysis;
  if (!investor) return;
  let y = 48;
  
  const kpis: TableRow[] = [
    ["Portfolio Companies", investor.portfolioCompanies?.toString() || "Not available", "Source value", "Distinct portfolio company IDs."],
    ["Total Invested", investor.totalInvested ? formatCurrency(investor.totalInvested) : "Not available", "Source value", "Sum of invested amounts."],
    ["Total Valuation", investor.totalValuation ? formatCurrency(investor.totalValuation) : "Not available", "Source value", "Sum of latest valuations."],
    ["Average Ownership", investor.avgOwnership ? `${investor.avgOwnership.toFixed(1)}%` : "Not available", "Derived", "Average ownership across portfolio."],
  ];
  y = drawTable(doc, kpis, page.margin, y, [55, 40, 30, 40]);
  
  if (investor.companiesByStatus.length > 0) {
    y += 8;
    y = drawSectionHeading(doc, "Portfolio Status", y);
    const statusData: TableRow[] = investor.companiesByStatus.map(s => [s.status, s.count.toString(), "Source value", "Company count by status."]);
    y = drawTable(doc, [["Status", "Companies", "Type", "Notes"], ...statusData], page.margin, y, [80, 30, 30, 30]);
  }
}

function drawInvestorCompanyPerformance(doc: jsPDF, report: Report) {
  const investor = report.investorAnalysis;
  if (!investor) return;
  let y = 48;
  
  y = drawSectionHeading(doc, "Top Companies by Annual Revenue", y);
  if (investor.revenueByCompany.length > 0) {
    const revenueData: TableRow[] = investor.revenueByCompany.map(c => [c.name, formatCurrency(c.revenue), "Source value", "Portfolio company annual revenue."]);
    y = drawTable(doc, [["Company", "Annual Revenue", "Type", "Notes"], ...revenueData], page.margin, y, [80, 35, 25, 30]);
  } else {
    y = drawUnavailable(doc, "Annual revenue data not available", "Portfolio company annual revenue field not found in dataset.", page.margin, y, 174, 20);
  }
  
  if (investor.runwayRisk !== null && investor.runwayRisk > 0) {
    y += 8;
    y = drawSectionHeading(doc, "Portfolio Risk", y);
    y = drawTable(doc, [["Risk Type", "Count", "Type", "Notes"], [`Low Runway (<12mo)`, investor.runwayRisk.toString(), "Source value", "Companies with runway under 12 months."]], page.margin, y, [80, 30, 25, 40]);
  }
  
  if (investor.highBurn !== null && investor.highBurn > 0) {
    y = drawTable(doc, [["Risk Type", "Count", "Type", "Notes"], [`High Monthly Burn`, investor.highBurn.toString(), "Source value", "Companies with high burn rates."]], page.margin, y, [80, 30, 25, 40]);
  }
}

function drawInvestorSectorStage(doc: jsPDF, report: Report) {
  const investor = report.investorAnalysis;
  if (!investor) return;
  let y = 48;
  
  if (investor.companiesBySector.length > 0) {
    y = drawSectionHeading(doc, "Investment by Sector", y);
    const sectorData: TableRow[] = investor.companiesBySector.slice(0, 8).map(s => [s.sector, formatCurrency(s.invested), s.count.toString(), "Source value"]);
    y = drawTable(doc, [["Sector", "Invested", "Companies", "Type"], ...sectorData], page.margin, y, [50, 35, 25, 30]);
  }
  
  if (investor.companiesByStage.length > 0) {
    y += 8;
    y = drawSectionHeading(doc, "Investment by Stage", y);
    const stageData: TableRow[] = investor.companiesByStage.map(s => [s.stage, formatCurrency(s.invested), s.count.toString(), "Source value"]);
    y = drawTable(doc, [["Stage", "Invested", "Companies", "Type"], ...stageData], page.margin, y, [50, 35, 25, 30]);
  }
}

function drawAccountancyLedgerSummary(doc: jsPDF, report: Report, financials: ReportFinancials) {
  let y = 48;
  y = drawSectionHeading(doc, "Ledger Summary", y);
  const debitVal = kpiNumber(report, "Debit total");
  const creditVal = kpiNumber(report, "Credit total");
  const netMovement = (debitVal !== null && creditVal !== null) ? debitVal - creditVal : null;
  const invoicesVal = kpiNumber(report, "Invoices / documents");
  const accountsVal = kpiNumber(report, "Accounts");
  y = drawTable(doc, [
    ["Metric", "Value", "Status", "Source / Notes"],
    ["Total Debits", debitVal !== null ? formatCurrency(debitVal) : "Not available", debitVal !== null ? "Available" : "Missing", "Sum of debit column from ledger."],
    ["Total Credits", creditVal !== null ? formatCurrency(creditVal) : "Not available", creditVal !== null ? "Available" : "Missing", "Sum of credit column from ledger."],
    ["Net Movement", netMovement !== null ? formatCurrency(netMovement) : "Not available", netMovement !== null ? "Available" : "Missing", "Total Debits - Total Credits."],
    ["Invoices / Documents", invoicesVal !== null ? String(invoicesVal) : "Not available", invoicesVal !== null ? "Available" : "Missing", "Count of distinct invoice or document references."],
    ["Accounts", accountsVal !== null ? String(accountsVal) : "Not available", accountsVal !== null ? "Available" : "Missing", "Count of distinct account entries."],
  ], page.margin, y, [50, 35, 25, 60]) + 12;

  y = drawSectionHeading(doc, "Profitability Metrics", y);
  y = drawTable(doc, [
    ["Metric", "Value", "Status", "Source / Notes"],
    ["Revenue", "Not available", "N/A", "Revenue cannot be derived from general ledger debit/credit alone."],
    ["Gross Profit", "Not available", "N/A", "Requires explicit revenue and COGS fields."],
    ["Operating Profit", "Not available", "N/A", "Requires explicit operating profit field or proper account classification."],
    ["Net Profit", "Not available", "N/A", "Requires explicit net profit field or proper account classification."],
    ["Gross Margin", "Not available", "N/A", "Requires revenue and gross profit fields."],
    ["Operating Margin", "Not available", "N/A", "Requires operating profit field."],
    ["Net Margin", "Not available", "N/A", "Requires net profit field."],
  ], page.margin, y, [50, 35, 25, 60]);
}
