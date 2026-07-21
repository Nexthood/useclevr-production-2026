import { calculateBusinessBalancedScorecard } from "@/lib/business/balanced-scorecard"
import { resolveBusinessModel, type BusinessModel } from "@/lib/data/business-model"
import { loadDatasetData } from "@/lib/data/dataset-access"
import { resolveDatasetType, type DatasetCategory } from "@/lib/data/dataset-category"
import type { datasets } from "@/lib/db/schema"
import type { ReportChart, ReportFinancials, ReportRecommendation } from "@/lib/reports/report-generator"

type DatasetRecord = typeof datasets.$inferSelect
type DataRow = Record<string, unknown>
type ReportModel = BusinessModel | DatasetCategory | "business_consulting"
type ReportKpi = { title: string; value: number; format: "currency" | "number" | "percent" }

type ColumnMap = {
  revenue?: string
  cost?: string
  profit?: string
  quantity?: string
  order?: string
  customer?: string
  country?: string
  channel?: string
  product?: string
  category?: string
  stock?: string
  reorderPoint?: string
  mrr?: string
  arr?: string
  churned?: string
  cac?: string
  ltv?: string
  burn?: string
  runway?: string
  investedAmount?: string
  valuation?: string
  ownership?: string
  sector?: string
  stage?: string
  seller?: string
  buyer?: string
  gmv?: string
  commission?: string
  billableHours?: string
  hourlyRate?: string
  consultantCost?: string
  grossMargin?: string
  account?: string
  debit?: string
  credit?: string
  invoice?: string
}

export async function buildDatasetReportInput(dataset: DatasetRecord) {
  const rows = await loadDatasetData(dataset.id, dataset)
  const columns = Array.isArray(dataset.columns) ? dataset.columns.filter((column): column is string => typeof column === "string") : []
  const datasetType = resolveDatasetType(dataset.datasetType, dataset.analysis)
  const businessModel = resolveBusinessModel({
    explicit: dataset.businessModel,
    uploadSource: isRecord(dataset.analysis) ? String(dataset.analysis.uploadSource || "") : "",
    datasetType,
    columns,
    datasetName: dataset.name,
    analysis: dataset.analysis,
  })
  const reportModel = resolveReportModel(datasetType, businessModel, columns, dataset.name)
  if (reportModel === "profitability") {
    const profitabilityReport = buildProfitabilityReportInput(dataset, rows, columns, businessModel)
    if (profitabilityReport) return profitabilityReport
  }
  const columnMap = detectColumns(columns)
  const kpis = buildKpis(reportModel, rows, columnMap)
  const charts = buildCharts(reportModel, rows, columnMap)
  const findings = buildFindings(reportModel, rows, columnMap, kpis)
  const bbsc = calculateBusinessBalancedScorecard({ rows, columns, businessModel: reportModel })

  return {
    businessModel,
    reportType: reportModel,
    summary: `${reportModelLabel(reportModel)} report for ${dataset.name}. This report uses only the selected dataset and includes a Business Balanced Scorecard when enough source fields are available.`,
    findings,
    kpis,
    charts,
    aiInsights: extractInsights(dataset.analysis),
    predictions: [],
    alerts: buildAlerts(reportModel, rows, columnMap),
    bbsc,
    rowCount: dataset.rowCount || rows.length,
    columns,
  }
}

