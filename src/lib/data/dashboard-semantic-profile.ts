import { buildDatasetReportInput } from "@/lib/reports/dataset-report-builder"
import type { BusinessModel } from "@/lib/data/business-model"
import {
  resolveTrendSemantics,
  snapshotTrendTitle,
  unavailableTrendTitle,
  type TrendSeriesPoint,
} from "@/lib/data/trend-semantics"
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

export type DashboardBusinessProfile = BusinessModel | "profitability"

export type DashboardSemanticMetric = {
  label: string
  value: number | null
  format: "currency" | "number" | "percent" | "ratio"
  available: boolean
  source: string
  basis: string
}

export type DashboardSemanticTrendState = "trend" | "snapshot" | "unavailable"

export type DashboardSemanticTrend = {
  title: string
  metricLabel: string
  format: "currency" | "number" | "percent"
  state: DashboardSemanticTrendState
  data: { label: string; value: number }[]
  snapshotValue: number | null
  emptyLabel: string
}

export type TrendPanelInput = {
  baseTitle: string
  metricLabel: string
  format: DashboardSemanticTrend["format"]
  series: TrendSeriesPoint[]
  metricValue: number | null
  unavailableReason: string
}

export function buildTrendPanel(input: TrendPanelInput): DashboardSemanticTrend {
  const resolved = resolveTrendSemantics({
    metricLabel: input.metricLabel,
    series: input.series,
    metricValue: input.metricValue,
    unavailableReason: input.unavailableReason,
  })
  const title = resolved.state === "trend"
    ? input.baseTitle
    : resolved.state === "snapshot"
      ? snapshotTrendTitle(input.metricLabel)
      : unavailableTrendTitle(input.metricLabel)
  return {
    title,
    metricLabel: input.metricLabel,
    format: input.format,
    state: resolved.state,
    data: resolved.data,
    snapshotValue: resolved.snapshotValue,
    emptyLabel: resolved.emptyLabel,
  }
}

export type DashboardSemanticAnalysis = {
  datasetId: string
  datasetName: string
  uploadType: string
  businessProfile: DashboardBusinessProfile
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
  if (reportInput.reportProfile?.id === "profitability_pnl" && reportInput.financials) {
    const financials = reportInput.financials
    return [
      metric("Revenue", financials.revenue ?? null, "currency", "Revenue", "Revenue source total from selected Profitability inputs."),
      metric("Operating Expenses", financials.operatingExpenses ?? null, "currency", "Operating Expenses", "Operating-expense source total from selected Profitability inputs."),
      metric("Operating Profit", financials.operatingProfit ?? null, "currency", "Operating Profit", "Operating profit from the canonical Profitability analysis."),
      metric("Operating Margin", financials.operatingMargin ?? null, "percent", "Operating Margin", "Operating profit divided by revenue."),
      metric("COGS", financials.cogs ?? null, "currency", "COGS", "COGS source total from selected Profitability inputs."),
      metric("Net Profit", financials.netProfit ?? null, "currency", "Net Profit", "Net profit after source-backed interest and tax."),
    ].filter((item) => item.available)
  }

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
    const customerLabel = saas.profile === "subscription_mrr_movements" ? "Active Customers" : "Customers"
    return [
      metric("Total Revenue", saas.revenue, "currency", saas.revenueField, "Source revenue field."),
      metric("Total Cost", saas.cost, "currency", saas.costField, "Source cost field."),
      metric("Total Profit", saas.profit, "currency", saas.profitField || "revenue - cost", saas.profitField ? "Source profit field." : "Revenue minus cost."),
      metric("Profit Margin", saas.profitMargin, "percent", "profit / revenue", "Profit divided by revenue."),
      metric("Total Users", saas.users, "number", saas.usersField, "Sum of recognized users field."),
      metric("Average Revenue per User", saas.averageRevenuePerUser, "currency", "revenue / users", "Revenue divided by users."),
      metric("Price per User", saas.pricePerUser, "currency", saas.pricePerUserField, "Average recognized price-per-user field."),
      metric("MRR", saas.mrr, "currency", saas.mrrField, "Latest-period SaaS snapshot sum."),
      metric("ARR", saas.arr, "currency", saas.arrField, "Latest-period SaaS snapshot sum."),
      metric(customerLabel, saas.customers, "number", saas.customerField, saas.profile === "subscription_mrr_movements" ? "Latest-period active customer IDs." : "Distinct recognized customer IDs."),
      metric("New Customers", saas.newCustomers, "number", saas.newCustomerField, "Distinct customers with normalized positive new-customer status."),
      metric("Churn Rate", saas.churnRate, "percent", saas.churnField, "Churned customers divided by eligible normalized churn-status customers."),
      metric("New MRR", saas.newMrr ?? null, "currency", saas.newMrrField ?? null, "Latest-period MRR delta where movement type is new."),
      metric("Expansion MRR", saas.expansionMrr, "currency", saas.expansionMrrField, "Latest-period expansion MRR sum."),
      metric("Contraction MRR", saas.contractionMrr, "currency", saas.contractionMrrField, "Latest-period contraction MRR sum."),
      metric("Churned MRR", saas.churnedMrr ?? null, "currency", saas.churnedMrrField ?? null, "Latest-period MRR delta where movement type is churn."),
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
      metric("Active Sellers", marketplace.activeSellers, "number", marketplace.activeSellersField, marketplace.activeSellersAggregation === "latest_snapshot" ? "Latest snapshot from recognized active sellers field." : "Sum of recognized active sellers field."),
      metric("Listings", marketplace.listings, "number", marketplace.listingsField, marketplace.listingsAggregation === "latest_snapshot" ? "Latest snapshot from recognized listing count field." : "Sum of recognized listing count field."),
      metric("Completion Rate", marketplace.completionRate, "percent", "completed / transactions", "Completed transactions divided by total transactions."),
    ].filter((item) => item.available)
  }

  return reportInput.kpis
    .map((item) => metric(item.title, parseDisplayNumber(item.value), inferMetricFormat(item.title, item.value), item.title, "Canonical report KPI."))
    .filter((item) => item.available)
}

