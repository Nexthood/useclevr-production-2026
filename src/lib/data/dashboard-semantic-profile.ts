import { buildDatasetReportInput } from "@/lib/reports/dataset-report-builder"
import type { BusinessModel } from "@/lib/data/business-model"
import type {
  EcommerceReportAnalysis,
  MarketplaceReportAnalysis,
  ReportRecommendation,
  RetailReportAnalysis,
  SaasReportAnalysis,
} from "@/lib/reports/report-generator"
import type { ReportProfileId } from "@/lib/reports/report-profiles"

type DashboardDatasetInput = {
  id: string
  name: string
  fileName: string
  fileSize: number | null
  rowCount: number
  columnCount: number
  columns: string[]
  data: Record<string, unknown>[]
  datasetType: string | null
  businessModel: string | null
  analysisStatus: string | null
  status: string
  createdAt: Date
  updatedAt: Date
  analysis: unknown
  aiInsights: unknown
  precomputedMetrics: unknown
  detectedColumns: unknown
}

type DashboardReportInput = Awaited<ReturnType<typeof buildDatasetReportInput>> & {
  retailAnalysis?: RetailReportAnalysis
  ecommerceAnalysis?: EcommerceReportAnalysis
  saasAnalysis?: SaasReportAnalysis
  marketplaceAnalysis?: MarketplaceReportAnalysis
  semanticContext?: {
    confidence?: number | null
    revenueField?: string | null
  }
  diagnostics?: {
    loadedRowsLength?: number | null
  }
  kpis: { title: string; value: string | number }[]
}

export type DashboardSemanticMetric = {
  label: string
  value: number | null
  format: "currency" | "number" | "percent" | "ratio"
  available: boolean
  source: string
  basis: string
}

export type DashboardSemanticTrend = {
  title: string
  metricLabel: string
  format: "currency" | "number" | "percent"
  data: { label: string; value: number }[]
  emptyLabel: string
}

export type DashboardSemanticAnalysis = {
  datasetId: string
  datasetName: string
  uploadType: string
  businessProfile: BusinessModel
  reportProfileId: ReportProfileId | "unknown"
  reportProfileTitle: string
  rowCount: number
  loadedRowCount: number
  confidence: {
    score: number | null
    basis: string
  }
  metrics: DashboardSemanticMetric[]
  trends: DashboardSemanticTrend[]
  recommendations: ReportRecommendation[]
  retailAnalysis?: RetailReportAnalysis
  ecommerceAnalysis?: EcommerceReportAnalysis
  saasAnalysis?: SaasReportAnalysis
  marketplaceAnalysis?: MarketplaceReportAnalysis
}

export async function buildDashboardSemanticAnalysis(dataset: DashboardDatasetInput): Promise<DashboardSemanticAnalysis> {
  const reportInput = await buildDatasetReportInput({
    ...dataset,
    columnTypes: null,
    previewRowCount: null,
    previewGenerated: null,
    fullAnalysisCompleted: null,
    analysisProgress: null,
    analysisMessage: null,
    analysisError: null,
    invalidRowCount: null,
    missingValueCounts: null,
    columnMapping: null,
  } as Parameters<typeof buildDatasetReportInput>[0]) as DashboardReportInput

  const businessProfile = businessProfileFromReport(reportInput.reportProfile?.id, reportInput.businessModel)
  const reportProfileId = reportInput.reportProfile?.id ?? "unknown"
  const reportProfileTitle = reportInput.reportProfile?.title ?? "Executive BI Report"
  const metrics = buildSemanticMetrics(reportInput)
  const confidenceScore = reportInput.saasAnalysis?.dataConfidence ?? reportInput.financials?.dataConfidence ?? reportInput.semanticContext?.confidence ?? null

  return {
    datasetId: dataset.id,
    datasetName: dataset.name,
    uploadType: dataset.datasetType || "standard",
    businessProfile,
    reportProfileId,
    reportProfileTitle,
    rowCount: reportInput.rowCount,
    loadedRowCount: reportInput.diagnostics?.loadedRowsLength ?? dataset.data.length,
    confidence: {
      score: confidenceScore,
      basis: confidenceScore === null ? "No canonical confidence score is available." : `${reportProfileTitle} semantic field coverage.`,
    },
    metrics,
    trends: buildSemanticTrends(reportInput),
    recommendations: reportInput.recommendations ?? [],
    retailAnalysis: reportInput.retailAnalysis,
    ecommerceAnalysis: reportInput.ecommerceAnalysis,
    saasAnalysis: reportInput.saasAnalysis,
    marketplaceAnalysis: reportInput.marketplaceAnalysis,
  }
}