function buildProfitabilityReportInput(dataset: DatasetRecord, rows: DataRow[], columns: string[], businessModel: BusinessModel) {
  const metrics = isRecord(dataset.precomputedMetrics) ? dataset.precomputedMetrics : null
  if (!metrics) return null
  const numeric = (key: string) => typeof metrics[key] === "number" ? metrics[key] as number : null
  const totalRevenue = numeric("totalRevenue")
  const cogs = numeric("cogs")
  const operatingExpenses = numeric("operatingExpenses")
  const interestExpense = numeric("interestExpense")
  const taxExpense = numeric("taxExpense")
  const grossProfit = totalRevenue !== null && cogs !== null ? round(totalRevenue - cogs) : null
  const operatingProfit = grossProfit !== null && operatingExpenses !== null ? round(grossProfit - operatingExpenses) : null
  const netProfit = operatingProfit !== null && interestExpense !== null && taxExpense !== null
    ? round(operatingProfit - interestExpense - taxExpense)
    : null
  const grossMargin = totalRevenue && grossProfit !== null ? round((grossProfit / totalRevenue) * 100) : null
  const operatingMargin = totalRevenue && operatingProfit !== null ? round((operatingProfit / totalRevenue) * 100) : null
  const netMargin = totalRevenue && netProfit !== null ? round((netProfit / totalRevenue) * 100) : null
  const missingFields = missingProfitabilityFields({
    totalRevenue,
    cogs,
    grossProfit,
    operatingExpenses,
    operatingProfit,
    interestExpense,
    taxExpense,
    netProfit,
    grossMargin,
    operatingMargin,
    netMargin,
  }, metrics)
  const kpis: ReportKpi[] = []
  addKpi(kpis, "Revenue", totalRevenue, "currency")
  addKpi(kpis, "COGS", cogs, "currency")
  addKpi(kpis, "Gross Profit", grossProfit, "currency")
  addKpi(kpis, "Operating Expenses", operatingExpenses, "currency")
  addKpi(kpis, "Operating Profit", operatingProfit, "currency")
  addKpi(kpis, "Interest", interestExpense, "currency")
  addKpi(kpis, "Taxes", taxExpense, "currency")
  addKpi(kpis, "Net Profit", netProfit, "currency")
  addKpi(kpis, "Gross Margin", grossMargin, "percent")
  addKpi(kpis, "Operating Margin", operatingMargin, "percent")
  addKpi(kpis, "Net Margin", netMargin, "percent")

  const charts: ReportChart[] = []
  const topCostCategories = tupleChart(metrics.topCostCategories || metrics.expenseCategories, "Top cost categories")
  const revenueSources = tupleChart(metrics.revenueByProduct || metrics.revenueByRegion, "Revenue sources")
  if (topCostCategories) charts.push(topCostCategories)
  if (revenueSources) charts.push(revenueSources)

  const findings = [
    "This report combines the selected Revenue and Expenses datasets.",
    "Revenue and expense totals are isolated to the selected profitability analysis pair.",
  ]
  if (typeof metrics.statusLabel === "string") findings.push(metrics.statusLabel)
  if (Array.isArray(metrics.dataQualityNotes)) findings.push(...metrics.dataQualityNotes.filter((note): note is string => typeof note === "string"))
  if (Array.isArray(metrics.missingColumns) && metrics.missingColumns.length > 0) {
    findings.push(`Missing source fields: ${metrics.missingColumns.map(String).join(", ")}.`)
  }

  const bbscRows = profitabilityRowsFromMetrics(metrics)
  const bbsc = calculateBusinessBalancedScorecard({
    rows: bbscRows,
    columns: Object.keys(bbscRows[0] || {}),
    businessModel: "profitability",
  })
  const financials: ReportFinancials = {
    reportingPeriod: reportingPeriodFromMetrics(metrics),
    dataConfidence: typeof metrics.dataConfidence === "number" ? metrics.dataConfidence : null,
    revenue: totalRevenue,
    cogs,
    grossProfit,
    operatingExpenses,
    operatingProfit,
    interestExpense,
    taxExpense,
    netProfit,
    grossMargin,
    operatingMargin,
    netMargin,
    revenueGrowth: revenueGrowthFromMetrics(metrics),
    expenseRatio: totalRevenue && numeric("totalExpenses") !== null ? round((numeric("totalExpenses")! / totalRevenue) * 100) : null,
    missingFields,
    topCostCategories: topCostCategories?.data || [],
    periodTrends: periodTrendsFromMetrics(metrics),
  }
  const recommendations = buildProfitabilityRecommendations(financials, bbsc)

  return {
    businessModel,
    reportType: "profitability" as const,
    summary: buildProfitabilitySummary(dataset.name, financials, bbsc),
    financials,
    findings,
    kpis,
    charts,
    aiInsights: extractInsights(dataset.analysis),
    predictions: [],
    recommendations,
    alerts: buildProfitabilityAlerts(netMargin, metrics),
    bbsc,
    rowCount: dataset.rowCount || rows.length,
    columns,
  }
}