function buildSemanticTrends(reportInput: DashboardReportInput): DashboardSemanticTrend[] {
  if (reportInput.reportProfile?.id === "profitability_pnl") {
    const periodTrends = reportInput.financials?.periodTrends ?? []
    const financials = reportInput.financials
    return [
      buildTrendPanel({
        baseTitle: "Revenue Trend",
        metricLabel: "Revenue",
        format: "currency",
        series: periodTrends.map((item) => ({ label: item.period, value: item.revenue })),
        metricValue: financials?.revenue ?? null,
        unavailableReason: "Revenue requires a recognized revenue source field.",
      }),
      buildTrendPanel({
        baseTitle: "Operating Profit Trend",
        metricLabel: "Operating Profit",
        format: "currency",
        series: periodTrends.map((item) => ({ label: item.period, value: item.operatingProfit })),
        metricValue: financials?.operatingProfit ?? null,
        unavailableReason: "Operating profit requires an operating profit field or revenue and operating expense fields.",
      }),
    ]
  }

  if (reportInput.reportProfile?.id === "investor_portfolio") {
    return [
      buildTrendPanel({
        baseTitle: "Portfolio Company Annual Revenue Trend",
        metricLabel: "Portfolio Company Annual Revenue",
        format: "currency",
        series: [],
        metricValue: reportInput.financials?.revenue ?? null,
        unavailableReason: "Portfolio company annual revenue requires a recognized revenue source field.",
      }),
      buildTrendPanel({
        baseTitle: "Profit Trend",
        metricLabel: "Profit",
        format: "currency",
        series: [],
        metricValue: reportInput.financials?.netProfit ?? reportInput.financials?.grossProfit ?? null,
        unavailableReason: "Profit requires a profit value or sufficient revenue and cost fields.",
      }),
    ]
  }

  if (reportInput.reportProfile?.id === "ecommerce" && reportInput.ecommerceAnalysis) {
    const ecommerce = reportInput.ecommerceAnalysis
    return [
      buildTrendPanel({
        baseTitle: "Revenue Trend",
        metricLabel: "Revenue",
        format: "currency",
        series: ecommerce.revenueTrend.map((item) => ({ label: item.name, value: item.value })),
        metricValue: reportInput.financials?.revenue ?? null,
        unavailableReason: "Revenue requires a recognized revenue source field.",
      }),
      buildTrendPanel({
        baseTitle: "Orders Trend",
        metricLabel: "Orders",
        format: "number",
        series: ecommerce.ordersTrend.map((item) => ({ label: item.name, value: item.value })),
        metricValue: ecommerce.orders,
        unavailableReason: "Orders require recognized order or quantity columns.",
      }),
    ]
  }

  if (reportInput.reportProfile?.id === "saas_startup" && reportInput.saasAnalysis) {
    const saas = reportInput.saasAnalysis
    const revenueTrend = reportInput.financials?.periodTrends
      ?.map((item) => ({ label: item.period, value: item.revenue })) ?? []
    return [
      buildTrendPanel({
        baseTitle: "Revenue Trend",
        metricLabel: "Revenue",
        format: "currency",
        series: revenueTrend,
        metricValue: saas.revenue ?? reportInput.financials?.revenue ?? null,
        unavailableReason: "Revenue requires a recognized revenue source field.",
      }),
      buildTrendPanel({
        baseTitle: "MRR Trend",
        metricLabel: "MRR",
        format: "currency",
        series: namedSeries(saas.mrrTrend),
        metricValue: saas.mrr,
        unavailableReason: "MRR requires recognized MRR and month columns.",
      }),
      buildTrendPanel({
        baseTitle: "Customer Trend",
        metricLabel: "Customers",
        format: "number",
        series: namedSeries(saas.customerTrend),
        metricValue: saas.customers,
        unavailableReason: "Customers require recognized customer and month columns.",
      }),
      buildTrendPanel({
        baseTitle: "Churn Trend",
        metricLabel: "Churned Customers",
        format: "number",
        series: namedSeries(saas.churnTrend),
        metricValue: null,
        unavailableReason: "Churned customers require recognized churn and month columns.",
      }),
      buildTrendPanel({
        baseTitle: "Runway Trend",
        metricLabel: "Runway",
        format: "number",
        series: namedSeries(saas.runwayTrend),
        metricValue: saas.runwayMonths,
        unavailableReason: "Runway requires recognized runway and month columns.",
      }),
    ]
  }

  if (reportInput.reportProfile?.id === "marketplace_startup" && reportInput.marketplaceAnalysis) {
    const marketplace = reportInput.marketplaceAnalysis
    return [
      buildTrendPanel({
        baseTitle: "GMV Trend",
        metricLabel: "GMV",
        format: "currency",
        series: namedSeries(marketplace.gmvTrend),
        metricValue: marketplace.gmv,
        unavailableReason: "GMV requires a recognized GMV or revenue field.",
      }),
      buildTrendPanel({
        baseTitle: "Marketplace Revenue Trend",
        metricLabel: "Marketplace Revenue",
        format: "currency",
        series: namedSeries(marketplace.marketplaceRevenueTrend),
        metricValue: marketplace.marketplaceRevenue,
        unavailableReason: "Marketplace revenue requires a platform fee or commission field.",
      }),
      buildTrendPanel({
        baseTitle: "Refund Trend",
        metricLabel: "Refund Amount",
        format: "currency",
        series: namedSeries(marketplace.refundTrend),
        metricValue: marketplace.refunds,
        unavailableReason: "Refund data requires a recognized refund amount field.",
      }),
    ]
  }

  const periodTrends = reportInput.financials?.periodTrends ?? []
  return [
    buildTrendPanel({
      baseTitle: "Revenue Trend",
      metricLabel: "Revenue",
      format: "currency",
      series: periodTrends.map((item) => ({ label: item.period, value: item.revenue })),
      metricValue: reportInput.financials?.revenue ?? null,
      unavailableReason: "Revenue requires a recognized revenue source field.",
    }),
    buildTrendPanel({
      baseTitle: "Profit Trend",
      metricLabel: "Profit",
      format: "currency",
      series: periodTrends.map((item) => ({ label: item.period, value: item.netProfit ?? item.grossProfit ?? null })),
      metricValue: reportInput.financials?.netProfit ?? reportInput.financials?.grossProfit ?? null,
      unavailableReason: "Profit requires a profit value or sufficient revenue and cost fields.",
    }),
  ]
}

function namedSeries(data: { name: string; value: number }[] | undefined): TrendSeriesPoint[] {
  return (data ?? []).map((item) => ({ label: item.name, value: item.value }))
}

function businessProfileFromReport(profileId?: string | null, businessModel?: string | null): DashboardBusinessProfile {
  if (profileId === "profitability_pnl" || businessModel === "profitability") return "profitability"
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