function buildSemanticMetrics(reportInput: DashboardReportInput): DashboardSemanticMetric[] {
  if (reportInput.reportProfile?.id === "ecommerce" && reportInput.ecommerceAnalysis) {
    const ecommerce = reportInput.ecommerceAnalysis
    return [
      metric("Revenue", reportInput.financials?.revenue ?? null, "currency", reportInput.semanticContext?.revenueField ?? null, "Source revenue field."),
      metric("Orders", ecommerce.orders, "number", ecommerce.orderField, "Distinct recognized order IDs."),
      metric("Average Order Value", ecommerce.averageOrderValue, "currency", ecommerce.orderField, "Revenue divided by distinct order count."),
      metric("Customers", ecommerce.customers, "number", ecommerce.customerField, "Distinct recognized customer IDs."),
      metric("Units Sold", ecommerce.unitsSold, "number", "quantity", "Sum of recognized quantity or units field."),
      metric("Products", ecommerce.products, "number", ecommerce.productField, "Distinct recognized product IDs or names."),
      metric("Return Rate", ecommerce.returnRate, "percent", ecommerce.returnStatusField, "Returned orders divided by eligible normalized return-status orders."),
    ].filter((item) => item.available)
  }

  if (reportInput.reportProfile?.id === "saas_startup" && reportInput.saasAnalysis) {
    const saas = reportInput.saasAnalysis
    return [
      metric("MRR", saas.mrr, "currency", saas.mrrField, "Latest-period SaaS snapshot sum."),
      metric("ARR", saas.arr, "currency", saas.arrField, "Latest-period SaaS snapshot sum."),
      metric("Customers", saas.customers, "number", saas.customerField, "Distinct recognized customer IDs."),
      metric("New Customers", saas.newCustomers, "number", saas.newCustomerField, "Distinct customers with normalized positive new-customer status."),
      metric("Churn Rate", saas.churnRate, "percent", saas.churnField, "Churned customers divided by eligible normalized churn-status customers."),
      metric("Expansion MRR", saas.expansionMrr, "currency", saas.expansionMrrField, "Latest-period expansion MRR sum."),
      metric("Contraction MRR", saas.contractionMrr, "currency", saas.contractionMrrField, "Latest-period contraction MRR sum."),
      metric("Net Expansion MRR", saas.netExpansionMrr, "currency", "expansion_mrr + contraction_mrr", "Expansion MRR minus Contraction MRR."),
      metric("CAC", saas.cac, "currency", saas.cacField, "Latest-period average CAC."),
      metric("LTV", saas.ltv, "currency", saas.ltvField, "Latest-period average LTV."),
      metric("LTV/CAC", saas.ltvToCac, "ratio", "ltv / cac", "LTV divided by CAC when both are available."),
      metric("Active Users", saas.activeUsers, "number", saas.activeUsersField, "Latest-period active-user sum."),
      metric("Support Tickets", saas.supportTickets, "number", saas.supportTicketsField, "Latest-period support-ticket sum."),
      metric("Burn", saas.burn, "currency", saas.burnField, "Latest-period average burn."),
      metric("Cash Balance", saas.cashBalance, "currency", saas.cashBalanceField, "Latest-period average cash balance."),
      metric("Runway", saas.runwayMonths, "number", saas.runwayField, "Explicit latest-period runway in months."),
    ].filter((item) => item.available)
  }

  if (reportInput.reportProfile?.id === "local_retail" && reportInput.retailAnalysis) {
    const retail = reportInput.retailAnalysis
    return [
      metric("Revenue", reportInput.financials?.revenue ?? null, "currency", reportInput.semanticContext?.revenueField ?? null, "Source revenue field."),
      metric("Gross Margin", reportInput.financials?.grossMargin ?? null, "percent", "revenue + cogs", "Gross profit divided by revenue when both are available."),
      metric("Inventory Value", retail.inventoryValue, "currency", "stock + cost/price", "Stock multiplied by recognized value field."),
      metric("Reorder Risk", retail.reorderRequiredCount, "number", "stock + reorder point", "Items at or below reorder point."),
      metric("Low Stock", retail.lowStockSkuCount, "number", "stock", "Recognized low-stock SKU count."),
      metric("Products/SKUs", retail.productCount, "number", "product", "Distinct products or SKUs."),
    ].filter((item) => item.available)
  }

  if (reportInput.reportProfile?.id === "marketplace_startup" && reportInput.marketplaceAnalysis) {
    const marketplace = reportInput.marketplaceAnalysis
    return [
      metric("GMV", marketplace.gmv, "currency", marketplace.gmvField, "Sum of recognized GMV field."),
      metric("Marketplace Revenue", marketplace.marketplaceRevenue, "currency", marketplace.marketplaceRevenueField, "Sum of recognized platform fee or commission field."),
      metric("Take Rate", marketplace.takeRate, "percent", "marketplace revenue / gmv", "Marketplace Revenue divided by GMV."),
      metric("Seller Payout", marketplace.sellerPayout, "currency", marketplace.sellerPayoutField, "Sum of recognized seller payout field."),
      metric("Refund Amount", marketplace.refunds, "currency", marketplace.refundsField, "Sum of recognized refund field."),
      metric("Refund Rate", marketplace.refundRate, "percent", "refunds / gmv", "Refund Amount divided by GMV."),
      metric("Transactions", marketplace.transactions, "number", marketplace.transactionField, "Distinct recognized transaction IDs or row count."),
      metric("Average Transaction Value", marketplace.averageTransactionValue, "currency", "gmv / transactions", "GMV divided by transactions."),
      metric("Buyers", marketplace.buyers, "number", marketplace.buyerField, "Distinct recognized buyer IDs."),
      metric("Sellers", marketplace.sellers, "number", marketplace.sellerField, "Distinct recognized seller IDs."),
      metric("New Buyers", marketplace.newBuyers, "number", marketplace.newBuyerField, "Normalized positive new buyer statuses."),
      metric("New Sellers", marketplace.newSellers, "number", marketplace.newSellerField, "Normalized positive new seller statuses."),
      metric("Active Sellers", marketplace.activeSellers, "number", marketplace.activeSellersField, "Sum of recognized active sellers field."),
      metric("Listings", marketplace.listings, "number", marketplace.listingsField, "Sum of recognized listing count field."),
      metric("Completion Rate", marketplace.completionRate, "percent", "completed / transactions", "Completed transactions divided by total transactions."),
    ].filter((item) => item.available)
  }

  return reportInput.kpis
    .map((item) => metric(item.title, parseDisplayNumber(item.value), inferMetricFormat(item.title, item.value), item.title, "Canonical report KPI."))
    .filter((item) => item.available)
}