function buildProfitabilitySummary(datasetName: string, financials: ReportFinancials, bbsc: ReturnType<typeof calculateBusinessBalancedScorecard>) {
  const revenue = financials.revenue !== null ? formatCurrencyForSummary(financials.revenue) : "Not available"
  const grossMargin = financials.grossMargin !== null ? `${financials.grossMargin.toFixed(1)}%` : "not available"
  const netMargin = financials.netMargin !== null ? `${financials.netMargin.toFixed(1)}%` : "not available"
  const score = bbsc.overallScore !== null ? `${bbsc.overallScore}/100` : "not available"
  const topCost = financials.topCostCategories?.[0]
  const totalCost = financials.topCostCategories?.reduce((total, item) => total + item.value, 0) || 0
  const topCostShare = topCost && totalCost > 0 ? `${((topCost.value / totalCost) * 100).toFixed(1)}%` : null
  const confidence = financials.dataConfidence !== null && financials.dataConfidence !== undefined ? `${Math.round(financials.dataConfidence)}%` : "not available"

  return [
    `${datasetName} generated ${revenue} in revenue with gross margin of ${grossMargin} and net margin of ${netMargin}.`,
    topCost && topCostShare ? `${topCost.name} represents ${topCostShare} of total categorized expenses.` : "Cost concentration is not available because expense category data is incomplete.",
    `Profitability health score is ${score}; source-data confidence is ${confidence}.`,
  ].join(" ")
}

function missingProfitabilityFields(values: Record<string, number | null>, metrics: Record<string, unknown>) {
  const missing = new Set<string>()
  for (const [field, value] of Object.entries(values)) {
    if (value === null) missing.add(humanizeField(field))
  }
  if (Array.isArray(metrics.missingColumns)) {
    for (const field of metrics.missingColumns) missing.add(String(field))
  }
  if (Array.isArray(metrics.unavailableMetrics)) {
    for (const field of metrics.unavailableMetrics) missing.add(humanizeField(String(field)))
  }
  return Array.from(missing)
}

function periodTrendsFromMetrics(metrics: Record<string, unknown>): ReportFinancials["periodTrends"] {
  if (!Array.isArray(metrics.periodTrends)) return []
  return metrics.periodTrends
    .filter(isRecord)
    .map((trend) => {
      const revenue = numberOrNull(trend.revenue)
      const cogs = numberOrNull(trend.cogs)
      const operatingExpenses = numberOrNull(trend.operatingExpenses)
      const interestExpense = numberOrNull(trend.interestExpense)
      const taxExpense = numberOrNull(trend.taxExpense)
      const grossProfit = revenue !== null && cogs !== null ? round(revenue - cogs) : numberOrNull(trend.grossProfit)
      const operatingProfit = grossProfit !== null && operatingExpenses !== null ? round(grossProfit - operatingExpenses) : numberOrNull(trend.operatingProfit)
      const netProfit = operatingProfit !== null && interestExpense !== null && taxExpense !== null
        ? round(operatingProfit - interestExpense - taxExpense)
        : numberOrNull(trend.netProfit)

      return {
        period: String(trend.period || "Period"),
        revenue,
        cogs,
        operatingExpenses,
        interestExpense,
        taxExpense,
        grossProfit,
        operatingProfit,
        netProfit,
        grossMargin: revenue && grossProfit !== null ? round((grossProfit / revenue) * 100) : null,
        operatingMargin: revenue && operatingProfit !== null ? round((operatingProfit / revenue) * 100) : null,
        netMargin: revenue && netProfit !== null ? round((netProfit / revenue) * 100) : null,
      }
    })
}

function revenueGrowthFromMetrics(metrics: Record<string, unknown>) {
  const trends = periodTrendsFromMetrics(metrics) || []
  const revenuePeriods = trends.filter((trend) => trend.revenue !== null)
  if (revenuePeriods.length < 2) return null
  const first = revenuePeriods[0].revenue
  const last = revenuePeriods[revenuePeriods.length - 1].revenue
  if (!first || last === null) return null
  return round(((last - first) / first) * 100)
}

function reportingPeriodFromMetrics(metrics: Record<string, unknown>) {
  const trends = periodTrendsFromMetrics(metrics) || []
  if (trends.length === 0) return null
  if (trends.length === 1) return trends[0].period
  return `${trends[0].period} to ${trends[trends.length - 1].period}`
}

function buildProfitabilityRecommendations(
  financials: ReportFinancials,
  bbsc: ReturnType<typeof calculateBusinessBalancedScorecard>,
): ReportRecommendation[] {
  const recommendations: ReportRecommendation[] = []
  const topCost = financials.topCostCategories?.[0]
  const totalCost = financials.topCostCategories?.reduce((total, item) => total + item.value, 0) || 0
  if (topCost && totalCost > 0) {
    const share = (topCost.value / totalCost) * 100
    recommendations.push({
      issue: `${topCost.name} represents ${share.toFixed(1)}% of total categorized expenses.`,
      businessImpact: share >= 50 ? "High expense concentration increases profitability risk." : "Expense concentration is visible and worth active management.",
      recommendedAction: `Review ${topCost.name} contracts, staffing levels, vendors, or usage drivers and set a reduction target.`,
      estimatedImpact: financials.netProfit !== null ? `A 5% reduction in ${topCost.name} would improve net profit by ${formatCurrencyForSummary(topCost.value * 0.05)}.` : null,
      confidence: "High",
      requiredData: [],
    })
  }
  if (financials.netMargin !== null && financials.netMargin < 10) {
    recommendations.push({
      issue: `Net margin is ${financials.netMargin.toFixed(1)}%.`,
      businessImpact: "Low net margin leaves limited room for pricing, demand, or cost shocks.",
      recommendedAction: "Prioritize margin expansion through pricing, COGS review, and operating-expense controls.",
      estimatedImpact: financials.revenue !== null ? `Each 1 percentage point of net margin equals ${formatCurrencyForSummary(financials.revenue * 0.01)} in net profit.` : null,
      confidence: "High",
      requiredData: [],
    })
  }
  if (bbsc.weakestPerspective) {
    recommendations.push({
      issue: `${bbsc.weakestPerspective.title} is the weakest available perspective at ${bbsc.weakestPerspective.score}/100.`,
      businessImpact: "The weakest scored perspective limits the overall business score.",
      recommendedAction: bbsc.weakestPerspective.recommendedActions[0] || "Track the missing drivers and review the perspective monthly.",
      estimatedImpact: null,
      confidence: bbsc.weakestPerspective.dataConfidence >= 70 ? "High" : "Medium",
      requiredData: bbsc.weakestPerspective.status === "available" ? [] : bbsc.weakestPerspective.requiredFields,
    })
  }
  if ((financials.missingFields || []).length > 0) {
    recommendations.push({
      issue: `Missing fields limit report completeness: ${financials.missingFields!.slice(0, 4).join(", ")}.`,
      businessImpact: "Unavailable source fields reduce confidence and prevent some KPI calculations.",
      recommendedAction: "Add the missing financial fields to the next Revenue and Expenses upload.",
      estimatedImpact: null,
      confidence: "Medium",
      requiredData: financials.missingFields,
    })
  }
  return recommendations.slice(0, 5)
}

function tupleChart(value: unknown, title: string): ReportChart | null {
  if (!Array.isArray(value)) return null
  const data = value
    .map((item) => {
      if (!Array.isArray(item)) return null
      const name = String(item[0] || "Other")
      const amount = typeof item[1] === "number" ? item[1] : Number(item[1])
      return Number.isFinite(amount) ? { name, value: amount } : null
    })
    .filter((item): item is { name: string; value: number } => Boolean(item))
    .slice(0, 8)
  return data.length > 0 ? { type: "bar", title, data } : null
}