function buildSemanticTrends(reportInput: DashboardReportInput): DashboardSemanticTrend[] {
  if (reportInput.reportProfile?.id === "ecommerce" && reportInput.ecommerceAnalysis) {
    const ecommerce = reportInput.ecommerceAnalysis
    return [
      trend("Revenue Trend", "Revenue", "currency", ecommerce.revenueTrend, "Missing revenue/date columns."),
      trend("Orders Trend", "Orders", "number", ecommerce.ordersTrend, "Missing order/date columns."),
    ].filter((item) => item.data.length > 0)
  }

  if (reportInput.reportProfile?.id === "saas_startup" && reportInput.saasAnalysis) {
    const saas = reportInput.saasAnalysis
    return [
      trend("MRR Trend", "MRR", "currency", saas.mrrTrend, "Missing MRR/month columns."),
      trend("Customer Trend", "Customers", "number", saas.customerTrend, "Missing customer/month columns."),
      trend("Churn Trend", "Churned Customers", "number", saas.churnTrend, "Missing churn/month columns."),
      trend("Runway Trend", "Runway", "number", saas.runwayTrend, "Missing runway/month columns."),
    ].filter((item) => item.data.length > 0)
  }

  if (reportInput.reportProfile?.id === "marketplace_startup" && reportInput.marketplaceAnalysis) {
    const marketplace = reportInput.marketplaceAnalysis
    return [
      trend("GMV Trend", "GMV", "currency", marketplace.gmvTrend, "Missing GMV/date columns."),
      trend("Marketplace Revenue Trend", "Marketplace Revenue", "currency", marketplace.marketplaceRevenueTrend, "Missing marketplace revenue/date columns."),
      trend("Refund Trend", "Refund Amount", "currency", marketplace.refundTrend, "Missing refund/date columns."),
    ].filter((item) => item.data.length > 0)
  }

  const periodTrends = reportInput.financials?.periodTrends ?? []
  return [
    trend("Revenue Trend", "Revenue", "currency", periodTrends.map((item) => ({ name: item.period, value: item.revenue ?? 0 })).filter((item) => item.value !== 0), "Missing revenue/date columns."),
    trend("Profit Trend", "Profit", "currency", periodTrends.map((item) => ({ name: item.period, value: item.netProfit ?? item.grossProfit ?? 0 })).filter((item) => item.value !== 0), "Missing profit or revenue/cost columns."),
  ].filter((item) => item.data.length > 0)
}