function profitabilityRowsFromMetrics(metrics: Record<string, unknown>) {
  return [{
    revenue: metrics.totalRevenue,
    cost: metrics.totalExpenses,
    cogs: metrics.cogs,
    operating_expenses: metrics.operatingExpenses,
    interest_expense: metrics.interestExpense,
    tax_expense: metrics.taxExpense,
    gross_profit: metrics.grossProfit,
    operating_profit: metrics.operatingProfit,
    net_profit: metrics.netProfit,
    gross_margin: metrics.grossMargin,
    operating_margin: metrics.operatingMargin,
    net_margin: metrics.netMargin,
    customer_id: metrics.customerCount,
    quantity: metrics.salesVolume,
  }]
}

function buildProfitabilityAlerts(netMargin: number | null, metrics: Record<string, unknown>) {
  const alerts: { type: string; message: string; severity: string }[] = []
  if (netMargin !== null && netMargin < 0) {
    alerts.push({ type: "profitability", message: "Net margin is negative.", severity: "high" })
  }
  if (Array.isArray(metrics.missingColumns) && metrics.missingColumns.length > 0) {
    alerts.push({ type: "data_quality", message: `Some profitability metrics are unavailable because fields are missing: ${metrics.missingColumns.map(String).join(", ")}.`, severity: "medium" })
  }
  return alerts
}