function businessProfileFromReport(profileId?: string | null, businessModel?: string | null): BusinessModel {
  if (profileId === "local_retail") return "local_retail"
  if (profileId === "ecommerce") return "ecommerce"
  if (profileId === "saas_startup") return "saas"
  if (profileId === "marketplace_startup") return "marketplace"
  if (profileId === "investor_portfolio") return "investor"
  if (businessModel === "local_retail" || businessModel === "ecommerce" || businessModel === "saas" || businessModel === "startup" || businessModel === "investor" || businessModel === "marketplace") {
    return businessModel
  }
  return "generic"
}

function metric(
  label: string,
  value: number | null,
  format: DashboardSemanticMetric["format"],
  source: string | null,
  basis: string,
): DashboardSemanticMetric {
  return {
    label,
    value,
    format,
    available: typeof value === "number" && Number.isFinite(value),
    source: source || "Not available",
    basis,
  }
}

function trend(
  title: string,
  metricLabel: string,
  format: DashboardSemanticTrend["format"],
  data: { name: string; value: number }[],
  emptyLabel: string,
): DashboardSemanticTrend {
  return {
    title,
    metricLabel,
    format,
    data: data.map((item) => ({ label: item.name, value: item.value })),
    emptyLabel,
  }
}

function parseDisplayNumber(value: string | number) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  const numeric = Number.parseFloat(value.replace(/[$,%€£,\s]/g, ""))
  return Number.isFinite(numeric) ? numeric : null
}

function inferMetricFormat(label: string, value: string | number): DashboardSemanticMetric["format"] {
  const displayValue = String(value)
  if (/%/.test(displayValue) || /margin|rate|churn/i.test(label)) return "percent"
  if (/[$€£]/.test(displayValue) || /revenue|profit|cost|mrr|arr|gmv|cash|burn|capital|valuation/i.test(label)) return "currency"
  return "number"
}