function resolveReportModel(datasetType: DatasetCategory, businessModel: BusinessModel, columns: string[], datasetName: string): ReportModel {
  if (datasetType === "profitability" || datasetType === "accountancy" || datasetType === "prebookkeeping") return datasetType
  if (detectBusinessConsulting(columns, datasetName)) return "business_consulting"
  return businessModel
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function detectBusinessConsulting(columns: string[], datasetName: string) {
  const text = [datasetName, ...columns].join(" ").toLowerCase()
  return /billable|hourly_rate|consultant_cost|project_margin|gross_margin|client_id|project_id/.test(text)
}

function reportModelLabel(model: ReportModel) {
  if (model === "local_retail") return "Local retail"
  if (model === "ecommerce") return "E-commerce"
  if (model === "saas") return "SaaS"
  if (model === "startup") return "Startup"
  if (model === "investor") return "Investor portfolio"
  if (model === "marketplace") return "Marketplace"
  if (model === "business_consulting") return "Business consulting"
  if (model === "profitability") return "Profitability"
  if (model === "accountancy") return "Accountancy"
  if (model === "prebookkeeping") return "Pre-bookkeeping"
  return "Business analytics"
}

function detectColumns(columns: string[]): ColumnMap {
  return {
    revenue: findColumn(columns, [/revenue/, /^sales$/, /amount/, /turnover/, /income/]),
    cost: findColumn(columns, [/^cost$/, /cogs/, /expense/, /shipping_cost/, /unit_cost/, /spend/]),
    profit: findColumn(columns, [/profit/, /gross_margin/, /margin/]),
    quantity: findColumn(columns, [/quantity/, /^qty$/, /units_sold/, /units/]),
    order: findColumn(columns, [/order_id/, /^order$/, /transaction/, /invoice/]),
    customer: findColumn(columns, [/customer_id/, /customer/, /client_id/, /client/]),
    country: findColumn(columns, [/country/, /region/, /location/]),
    channel: findColumn(columns, [/channel/, /source/]),
    product: findColumn(columns, [/product_id/, /product/, /^sku$/, /item/]),
    category: findColumn(columns, [/category/, /sector/, /industry/]),
    stock: findColumn(columns, [/stock_on_hand/, /stock/, /inventory/]),
    reorderPoint: findColumn(columns, [/reorder_point/, /reorder/]),
    mrr: findColumn(columns, [/^mrr$/]),
    arr: findColumn(columns, [/^arr$/]),
    churned: findColumn(columns, [/churned/, /churn/]),
    cac: findColumn(columns, [/^cac$/]),
    ltv: findColumn(columns, [/^ltv$/]),
    burn: findColumn(columns, [/burn/]),
    runway: findColumn(columns, [/runway/]),
    investedAmount: findColumn(columns, [/invested_amount/, /invested_capital/, /investment/]),
    valuation: findColumn(columns, [/latest_valuation/, /valuation/]),
    ownership: findColumn(columns, [/ownership/]),
    sector: findColumn(columns, [/sector/]),
    stage: findColumn(columns, [/stage/]),
    seller: findColumn(columns, [/seller/, /vendor/, /merchant/]),
    buyer: findColumn(columns, [/buyer/]),
    gmv: findColumn(columns, [/^gmv$/, /gross_merchandise/]),
    commission: findColumn(columns, [/commission/, /take_rate/, /platform_fee/]),
    billableHours: findColumn(columns, [/billable_hours/, /hours/]),
    hourlyRate: findColumn(columns, [/hourly_rate/, /rate/]),
    consultantCost: findColumn(columns, [/consultant_cost/]),
    grossMargin: findColumn(columns, [/gross_margin/, /project_margin/]),
    account: findColumn(columns, [/account/, /ledger/]),
    debit: findColumn(columns, [/debit/]),
    credit: findColumn(columns, [/credit/]),
    invoice: findColumn(columns, [/invoice/, /receipt/]),
  }
}

function buildKpis(model: ReportModel, rows: DataRow[], columns: ColumnMap): ReportKpi[] {
  const revenue = sumColumn(rows, columns.revenue) ?? sumColumn(rows, columns.gmv)
  const cost = sumColumn(rows, columns.cost)
  const profit = sumColumn(rows, columns.profit) ?? (revenue !== null && cost !== null ? revenue - cost : null)
  const quantity = sumColumn(rows, columns.quantity)
  const orders = columns.order ? uniqueCount(rows, columns.order) : quantity
  const customers = columns.customer ? uniqueCount(rows, columns.customer) : null
  const kpis: ReportKpi[] = []

  addKpi(kpis, "Revenue", revenue, "currency")
  addKpi(kpis, "Profit", profit, "currency")

  if (model === "local_retail") {
    addKpi(kpis, "Units sold", quantity, "number")
    addKpi(kpis, "Inventory", sumColumn(rows, columns.stock), "number")
    addKpi(kpis, "Low stock", countLowStock(rows, columns), "number")
  } else if (model === "ecommerce") {
    addKpi(kpis, "Orders", orders, "number")
    addKpi(kpis, "Customers", customers, "number")
    addKpi(kpis, "AOV", revenue !== null && orders ? revenue / orders : null, "currency")
    addKpi(kpis, "Shipping cost", sumColumn(rows, columns.cost), "currency")
  } else if (model === "saas" || model === "startup") {
    addKpi(kpis, "MRR", sumColumn(rows, columns.mrr), "currency")
    addKpi(kpis, "ARR", sumColumn(rows, columns.arr), "currency")
    addKpi(kpis, "Churn", churnRate(rows, columns.churned), "percent")
    addKpi(kpis, "CAC", averageColumn(rows, columns.cac), "currency")
    addKpi(kpis, "LTV", averageColumn(rows, columns.ltv), "currency")
    addKpi(kpis, "Burn", sumColumn(rows, columns.burn), "currency")
    addKpi(kpis, "Runway", averageColumn(rows, columns.runway), "number")
    addKpi(kpis, "Customers", customers, "number")
  } else if (model === "investor") {
    addKpi(kpis, "Invested capital", sumColumn(rows, columns.investedAmount), "currency")
    addKpi(kpis, "Portfolio valuation", sumColumn(rows, columns.valuation), "currency")
    addKpi(kpis, "Average ownership", averageColumn(rows, columns.ownership), "percent")
  } else if (model === "marketplace") {
    addKpi(kpis, "GMV", sumColumn(rows, columns.gmv) ?? revenue, "currency")
    addKpi(kpis, "Commission", sumColumn(rows, columns.commission), "currency")
    addKpi(kpis, "Sellers", columns.seller ? uniqueCount(rows, columns.seller) : null, "number")
    addKpi(kpis, "Buyers", columns.buyer ? uniqueCount(rows, columns.buyer) : customers, "number")
  } else if (model === "business_consulting") {
    addKpi(kpis, "Billable hours", sumColumn(rows, columns.billableHours), "number")
    addKpi(kpis, "Utilization revenue", revenue, "currency")
    addKpi(kpis, "Project margin", sumColumn(rows, columns.grossMargin) ?? profit, "currency")
    addKpi(kpis, "Client count", customers, "number")
  } else if (model === "profitability") {
    addKpi(kpis, "Costs", cost, "currency")
    addKpi(kpis, "Gross margin", profit !== null && revenue ? (profit / revenue) * 100 : null, "percent")
  } else if (model === "accountancy" || model === "prebookkeeping") {
    addKpi(kpis, "Debit total", sumColumn(rows, columns.debit), "currency")
    addKpi(kpis, "Credit total", sumColumn(rows, columns.credit), "currency")
    addKpi(kpis, "Invoices / documents", columns.invoice ? uniqueCount(rows, columns.invoice) : rows.length, "number")
    addKpi(kpis, "Accounts", columns.account ? uniqueCount(rows, columns.account) : null, "number")
  } else {
    addKpi(kpis, "Orders / quantity", orders, "number")
    addKpi(kpis, "Customers", customers, "number")
  }

  return kpis
}

function buildCharts(model: ReportModel, rows: DataRow[], columns: ColumnMap): ReportChart[] {
  const charts: ReportChart[] = []
  const productChart = groupedChart(rows, columns.product || columns.category, columns.revenue || columns.quantity, "Top products or categories")
  if (productChart) charts.push(productChart)

  if (model === "ecommerce") {
    const channel = groupedChart(rows, columns.channel, columns.revenue || columns.quantity, "Channel performance")
    const geography = groupedChart(rows, columns.country, columns.revenue || columns.quantity, "Geography")
    if (channel) charts.push(channel)
    if (geography) charts.push(geography)
  } else if (model === "investor") {
    const sector = groupedChart(rows, columns.sector, columns.investedAmount || columns.valuation, "Sector allocation")
    const stage = groupedChart(rows, columns.stage, columns.investedAmount || columns.valuation, "Stage allocation")
    if (sector) charts.push(sector)
    if (stage) charts.push(stage)
  } else if (model === "marketplace") {
    const seller = groupedChart(rows, columns.seller, columns.gmv || columns.revenue, "Seller performance")
    if (seller) charts.push(seller)
  } else if (model === "business_consulting") {
    const clients = groupedChart(rows, columns.customer, columns.revenue || columns.billableHours, "Client profitability")
    if (clients) charts.push(clients)
  } else if (model === "accountancy" || model === "prebookkeeping") {
    const accounts = groupedChart(rows, columns.account, columns.debit || columns.credit || columns.revenue, "Account activity")
    if (accounts) charts.push(accounts)
  }

  return charts.slice(0, 4)
}

function buildFindings(model: ReportModel, rows: DataRow[], columns: ColumnMap, kpis: ReportKpi[]) {
  const findings = [`Generated from ${rows.length.toLocaleString()} loaded rows for ${reportModelLabel(model).toLowerCase()} analysis.`]
  if (kpis.some((kpi) => kpi.title === "Revenue")) findings.push("Revenue is included as a primary KPI for this selected dataset.")
  if (model === "local_retail" && columns.stock) findings.push("Inventory and reorder-risk checks are included from stock columns.")
  if (model === "ecommerce" && columns.country) findings.push("Geography uses only country or region values present in this dataset.")
  if ((model === "saas" || model === "startup") && (columns.mrr || columns.arr)) findings.push("Recurring revenue metrics are included from MRR/ARR columns.")
  if (model === "investor" && columns.valuation) findings.push("Portfolio valuation and allocation metrics are included.")
  if (model === "marketplace" && (columns.gmv || columns.commission)) findings.push("Marketplace GMV, commission, seller, and buyer metrics are included where columns exist.")
  if (model === "business_consulting" && columns.billableHours) findings.push("Billable-hour and project-margin metrics are included.")
  if ((model === "accountancy" || model === "prebookkeeping") && (columns.debit || columns.credit)) findings.push("Ledger debit and credit totals are included from accounting columns.")
  return findings
}

function buildAlerts(model: ReportModel, rows: DataRow[], columns: ColumnMap) {
  const alerts: { type: string; message: string; severity: string }[] = []
  if (model === "local_retail" && countLowStock(rows, columns)) {
    alerts.push({ type: "inventory", message: "Some products are at or below reorder point.", severity: "medium" })
  }
  if ((model === "saas" || model === "startup") && churnRate(rows, columns.churned) !== null && (churnRate(rows, columns.churned) || 0) > 10) {
    alerts.push({ type: "retention", message: "Detected churn rate is above 10%.", severity: "high" })
  }
  return alerts
}

function extractInsights(analysis: unknown): string[] {
  if (!analysis || typeof analysis !== "object") return []
  const record = analysis as Record<string, unknown>
  const sources = [record.ai_summary, record.summary].filter((value): value is string => typeof value === "string")
  return sources.slice(0, 3)
}

function findColumn(columns: string[], patterns: RegExp[]) {
  return columns.find((column) => patterns.some((pattern) => pattern.test(column.toLowerCase().trim().replace(/[\s-]+/g, "_"))))
}

function addKpi(kpis: ReportKpi[], title: string, value: number | null, format: ReportKpi["format"]) {
  if (value === null || !Number.isFinite(value)) return
  kpis.push({ title, value, format })
}

function sumColumn(rows: DataRow[], column?: string) {
  if (!column) return null
  let total = 0
  let found = false
  for (const row of rows) {
    const value = getNumber(row[column])
    if (value === null) continue
    total += value
    found = true
  }
  return found ? total : null
}

function averageColumn(rows: DataRow[], column?: string) {
  if (!column) return null
  const values = rows.map((row) => getNumber(row[column])).filter((value): value is number => value !== null)
  if (values.length === 0) return null
  return values.reduce((total, value) => total + value, 0) / values.length
}

function uniqueCount(rows: DataRow[], column: string) {
  return new Set(rows.map((row) => String(row[column] || "").trim()).filter(Boolean)).size
}

function churnRate(rows: DataRow[], column?: string) {
  if (!column || rows.length === 0) return null
  const churned = rows.filter((row) => ["true", "yes", "1", "churned"].includes(String(row[column]).toLowerCase())).length
  return (churned / rows.length) * 100
}

function countLowStock(rows: DataRow[], columns: ColumnMap) {
  if (!columns.stock || !columns.reorderPoint) return null
  return rows.filter((row) => {
    const stock = getNumber(row[columns.stock!])
    const reorder = getNumber(row[columns.reorderPoint!])
    return stock !== null && reorder !== null && stock <= reorder
  }).length
}

function groupedChart(rows: DataRow[], groupColumn: string | undefined, valueColumn: string | undefined, title: string): ReportChart | null {
  if (!groupColumn || !valueColumn) return null
  const grouped = new Map<string, number>()
  for (const row of rows) {
    const name = String(row[groupColumn] || "").trim()
    const value = getNumber(row[valueColumn])
    if (!name || value === null) continue
    grouped.set(name, (grouped.get(name) || 0) + value)
  }
  const data = Array.from(grouped.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
  return data.length > 0 ? { type: "bar", title, data } : null
}

function getNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value !== "string") return null
  const parsed = Number.parseFloat(value.replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : null
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function round(value: number) {
  return Math.round(value * 100) / 100
}

function humanizeField(field: string) {
  return field
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatCurrencyForSummary(value: number) {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}
