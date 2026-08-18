import { calculateBusinessBalancedScorecard } from "@/lib/business/balanced-scorecard"
import { resolveBusinessModel, type BusinessModel } from "@/lib/data/business-model"
import { loadDatasetData } from "@/lib/data/dataset-access"
import { resolveDatasetType, type DatasetCategory } from "@/lib/data/dataset-category"
import type { datasets } from "@/lib/db/schema"
import { debugLog } from "@/lib/utils/debug"
import { ReportIntegrityError } from "@/lib/reports/report-generator"
import type { EcommerceReportAnalysis, InvestorReportAnalysis, MarketplaceReportAnalysis, ReportChart, ReportDiagnostics, ReportFinancials, ReportRecommendation, ReportSemanticContext, RetailReportAnalysis, SaasReportAnalysis } from "@/lib/reports/report-generator"
import { getReportProfile } from "@/lib/reports/report-profiles"

type DatasetRecord = typeof datasets.$inferSelect
type DataRow = Record<string, unknown>
type ReportModel = BusinessModel | DatasetCategory | "business_consulting" | "professional_services"
type ReportKpi = { title: string; value: number; format: "currency" | "number" | "percent" }
type MetricSource = "source_value" | "derived_value" | "unavailable"
type FinancialMetric = { value: number | null; source: MetricSource; note: string }
type NormalizedReturnStatus = "returned" | "not_returned" | "unknown"
type NormalizedBooleanStatus = "positive" | "negative" | "unknown"

type ColumnMap = {
  revenue?: string
  cost?: string
  grossProfit?: string
  operatingProfit?: string
  netProfit?: string
  cogs?: string
  operatingExpenses?: string
  interestExpense?: string
  taxExpense?: string
  profit?: string
  quantity?: string
  order?: string
  customer?: string
  country?: string
  region?: string
  channel?: string
  product?: string
  category?: string
  date?: string
  shippingCost?: string
  discount?: string
  returnStatus?: string
  paymentMethod?: string
  expenseCategory?: string
  expenseAmount?: string
  vendor?: string
  stock?: string
  reorderPoint?: string
  mrr?: string
  arr?: string
  newCustomer?: string
  churned?: string
  expansionMrr?: string
  contractionMrr?: string
  cac?: string
  ltv?: string
  activeUsers?: string
  supportTickets?: string
  burn?: string
  cashBalance?: string
  runway?: string
  plan?: string
  investedAmount?: string
  valuation?: string
  ownership?: string
  sector?: string
  stage?: string
  companyId?: string
  companyName?: string
  status?: string
  growthRate?: string
  seller?: string
  buyer?: string
  gmv?: string
  commission?: string
  billableHours?: string
  hourlyRate?: string
  consultantCost?: string
  otherCost?: string
  grossMargin?: string
  projectStart?: string
  projectEnd?: string
  projectId?: string
  consultantId?: string
  industry?: string
  pipelineStage?: string
  freelancerCost?: string
  adSpend?: string
  campaignId?: string
  serviceLine?: string
  leadCount?: string
  conversionCount?: string
  account?: string
  debit?: string
  credit?: string
  invoice?: string
  refund?: string
  sellerPayout?: string
  newBuyer?: string
  newSeller?: string
  activeSellers?: string
  listingCount?: string
  completed?: string
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
  if (reportModel === "local_retail" && !columnMap.cogs && columnMap.cost) {
    columnMap.cogs = columnMap.cost
  }
  if (reportModel === "marketplace") {
    columnMap.revenue = undefined
    columnMap.expenseCategory = undefined
    columnMap.expenseAmount = undefined
  }
  const reportProfile = getReportProfile(reportModel)
  traceReportRuntime("buildSemanticContext", {
    datasetId: dataset.id,
    filename: dataset.fileName,
    persistedRowCount: dataset.rowCount,
    loadedRowsLength: rows.length,
    analysisObjectKeys: isRecord(dataset.analysis) ? Object.keys(dataset.analysis) : [],
    templateName: "executive-bi-report",
  })
  const semanticContext = buildSemanticContext({
    datasetId: dataset.id,
    datasetType,
    reportModel,
    columnMap,
  })
  traceReportRuntime("buildDeterministicAnalysis", {
    datasetId: dataset.id,
    filename: dataset.fileName,
    persistedRowCount: dataset.rowCount,
    loadedRowsLength: rows.length,
    analysisRowsLength: rows.length,
    detectedDateField: semanticContext.dateField,
    detectedExpenseCategoryField: semanticContext.expenseCategoryField,
    detectedExpenseAmountField: semanticContext.expenseAmountField,
    detectedVendorField: semanticContext.vendorField,
    analysisObjectKeys: isRecord(dataset.analysis) ? Object.keys(dataset.analysis) : [],
    templateName: "executive-bi-report",
  })
  const financials = buildGenericFinancials(rows, columnMap)
  if (reportModel === "marketplace" && financials.revenue !== null && columnMap.gmv && financials.metricSources?.revenue?.note?.includes(columnMap.gmv)) {
    financials.revenue = null
    financials.grossProfit = null
    financials.operatingProfit = null
    financials.netProfit = null
    financials.grossMargin = null
    financials.operatingMargin = null
    financials.netMargin = null
  }
  const retailAnalysis = reportModel === "local_retail" ? buildRetailAnalysis(rows, columnMap) : undefined
  const ecommerceAnalysis = reportModel === "ecommerce" ? buildEcommerceAnalysis(rows, columnMap, financials) : undefined
  const saasAnalysis = reportModel === "saas" || reportModel === "startup" ? buildSaasAnalysis(rows, columnMap) : undefined
  const marketplaceAnalysis = reportModel === "marketplace" ? buildMarketplaceAnalysis(rows, columnMap) : undefined
  const investorAnalysis = reportModel === "investor" ? buildInvestorAnalysis(rows, columnMap) : undefined
  if (ecommerceAnalysis) financials.dataConfidence = ecommerceDataConfidence(columnMap)
  if (saasAnalysis) financials.dataConfidence = saasDataConfidence(columnMap)
  if (marketplaceAnalysis) financials.dataConfidence = marketplaceDataConfidence(columnMap)
  if (investorAnalysis) financials.dataConfidence = investorDataConfidence(columnMap)
  if (reportModel === "business_consulting") {
    financials.dataConfidence = businessConsultingDataConfidence(columnMap)
    financials.consultantCost = sumColumn(rows, columnMap.consultantCost)
    financials.otherCost = sumColumn(rows, columnMap.otherCost)
    financials.totalProjectCost = financials.consultantCost !== null && financials.otherCost !== null
      ? financials.consultantCost + financials.otherCost
      : financials.consultantCost ?? financials.otherCost ?? null
    if (columnMap.projectStart || columnMap.projectEnd) {
      const starts = rows.map(r => r[columnMap.projectStart!]).filter(Boolean).map(d => new Date(String(d)).getTime()).filter(t => !isNaN(t))
      const ends = rows.map(r => r[columnMap.projectEnd!]).filter(Boolean).map(d => new Date(String(d)).getTime()).filter(t => !isNaN(t))
      if (starts.length > 0 && ends.length > 0) {
        const minStart = new Date(Math.min(...starts))
        const maxEnd = new Date(Math.max(...ends))
        const fmt = (d: Date) => d.toISOString().split('T')[0]
        financials.reportingPeriod = `${fmt(minStart)} to ${fmt(maxEnd)}`
      } else if (starts.length > 0) {
        const minStart = new Date(Math.min(...starts))
        financials.reportingPeriod = minStart.toISOString().split('T')[0]
      } else if (ends.length > 0) {
        const maxEnd = new Date(Math.max(...ends))
        financials.reportingPeriod = maxEnd.toISOString().split('T')[0]
      }
    }
  }
  if (reportModel === "professional_services") {
    financials.dataConfidence = professionalServicesDataConfidence(columnMap)
    financials.freelancerCost = sumColumn(rows, columnMap.freelancerCost)
    financials.adSpend = sumColumn(rows, columnMap.adSpend)
    financials.totalDirectCost = financials.freelancerCost !== null && financials.adSpend !== null
      ? financials.freelancerCost + financials.adSpend
      : financials.freelancerCost ?? financials.adSpend ?? null
    if (columnMap.date) {
      const dates = rows.map(r => r[columnMap.date!]).filter(Boolean).map(d => new Date(String(d)).getTime()).filter(t => !isNaN(t))
      if (dates.length > 0) {
        const minDate = new Date(Math.min(...dates))
        const maxDate = new Date(Math.max(...dates))
        const fmt = (d: Date) => d.toISOString().split('T')[0]
        financials.reportingPeriod = `${fmt(minDate)} to ${fmt(maxDate)}`
      }
    }
  }
  const kpis = buildKpis(reportModel, rows, columnMap, financials, retailAnalysis, ecommerceAnalysis, saasAnalysis, marketplaceAnalysis)
  const charts = buildCharts(reportModel, rows, columnMap, retailAnalysis, ecommerceAnalysis, saasAnalysis, marketplaceAnalysis)
  const canonicalRowCount = dataset.rowCount || rows.length
  if (rows.length !== canonicalRowCount) {
    throw new ReportIntegrityError("Report KPI row count does not match the authoritative dataset row count.", {
      datasetId: dataset.id,
      filename: dataset.fileName,
      persistedRowCount: dataset.rowCount,
      loadedRowsLength: rows.length,
      rowsForKpis: rows.length,
      authoritativeRowCount: canonicalRowCount,
    })
  }
  traceReportRuntime("buildExecutiveSummary", {
    datasetId: dataset.id,
    filename: dataset.fileName,
    persistedRowCount: dataset.rowCount,
    loadedRowsLength: rows.length,
    summaryRowsLength: canonicalRowCount,
    detectedDateField: semanticContext.dateField,
    detectedExpenseCategoryField: semanticContext.expenseCategoryField,
    detectedExpenseAmountField: semanticContext.expenseAmountField,
    detectedVendorField: semanticContext.vendorField,
    templateName: "executive-bi-report",
  })
  const findings = buildFindings(reportModel, canonicalRowCount, columnMap, kpis, retailAnalysis, ecommerceAnalysis, saasAnalysis, marketplaceAnalysis)
  const bbsc = calculateBusinessBalancedScorecard({ rows, columns, businessModel: reportModel })
  const recommendations = reportModel === "local_retail" && retailAnalysis
    ? buildRetailRecommendations(retailAnalysis, financials, columnMap)
    : reportModel === "ecommerce" && ecommerceAnalysis
      ? buildEcommerceRecommendations(ecommerceAnalysis, financials, columnMap)
      : saasAnalysis
        ? buildSaasRecommendations(saasAnalysis, financials, columnMap)
        : buildDatasetRecommendations(columnMap, financials, bbsc)
  const diagnostics = buildReportDiagnostics({
    dataset,
    rowCount: canonicalRowCount,
    rows,
    reportModel,
    semanticContext,
    financials,
    saasAnalysis,
  })

  debugLog("[REPORT_BUILDER] validated analysis object", diagnostics)
  traceReportRuntime("buildCostIntelligence", {
    datasetId: dataset.id,
    filename: dataset.fileName,
    persistedRowCount: dataset.rowCount,
    loadedRowsLength: rows.length,
    analysisRowsLength: rows.length,
    detectedDateField: semanticContext.dateField,
    detectedExpenseCategoryField: semanticContext.expenseCategoryField,
    detectedExpenseAmountField: semanticContext.expenseAmountField,
    detectedVendorField: semanticContext.vendorField,
    validExpenseCategoryCount: diagnostics.validExpenseCategoryCount,
    validExpenseAmountCount: diagnostics.validExpenseAmountCount,
    validVendorCount: diagnostics.validVendorCount,
    templateName: diagnostics.templateName,
  })
  traceReportRuntime("buildTrendAnalysis", {
    datasetId: dataset.id,
    filename: dataset.fileName,
    persistedRowCount: dataset.rowCount,
    loadedRowsLength: rows.length,
    detectedDateField: semanticContext.dateField,
    detectedNetProfitField: semanticContext.netProfitField,
    validDateCount: diagnostics.validDateCount,
    validNetProfitCount: diagnostics.validNetProfitCount,
    trendAvailable: diagnostics.trendAvailable,
    templateName: diagnostics.templateName,
  })

  return {
    businessModel,
    reportType: reportModel,
    reportProfile,
    summary: reportModel === "local_retail" && retailAnalysis
      ? buildRetailSummary(dataset.name, canonicalRowCount, financials, retailAnalysis)
      : reportModel === "ecommerce" && ecommerceAnalysis
        ? buildEcommerceSummary(dataset.name, canonicalRowCount, financials, ecommerceAnalysis)
        : reportModel === "marketplace" && marketplaceAnalysis
          ? buildMarketplaceSummary(dataset.name, canonicalRowCount, columnMap, financials, marketplaceAnalysis)
          : reportModel === "investor" && investorAnalysis
            ? buildInvestorSummary(dataset.name, investorAnalysis)
            : saasAnalysis
              ? buildSaasSummary(dataset.name, canonicalRowCount, saasAnalysis)
              : buildDatasetSummary(dataset.name, reportModel, canonicalRowCount, columnMap, financials, bbsc),
    findings,
    kpis,
    charts,
    financials,
    aiInsights: extractInsights(dataset.analysis),
    predictions: [],
    recommendations: reportModel === "local_retail" && retailAnalysis
      ? buildRetailRecommendations(retailAnalysis, financials, columnMap)
      : reportModel === "ecommerce" && ecommerceAnalysis
        ? buildEcommerceRecommendations(ecommerceAnalysis, financials, columnMap)
        : reportModel === "marketplace" && marketplaceAnalysis
          ? buildMarketplaceRecommendations(marketplaceAnalysis, financials, columnMap, bbsc)
          : reportModel === "investor" && investorAnalysis
            ? buildInvestorRecommendations(investorAnalysis, financials, columnMap)
            : saasAnalysis
              ? buildSaasRecommendations(saasAnalysis, financials, columnMap)
              : buildDatasetRecommendations(columnMap, financials, bbsc),
    retailAnalysis,
    ecommerceAnalysis,
    saasAnalysis,
    marketplaceAnalysis,
    investorAnalysis,
    alerts: buildAlerts(reportModel, rows, columnMap),
    bbsc,
    semanticContext,
    diagnostics,
    rowCount: canonicalRowCount,
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
  const explicitGrossProfit = numeric("grossProfit")
  const explicitOperatingProfit = numeric("operatingProfit")
  const explicitNetProfit = numeric("netProfit")
  const grossProfit = explicitGrossProfit !== null ? explicitGrossProfit : totalRevenue !== null && cogs !== null ? round(totalRevenue - cogs) : null
  const operatingProfit = explicitOperatingProfit !== null ? explicitOperatingProfit : grossProfit !== null && operatingExpenses !== null ? round(grossProfit - operatingExpenses) : null
  const netProfit = explicitNetProfit !== null ? explicitNetProfit : operatingProfit !== null && interestExpense !== null && taxExpense !== null
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
    metricSources: {
      revenue: totalRevenue !== null ? sourceMeta("Revenue source total from selected analysis inputs.") : unavailableMeta("No recognized revenue source field."),
      cogs: cogs !== null ? sourceMeta("COGS source total from selected analysis inputs.") : unavailableMeta("No recognized COGS source field."),
      grossProfit: explicitGrossProfit !== null ? sourceMeta("Explicit gross profit field from selected analysis inputs.") : grossProfit !== null ? derivedMeta("Revenue minus COGS.") : unavailableMeta("Requires COGS or explicit gross profit field."),
      operatingExpenses: operatingExpenses !== null ? sourceMeta("Operating-expense source total from selected analysis inputs.") : unavailableMeta("No recognized operating-expense source field."),
      operatingProfit: explicitOperatingProfit !== null ? sourceMeta("Explicit operating profit field from selected analysis inputs.") : operatingProfit !== null ? derivedMeta("Gross profit minus operating expenses.") : unavailableMeta("Requires operating expenses or explicit operating profit field."),
      interestExpense: interestExpense !== null ? sourceMeta("Interest-expense source total from selected analysis inputs.") : unavailableMeta("No recognized interest-expense source field."),
      taxExpense: taxExpense !== null ? sourceMeta("Tax-expense source total from selected analysis inputs.") : unavailableMeta("No recognized tax-expense source field."),
      netProfit: explicitNetProfit !== null ? sourceMeta("Explicit net profit field from selected analysis inputs.") : netProfit !== null ? derivedMeta("Operating profit minus interest and tax expense.") : unavailableMeta("Requires interest, tax, and operating profit inputs or explicit net profit field."),
      grossMargin: grossMargin !== null ? derivedMeta("Gross profit divided by revenue.") : unavailableMeta("Requires gross profit and non-zero revenue."),
      operatingMargin: operatingMargin !== null ? derivedMeta("Operating profit divided by revenue.") : unavailableMeta("Requires operating profit and non-zero revenue."),
      netMargin: netMargin !== null ? derivedMeta("Net profit divided by revenue.") : unavailableMeta("Requires net profit and non-zero revenue."),
    },
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
  const reportProfile = getReportProfile("profitability")

  return {
    businessModel,
    reportType: "profitability" as const,
    reportProfile,
    summary: buildProfitabilitySummary(dataset.name, financials, bbsc),
    financials,
    findings,
    kpis,
    charts,
    aiInsights: extractInsights(dataset.analysis),
    predictions: [],
    recommendations,
    retailAnalysis: undefined,
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
      requiredData: financials.missingFields,
    })
  }
  return recommendations.slice(0, 5)
}

function buildGenericFinancials(rows: DataRow[], columns: ColumnMap): ReportFinancials {
  const revenue = sourceMetric(sumColumn(rows, columns.revenue) ?? sumColumn(rows, columns.gmv), columns.revenue || columns.gmv)
  const cogs = cogsMetric(sumCogs(rows, columns), columns)
  const operatingExpenses = sourceMetric(sumColumn(rows, columns.operatingExpenses), columns.operatingExpenses)
  const interestExpense = sourceMetric(sumColumn(rows, columns.interestExpense), columns.interestExpense)
  const taxExpense = sourceMetric(sumColumn(rows, columns.taxExpense), columns.taxExpense)
  const grossProfitSource = sourceMetric(sumColumn(rows, columns.grossProfit), columns.grossProfit)
  const operatingProfitSource = sourceMetric(sumColumn(rows, columns.operatingProfit), columns.operatingProfit)
  const netProfitSource = sourceMetric(sumColumn(rows, columns.netProfit), columns.netProfit)
  const grossProfit = grossProfitSource.value !== null
    ? grossProfitSource
    : revenue.value !== null && cogs.value !== null
      ? calculatedMetric(round(revenue.value - cogs.value))
      : unavailableMetric()
  const operatingProfit = operatingProfitSource.value !== null
    ? operatingProfitSource
    : grossProfit.value !== null && operatingExpenses.value !== null
      ? calculatedMetric(round(grossProfit.value - operatingExpenses.value))
      : unavailableMetric()
  const netProfit = netProfitSource.value !== null
    ? netProfitSource
    : operatingProfit.value !== null && interestExpense.value !== null && taxExpense.value !== null
      ? calculatedMetric(round(operatingProfit.value - interestExpense.value - taxExpense.value))
      : unavailableMetric()
  const grossMargin = revenue.value !== null && revenue.value !== 0 && grossProfit.value !== null
    ? calculatedMetric(round((grossProfit.value / revenue.value) * 100))
    : unavailableMetric()
  const operatingMargin = revenue.value !== null && revenue.value !== 0 && operatingProfit.value !== null
    ? calculatedMetric(round((operatingProfit.value / revenue.value) * 100))
    : unavailableMetric()
  const netMargin = revenue.value !== null && revenue.value !== 0 && netProfit.value !== null
    ? calculatedMetric(round((netProfit.value / revenue.value) * 100))
    : unavailableMetric()
  const costValues = [cogs.value, operatingExpenses.value, interestExpense.value, taxExpense.value].filter((value): value is number => value !== null)
  const expenseRatio = revenue.value !== null && revenue.value !== 0 && costValues.length > 0
    ? round((costValues.reduce((total, value) => total + value, 0) / revenue.value) * 100)
    : null
  const periodTrends = buildPeriodTrends(rows, columns)
  const revenueGrowth = revenueGrowthFromPeriodTrends(periodTrends)

  return {
    reportingPeriod: reportingPeriodFromPeriodTrends(periodTrends),
    dataConfidence: dataConfidenceForFinancials([revenue, cogs, operatingExpenses, interestExpense, taxExpense]),
    metricSources: {
      revenue: metaFromMetric(revenue),
      cogs: metaFromMetric(cogs, "No recognized COGS source field."),
      grossProfit: metaFromMetric(grossProfit, "Requires COGS or explicit gross profit field."),
      operatingExpenses: metaFromMetric(operatingExpenses, "No recognized operating-expense source field."),
      operatingProfit: metaFromMetric(operatingProfit, "Requires operating expenses or explicit operating profit field."),
      interestExpense: metaFromMetric(interestExpense, "No recognized interest-expense source field."),
      taxExpense: metaFromMetric(taxExpense, "No recognized tax-expense source field."),
      netProfit: metaFromMetric(netProfit, "Requires interest, tax, and operating profit inputs or explicit net profit field."),
      grossMargin: metaFromMetric(grossMargin, "Requires gross profit and non-zero revenue."),
      operatingMargin: metaFromMetric(operatingMargin, "Requires operating profit and non-zero revenue."),
      netMargin: metaFromMetric(netMargin, "Requires net profit and non-zero revenue."),
    },
    revenue: revenue.value,
    cogs: cogs.value,
    grossProfit: grossProfit.value,
    operatingExpenses: operatingExpenses.value,
    operatingProfit: operatingProfit.value,
    interestExpense: interestExpense.value,
    taxExpense: taxExpense.value,
    netProfit: netProfit.value,
    grossMargin: grossMargin.value,
    operatingMargin: operatingMargin.value,
    netMargin: netMargin.value,
    revenueGrowth,
    expenseRatio,
    missingFields: missingProfitabilityFields({
      revenue: revenue.value,
      cogs: cogs.value,
      grossProfit: grossProfit.value,
      operatingExpenses: operatingExpenses.value,
      operatingProfit: operatingProfit.value,
      interestExpense: interestExpense.value,
      taxExpense: taxExpense.value,
      netProfit: netProfit.value,
      grossMargin: grossMargin.value,
      operatingMargin: operatingMargin.value,
      netMargin: netMargin.value,
    }, {}),
    topCostCategories: buildTopCostCategories(rows, columns),
    periodTrends,
  }
}

function buildRetailAnalysis(rows: DataRow[], columns: ColumnMap): RetailReportAnalysis {
  const currentStock = sumColumn(rows, columns.stock)
  const quantity = sumColumn(rows, columns.quantity)
  const revenue = sumColumn(rows, columns.revenue)
  const averageOrderValue = retailAverageOrderValue(rows, columns, revenue)
  const inventoryValue = retailInventoryValue(rows, columns)
  const productCount = columns.product ? uniqueCount(rows, columns.product) : rows.length
  const supplierCount = columns.vendor ? uniqueCount(rows, columns.vendor) : null
  const lowStockItems = retailLowStockItems(rows, columns)
  const outOfStockSkuCount = columns.stock ? uniqueCountWhere(rows, columns.product, (row) => (getNumber(row[columns.stock!]) ?? 0) <= 0) : null

  return {
    currentStock,
    inventoryValue,
    productCount,
    lowStockSkuCount: lowStockItems.length,
    reorderRequiredCount: lowStockItems.length,
    outOfStockSkuCount,
    averageTransactionValue: averageOrderValue.value,
    averageOrderValue,
    supplierCount,
    topProductsByRevenue: groupedRetailChart(rows, columns.product, columns.revenue, "Unknown product"),
    revenueByCategory: groupedRetailChart(rows, columns.category, columns.revenue, "Uncategorized"),
    grossMarginByCategory: retailMarginByGroup(rows, columns.category, columns),
    stockByCategory: groupedRetailChart(rows, columns.category, columns.stock, "Uncategorized"),
    inventoryValueByProduct: retailInventoryValueByProduct(rows, columns),
    supplierExposure: groupedRetailChart(rows, columns.vendor, columns.revenue, "Unknown supplier"),
    lowStockItems,
  }
}

function buildRetailSummary(datasetName: string, rowCount: number, financials: ReportFinancials, retail: RetailReportAnalysis) {
  const parts: string[] = []
  parts.push(`${datasetName} is analyzed as a retail dataset with ${rowCount.toLocaleString()} loaded rows.`)
  if (financials.revenue !== null) parts.push(`Revenue is ${formatCurrencyForSummary(financials.revenue)}.`)
  if (financials.grossProfit !== null && financials.grossMargin !== null) {
    parts.push(`Gross profit is ${formatCurrencyForSummary(financials.grossProfit)} with gross margin of ${financials.grossMargin.toFixed(1)}%.`)
  }
  if (retail.currentStock !== null) parts.push(`Current stock is ${retail.currentStock.toLocaleString()} units across ${retail.productCount?.toLocaleString() || "recognized"} products or SKUs.`)
  if (retail.reorderRequiredCount !== null && retail.reorderRequiredCount > 0) parts.push(`${retail.reorderRequiredCount.toLocaleString()} SKU${retail.reorderRequiredCount === 1 ? "" : "s"} are at or below reorder point.`)
  if (retail.supplierExposure[0]) parts.push(`${retail.supplierExposure[0].name} is the largest detected supplier by revenue.`)
  return parts.join(" ")
}

function buildRetailRecommendations(
  retail: RetailReportAnalysis,
  financials: ReportFinancials,
  columns: ColumnMap,
): ReportRecommendation[] {
  const recommendations: ReportRecommendation[] = []
  const topLowStock = retail.lowStockItems[0]
  if (topLowStock) {
    recommendations.push({
      issue: `${topLowStock.product} is at or below reorder point.`,
      businessImpact: "Stockout risk can interrupt retail sales and push customers to alternatives.",
      recommendedAction: `Reorder ${topLowStock.product} and review the reorder point against recent unit sales.`,
      estimatedImpact: "Protects near-term revenue from avoidable out-of-stock exposure.",
      confidence: "High",
      requiredData: [],
    })
  }
  const lowMargin = retail.grossMarginByCategory.filter((item) => item.value < 25).sort((a, b) => a.value - b.value)[0]
  if (lowMargin) {
    recommendations.push({
      issue: `${lowMargin.name} has a gross margin of ${lowMargin.value.toFixed(1)}%.`,
      businessImpact: "Weak category margin reduces retail profit quality even when revenue is available.",
      recommendedAction: `Review pricing, supplier terms, shrinkage, or promotion depth for ${lowMargin.name}.`,
      estimatedImpact: financials.revenue !== null ? `Each 1 percentage point of gross margin equals ${formatCurrencyForSummary(financials.revenue * 0.01)} in gross profit.` : null,
      confidence: "High",
      requiredData: [],
    })
  }
  const supplier = retail.supplierExposure[0]
  if (supplier && financials.revenue !== null && supplier.value >= financials.revenue * 0.4) {
    recommendations.push({
      issue: `${supplier.name} represents ${((supplier.value / financials.revenue) * 100).toFixed(1)}% of detected revenue.`,
      businessImpact: "Supplier concentration raises availability and negotiating risk.",
      recommendedAction: `Review backup supply, lead times, and purchase terms for ${supplier.name}.`,
      estimatedImpact: null,
      confidence: "Medium",
      requiredData: [],
    })
  }
  if (retail.inventoryValue !== null && financials.revenue !== null && retail.inventoryValue > financials.revenue * 0.5) {
    recommendations.push({
      issue: `Inventory value is ${formatCurrencyForSummary(retail.inventoryValue)} against ${formatCurrencyForSummary(financials.revenue)} revenue.`,
      businessImpact: "High inventory cash exposure can limit buying flexibility and working capital.",
      recommendedAction: "Prioritize sell-through analysis for slow-moving products and rebalance purchasing toward faster movers.",
      estimatedImpact: null,
      confidence: "Medium",
      requiredData: [],
    })
  }
  if (!columns.order && !columns.customer) {
    recommendations.push({
      issue: "Order and customer fields are not recognized.",
      businessImpact: "Average order value, repeat behavior, and basket diagnostics are limited.",
      recommendedAction: "Add order ID and customer ID fields to future retail uploads.",
      estimatedImpact: null,
      confidence: "High",
      requiredData: ["Order ID", "Customer ID"],
    })
  }
  if (!columns.reorderPoint || !columns.stock) {
    recommendations.push({
      issue: "Inventory control fields are incomplete.",
      businessImpact: "Reorder, out-of-stock, dead-stock, and excess-stock actions cannot be fully ranked.",
      recommendedAction: "Add stock-on-hand and reorder-point fields to future retail uploads.",
      estimatedImpact: null,
      confidence: "High",
      requiredData: ["Stock on hand", "Reorder point"],
    })
  }
  return recommendations.slice(0, 5)
}

function buildEcommerceAnalysis(rows: DataRow[], columns: ColumnMap, financials: ReportFinancials): EcommerceReportAnalysis {
  const revenue = financials.revenue
  const orders = columns.order ? uniqueCount(rows, columns.order) : null
  const customers = columns.customer ? uniqueCount(rows, columns.customer) : null
  const shippingCost = sumColumn(rows, columns.shippingCost)
  const discounts = sumColumn(rows, columns.discount)
  const returnMetrics = calculateReturnMetrics(rows, columns)
  return {
    orders,
    orderField: columns.order || null,
    customers,
    customerField: columns.customer || null,
    ordersPerCustomer: orders !== null && customers ? round(orders / customers) : null,
    revenuePerCustomer: revenue !== null && customers ? round(revenue / customers) : null,
    averageOrderValue: revenue !== null && orders ? round(revenue / orders) : null,
    unitsSold: sumColumn(rows, columns.quantity),
    products: columns.product ? uniqueCount(rows, columns.product) : null,
    productField: columns.product || null,
    returnRate: returnMetrics.returnRate,
    returnedOrders: returnMetrics.returnedOrders,
    eligibleReturnOrders: returnMetrics.eligibleOrders,
    returnStatusField: columns.returnStatus || null,
    returnStatus: returnMetrics.status,
    shippingCost,
    shippingCostRate: revenue !== null && revenue !== 0 && shippingCost !== null ? round((shippingCost / revenue) * 100) : null,
    averageShippingCostPerOrder: orders && shippingCost !== null ? round(shippingCost / orders) : null,
    discounts,
    discountRate: revenue !== null && revenue !== 0 && discounts !== null ? round((discounts / revenue) * 100) : null,
    averageDiscountPerOrder: orders && discounts !== null ? round(discounts / orders) : null,
    revenueTrend: ecommerceRevenueTrend(rows, columns),
    ordersTrend: ecommerceOrdersTrend(rows, columns),
    categoryPerformance: groupedRetailChart(rows, columns.category, columns.revenue, "Uncategorized"),
    topProducts: groupedRetailChart(rows, columns.product, columns.revenue, "Unknown product"),
    channelPerformance: ecommerceChannelPerformance(rows, columns, revenue),
    geography: ecommerceGeography(rows, columns, revenue),
    paymentMethods: ecommercePaymentMethods(rows, columns),
  }
}

function buildMarketplaceAnalysis(rows: DataRow[], columns: ColumnMap): MarketplaceReportAnalysis {
  const gmv = sumColumn(rows, columns.gmv)
  const marketplaceRevenue = sumColumn(rows, columns.commission)
  const sellerPayout = sumColumn(rows, columns.sellerPayout)
  const refunds = sumColumn(rows, columns.refund)
  const transactions = columns.order ? uniqueCount(rows, columns.order) : rows.length
  const buyers = columns.buyer ? uniqueCount(rows, columns.buyer) : null
  const sellers = columns.seller ? uniqueCount(rows, columns.seller) : null
  const newBuyers = columns.newBuyer ? countPositiveRows(rows, columns.newBuyer) : null
  const newSellers = columns.newSeller ? countPositiveRows(rows, columns.newSeller) : null
  const activeSellersResult = columns.activeSellers ? snapshotColumn(rows, columns.activeSellers, columns.date) : { value: null, latest: false }
  const activeSellers = activeSellersResult.value
  const listingsResult = columns.listingCount ? snapshotColumn(rows, columns.listingCount, columns.date) : { value: null, latest: false }
  const listings = listingsResult.value
  const completedTransactions = countDistinctPositiveStatus(rows, columns.order, columns.completed)
  const completionRate = transactions > 0 && completedTransactions !== null ? round((completedTransactions / transactions) * 100) : null
  const takeRate = gmv !== null && marketplaceRevenue !== null && gmv > 0 ? round((marketplaceRevenue / gmv) * 100) : null
  const refundRate = gmv !== null && refunds !== null && gmv > 0 ? round((refunds / gmv) * 100) : null
  const averageTransactionValue = gmv !== null && transactions > 0 ? round(gmv / transactions) : null

  return {
    gmv,
    gmvField: columns.gmv || null,
    marketplaceRevenue,
    marketplaceRevenueField: columns.commission || null,
    takeRate,
    sellerPayout,
    sellerPayoutField: columns.sellerPayout || null,
    refunds,
    refundsField: columns.refund || null,
    refundRate,
    transactions,
    transactionField: columns.order || null,
    averageTransactionValue,
    buyers,
    buyerField: columns.buyer || null,
    sellers,
    sellerField: columns.seller || null,
    newBuyers,
    newBuyerField: columns.newBuyer || null,
    newSellers,
    newSellerField: columns.newSeller || null,
    activeSellers,
    activeSellersField: columns.activeSellers || null,
    activeSellersAggregation: activeSellersResult.latest ? "latest_snapshot" : "sum",
    listings,
    listingsField: columns.listingCount || null,
    listingsAggregation: listingsResult.latest ? "latest_snapshot" : "sum",
    completionRate,
    gmvTrend: marketplaceValueTrend(rows, columns.date, columns.gmv, "GMV"),
    marketplaceRevenueTrend: marketplaceValueTrend(rows, columns.date, columns.commission, "Marketplace Revenue"),
    refundTrend: marketplaceValueTrend(rows, columns.date, columns.refund, "Refunds"),
    categoryPerformance: groupedRetailChart(rows, columns.category, columns.gmv || columns.commission, "Uncategorized"),
    geography: groupedRetailChart(rows, columns.country, columns.gmv || columns.commission, "Unknown geography"),
  }
}

function buildInvestorAnalysis(rows: DataRow[], columns: ColumnMap): InvestorReportAnalysis {
  const portfolioCompanies = columns.companyId ? uniqueCount(rows, columns.companyId) : rows.length
  const totalInvested = columns.investedAmount ? sumColumn(rows, columns.investedAmount) : null
  const totalValuation = columns.valuation ? sumColumn(rows, columns.valuation) : null
  
  let avgOwnership: number | null = null
  if (columns.ownership) {
    const values = rows.map(r => getNumber(r[columns.ownership!])).filter((v): v is number => v !== null)
    if (values.length > 0) {
      avgOwnership = values.reduce((a, b) => a + b, 0) / values.length
    }
  }
  
  const companiesByStatus = groupByCount(rows, columns.status)
  const companiesBySector = groupBySector(rows, columns.sector, columns.investedAmount, columns.valuation)
  const companiesByStage = groupByStage(rows, columns.stage, columns.investedAmount, columns.valuation)
  const revenueByCompany = columns.revenue ? getTopRevenueByCompany(rows, columns.companyName, columns.revenue) : []
  const runwayRisk = columns.runway ? countLowRunway(rows, columns.runway) : null
  const highBurn = columns.burn ? countHighBurn(rows, columns.burn) : null
  
  return {
    portfolioCompanies,
    totalInvested,
    totalValuation,
    avgOwnership,
    companiesByStatus,
    companiesBySector,
    companiesByStage,
    revenueByCompany,
    runwayRisk,
    highBurn,
    dataConfidence: null,
  }
}

function investorDataConfidence(columns: ColumnMap) {
  const required = [
    columns.companyId,
    columns.investedAmount,
    columns.ownership,
    columns.valuation,
  ]
  const optional = [
    columns.sector,
    columns.stage,
    columns.status,
    columns.revenue,
    columns.growthRate,
    columns.runway,
    columns.burn,
  ]
  const availableRequired = required.filter(Boolean).length
  const availableOptional = optional.filter(Boolean).length
  return Math.round(((availableRequired / required.length) * 85) + ((availableOptional / optional.length) * 15))
}

function businessConsultingDataConfidence(columns: ColumnMap) {
  const required = [
    columns.projectId,
    columns.customer,
    columns.revenue,
    columns.consultantCost,
    columns.grossMargin,
  ]
  const optional = [
    columns.consultantId,
    columns.industry,
    columns.projectStart,
    columns.projectEnd,
    columns.billableHours,
    columns.hourlyRate,
    columns.otherCost,
    columns.status,
    columns.pipelineStage,
  ]
  const availableRequired = required.filter(Boolean).length
  const availableOptional = optional.filter(Boolean).length
  return Math.round(((availableRequired / required.length) * 85) + ((availableOptional / optional.length) * 15))
}

function professionalServicesDataConfidence(columns: ColumnMap) {
  const required = [
    columns.campaignId,
    columns.serviceLine,
    columns.revenue,
    columns.freelancerCost,
  ]
  const optional = [
    columns.adSpend,
    columns.channel,
    columns.billableHours,
    columns.hourlyRate,
    columns.leadCount,
    columns.conversionCount,
    columns.status,
    columns.date,
  ]
  const availableRequired = required.filter(Boolean).length
  const availableOptional = optional.filter(Boolean).length
  return Math.round(((availableRequired / required.length) * 85) + ((availableOptional / optional.length) * 15))
}

function groupByCount(rows: DataRow[], column?: string): { status: string; count: number }[] {
  if (!column) return []
  const counts = new Map<string, number>()
  rows.forEach(row => {
    const val = String(row[column] || "Unknown").trim()
    counts.set(val, (counts.get(val) || 0) + 1)
  })
  return Array.from(counts.entries()).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count)
}

function groupBySector(rows: DataRow[], sectorCol?: string, investedCol?: string, valuationCol?: string): { sector: string; invested: number; valuation: number; count: number }[] {
  if (!sectorCol) return []
  const sectors = new Map<string, { invested: number; valuation: number; count: number }>()
  rows.forEach(row => {
    const sector = String(row[sectorCol] || "Unknown").trim()
    const invested = getNumber(row[investedCol!]) || 0
    const valuation = getNumber(row[valuationCol!]) || 0
    const current = sectors.get(sector) || { invested: 0, valuation: 0, count: 0 }
    current.invested += invested
    current.valuation += valuation
    current.count += 1
    sectors.set(sector, current)
  })
  return Array.from(sectors.entries()).map(([sector, data]) => ({ sector, ...data })).sort((a, b) => b.invested - a.invested)
}

function groupByStage(rows: DataRow[], stageCol?: string, investedCol?: string, valuationCol?: string): { stage: string; invested: number; valuation: number; count: number }[] {
  if (!stageCol) return []
  const stages = new Map<string, { invested: number; valuation: number; count: number }>()
  rows.forEach(row => {
    const stage = String(row[stageCol] || "Unknown").trim()
    const invested = getNumber(row[investedCol!]) || 0
    const valuation = getNumber(row[valuationCol!]) || 0
    const current = stages.get(stage) || { invested: 0, valuation: 0, count: 0 }
    current.invested += invested
    current.valuation += valuation
    current.count += 1
    stages.set(stage, current)
  })
  return Array.from(stages.entries()).map(([stage, data]) => ({ stage, ...data })).sort((a, b) => b.invested - a.invested)
}

function getTopRevenueByCompany(rows: DataRow[], nameCol?: string, revenueCol?: string): { name: string; revenue: number }[] {
  if (!nameCol || !revenueCol) return []
  const revenues = new Map<string, number>()
  rows.forEach(row => {
    const name = String(row[nameCol] || "Unknown").trim()
    const revenue = getNumber(row[revenueCol]) || 0
    revenues.set(name, (revenues.get(name) || 0) + revenue)
  })
  return Array.from(revenues.entries()).map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue).slice(0, 10)
}

function countLowRunway(rows: DataRow[], runwayCol: string): number {
  let count = 0
  rows.forEach(row => {
    const runway = getNumber(row[runwayCol])
    if (runway !== null && runway < 12) count++
  })
  return count
}

function countHighBurn(rows: DataRow[], burnCol: string): number {
  let count = 0
  rows.forEach(row => {
    const burn = getNumber(row[burnCol])
    if (burn !== null && burn > 100000) count++
  })
  return count
}

function buildInvestorRecommendations(analysis: InvestorReportAnalysis, financials: ReportFinancials, columns: ColumnMap): ReportRecommendation[] {
  const recs: ReportRecommendation[] = []
  
  if (analysis.companiesByStatus.find(s => s.status.toLowerCase().includes("watchlist"))) {
    recs.push({ issue: "Review Watchlist companies for investment decisions.", businessImpact: "Active monitoring of watchlist companies is critical for portfolio risk management.", recommendedAction: "Schedule review meetings for watchlist companies." })
  }
  
  if (analysis.runwayRisk && analysis.runwayRisk > 0) {
    recs.push({ issue: `${analysis.runwayRisk} companies have runway under 12 months.`, businessImpact: "Low runway indicates urgent need for follow-on funding or exit planning.", recommendedAction: "Assess runway and plan follow-on investments or exits." })
  }
  
  if (analysis.highBurn && analysis.highBurn > 0) {
    recs.push({ issue: `${analysis.highBurn} companies show high monthly burn rates.`, businessImpact: "High burn companies require careful monitoring and potential intervention.", recommendedAction: "Monitor burn rates and engage with portfolio company management." })
  }
  
  if (analysis.companiesBySector.length > 0) {
    const topSector = analysis.companiesBySector[0]
    recs.push({ issue: `Portfolio concentration in ${topSector.sector} sector at ${Math.round((topSector.invested / (analysis.totalInvested || 1)) * 100)}% of invested capital.`, businessImpact: "Consider sector diversification to reduce portfolio risk.", recommendedAction: "Evaluate new investments in underrepresented sectors." })
  }
  
  if (analysis.companiesByStage.length > 1) {
    recs.push({ issue: "Portfolio spans multiple investment stages.", businessImpact: "Stage diversification provides natural risk mitigation across portfolio companies.", recommendedAction: "Maintain current stage diversification strategy." })
  }
  
  if (recs.length === 0) {
    recs.push({ issue: "Portfolio analysis is complete with available data.", businessImpact: "All available portfolio metrics have been analyzed.", recommendedAction: "No action required." })
  }
  
  return recs
}

function marketplaceDataConfidence(columns: ColumnMap) {
  const required = [
    columns.gmv,
    columns.commission,
    columns.order,
    columns.buyer,
    columns.seller,
    columns.date,
    columns.refund,
  ]
  const optional = [columns.sellerPayout, columns.newBuyer, columns.newSeller, columns.activeSellers, columns.listingCount, columns.category, columns.country, columns.completed]
  const availableRequired = required.filter(Boolean).length
  const availableOptional = optional.filter(Boolean).length
  return Math.round(((availableRequired / required.length) * 85) + ((availableOptional / optional.length) * 15))
}

function ecommerceDataConfidence(columns: ColumnMap) {
  const required = [
    columns.revenue,
    columns.order,
    columns.date,
    columns.customer,
    columns.product,
    columns.quantity,
    columns.category,
    columns.channel,
    columns.returnStatus,
  ]
  const optional = [columns.country || columns.region, columns.shippingCost, columns.discount, columns.paymentMethod]
  const availableRequired = required.filter(Boolean).length
  const availableOptional = optional.filter(Boolean).length
  return Math.round(((availableRequired / required.length) * 85) + ((availableOptional / optional.length) * 15))
}

function buildEcommerceRecommendations(
  ecommerce: EcommerceReportAnalysis,
  financials: ReportFinancials,
  columns: ColumnMap,
): ReportRecommendation[] {
  const recommendations: ReportRecommendation[] = []
  const topChannel = ecommerce.channelPerformance[0]
  if (topChannel && topChannel.share !== null) {
    recommendations.push({
      issue: `${topChannel.name} contributes ${topChannel.share.toFixed(1)}% of e-commerce revenue.`,
      businessImpact: topChannel.share >= 50 ? "Channel concentration can expose growth to platform or campaign volatility." : "Channel mix is measurable and can guide acquisition focus.",
      recommendedAction: `Review conversion, merchandising, and traffic quality for ${topChannel.name}, then compare with lower-share channels.`,
      estimatedImpact: financials.revenue !== null ? `One revenue-share point equals ${formatCurrencyForSummary(financials.revenue * 0.01)} in this dataset.` : null,
      confidence: "High",
      requiredData: [],
    })
  }
  const topCategory = ecommerce.categoryPerformance[0]
  if (topCategory && financials.revenue !== null) {
    recommendations.push({
      issue: `${topCategory.name} is the top product category by revenue.`,
      businessImpact: "Category contribution identifies where assortment, pricing, and promotion decisions matter most.",
      recommendedAction: `Review stock, pricing, returns, and campaign allocation for ${topCategory.name}.`,
      estimatedImpact: `${topCategory.name} contributes ${((topCategory.value / financials.revenue) * 100).toFixed(1)}% of revenue.`,
      confidence: "High",
      requiredData: [],
    })
  }
  if (ecommerce.returnRate !== null && ecommerce.returnRate >= 10) {
    recommendations.push({
      issue: `Return rate is ${ecommerce.returnRate.toFixed(1)}%.`,
      businessImpact: "Returned orders can reduce realized revenue quality and customer satisfaction.",
      recommendedAction: "Review returned order reasons by product, category, and channel before changing refund assumptions.",
      estimatedImpact: null,
      confidence: "High",
      requiredData: [],
    })
  }
  if (ecommerce.shippingCostRate !== null) {
    recommendations.push({
      issue: `Shipping and fulfillment cost is ${ecommerce.shippingCostRate.toFixed(1)}% of revenue.`,
      businessImpact: "Fulfillment cost affects commercial efficiency but is not product COGS.",
      recommendedAction: "Track shipping cost separately from product margin and compare it by channel and geography.",
      estimatedImpact: ecommerce.shippingCost !== null ? `${formatCurrencyForSummary(ecommerce.shippingCost)} in shipping cost is visible in this dataset.` : null,
      confidence: "High",
      requiredData: [],
    })
  }
  if (financials.cogs === null) {
    recommendations.push({
      issue: "Product COGS is not available.",
      businessImpact: "Gross profit and gross margin remain unavailable until product-cost data is added.",
      recommendedAction: "Add cogs, cost_of_goods_sold, product_cost, or merchandise_cost when product profitability is needed.",
      estimatedImpact: null,
      confidence: "High",
      requiredData: ["COGS or product cost"],
    })
  }
  if (!columns.order || !columns.customer) {
    recommendations.push({
      issue: "Order or customer identifiers are incomplete.",
      businessImpact: "AOV, customer economics, and order concentration depend on reliable identifiers.",
      recommendedAction: "Include order_id and customer_id in future e-commerce uploads.",
      estimatedImpact: null,
      confidence: "High",
      requiredData: ["Order ID", "Customer ID"],
    })
  }
  return recommendations.slice(0, 5)
}

function buildEcommerceSummary(datasetName: string, rowCount: number, financials: ReportFinancials, ecommerce: EcommerceReportAnalysis) {
  const parts: string[] = []
  parts.push(`${datasetName} is analyzed as an e-commerce dataset with ${rowCount.toLocaleString()} loaded rows.`)
  if (financials.revenue !== null) parts.push(`Revenue is ${formatCurrencyForSummary(financials.revenue)}.`)
  if (ecommerce.orders !== null) parts.push(`${ecommerce.orders.toLocaleString()} distinct orders are recognized${ecommerce.orderField ? ` from ${ecommerce.orderField}` : ""}.`)
  if (ecommerce.averageOrderValue !== null) parts.push(`Average Order Value is ${formatCurrencyForSummary(ecommerce.averageOrderValue)}.`)
  if (ecommerce.customers !== null) parts.push(`${ecommerce.customers.toLocaleString()} distinct customers are recognized.`)
  if (ecommerce.returnRate !== null) parts.push(`Return rate is ${ecommerce.returnRate.toFixed(1)}% from return-status values.`)
  if (ecommerce.channelPerformance[0]) parts.push(`${ecommerce.channelPerformance[0].name} is the top revenue channel.`)
  if (financials.grossProfit === null) parts.push("Gross profit and gross margin are not available because valid product COGS is missing.")
  return parts.join(" ")
}

function buildMarketplaceSummary(datasetName: string, rowCount: number, columns: ColumnMap, financials: ReportFinancials, marketplace: MarketplaceReportAnalysis) {
  const parts: string[] = []
  parts.push(`${datasetName} is analyzed as a marketplace dataset with ${rowCount.toLocaleString()} loaded rows.`)
  if (marketplace.gmv !== null) parts.push(`GMV is ${formatCurrencyForSummary(marketplace.gmv)} from ${marketplace.gmvField}.`)
  if (marketplace.marketplaceRevenue !== null) parts.push(`Marketplace Revenue is ${formatCurrencyForSummary(marketplace.marketplaceRevenue)} from ${marketplace.marketplaceRevenueField}.`)
  if (marketplace.takeRate !== null) parts.push(`Take Rate is ${marketplace.takeRate.toFixed(2)}% from marketplace revenue divided by GMV.`)
  if (marketplace.transactions !== null) parts.push(`${marketplace.transactions.toLocaleString()} transactions are recognized from ${marketplace.transactionField || "row count"}.`)
  if (marketplace.averageTransactionValue !== null) parts.push(`Average Transaction Value is ${formatCurrencyForSummary(marketplace.averageTransactionValue)} from GMV divided by transactions.`)
  if (marketplace.buyers !== null) parts.push(`${marketplace.buyers.toLocaleString()} buyers are recognized from ${marketplace.buyerField}.`)
  if (marketplace.sellers !== null) parts.push(`${marketplace.sellers.toLocaleString()} sellers are recognized from ${marketplace.sellerField}.`)
  if (marketplace.refundRate !== null) parts.push(`Refund Rate is ${marketplace.refundRate.toFixed(2)}% from refund amount divided by GMV.`)
  if (marketplace.completionRate !== null) parts.push(`Completion Rate is ${Math.round(marketplace.completionRate)}% from completed transaction status.`)
  if (financials.revenue === null && marketplace.marketplaceRevenue !== null) parts.push("Generic company revenue is not available; marketplace economics are used instead.")
  return parts.join(" ")
}

function buildMarketplaceRecommendations(
  marketplace: MarketplaceReportAnalysis,
  financials: ReportFinancials,
  columns: ColumnMap,
  bbsc: ReturnType<typeof calculateBusinessBalancedScorecard>,
): ReportRecommendation[] {
  const recommendations: ReportRecommendation[] = []
  if (marketplace.takeRate !== null) {
    recommendations.push({
      issue: `Take rate is ${marketplace.takeRate.toFixed(2)}% across the dataset.`,
      businessImpact: "Take rate measures platform monetization efficiency relative to gross merchandise value.",
      recommendedAction: "Review take rate by category, seller, and geography to identify monetization optimization opportunities.",
      estimatedImpact: marketplace.gmv !== null ? `Each 1 percentage point of take rate equals ${formatCurrencyForSummary(marketplace.gmv * 0.01)} in marketplace revenue.` : null,
      confidence: "High",
      requiredData: [],
    })
  }
  if (marketplace.refundRate !== null && marketplace.refundRate >= 5) {
    recommendations.push({
      issue: `Refund rate is ${marketplace.refundRate.toFixed(2)}% of GMV.`,
      businessImpact: "High refund rates reduce buyer trust and effective marketplace revenue.",
      recommendedAction: "Investigate refund patterns by seller, category, and country before the next seller onboarding review.",
      estimatedImpact: marketplace.refunds !== null ? `${formatCurrencyForSummary(marketplace.refunds)} in refunds is visible in this dataset.` : null,
      confidence: "High",
      requiredData: [],
    })
  }
  if (!columns.buyer || !columns.seller) {
    recommendations.push({
      issue: "Buyer or seller identifiers are incomplete.",
      businessImpact: "Marketplace liquidity, concentration, and two-sided growth metrics are limited without both sides.",
      recommendedAction: "Include buyer_id and seller_id in future marketplace uploads.",
      estimatedImpact: null,
      confidence: "High",
      requiredData: ["Buyer ID", "Seller ID"],
    })
  }
  if (bbsc.weakestPerspective && bbsc.availablePerspectiveCount >= 2) {
    recommendations.push({
      issue: `${bbsc.weakestPerspective.title} is the weakest available perspective at ${bbsc.weakestPerspective.score}/100.`,
      businessImpact: "The weakest scored perspective limits the overall business score.",
      recommendedAction: bbsc.weakestPerspective.recommendedActions[0] || "Track the missing drivers and review the perspective monthly.",
      estimatedImpact: null,
      confidence: bbsc.weakestPerspective.dataConfidence >= 70 ? "High" : "Medium",
      requiredData: [],
    })
  }
  return recommendations.slice(0, 5)
}

function buildSaasSummary(datasetName: string, rowCount: number, saas: SaasReportAnalysis) {
  const parts: string[] = []
  parts.push(`${datasetName} is analyzed as a SaaS startup dataset with ${rowCount.toLocaleString()} loaded rows.`)
  if (saas.latestPeriod) parts.push(`Latest SaaS snapshot period is ${saas.latestPeriod}.`)
  if (saas.mrr !== null) parts.push(`MRR is ${formatCurrencyForSummary(saas.mrr)} from ${saas.mrrField}.`)
  if (saas.arr !== null) parts.push(`ARR is ${formatCurrencyForSummary(saas.arr)} from ${saas.arrField}.`)
  if (saas.customers !== null) parts.push(`${saas.customers.toLocaleString()} distinct customers are recognized from ${saas.customerField}.`)
  if (saas.churnRate !== null) parts.push(`Churn rate is ${saas.churnRate.toFixed(1)}% from normalized ${saas.churnField} values.`)
  if (saas.netExpansionMrr !== null) parts.push(`Net Expansion MRR is ${formatCurrencyForSummary(saas.netExpansionMrr)}.`)
  if (saas.runwayMonths !== null) parts.push(`Runway is ${saas.runwayMonths.toFixed(1)} months from explicit runway data.`)
  return parts.join(" ")
}

function buildInvestorSummary(datasetName: string, investor: InvestorReportAnalysis) {
  const parts: string[] = []
  parts.push(`${datasetName} is analyzed as an investor portfolio dataset.`)
  if (investor.portfolioCompanies !== null) {
    parts.push(`The portfolio contains ${investor.portfolioCompanies} companies.`)
  }
  if (investor.totalInvested !== null) {
    parts.push(`Total invested capital is ${formatCurrencyForSummary(investor.totalInvested)}.`)
  }
  if (investor.totalValuation !== null) {
    parts.push(`Aggregate latest company valuations total ${formatCurrencyForSummary(investor.totalValuation)}.`)
  }
  if (investor.avgOwnership !== null) {
    parts.push(`Average ownership across the portfolio is ${investor.avgOwnership.toFixed(1)}%.`)
  }
  const activeCount = investor.companiesByStatus.find((s) => s.status.toLowerCase() === "active")?.count || 0
  const exitedCount = investor.companiesByStatus.find((s) => s.status.toLowerCase() === "exited")?.count || 0
  const watchlistCount = investor.companiesByStatus.find((s) => s.status.toLowerCase() === "watchlist")?.count || 0
  if (activeCount + exitedCount + watchlistCount > 0) {
    parts.push(`The portfolio includes ${activeCount} active companies, ${exitedCount} exited, and ${watchlistCount} on watchlist.`)
  }
  return parts.join(" ")
}

function buildSaasRecommendations(
  saas: SaasReportAnalysis,
  _financials: ReportFinancials,
  columns: ColumnMap,
): ReportRecommendation[] {
  const recommendations: ReportRecommendation[] = []
  const mrrTrend = trendMovement(saas.mrrTrend)
  if (mrrTrend) {
    recommendations.push({
      issue: `MRR changed by ${mrrTrend.percent.toFixed(1)}% across the available period trend.`,
      businessImpact: mrrTrend.percent >= 0 ? "Recurring revenue growth is measurable from source MRR values." : "Recurring revenue contraction is visible in source MRR values.",
      recommendedAction: "Review the latest MRR movement by plan and country before setting growth actions.",
      estimatedImpact: `${formatCurrencyForSummary(mrrTrend.delta)} net MRR movement from first to latest period.`,
      confidence: "High",
      requiredData: [],
    })
  }
  if (saas.churnRate !== null) {
    recommendations.push({
      issue: `${saas.churnedCustomers?.toLocaleString() || "0"} churned customers produce a ${saas.churnRate.toFixed(1)}% churn rate.`,
      businessImpact: "Customer churn affects recurring revenue durability and expansion capacity.",
      recommendedAction: "Review churned customers by plan, country, active usage, and support tickets.",
      estimatedImpact: saas.eligibleChurnCustomers !== null ? `Denominator: ${saas.eligibleChurnCustomers.toLocaleString()} customers with normalized churn status.` : null,
      confidence: "High",
      requiredData: [],
    })
  }
  if (saas.ltvToCac !== null) {
    recommendations.push({
      issue: `LTV/CAC is ${saas.ltvToCac.toFixed(2)}x.`,
      businessImpact: "Unit economics are measurable because both LTV and CAC are available with compatible latest-period averaging.",
      recommendedAction: "Compare LTV/CAC by acquisition segment before scaling spend.",
      estimatedImpact: "Derived from LTV divided by CAC.",
      confidence: "Medium",
      requiredData: [],
    })
  }
  if (saas.netExpansionMrr !== null) {
    recommendations.push({
      issue: `Net Expansion MRR is ${formatCurrencyForSummary(saas.netExpansionMrr)}.`,
      businessImpact: "Expansion minus contraction shows whether existing accounts are growing or shrinking recurring revenue.",
      recommendedAction: "Compare expansion and contraction by plan to identify upgrade and downgrade drivers.",
      estimatedImpact: "Derived from Expansion MRR minus Contraction MRR.",
      confidence: "High",
      requiredData: [],
    })
  }
  if (saas.runwayMonths !== null) {
    recommendations.push({
      issue: `Runway is ${saas.runwayMonths.toFixed(1)} months.`,
      businessImpact: "Explicit runway data supports startup cash-planning decisions without deriving cash divided by burn.",
      recommendedAction: "Track runway trend alongside burn and cash balance in the next monthly review.",
      estimatedImpact: null,
      confidence: "High",
      requiredData: [],
    })
  }
  if (!columns.mrr && !columns.arr) {
    recommendations.push({
      issue: "Recurring revenue fields are missing.",
      businessImpact: "SaaS growth quality cannot be measured without MRR or ARR.",
      recommendedAction: "Add MRR or ARR fields to future SaaS uploads.",
      estimatedImpact: null,
      confidence: "High",
      requiredData: ["MRR or ARR"],
    })
  }
  return recommendations.slice(0, 5)
}

function trendMovement(trend: { name: string; value: number }[]) {
  if (trend.length < 2) return null
  const first = trend[0].value
  const last = trend[trend.length - 1].value
  if (!first) return null
  return { delta: round(last - first), percent: round(((last - first) / first) * 100) }
}

function buildSaasAnalysis(rows: DataRow[], columns: ColumnMap): SaasReportAnalysis {
  const latestRows = latestPeriodRows(rows, columns.date)
  const latestPeriod = latestRows.period
  const snapshotRows = latestRows.rows
  const mrr = sumColumn(snapshotRows, columns.mrr)
  const arr = sumColumn(snapshotRows, columns.arr)
  const expansionMrr = sumColumn(snapshotRows, columns.expansionMrr)
  const contractionMrr = sumColumn(snapshotRows, columns.contractionMrr)
  const customers = columns.customer ? uniqueCount(rows, columns.customer) : null
  const newCustomers = countDistinctPositiveStatus(rows, columns.customer, columns.newCustomer)
  const churn = churnMetrics(rows, columns)
  const cac = averageColumn(snapshotRows, columns.cac)
  const ltv = averageColumn(snapshotRows, columns.ltv)
  const activeUsers = sumColumn(snapshotRows, columns.activeUsers)
  const supportTickets = sumColumn(snapshotRows, columns.supportTickets)
  const burn = averageColumn(snapshotRows, columns.burn)
  const cashBalance = averageColumn(snapshotRows, columns.cashBalance)
  const runwayMonths = averageColumn(snapshotRows, columns.runway)
  return {
    mrr: mrr === null ? null : round(mrr),
    mrrField: columns.mrr || null,
    arr: arr === null ? null : round(arr),
    arrField: columns.arr || null,
    customers,
    customerField: columns.customer || null,
    newCustomers,
    newCustomerField: columns.newCustomer || null,
    churnedCustomers: churn.churnedCustomers,
    eligibleChurnCustomers: churn.eligibleCustomers,
    churnRate: churn.churnRate,
    churnField: columns.churned || null,
    expansionMrr: expansionMrr === null ? null : round(expansionMrr),
    expansionMrrField: columns.expansionMrr || null,
    contractionMrr: contractionMrr === null ? null : round(contractionMrr),
    contractionMrrField: columns.contractionMrr || null,
    netExpansionMrr: expansionMrr !== null && contractionMrr !== null ? round(expansionMrr - contractionMrr) : null,
    cac: cac === null ? null : round(cac),
    cacField: columns.cac || null,
    ltv: ltv === null ? null : round(ltv),
    ltvField: columns.ltv || null,
    ltvToCac: ltv !== null && cac !== null && cac > 0 ? round(ltv / cac) : null,
    activeUsers: activeUsers === null ? null : round(activeUsers),
    activeUsersField: columns.activeUsers || null,
    supportTickets: supportTickets === null ? null : round(supportTickets),
    supportTicketsField: columns.supportTickets || null,
    burn: burn === null ? null : round(burn),
    burnField: columns.burn || null,
    cashBalance: cashBalance === null ? null : round(cashBalance),
    cashBalanceField: columns.cashBalance || null,
    runwayMonths: runwayMonths === null ? null : round(runwayMonths),
    runwayField: columns.runway || null,
    periodField: columns.date || null,
    latestPeriod,
    dataConfidence: saasDataConfidence(columns),
    mrrTrend: trendByPeriod(rows, columns.date, columns.mrr, "sum"),
    arrTrend: trendByPeriod(rows, columns.date, columns.arr, "sum"),
    customerTrend: customerTrendByPeriod(rows, columns),
    newCustomerTrend: statusTrendByPeriod(rows, columns.date, columns.customer, columns.newCustomer),
    churnTrend: statusTrendByPeriod(rows, columns.date, columns.customer, columns.churned),
    expansionTrend: trendByPeriod(rows, columns.date, columns.expansionMrr, "sum"),
    contractionTrend: trendByPeriod(rows, columns.date, columns.contractionMrr, "sum"),
    activeUserTrend: trendByPeriod(rows, columns.date, columns.activeUsers, "sum"),
    burnTrend: trendByPeriod(rows, columns.date, columns.burn, "average"),
    cashTrend: trendByPeriod(rows, columns.date, columns.cashBalance, "average"),
    runwayTrend: trendByPeriod(rows, columns.date, columns.runway, "average"),
    planPerformance: saasSegmentPerformance(snapshotRows, columns.plan, columns, mrr),
    geography: saasSegmentPerformance(snapshotRows, columns.country || columns.region, columns, mrr),
  }
}

function saasDataConfidence(columns: ColumnMap) {
  const fields = [
    columns.date,
    columns.customer,
    columns.mrr,
    columns.arr,
    columns.newCustomer,
    columns.churned,
    columns.expansionMrr,
    columns.contractionMrr,
    columns.cac,
    columns.ltv,
    columns.activeUsers,
    columns.supportTickets,
    columns.burn,
    columns.cashBalance,
    columns.runway,
    columns.plan,
    columns.country || columns.region,
  ]
  return Math.round((fields.filter(Boolean).length / fields.length) * 100)
}

function latestPeriodRows(rows: DataRow[], periodColumn?: string) {
  if (!periodColumn) return { period: null, rows }
  const keyed = rows
    .map((row) => ({ row, key: periodKey(row[periodColumn]) }))
    .filter((item): item is { row: DataRow; key: string } => Boolean(item.key))
  if (keyed.length === 0) return { period: null, rows }
  const latest = keyed.map((item) => item.key).sort().at(-1) || null
  return { period: latest, rows: latest ? keyed.filter((item) => item.key === latest).map((item) => item.row) : rows }
}

function countDistinctPositiveStatus(rows: DataRow[], idColumn?: string, statusColumn?: string) {
  if (!idColumn || !statusColumn) return null
  const values = new Set<string>()
  rows.forEach((row, index) => {
    if (normalizeBooleanStatus(row[statusColumn]) !== "positive") return
    const key = String(row[idColumn] || "").trim() || `row_${index}`
    values.add(key)
  })
  return values.size
}

function countPositiveRows(rows: DataRow[], statusColumn?: string) {
  if (!statusColumn) return null
  let count = 0
  rows.forEach((row) => {
    if (normalizeBooleanStatus(row[statusColumn]) === "positive") {
      count++
    }
  })
  return count
}

function churnMetrics(rows: DataRow[], columns: ColumnMap) {
  if (!columns.churned) return { churnedCustomers: null, eligibleCustomers: null, churnRate: null }
  const statusByCustomer = new Map<string, NormalizedBooleanStatus[]>()
  rows.forEach((row, index) => {
    const key = columns.customer ? String(row[columns.customer] || "").trim() : `row_${index}`
    if (!key) return
    const statuses = statusByCustomer.get(key) || []
    statuses.push(normalizeBooleanStatus(row[columns.churned!]))
    statusByCustomer.set(key, statuses)
  })
  let eligibleCustomers = 0
  let churnedCustomers = 0
  for (const statuses of statusByCustomer.values()) {
    if (statuses.includes("positive")) {
      churnedCustomers += 1
      eligibleCustomers += 1
    } else if (statuses.includes("negative")) {
      eligibleCustomers += 1
    }
  }
  if (eligibleCustomers === 0) return { churnedCustomers: null, eligibleCustomers: null, churnRate: null }
  return {
    churnedCustomers,
    eligibleCustomers,
    churnRate: round((churnedCustomers / eligibleCustomers) * 100),
  }
}

function normalizeBooleanStatus(value: unknown): NormalizedBooleanStatus {
  if (value === null || value === undefined) return "unknown"
  const normalized = String(value).trim().toLowerCase().replace(/[\s-]+/g, "_").replace(/[^a-z0-9_]/g, "")
  if (!normalized) return "unknown"
  if (["true", "yes", "1", "y", "churned", "new", "new_customer"].includes(normalized)) return "positive"
  if (["false", "no", "0", "n", "active", "retained", "existing", "not_churned", "not_new"].includes(normalized)) return "negative"
  return "unknown"
}

function trendByPeriod(rows: DataRow[], periodColumn: string | undefined, valueColumn: string | undefined, mode: "sum" | "average") {
  if (!periodColumn || !valueColumn) return []
  const grouped = new Map<string, { total: number; count: number }>()
  for (const row of rows) {
    const key = periodKey(row[periodColumn])
    const value = getNumber(row[valueColumn])
    if (!key || value === null) continue
    const current = grouped.get(key) || { total: 0, count: 0 }
    current.total += value
    current.count += 1
    grouped.set(key, current)
  }
  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => ({ name, value: round(mode === "average" ? value.total / value.count : value.total) }))
}

function customerTrendByPeriod(rows: DataRow[], columns: ColumnMap) {
  if (!columns.date || !columns.customer) return []
  const grouped = new Map<string, Set<string>>()
  for (const row of rows) {
    const key = periodKey(row[columns.date])
    const customer = String(row[columns.customer] || "").trim()
    if (!key || !customer) continue
    const values = grouped.get(key) || new Set<string>()
    values.add(customer)
    grouped.set(key, values)
  }
  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, values]) => ({ name, value: values.size }))
}

function statusTrendByPeriod(rows: DataRow[], periodColumn: string | undefined, idColumn: string | undefined, statusColumn: string | undefined) {
  if (!periodColumn || !idColumn || !statusColumn) return []
  const grouped = new Map<string, Set<string>>()
  rows.forEach((row, index) => {
    const key = periodKey(row[periodColumn])
    if (!key || normalizeBooleanStatus(row[statusColumn]) !== "positive") return
    const id = String(row[idColumn] || "").trim() || `row_${index}`
    const values = grouped.get(key) || new Set<string>()
    values.add(id)
    grouped.set(key, values)
  })
  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, values]) => ({ name, value: values.size }))
}

function saasSegmentPerformance(rows: DataRow[], groupColumn: string | undefined, columns: ColumnMap, totalMrr: number | null) {
  if (!groupColumn) return []
  const grouped = new Map<string, { customers: Set<string>; mrr: number; arr: number }>()
  rows.forEach((row, index) => {
    const name = String(row[groupColumn] || "").trim()
    if (!name) return
    const current = grouped.get(name) || { customers: new Set<string>(), mrr: 0, arr: 0 }
    const customer = columns.customer ? String(row[columns.customer] || "").trim() : `row_${index}`
    if (customer) current.customers.add(customer)
    current.mrr += columns.mrr ? getNumber(row[columns.mrr]) || 0 : 0
    current.arr += columns.arr ? getNumber(row[columns.arr]) || 0 : 0
    grouped.set(name, current)
  })
  return Array.from(grouped.entries())
    .map(([name, value]) => ({
      name,
      customers: value.customers.size || null,
      mrr: columns.mrr ? round(value.mrr) : null,
      arr: columns.arr ? round(value.arr) : null,
      share: totalMrr && totalMrr > 0 ? round((value.mrr / totalMrr) * 100) : null,
    }))
    .sort((a, b) => (b.mrr || b.customers || 0) - (a.mrr || a.customers || 0))
    .slice(0, 8)
}

function retailInventoryValue(rows: DataRow[], columns: ColumnMap) {
  if (!columns.stock || !columns.cost) return null
  let total = 0
  let found = false
  for (const row of rows) {
    const stock = getNumber(row[columns.stock])
    const unitCost = rowUnitCost(row, columns)
    if (stock === null || unitCost === null) continue
    total += stock * unitCost
    found = true
  }
  return found ? round(total) : null
}

function retailInventoryValueByProduct(rows: DataRow[], columns: ColumnMap) {
  if (!columns.product || !columns.stock || !columns.cost) return []
  const grouped = new Map<string, number>()
  for (const row of rows) {
    const product = String(row[columns.product] || "Unknown product").trim() || "Unknown product"
    const stock = getNumber(row[columns.stock])
    const unitCost = rowUnitCost(row, columns)
    if (stock === null || unitCost === null) continue
    grouped.set(product, round((grouped.get(product) || 0) + stock * unitCost))
  }
  return Array.from(grouped.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8)
}

function retailLowStockItems(rows: DataRow[], columns: ColumnMap) {
  if (!columns.stock || !columns.reorderPoint) return []
  const items = new Map<string, { product: string; category?: string; supplier?: string; stock: number; reorderPoint: number; revenue: number }>()
  for (const row of rows) {
    const stock = getNumber(row[columns.stock])
    const reorderPoint = getNumber(row[columns.reorderPoint])
    if (stock === null || reorderPoint === null || stock > reorderPoint) continue
    const product = columns.product ? String(row[columns.product] || "Unknown product").trim() : "Unknown product"
    const key = product || "Unknown product"
    const revenue = columns.revenue ? getNumber(row[columns.revenue]) || 0 : 0
    const current = items.get(key)
    if (!current || revenue > current.revenue) {
      items.set(key, {
        product: key,
        category: columns.category ? String(row[columns.category] || "").trim() || undefined : undefined,
        supplier: columns.vendor ? String(row[columns.vendor] || "").trim() || undefined : undefined,
        stock,
        reorderPoint,
        revenue,
      })
    }
  }
  return Array.from(items.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10).map(({ revenue: _revenue, ...item }) => item)
}

function groupedRetailChart(rows: DataRow[], groupColumn: string | undefined, valueColumn: string | undefined, fallback: string) {
  if (!groupColumn || !valueColumn) return []
  const grouped = new Map<string, number>()
  for (const row of rows) {
    const name = String(row[groupColumn] || fallback).trim() || fallback
    const value = getNumber(row[valueColumn])
    if (value === null) continue
    grouped.set(name, round((grouped.get(name) || 0) + value))
  }
  return Array.from(grouped.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8)
}

function calculateReturnMetrics(rows: DataRow[], columns: ColumnMap) {
  if (!columns.returnStatus) {
    return {
      returnedOrders: null,
      eligibleOrders: null,
      returnRate: null,
      status: "not_available" as const,
    }
  }
  const statusesByOrder = new Map<string, NormalizedReturnStatus[]>()
  rows.forEach((row, index) => {
    const orderKey = columns.order ? String(row[columns.order] || "").trim() : `row_${index}`
    if (!orderKey) return
    const status = normalizeReturnStatus(row[columns.returnStatus!])
    const statuses = statusesByOrder.get(orderKey) || []
    statuses.push(status)
    statusesByOrder.set(orderKey, statuses)
  })
  let returnedOrders = 0
  let eligibleOrders = 0
  for (const statuses of statusesByOrder.values()) {
    const status = aggregateOrderReturnStatus(statuses)
    if (status === "unknown") continue
    eligibleOrders += 1
    if (status === "returned") returnedOrders += 1
  }
  if (eligibleOrders === 0) {
    return {
      returnedOrders: null,
      eligibleOrders: null,
      returnRate: null,
      status: "not_available" as const,
    }
  }
  return {
    returnedOrders,
    eligibleOrders,
    returnRate: round((returnedOrders / eligibleOrders) * 100),
    status: "available" as const,
  }
}

function normalizeReturnStatus(value: unknown): NormalizedReturnStatus {
  if (value === null || value === undefined) return "unknown"
  const raw = String(value).trim().toLowerCase()
  if (!raw) return "unknown"
  const normalized = raw.replace(/[\s-]+/g, "_").replace(/[^a-z0-9_]/g, "")
  if (["not_returned", "no", "false", "0", "completed", "delivered", "kept"].includes(normalized)) return "not_returned"
  if (["returned", "return", "yes", "true", "1", "refunded", "return_approved"].includes(normalized)) return "returned"
  return "unknown"
}

function aggregateOrderReturnStatus(statuses: NormalizedReturnStatus[]): NormalizedReturnStatus {
  if (statuses.includes("returned")) return "returned"
  if (statuses.includes("not_returned")) return "not_returned"
  return "unknown"
}

function ecommerceRevenueTrend(rows: DataRow[], columns: ColumnMap) {
  if (!columns.date || !columns.revenue) return []
  const grouped = new Map<string, number>()
  for (const row of rows) {
    const period = monthKey(row[columns.date])
    const revenue = getNumber(row[columns.revenue])
    if (!period || revenue === null) continue
    grouped.set(period, round((grouped.get(period) || 0) + revenue))
  }
  return Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => ({ name, value }))
}

function marketplaceValueTrend(rows: DataRow[], dateColumn: string | undefined, valueColumn: string | undefined, label: string) {
  if (!dateColumn || !valueColumn) return []
  const grouped = new Map<string, number>()
  for (const row of rows) {
    const period = monthKey(row[dateColumn])
    const value = getNumber(row[valueColumn])
    if (!period || value === null) continue
    grouped.set(period, round((grouped.get(period) || 0) + value))
  }
  return Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => ({ name, value }))
}

function ecommerceOrdersTrend(rows: DataRow[], columns: ColumnMap) {
  if (!columns.date || !columns.order) return []
  const grouped = new Map<string, Set<string>>()
  for (const row of rows) {
    const period = monthKey(row[columns.date])
    const orderId = String(row[columns.order] || "").trim()
    if (!period || !orderId) continue
    const orders = grouped.get(period) || new Set<string>()
    orders.add(orderId)
    grouped.set(period, orders)
  }
  return Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([name, orders]) => ({ name, value: orders.size }))
}

function ecommerceChannelPerformance(rows: DataRow[], columns: ColumnMap, totalRevenue: number | null) {
  if (!columns.channel || !columns.revenue) return []
  const grouped = new Map<string, { revenue: number; orders: Set<string> }>()
  for (const row of rows) {
    const name = String(row[columns.channel] || "Unknown channel").trim() || "Unknown channel"
    const revenue = getNumber(row[columns.revenue])
    if (revenue === null) continue
    const current = grouped.get(name) || { revenue: 0, orders: new Set<string>() }
    current.revenue += revenue
    if (columns.order) {
      const orderId = String(row[columns.order] || "").trim()
      if (orderId) current.orders.add(orderId)
    }
    grouped.set(name, current)
  }
  return Array.from(grouped.entries())
    .map(([name, value]) => ({
      name,
      value: round(value.revenue),
      orders: value.orders.size,
      aov: value.orders.size > 0 ? round(value.revenue / value.orders.size) : null,
      share: totalRevenue && totalRevenue > 0 ? round((value.revenue / totalRevenue) * 100) : null,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
}

function ecommerceGeography(rows: DataRow[], columns: ColumnMap, totalRevenue: number | null) {
  const geographyColumn = columns.country || columns.region
  if (!geographyColumn || !columns.revenue) return []
  const grouped = new Map<string, { revenue: number; orders: Set<string> }>()
  for (const row of rows) {
    const name = String(row[geographyColumn] || "Unknown geography").trim() || "Unknown geography"
    const revenue = getNumber(row[columns.revenue])
    if (revenue === null) continue
    const current = grouped.get(name) || { revenue: 0, orders: new Set<string>() }
    current.revenue += revenue
    if (columns.order) {
      const orderId = String(row[columns.order] || "").trim()
      if (orderId) current.orders.add(orderId)
    }
    grouped.set(name, current)
  }
  return Array.from(grouped.entries())
    .map(([name, value]) => ({
      name,
      value: round(value.revenue),
      orders: value.orders.size,
      share: totalRevenue && totalRevenue > 0 ? round((value.revenue / totalRevenue) * 100) : null,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
}

function ecommercePaymentMethods(rows: DataRow[], columns: ColumnMap) {
  if (!columns.paymentMethod || !columns.revenue) return []
  const grouped = new Map<string, { revenue: number; orders: Set<string> }>()
  for (const row of rows) {
    const name = String(row[columns.paymentMethod] || "Unknown payment method").trim() || "Unknown payment method"
    const revenue = getNumber(row[columns.revenue])
    if (revenue === null) continue
    const current = grouped.get(name) || { revenue: 0, orders: new Set<string>() }
    current.revenue += revenue
    if (columns.order) {
      const orderId = String(row[columns.order] || "").trim()
      if (orderId) current.orders.add(orderId)
    }
    grouped.set(name, current)
  }
  return Array.from(grouped.entries())
    .map(([name, value]) => ({ name, value: round(value.revenue), orders: value.orders.size }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
}

function retailMarginByGroup(rows: DataRow[], groupColumn: string | undefined, columns: ColumnMap) {
  if (!groupColumn || !columns.revenue || !columns.cogs) return []
  const grouped = new Map<string, { revenue: number; cogs: number; grossProfit: number }>()
  let totalRevenue = 0
  let totalCogs = 0
  let totalGrossProfit = 0
  for (const row of rows) {
    const name = String(row[groupColumn] || "Uncategorized").trim() || "Uncategorized"
    const revenue = getNumber(row[columns.revenue])
    const cogs = rowCogs(row, columns)
    if (revenue === null || cogs === null) continue
    const grossProfit = revenue - cogs
    const current = grouped.get(name) || { revenue: 0, cogs: 0, grossProfit: 0 }
    current.revenue += revenue
    current.cogs += cogs
    current.grossProfit += grossProfit
    totalRevenue += revenue
    totalCogs += cogs
    totalGrossProfit += grossProfit
    grouped.set(name, current)
  }
  if (grouped.size === 0 || !retailCategoryTotalsReconcile(rows, columns, { totalRevenue, totalCogs, totalGrossProfit })) return []
  const revenueSource = columns.revenue
  const cogsSource = cogsCalculationSource(columns)
  return Array.from(grouped.entries())
    .map(([name, value]) => {
      const grossMargin = value.revenue > 0 ? round((value.grossProfit / value.revenue) * 100) : 0
      return {
        name,
        category: name,
        value: grossMargin,
        revenue: round(value.revenue),
        cogs: round(value.cogs),
        grossProfit: round(value.grossProfit),
        grossMargin,
        revenueSource,
        cogsSource,
      }
    })
    .sort((a, b) => b.value - a.value)
}

function buildTopCostCategories(rows: DataRow[], columns: ColumnMap) {
  if (!columns.expenseCategory || !columns.expenseAmount) return []
  const grouped = new Map<string, number>()
  for (const row of rows) {
    const category = String(row[columns.expenseCategory] || "").trim()
    const amount = getNumber(row[columns.expenseAmount])
    if (!category || amount === null) continue
    grouped.set(category, (grouped.get(category) || 0) + amount)
  }
  return Array.from(grouped.entries())
    .map(([name, value]) => ({ name, value: round(value) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
}

function buildPeriodTrends(rows: DataRow[], columns: ColumnMap): NonNullable<ReportFinancials["periodTrends"]> {
  if (!columns.date) return []
  const valueColumns = [
    columns.revenue || columns.gmv,
    columns.cogs,
    columns.operatingExpenses,
    columns.interestExpense,
    columns.taxExpense,
    columns.grossProfit,
    columns.operatingProfit,
    columns.netProfit,
  ]
  if (!valueColumns.some(Boolean)) return []

  const grouped = new Map<string, {
    revenue: number | null
    cogs: number | null
    operatingExpenses: number | null
    interestExpense: number | null
    taxExpense: number | null
    grossProfit: number | null
    operatingProfit: number | null
    netProfit: number | null
  }>()

  for (const row of rows) {
    const period = periodKey(row[columns.date])
    if (!period) continue
    const current = grouped.get(period) || {
      revenue: null,
      cogs: null,
      operatingExpenses: null,
      interestExpense: null,
      taxExpense: null,
      grossProfit: null,
      operatingProfit: null,
      netProfit: null,
    }
    addTrendValue(current, "revenue", row, columns.revenue || columns.gmv)
    addTrendValue(current, "cogs", row, columns.cogs)
    addTrendValue(current, "operatingExpenses", row, columns.operatingExpenses)
    addTrendValue(current, "interestExpense", row, columns.interestExpense)
    addTrendValue(current, "taxExpense", row, columns.taxExpense)
    addTrendValue(current, "grossProfit", row, columns.grossProfit)
    addTrendValue(current, "operatingProfit", row, columns.operatingProfit)
    addTrendValue(current, "netProfit", row, columns.netProfit)
    grouped.set(period, current)
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, trend]) => {
      const grossProfit = trend.grossProfit !== null
        ? trend.grossProfit
        : trend.revenue !== null && trend.cogs !== null
          ? round(trend.revenue - trend.cogs)
          : null
      const operatingProfit = trend.operatingProfit !== null
        ? trend.operatingProfit
        : grossProfit !== null && trend.operatingExpenses !== null
          ? round(grossProfit - trend.operatingExpenses)
          : null
      const netProfit = trend.netProfit !== null
        ? trend.netProfit
        : operatingProfit !== null && trend.interestExpense !== null && trend.taxExpense !== null
          ? round(operatingProfit - trend.interestExpense - trend.taxExpense)
          : null
      return {
        period,
        revenue: trend.revenue,
        cogs: trend.cogs,
        operatingExpenses: trend.operatingExpenses,
        interestExpense: trend.interestExpense,
        taxExpense: trend.taxExpense,
        grossProfit,
        operatingProfit,
        netProfit,
        grossMargin: trend.revenue && grossProfit !== null ? round((grossProfit / trend.revenue) * 100) : null,
        operatingMargin: trend.revenue && operatingProfit !== null ? round((operatingProfit / trend.revenue) * 100) : null,
        netMargin: trend.revenue && netProfit !== null ? round((netProfit / trend.revenue) * 100) : null,
      }
    })
}

function addTrendValue(
  target: Record<string, number | null>,
  key: string,
  row: DataRow,
  column?: string,
) {
  if (!column) return
  const value = getNumber(row[column])
  if (value === null) return
  target[key] = round((target[key] || 0) + value)
}

function periodKey(value: unknown) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString().slice(0, 10)
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSXDateToJSDate(value)
    return parsed ? parsed.toISOString().slice(0, 10) : null
  }
  const text = String(value || "").trim()
  if (!text) return null
  const parsed = new Date(text)
  if (Number.isFinite(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  if (/^\d{4}-\d{1,2}$/.test(text)) return text.replace(/-(\d)$/, "-0$1")
  return null
}

function monthKey(value: unknown) {
  const period = periodKey(value)
  return period ? period.slice(0, 7) : null
}

function XLSXDateToJSDate(serial: number) {
  if (serial < 1 || serial > 100000) return null
  const utcDays = Math.floor(serial - 25569)
  const utcValue = utcDays * 86400
  const dateInfo = new Date(utcValue * 1000)
  return Number.isFinite(dateInfo.getTime()) ? dateInfo : null
}

function revenueGrowthFromPeriodTrends(trends: NonNullable<ReportFinancials["periodTrends"]>) {
  const revenuePeriods = trends.filter((trend) => trend.revenue !== null)
  if (revenuePeriods.length < 2) return null
  const first = revenuePeriods[0].revenue
  const last = revenuePeriods[revenuePeriods.length - 1].revenue
  if (!first || last === null) return null
  return round(((last - first) / first) * 100)
}

function reportingPeriodFromPeriodTrends(trends: NonNullable<ReportFinancials["periodTrends"]>) {
  if (trends.length === 0) return null
  if (trends.length === 1) return trends[0].period
  return `${trends[0].period} to ${trends[trends.length - 1].period}`
}

function sourceMetric(value: number | null, column?: string): FinancialMetric {
  return value !== null && column ? { value, source: "source_value", note: `Directly from source field: ${column}.` } : unavailableMetric()
}

function cogsMetric(value: number | null, columns: ColumnMap): FinancialMetric {
  if (value === null || !columns.cogs) return unavailableMetric()
  if (isUnitCostColumn(columns.cogs)) {
    return columns.quantity
      ? { value, source: "derived_value", note: `Calculated from ${columns.cogs} multiplied by ${columns.quantity}.` }
      : unavailableMetric()
  }
  return sourceMetric(value, columns.cogs)
}

function calculatedMetric(value: number): FinancialMetric {
  return { value, source: "derived_value", note: "Calculated from complete required source inputs." }
}

function unavailableMetric(): FinancialMetric {
  return { value: null, source: "unavailable", note: "Required source input is missing." }
}

function sourceMeta(note: string) {
  return { kind: "source_value" as const, note }
}

function derivedMeta(note: string) {
  return { kind: "derived_value" as const, note }
}

function unavailableMeta(note: string) {
  return { kind: "unavailable" as const, note }
}

function metaFromMetric(metric: FinancialMetric, unavailableNote?: string) {
  return {
    kind: metric.source,
    note: metric.source === "unavailable" ? unavailableNote || metric.note : metric.note,
  }
}

function dataConfidenceForFinancials(metrics: FinancialMetric[]) {
  const available = metrics.filter((metric) => metric.value !== null).length
  return Math.round((available / metrics.length) * 100)
}

function buildDatasetSummary(
  datasetName: string,
  model: ReportModel,
  rowCount: number,
  columns: ColumnMap,
  financials: ReportFinancials,
  bbsc: ReturnType<typeof calculateBusinessBalancedScorecard>,
) {
  if (model === "business_consulting") {
    const parts: string[] = []
    if (financials.revenue !== null) {
      parts.push(`${datasetName} contains ${formatCurrencyForSummary(financials.revenue)} in recognized revenue across ${rowCount.toLocaleString()} loaded rows.`)
    } else {
      parts.push(`${datasetName} has ${rowCount.toLocaleString()} loaded rows, but revenue is not available from recognized source fields.`)
    }
    if (financials.grossProfit !== null) {
      parts.push(`Gross profit is ${formatCurrencyForSummary(financials.grossProfit)} with a gross margin of ${financials.grossMargin?.toFixed(1)}%.`)
    } else if (financials.revenue !== null && (columns.consultantCost || columns.otherCost)) {
      parts.push("Gross profitability cannot be calculated because consultant_cost and/or other_cost data is incomplete.")
    }
    if (financials.netProfit === null) {
      parts.push("Operating and net profitability require additional inputs (operating expenses, interest, tax).")
    }
    parts.push(hasTrendFields(columns) ? "Trend analysis can use the recognized date or period field." : "Trend analysis is unavailable because no valid date or period field is recognized.")
    if (bbsc.availablePerspectiveCount < 2) {
      parts.push("Balanced Scorecard comparison is unavailable because fewer than two perspectives have comparable source data.")
    }
    return parts.join(" ")
  }
  if (model === "professional_services") {
    const parts: string[] = []
    if (financials.revenue !== null) {
      parts.push(`${datasetName} contains ${formatCurrencyForSummary(financials.revenue)} in recognized revenue across ${rowCount.toLocaleString()} loaded rows.`)
    } else {
      parts.push(`${datasetName} has ${rowCount.toLocaleString()} loaded rows, but revenue is not available from recognized source fields.`)
    }
    if (financials.grossProfit !== null) {
      parts.push(`Gross profit is ${formatCurrencyForSummary(financials.grossProfit)} with a gross margin of ${financials.grossMargin?.toFixed(1)}%.`)
    } else if (financials.revenue !== null && (columns.freelancerCost || columns.adSpend)) {
      parts.push("Gross profitability cannot be calculated because freelancer_cost and/or ad_spend data is incomplete.")
    }
    if (financials.netProfit === null) {
      parts.push("Operating and net profitability require additional inputs (operating expenses, interest, tax).")
    }
    parts.push(hasTrendFields(columns) ? "Trend analysis can use the recognized date or period field." : "Trend analysis is unavailable because no valid date or period field is recognized.")
    if (bbsc.availablePerspectiveCount < 2) {
      parts.push("Balanced Scorecard comparison is unavailable because fewer than two perspectives have comparable source data.")
    }
    return parts.join(" ")
  }
  const parts: string[] = []
  if (financials.revenue !== null) {
    parts.push(`${datasetName} contains ${formatCurrencyForSummary(financials.revenue)} in recognized revenue across ${rowCount.toLocaleString()} loaded rows.`)
  } else {
    parts.push(`${datasetName} has ${rowCount.toLocaleString()} loaded rows, but revenue is not available from recognized source fields.`)
  }
  if (financials.netProfit === null) {
    parts.push("Profitability cannot be reliably assessed because required cost, expense, interest, or tax fields are missing.")
  } else {
    parts.push(`Net profit is ${formatCurrencyForSummary(financials.netProfit)} from explicit source fields or complete required financial inputs.`)
  }
  parts.push(hasTrendFields(columns) ? "Trend analysis can use the recognized date or period field." : "Trend analysis is unavailable because no valid date or period field is recognized.")
  if (bbsc.availablePerspectiveCount < 2) {
    parts.push("Balanced Scorecard comparison is unavailable because fewer than two perspectives have comparable source data.")
  }
  if (model === "startup" && !columns.customer) {
    parts.push("Customer analysis is unavailable because no recognized customer or account field exists.")
  }
  return parts.join(" ")
}

function buildDatasetRecommendations(
  columns: ColumnMap,
  financials: ReportFinancials,
  bbsc: ReturnType<typeof calculateBusinessBalancedScorecard>,
): ReportRecommendation[] {
  const isBusinessConsulting = columns.consultantCost !== undefined || columns.otherCost !== undefined
  if (isBusinessConsulting) {
    const recommendations: ReportRecommendation[] = []
    if (financials.grossProfit === null && financials.revenue !== null) {
      recommendations.push({
        issue: "Add project cost data to calculate gross profit.",
        businessImpact: "Revenue is available, but consultant_cost and other_cost fields are missing for project cost analysis.",
        recommendedAction: "Add consultant_cost and other_cost fields to enable gross profit and margin analysis.",
        estimatedImpact: "High",
        confidence: "High",
        requiredData: ["Consultant Cost", "Other Cost"],
      })
    }
    if (financials.revenue !== null && financials.netProfit === null) {
      recommendations.push({
        issue: "Add operating expense data to extend profitability analysis.",
        businessImpact: "Gross profitability is available, but operating and net profitability require operating expenses, interest, and tax inputs.",
        recommendedAction: "Add operating expenses, interest, and tax data to extend analysis from gross to operating and net profitability.",
        estimatedImpact: "Medium",
        confidence: "High",
        requiredData: ["Operating Expenses", "Interest Expense", "Tax Expense"],
      })
    }
    if (!hasTrendFields(columns)) {
      recommendations.push({
        issue: "Add project date data to enable trend analysis.",
        businessImpact: "Project start and end dates are missing, preventing revenue and profitability trend analysis.",
        recommendedAction: "Add project_start and project_end fields to enable project-based trend analysis.",
        estimatedImpact: "Medium",
        confidence: "High",
        requiredData: ["Project Start", "Project End"],
      })
    }
    return recommendations.slice(0, 4)
  }
  const isProfessionalServices = columns.freelancerCost !== undefined || columns.adSpend !== undefined || columns.campaignId !== undefined
  if (isProfessionalServices) {
    const recommendations: ReportRecommendation[] = []
    if (financials.grossProfit === null && financials.revenue !== null) {
      recommendations.push({
        issue: "Add direct cost data to calculate gross profit.",
        businessImpact: "Revenue is available, but freelancer_cost and/or ad_spend fields are missing for direct cost analysis.",
        recommendedAction: "Add freelancer_cost and ad_spend fields to enable gross profit and margin analysis.",
        estimatedImpact: "High",
        confidence: "High",
        requiredData: ["Freelancer Cost", "Ad Spend"],
      })
    }
    if (financials.revenue !== null && financials.netProfit === null) {
      recommendations.push({
        issue: "Add operating expense data to extend profitability analysis.",
        businessImpact: "Gross profitability is available, but operating and net profitability require operating expenses, interest, and tax inputs.",
        recommendedAction: "Add operating expenses, interest, and tax data to extend analysis from gross to operating and net profitability.",
        estimatedImpact: "Medium",
        confidence: "High",
        requiredData: ["Operating Expenses", "Interest Expense", "Tax Expense"],
      })
    }
    if (!columns.leadCount || !columns.conversionCount) {
      recommendations.push({
        issue: "Lead and conversion tracking is incomplete.",
        businessImpact: "Campaign effectiveness metrics are limited without lead_count and conversion_count data.",
        recommendedAction: "Add lead_count and conversion_count fields to enable campaign performance analysis.",
        estimatedImpact: "Medium",
        confidence: "High",
        requiredData: ["Lead Count", "Conversion Count"],
      })
    }
    return recommendations.slice(0, 4)
  }
  const recommendations: ReportRecommendation[] = []
  if (financials.revenue !== null && financials.netProfit === null) {
    recommendations.push({
      issue: "Revenue is available, but profitability inputs are incomplete.",
      businessImpact: "Margin, profit, and expense-ratio decisions are not reliable until cost data is present.",
      recommendedAction: "Add COGS, operating expenses, interest, and tax fields before making margin or profitability decisions.",
      estimatedImpact: null,
      requiredData: ["COGS", "Operating Expenses", "Interest Expense", "Tax Expense"],
    })
  }
  if (!hasTrendFields(columns)) {
    recommendations.push({
      issue: "No recognized date or period field is available for trend analysis.",
      businessImpact: "The report cannot show growth, seasonality, or changes in business health over time.",
      recommendedAction: "Add a date, month, or period column to enable trend and growth analysis.",
      estimatedImpact: null,
      requiredData: ["Date or Period"],
    })
  }
  if (financials.cogs === null || financials.operatingExpenses === null) {
    recommendations.push({
      issue: "Categorized expense data is incomplete.",
      businessImpact: "Cost optimization opportunities cannot be ranked or quantified from this dataset.",
      recommendedAction: "Upload categorized expense data so COGS and operating-expense drivers can be reviewed separately.",
      estimatedImpact: null,
      requiredData: ["Expense Category", "COGS", "Operating Expenses"],
    })
  }
  if (!columns.customer && !columns.order) {
    recommendations.push({
      issue: "Customer and order fields are not recognized.",
      businessImpact: "Customer performance, concentration, retention, and order-value analysis are unavailable.",
      recommendedAction: "Add customer, account, order, or transaction identifiers to unlock customer performance analysis.",
      estimatedImpact: null,
      requiredData: ["Customer ID", "Order ID"],
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
  if (bbsc.weakestPerspective && bbsc.availablePerspectiveCount >= 2) {
    recommendations.push({
      issue: `${bbsc.weakestPerspective.title} is the weakest available perspective at ${bbsc.weakestPerspective.score}/100.`,
      businessImpact: "The weakest scored perspective limits the overall business score.",
      recommendedAction: bbsc.weakestPerspective.recommendedActions[0] || "Track the missing drivers and review the perspective monthly.",
      estimatedImpact: null,
      confidence: bbsc.weakestPerspective.dataConfidence >= 70 ? "High" : "Medium",
      requiredData: [],
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
  if (detectProfessionalServices(columns, datasetName)) return "professional_services"
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

function detectProfessionalServices(columns: string[], datasetName: string) {
  const text = [datasetName, ...columns].join(" ").toLowerCase()
  const hasFreelancerCost = /freelancer_cost/.test(text)
  const hasAdSpend = /ad_spend/.test(text)
  const hasCampaignId = /campaign_id/.test(text)
  const hasServiceLine = /service_line/.test(text)
  const hasLeadCount = /lead_count/.test(text)
  const hasConversionCount = /conversion_count/.test(text)
  const hasChannel = /channel/.test(text)
  const nameHasProfessionalServices = /professional_services/.test(text)
  if (nameHasProfessionalServices) return true
  if (hasFreelancerCost && hasAdSpend) return true
  if (hasCampaignId && hasServiceLine && hasLeadCount && hasConversionCount) return true
  if (hasCampaignId && hasFreelancerCost && hasAdSpend) return true
  if (hasCampaignId && hasChannel && (hasFreelancerCost || hasAdSpend)) return true
  if (hasServiceLine && hasChannel && (hasFreelancerCost || hasAdSpend)) return true
  return false
}

function reportModelLabel(model: ReportModel) {
  if (model === "local_retail") return "Local retail"
  if (model === "ecommerce") return "E-commerce"
  if (model === "saas") return "SaaS"
  if (model === "startup") return "Startup"
  if (model === "investor") return "Investor portfolio"
  if (model === "marketplace") return "Marketplace"
  if (model === "business_consulting") return "Business consulting"
  if (model === "professional_services") return "Professional services"
  if (model === "profitability") return "Profitability"
  if (model === "accountancy") return "Accountancy"
  if (model === "prebookkeeping") return "Pre-bookkeeping"
  return "Business analytics"
}

function detectColumns(columns: string[]): ColumnMap {
  return {
    revenue: findColumn(columns, [/revenue/, /^sales$/, /turnover/, /income/]),
    cost: findColumn(columns, [/^cost$/, /cogs/, /expense/, /unit_cost/, /spend/]),
    grossProfit: findColumn(columns, [/gross_profit/, /grossprofit/]),
    operatingProfit: findColumn(columns, [/operating_profit/, /operatingprofit/, /ebit\b/]),
    netProfit: findColumn(columns, [/net_profit/, /netprofit/, /^profit$/, /profit_loss/]),
    cogs: findColumn(columns, [/^cogs$/, /cost_of_goods_sold/, /cost_of_goods/, /cost_of_sales/, /product_cost/, /merchandise_cost/]),
    operatingExpenses: findColumn(columns, [/operating_expenses/, /^opex$/, /sg_a/, /sga/]),
    interestExpense: findColumn(columns, [/interest_expense/, /^interest$/]),
    taxExpense: findColumn(columns, [/tax_expense/, /^tax$/, /taxes/]),
    profit: findColumn(columns, [/net_profit/, /gross_profit/, /operating_profit/, /^profit$/]),
    quantity: findColumn(columns, [/quantity/, /^qty$/, /units_sold/, /units/, /volume/]),
    order: columns.find((column) => isOrderIdentifierColumn(column)),
    customer: findColumn(columns, [/customer_id/, /customer/, /client_id/, /client/]),
    country: findColumn(columns, [/country/, /region/, /location/]),
    region: findColumn(columns, [/region/]),
    channel: findColumn(columns, [/channel/, /source/]),
    product: findColumn(columns, [/product_id/, /product_name/, /product/, /^sku$/, /item/]),
    category: findColumn(columns, [/category/]),
    date: findColumn(columns, [/date/, /month/, /period/, /created_at/, /project_start/, /project_end/]),
    shippingCost: findColumn(columns, [/shipping_cost/, /shipping/, /fulfillment_cost/, /delivery_cost/, /freight/]),
    discount: findColumn(columns, [/discount/, /discount_amount/, /promo/]),
    returnStatus: findColumn(columns, [/return_status/, /returned/, /return/]),
    paymentMethod: findColumn(columns, [/payment_method/, /payment/]),
    expenseCategory: findColumn(columns, [/expense_category/, /expensecategory/, /cost_category/, /costcategory/]),
    expenseAmount: findColumn(columns, [/expense_amount/, /expenseamount/, /cost_amount/, /costamount/]),
    vendor: findColumn(columns, [/vendor_supplier/, /vendorsupplier/, /^vendor$/, /supplier/, /merchant/]),
    stock: findColumn(columns, [/stock_on_hand/, /stock/, /inventory/]),
    reorderPoint: findColumn(columns, [/reorder_point/, /reorder/]),
    mrr: findColumn(columns, [/^mrr$/, /monthly_recurring_revenue/]),
    arr: findColumn(columns, [/^arr$/, /annual_recurring_revenue/]),
    newCustomer: findColumn(columns, [/new_customer/, /newcustomer/, /new_logo/]),
    churned: findColumn(columns, [/churned/, /churn/]),
    expansionMrr: findColumn(columns, [/expansion_mrr/, /expansion_recurring/, /upsell/]),
    contractionMrr: findColumn(columns, [/contraction_mrr/, /contraction_recurring/, /downsell/]),
    cac: findColumn(columns, [/^cac$/, /customer_acquisition_cost/]),
    ltv: findColumn(columns, [/^ltv$/, /customer_lifetime_value/, /lifetime_value/]),
    activeUsers: findColumn(columns, [/active_users/, /active_user/, /usage/]),
    supportTickets: findColumn(columns, [/support_tickets/, /support_ticket/, /tickets/]),
    burn: findColumn(columns, [/burn/]),
    cashBalance: findColumn(columns, [/cash_balance/, /^cash$/]),
    runway: findColumn(columns, [/runway/]),
    plan: findColumn(columns, [/^plan$/, /subscription_plan/, /tier/]),
    investedAmount: findColumn(columns, [/invested_amount/, /invested_capital/, /investment/]),
    valuation: findColumn(columns, [/latest_valuation/, /valuation/]),
    ownership: findColumn(columns, [/ownership/]),
    sector: findColumn(columns, [/sector/, /industry/]),
    stage: findColumn(columns, [/stage/]),
    companyId: findColumn(columns, [/company_id/, /companyid/]),
    companyName: findColumn(columns, [/company_name/, /companyname/]),
    status: findColumn(columns, [/status/, /portfolio_status/]),
    growthRate: findColumn(columns, [/growth_rate/, /growth/]),
    seller: findColumn(columns, [/seller/, /vendor/, /merchant/]),
    buyer: findColumn(columns, [/buyer/]),
    gmv: findColumn(columns, [/^gmv$/, /gross_merchandise/]),
    commission: findColumn(columns, [/commission/, /take_rate/, /platform_fee/]),
    billableHours: findColumn(columns, [/billable_hours/, /hours/]),
    hourlyRate: findColumn(columns, [/hourly_rate/, /rate/]),
    consultantCost: findColumn(columns, [/consultant_cost/]),
    otherCost: findColumn(columns, [/other_cost/]),
    grossMargin: findColumn(columns, [/gross_margin/, /project_margin/]),
    projectStart: findColumn(columns, [/project_start/]),
    projectEnd: findColumn(columns, [/project_end/]),
    projectId: findColumn(columns, [/project_id/]),
    consultantId: findColumn(columns, [/consultant_id/]),
    industry: findColumn(columns, [/industry/]),
    pipelineStage: findColumn(columns, [/pipeline_stage/]),
    account: findColumn(columns, [/account/, /ledger/]),
    debit: findColumn(columns, [/debit/]),
    credit: findColumn(columns, [/credit/]),
    invoice: findColumn(columns, [/invoice/, /receipt/]),
    refund: findColumn(columns, [/refund/, /return_amount/]),
    sellerPayout: findColumn(columns, [/seller_payout/, /merchant_payout/, /payout/]),
    newBuyer: findColumn(columns, [/new_buyer/, /newbuyer/]),
    newSeller: findColumn(columns, [/new_seller/, /newseller/]),
    activeSellers: findColumn(columns, [/active_sellers/, /active_seller/]),
    listingCount: findColumn(columns, [/listing_count/, /listing/]),
    completed: findColumn(columns, [/completed/, /completion_status/]),
    freelancerCost: findColumn(columns, [/freelancer_cost/]),
    adSpend: findColumn(columns, [/ad_spend/]),
    campaignId: findColumn(columns, [/campaign_id/]),
    serviceLine: findColumn(columns, [/service_line/]),
    leadCount: findColumn(columns, [/lead_count/]),
    conversionCount: findColumn(columns, [/conversion_count/]),
  }
}

function buildSemanticContext(input: {
  datasetId: string
  datasetType: string
  reportModel: ReportModel
  columnMap: ColumnMap
}): ReportSemanticContext {
  const isEcommerce = input.reportModel === "ecommerce"
  const isSaas = input.reportModel === "saas" || input.reportModel === "startup"
  const isMarketplace = input.reportModel === "marketplace"
  const isBusinessConsulting = input.reportModel === "business_consulting"
  const isProfessionalServices = input.reportModel === "professional_services"
  const mappings: Record<string, string | null> = {
    date: isBusinessConsulting ? ((input.columnMap.projectStart || input.columnMap.projectEnd) ?? null) : (input.columnMap.date ?? null),
    revenue: isBusinessConsulting || isProfessionalServices ? (input.columnMap.revenue ?? null) : (isMarketplace ? null : (input.columnMap.revenue || input.columnMap.gmv || null)),
    cogs: isBusinessConsulting || isProfessionalServices ? null : (input.columnMap.cogs ?? null),
    grossProfit: isBusinessConsulting || isProfessionalServices ? (input.columnMap.grossProfit ?? null) : (input.columnMap.grossProfit ?? null),
    operatingExpenses: input.columnMap.operatingExpenses ?? null,
    operatingProfit: input.columnMap.operatingProfit ?? null,
    interestExpense: input.columnMap.interestExpense ?? null,
    taxExpense: input.columnMap.taxExpense ?? null,
    netProfit: input.columnMap.netProfit ?? null,
    expenseCategory: isEcommerce || isSaas || isMarketplace || isBusinessConsulting || isProfessionalServices ? null : input.columnMap.expenseCategory || null,
    expenseAmount: isEcommerce || isSaas || isMarketplace || isBusinessConsulting || isProfessionalServices ? null : input.columnMap.expenseAmount || null,
    vendor: input.columnMap.vendor || null,
    mrr: input.columnMap.mrr || null,
    arr: input.columnMap.arr || null,
    customer: input.columnMap.customer || null,
    newCustomer: input.columnMap.newCustomer || null,
    churned: input.columnMap.churned || null,
    expansionMrr: input.columnMap.expansionMrr || null,
    contractionMrr: input.columnMap.contractionMrr || null,
    cac: input.columnMap.cac || null,
    ltv: input.columnMap.ltv || null,
    activeUsers: input.columnMap.activeUsers || null,
    supportTickets: input.columnMap.supportTickets || null,
    burn: input.columnMap.burn || null,
    cashBalance: input.columnMap.cashBalance || null,
    runway: input.columnMap.runway || null,
    plan: input.columnMap.plan || null,
    country: input.columnMap.country ?? null,
    gmv: input.columnMap.gmv || null,
    commission: input.columnMap.commission || null,
    refund: input.columnMap.refund || null,
    sellerPayout: input.columnMap.sellerPayout || null,
    buyer: input.columnMap.buyer || null,
    seller: input.columnMap.seller || null,
    order: input.columnMap.order || null,
    activeSellers: input.columnMap.activeSellers || null,
    listingCount: input.columnMap.listingCount || null,
    newBuyer: input.columnMap.newBuyer || null,
    newSeller: input.columnMap.newSeller || null,
    completed: input.columnMap.completed || null,
    consultantCost: isBusinessConsulting ? input.columnMap.consultantCost || null : null,
    otherCost: isBusinessConsulting ? input.columnMap.otherCost || null : null,
    projectStart: isBusinessConsulting ? input.columnMap.projectStart || null : null,
    projectEnd: isBusinessConsulting ? input.columnMap.projectEnd || null : null,
    billableHours: isBusinessConsulting || isProfessionalServices ? input.columnMap.billableHours || null : null,
  }
  const required = isSaas
    ? ["date", "mrr", "arr", "customer", "newCustomer", "churned", "expansionMrr", "contractionMrr", "cac", "ltv", "activeUsers", "supportTickets", "burn", "cashBalance", "runway", "plan", "country"]
    : isMarketplace
      ? ["date", "gmv", "commission", "order", "buyer", "seller", "refund"]
      : isBusinessConsulting
        ? ["date", "revenue", "grossProfit", "consultantCost", "projectStart", "projectEnd"]
        : isProfessionalServices
          ? ["date", "revenue", "grossProfit"]
          : ["date", "revenue", "netProfit", "expenseCategory", "expenseAmount", "vendor"]
  const available = required.filter((key) => Boolean(mappings[key])).length
  return {
    datasetId: input.datasetId,
    datasetType: input.datasetType,
    mappings,
    confidence: Math.round((available / required.length) * 100),
    dateField: mappings.date,
    revenueField: mappings.revenue,
    netProfitField: mappings.netProfit,
    costFields: isBusinessConsulting
      ? [input.columnMap.consultantCost, input.columnMap.otherCost].filter((field): field is string => Boolean(field))
      : isProfessionalServices
        ? [input.columnMap.freelancerCost, input.columnMap.adSpend].filter((field): field is string => Boolean(field))
        : [
            input.columnMap.cogs,
            input.columnMap.operatingExpenses,
            input.columnMap.interestExpense,
            input.columnMap.taxExpense,
          ].filter((field): field is string => Boolean(field)),
    expenseCategoryField: mappings.expenseCategory,
    expenseAmountField: mappings.expenseAmount,
    vendorField: mappings.vendor,
  }
}

function buildReportDiagnostics(input: {
  dataset: DatasetRecord
  rowCount: number
  rows: DataRow[]
  reportModel: ReportModel
  semanticContext: ReportSemanticContext
  financials: ReportFinancials
  saasAnalysis?: SaasReportAnalysis
}): ReportDiagnostics {
  const analysisKeys = isRecord(input.dataset.analysis) ? Object.keys(input.dataset.analysis) : []
  return {
    datasetId: input.dataset.id,
    filename: input.dataset.fileName,
    persistedRowCount: input.dataset.rowCount,
    loadedRowsLength: input.rows.length,
    analysisRowsLength: input.rows.length,
    rowCount: input.rowCount,
    rowsUsedForKpis: input.rows.length,
    rowsUsedForSummary: input.rowCount,
    reportRowsLength: input.rowCount,
    provenanceRowsLength: input.rowCount,
    dateField: input.semanticContext.dateField,
    expenseCategoryField: input.semanticContext.expenseCategoryField,
    expenseAmountField: input.semanticContext.expenseAmountField,
    vendorField: input.semanticContext.vendorField,
    revenueField: input.semanticContext.revenueField,
    netProfitField: input.semanticContext.netProfitField,
    validDateCount: validValueCount(input.rows, input.semanticContext.dateField, isValidDateValue),
    validNetProfitCount: validValueCount(input.rows, input.semanticContext.netProfitField, (value) => getNumber(value) !== null),
    validExpenseCategoryCount: validValueCount(input.rows, input.semanticContext.expenseCategoryField, (value) => String(value || "").trim().length > 0),
    validExpenseAmountCount: validValueCount(input.rows, input.semanticContext.expenseAmountField, (value) => getNumber(value) !== null),
    validVendorCount: validValueCount(input.rows, input.semanticContext.vendorField, (value) => String(value || "").trim().length > 0),
    trendAvailable: input.reportModel === "saas" || input.reportModel === "startup"
      ? Boolean(input.saasAnalysis && hasSaasTrendForDiagnostics(input.saasAnalysis))
      : input.reportModel === "ecommerce"
      ? hasRevenueOrRecurringTrendForDiagnostics(input.financials)
      : hasTrendDataForDiagnostics(input.financials),
    analysisObjectKeys: analysisKeys,
    reportInputKeys: [
      "businessModel",
      "reportType",
      "summary",
      "findings",
      "kpis",
      "charts",
      "financials",
      "reportProfile",
      "aiInsights",
      "predictions",
      "recommendations",
      "retailAnalysis",
      "saasAnalysis",
      "alerts",
      "bbsc",
      "semanticContext",
      "diagnostics",
      "rowCount",
      "columns",
    ],
    templateName: "executive-bi-report",
  }
}

function hasTrendDataForDiagnostics(financials: ReportFinancials) {
  const trends = financials.periodTrends || []
  const validNetProfitCount = trends.filter((trend) => trend.netProfit !== null).length
  return trends.length > 0 && validNetProfitCount > 0
}

function hasRevenueOrRecurringTrendForDiagnostics(financials: ReportFinancials) {
  const trends = financials.periodTrends || []
  return trends.filter((trend) => trend.revenue !== null).length >= 2
}

function hasSaasTrendForDiagnostics(saas: SaasReportAnalysis) {
  return [
    saas.mrrTrend,
    saas.arrTrend,
    saas.customerTrend,
    saas.newCustomerTrend,
    saas.churnTrend,
    saas.expansionTrend,
    saas.contractionTrend,
    saas.activeUserTrend,
    saas.burnTrend,
    saas.cashTrend,
    saas.runwayTrend,
  ].some((trend) => trend.length >= 2)
}

function validValueCount(rows: DataRow[], column: string | null, predicate: (value: unknown) => boolean) {
  if (!column) return 0
  return rows.filter((row) => predicate(row[column])).length
}

function isValidDateValue(value: unknown) {
  return Boolean(periodKey(value))
}

function traceReportRuntime(moduleName: string, details: Record<string, unknown>) {
  debugLog("[REPORT TRACE]", moduleName, details)
}

function buildKpis(model: ReportModel, rows: DataRow[], columns: ColumnMap, financials: ReportFinancials, retail?: RetailReportAnalysis, ecommerce?: EcommerceReportAnalysis, saas?: SaasReportAnalysis, marketplace?: MarketplaceReportAnalysis): ReportKpi[] {
  const revenue = financials.revenue ?? sumColumn(rows, columns.gmv)
  const cost = sumColumn(rows, columns.cost)
  const profit = financials.netProfit ?? financials.grossProfit
  const quantity = sumColumn(rows, columns.quantity)
  const orders = columns.order ? uniqueCount(rows, columns.order) : quantity
  const customers = columns.customer ? uniqueCount(rows, columns.customer) : null
  const kpis: ReportKpi[] = []

  addKpi(kpis, "Revenue", revenue, "currency")
  addKpi(kpis, "Profit", profit, "currency")

  if (model === "local_retail") {
    kpis.length = 0
    addKpi(kpis, "Revenue", financials.revenue, "currency")
    addKpi(kpis, "Gross Profit", financials.grossProfit, "currency")
    addKpi(kpis, "Gross Margin", financials.grossMargin, "percent")
    addKpi(kpis, "Units Sold", quantity, "number")
    addKpi(kpis, "Current Stock", retail?.currentStock ?? sumColumn(rows, columns.stock), "number")
    addKpi(kpis, "Inventory Value", retail?.inventoryValue ?? null, "currency")
    addKpi(kpis, "Products / SKUs", retail?.productCount ?? (columns.product ? uniqueCount(rows, columns.product) : null), "number")
    addKpi(kpis, "Low Stock SKUs", retail?.lowStockSkuCount ?? countLowStock(rows, columns), "number")
    addKpi(kpis, "Reorder Required", retail?.reorderRequiredCount ?? countLowStock(rows, columns), "number")
    addKpi(kpis, "Out of Stock", retail?.outOfStockSkuCount ?? null, "number")
    addKpi(kpis, "AOV", retail?.averageOrderValue?.status === "available" ? retail.averageOrderValue.value : null, "currency")
  } else if (model === "ecommerce") {
    kpis.length = 0
    addKpi(kpis, "Revenue", revenue, "currency")
    addKpi(kpis, "Orders", ecommerce?.orders ?? orders, "number")
    addKpi(kpis, "AOV", ecommerce?.averageOrderValue ?? null, "currency")
    addKpi(kpis, "Customers", ecommerce?.customers ?? customers, "number")
    addKpi(kpis, "Orders per Customer", ecommerce?.ordersPerCustomer ?? null, "number")
    addKpi(kpis, "Revenue per Customer", ecommerce?.revenuePerCustomer ?? null, "currency")
    addKpi(kpis, "Units Sold", ecommerce?.unitsSold ?? quantity, "number")
    addKpi(kpis, "Products", ecommerce?.products ?? null, "number")
    addKpi(kpis, "Return Rate", ecommerce?.returnRate ?? null, "percent")
    addKpi(kpis, "Shipping / Fulfillment Cost", ecommerce?.shippingCost ?? null, "currency")
    addKpi(kpis, "Shipping Cost % of Revenue", ecommerce?.shippingCostRate ?? null, "percent")
    addKpi(kpis, "Average Shipping Cost per Order", ecommerce?.averageShippingCostPerOrder ?? null, "currency")
    addKpi(kpis, "Total Discounts", ecommerce?.discounts ?? null, "currency")
    addKpi(kpis, "Discount % of Revenue", ecommerce?.discountRate ?? null, "percent")
  } else if (model === "saas" || model === "startup") {
    kpis.length = 0
    addKpi(kpis, "MRR", saas?.mrr ?? null, "currency")
    addKpi(kpis, "ARR", saas?.arr ?? null, "currency")
    addKpi(kpis, "Customers", saas?.customers ?? customers, "number")
    addKpi(kpis, "New Customers", saas?.newCustomers ?? null, "number")
    addKpi(kpis, "Churned Customers", saas?.churnedCustomers ?? null, "number")
    addKpi(kpis, "Churn Rate", saas?.churnRate ?? null, "percent")
    addKpi(kpis, "Expansion MRR", saas?.expansionMrr ?? null, "currency")
    addKpi(kpis, "Contraction MRR", saas?.contractionMrr ?? null, "currency")
    addKpi(kpis, "Net Expansion MRR", saas?.netExpansionMrr ?? null, "currency")
    addKpi(kpis, "CAC", saas?.cac ?? null, "currency")
    addKpi(kpis, "LTV", saas?.ltv ?? null, "currency")
    addKpi(kpis, "LTV/CAC", saas?.ltvToCac ?? null, "number")
    addKpi(kpis, "Active Users", saas?.activeUsers ?? null, "number")
    addKpi(kpis, "Support Tickets", saas?.supportTickets ?? null, "number")
    addKpi(kpis, "Burn", saas?.burn ?? null, "currency")
    addKpi(kpis, "Cash Balance", saas?.cashBalance ?? null, "currency")
    addKpi(kpis, "Runway", saas?.runwayMonths ?? null, "number")
  } else if (model === "investor") {
    addKpi(kpis, "Invested capital", sumColumn(rows, columns.investedAmount), "currency")
    addKpi(kpis, "Portfolio valuation", sumColumn(rows, columns.valuation), "currency")
    addKpi(kpis, "Average ownership", averageColumn(rows, columns.ownership), "percent")
  } else if (model === "marketplace") {
    kpis.length = 0
    addKpi(kpis, "GMV", marketplace?.gmv ?? null, "currency")
    addKpi(kpis, "Marketplace Revenue", marketplace?.marketplaceRevenue ?? null, "currency")
    addKpi(kpis, "Take Rate", marketplace?.takeRate ?? null, "percent")
    addKpi(kpis, "Transactions", marketplace?.transactions ?? null, "number")
    addKpi(kpis, "Average Transaction Value", marketplace?.averageTransactionValue ?? null, "currency")
    addKpi(kpis, "Buyers", marketplace?.buyers ?? null, "number")
    addKpi(kpis, "Sellers", marketplace?.sellers ?? null, "number")
    addKpi(kpis, "Refund Amount", marketplace?.refunds ?? null, "currency")
    addKpi(kpis, "Refund Rate", marketplace?.refundRate ?? null, "percent")
  } else if (model === "business_consulting") {
    const consultantCost = sumColumn(rows, columns.consultantCost)
    const otherCost = sumColumn(rows, columns.otherCost)
    const totalProjectCost = consultantCost !== null && otherCost !== null ? consultantCost + otherCost : consultantCost ?? otherCost
    const grossProfitVal = financials.grossProfit ?? (revenue !== null && totalProjectCost !== null ? revenue - totalProjectCost : null)
    const grossMarginVal = financials.grossMargin ?? (revenue !== null && grossProfitVal !== null ? (grossProfitVal / revenue) * 100 : null)
    kpis.length = 0
    addKpi(kpis, "Revenue", revenue, "currency")
    addKpi(kpis, "Consultant Cost", consultantCost, "currency")
    addKpi(kpis, "Other Cost", otherCost, "currency")
    addKpi(kpis, "Total Project Cost", totalProjectCost, "currency")
    addKpi(kpis, "Gross Profit", grossProfitVal, "currency")
    addKpi(kpis, "Gross Margin", grossMarginVal, "percent")
    addKpi(kpis, "Projects", columns.projectId ? uniqueCount(rows, columns.projectId) : rows.length, "number")
    addKpi(kpis, "Clients", columns.customer ? uniqueCount(rows, columns.customer) : customers, "number")
    addKpi(kpis, "Consultants", columns.consultantId ? uniqueCount(rows, columns.consultantId) : null, "number")
    addKpi(kpis, "Billable Hours", sumColumn(rows, columns.billableHours), "number")
  } else if (model === "professional_services") {
    const freelancerCost = sumColumn(rows, columns.freelancerCost)
    const adSpend = sumColumn(rows, columns.adSpend)
    const totalDirectCost = freelancerCost !== null && adSpend !== null ? freelancerCost + adSpend : freelancerCost ?? adSpend
    const grossProfitVal = financials.grossProfit ?? (revenue !== null && totalDirectCost !== null ? revenue - totalDirectCost : null)
    const grossMarginVal = financials.grossMargin ?? (revenue !== null && grossProfitVal !== null ? (grossProfitVal / revenue) * 100 : null)
    const hours = sumColumn(rows, columns.billableHours)
    const leads = sumColumn(rows, columns.leadCount)
    const conversions = sumColumn(rows, columns.conversionCount)
    const conversionRate = leads !== null && conversions !== null && leads > 0 ? (conversions / leads) * 100 : null
    kpis.length = 0
    addKpi(kpis, "Revenue", revenue, "currency")
    addKpi(kpis, "Freelancer Cost", freelancerCost, "currency")
    addKpi(kpis, "Ad Spend", adSpend, "currency")
    addKpi(kpis, "Total Direct Cost", totalDirectCost, "currency")
    addKpi(kpis, "Gross Profit", grossProfitVal, "currency")
    addKpi(kpis, "Gross Margin", grossMarginVal, "percent")
    addKpi(kpis, "Campaigns", columns.campaignId ? uniqueCount(rows, columns.campaignId) : rows.length, "number")
    addKpi(kpis, "Clients", columns.customer ? uniqueCount(rows, columns.customer) : null, "number")
    addKpi(kpis, "Hours", hours, "number")
    addKpi(kpis, "Leads", leads, "number")
    addKpi(kpis, "Conversions", conversions, "number")
    addKpi(kpis, "Conversion Rate", conversionRate, "percent")
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

function buildCharts(model: ReportModel, rows: DataRow[], columns: ColumnMap, retail?: RetailReportAnalysis, ecommerce?: EcommerceReportAnalysis, saas?: SaasReportAnalysis, marketplace?: MarketplaceReportAnalysis): ReportChart[] {
  const charts: ReportChart[] = []
  if (model === "local_retail" && retail) {
    if (retail.topProductsByRevenue.length > 0) charts.push({ type: "bar", title: "Top products by revenue", data: retail.topProductsByRevenue })
    if (retail.revenueByCategory.length > 0) charts.push({ type: "bar", title: "Revenue by category", data: retail.revenueByCategory })
    if (retail.supplierExposure.length > 0) charts.push({ type: "bar", title: "Supplier revenue exposure", data: retail.supplierExposure })
    if (retail.stockByCategory.length > 0) charts.push({ type: "bar", title: "Stock by category", data: retail.stockByCategory })
    return charts.slice(0, 4)
  }
  if (model === "investor") {
    const sectorRevenue = groupedChart(rows, columns.sector, columns.revenue, "Top Sector by Portfolio Revenue")
    const sectorInvested = groupedChart(rows, columns.sector, columns.investedAmount || columns.valuation, "Top Sector by Invested Capital")
    const stage = groupedChart(rows, columns.stage, columns.investedAmount || columns.valuation, "Stage allocation")
    if (sectorRevenue) charts.push(sectorRevenue)
    if (sectorInvested) charts.push(sectorInvested)
    if (stage) charts.push(stage)
    return charts.slice(0, 4)
  }
  const productChart = groupedChart(rows, columns.product || columns.category, columns.revenue || columns.quantity, "Top products or categories")
  if (productChart) charts.push(productChart)

  if (model === "ecommerce") {
    if (ecommerce?.revenueTrend.length) charts.push({ type: "line", title: "Revenue Trend", data: ecommerce.revenueTrend })
    if (ecommerce?.categoryPerformance.length) charts.push({ type: "bar", title: "Category Performance", data: ecommerce.categoryPerformance })
    if (ecommerce?.channelPerformance.length) charts.push({ type: "bar", title: "Channel Performance", data: ecommerce.channelPerformance.map(({ name, value }) => ({ name, value })) })
    if (ecommerce?.geography.length) charts.push({ type: "bar", title: "Geography", data: ecommerce.geography.map(({ name, value }) => ({ name, value })) })
  } else if ((model === "saas" || model === "startup") && saas) {
    if (saas.mrrTrend.length) charts.push({ type: "line", title: "MRR Trend", data: saas.mrrTrend })
    if (saas.arrTrend.length) charts.push({ type: "line", title: "ARR Trend", data: saas.arrTrend })
    if (saas.planPerformance.length) charts.push({ type: "bar", title: "MRR by Plan", data: saas.planPerformance.map((item) => ({ name: item.name, value: item.mrr || 0 })) })
    if (saas.geography.length) charts.push({ type: "bar", title: "MRR by Country", data: saas.geography.map((item) => ({ name: item.name, value: item.mrr || 0 })) })
  } else if (model === "marketplace" && marketplace) {
    if (marketplace.gmvTrend.length) charts.push({ type: "line", title: "GMV Trend", data: marketplace.gmvTrend })
    if (marketplace.marketplaceRevenueTrend.length) charts.push({ type: "line", title: "Marketplace Revenue Trend", data: marketplace.marketplaceRevenueTrend })
    if (marketplace.refundTrend.length) charts.push({ type: "line", title: "Refund Trend", data: marketplace.refundTrend })
    if (marketplace.categoryPerformance.length) charts.push({ type: "bar", title: "GMV by Category", data: marketplace.categoryPerformance })
    if (marketplace.geography.length) charts.push({ type: "bar", title: "GMV by Country", data: marketplace.geography })
    const seller = groupedChart(rows, columns.seller, columns.gmv || columns.commission, "Seller performance")
    if (seller) charts.push(seller)
  } else if (model === "business_consulting") {
    const industryChart = groupedChart(rows, columns.industry, columns.revenue, "Top Industry by Revenue")
    if (industryChart) charts.push(industryChart)
    const clients = groupedChart(rows, columns.customer, columns.revenue, "Top Client by Revenue")
    if (clients) charts.push(clients)
    return charts.slice(0, 4)
  } else if (model === "accountancy" || model === "prebookkeeping") {
    const accounts = groupedChart(rows, columns.account, columns.debit || columns.credit || columns.revenue, "Account activity")
    if (accounts) charts.push(accounts)
  }

  return charts.slice(0, 4)
}

function buildFindings(model: ReportModel, rowCount: number, columns: ColumnMap, kpis: ReportKpi[], retail?: RetailReportAnalysis, ecommerce?: EcommerceReportAnalysis, saas?: SaasReportAnalysis, marketplace?: MarketplaceReportAnalysis) {
  const findings = [`The selected dataset contains ${rowCount.toLocaleString()} loaded rows for ${reportModelLabel(model).toLowerCase()} analysis.`]
  if (kpis.some((kpi) => kpi.title === "Revenue")) findings.push("Revenue is available from a recognized source field in this dataset.")
  if (model !== "local_retail" && model !== "ecommerce" && model !== "saas" && model !== "startup" && model !== "business_consulting" && model !== "professional_services" && !columns.cogs && !columns.operatingExpenses && !columns.interestExpense && !columns.taxExpense) findings.push("Profitability and expense analysis are limited because recognized cost fields are missing.")
  if (model === "business_consulting" && !columns.consultantCost && !columns.otherCost) findings.push("Project cost analysis is limited because consultant_cost and other_cost fields are not recognized.")
  if (!hasTrendFields(columns)) findings.push("Trend analysis is unavailable because no recognized date or period field exists.")
  if (model === "local_retail") {
    findings.push("Retail KPIs prioritize revenue, gross profit, gross margin, unit sales, inventory value, stock levels, reorder risk, products, categories, and suppliers.")
    if (columns.stock) findings.push("Inventory and reorder-risk checks are included from stock columns.")
    if (retail?.supplierExposure.length) findings.push("Supplier intelligence uses only supplier values present in the selected dataset.")
  }
  if (model === "ecommerce") {
    if (columns.order) findings.push("Orders and Average Order Value use distinct recognized order IDs.")
    if (columns.customer) findings.push("Customer metrics use distinct customer identifiers from the selected dataset.")
    if (columns.category) findings.push("Category is treated as product/category performance, not an expense category.")
    if (columns.shippingCost) findings.push("Shipping and fulfillment cost is analyzed separately from COGS.")
    if (columns.returnStatus && ecommerce?.returnRate !== null) findings.push("Returns are calculated from return-status values present in the dataset.")
    if (columns.channel) findings.push("Channel performance uses only source channel values.")
    if (!columns.cogs) findings.push("Gross profit and gross margin are unavailable because no authoritative product COGS field exists.")
    if (columns.country || columns.region) findings.push("Geography uses only country or region values present in this dataset.")
  }
  if ((model === "saas" || model === "startup") && saas) {
    if (saas.mrr !== null || saas.arr !== null) findings.push("Recurring revenue metrics are included from SaaS MRR/ARR columns.")
    if (saas.customerField) findings.push("Customer metrics use distinct customer identifiers from the selected dataset.")
    if (saas.periodField && saas.mrrTrend.length >= 2) findings.push("SaaS trend analysis uses the recognized period field and recurring-revenue metrics.")
    if (columns.plan) findings.push("Plan is treated as subscription-plan segmentation, not an expense category.")
    if (columns.country || columns.region) findings.push("SaaS geography uses only country or region values present in this dataset.")
  }
  if (model === "marketplace" && marketplace) {
    findings.push("Marketplace KPIs use GMV, platform revenue, take rate, seller payout, refunds, transactions, buyers, sellers, and marketplace economics where columns exist.")
    if (columns.gmv) findings.push("GMV is recognized from gross merchandise value columns.")
    if (columns.commission) findings.push("Marketplace revenue is recognized from platform fee or commission columns.")
    if (columns.refund) findings.push("Refunds are treated as refund economics, not revenue.")
    if (columns.buyer && columns.seller) findings.push("Buyer and seller sides are analyzed separately.")
    if (columns.category || columns.country) findings.push("Category and geography segmentation use marketplace economics.")
  }
  if (model === "investor" && columns.valuation) findings.push("Portfolio valuation and allocation metrics are included.")
  if (model === "business_consulting" && columns.billableHours) findings.push("Billable-hour and project-margin metrics are included.")
  if (model === "business_consulting" && (columns.consultantCost || columns.otherCost)) findings.push("Project costs are recognized from consultant_cost and other_cost fields.")
  if (model === "business_consulting" && (columns.projectStart || columns.projectEnd)) findings.push("Reporting period is derived from project_start and project_end dates.")
  if (model === "professional_services" && (columns.freelancerCost || columns.adSpend)) findings.push("Direct costs are recognized from freelancer_cost and ad_spend fields. Gross profitability is available.")
  if (model === "professional_services" && columns.campaignId) findings.push("Campaign-based analysis is included from campaign_id field.")
  if (model === "professional_services" && (columns.freelancerCost || columns.adSpend)) findings.push("Direct costs are recognized from freelancer_cost and ad_spend fields.")
  if (model === "professional_services" && columns.serviceLine) findings.push("Service line segmentation is available from service_line field.")
  if (model === "professional_services" && columns.channel) findings.push("Channel performance is tracked from channel field.")
  if (model === "professional_services" && (columns.leadCount || columns.conversionCount)) findings.push("Lead and conversion metrics are available for campaign effectiveness analysis.")
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

function snapshotColumn(rows: DataRow[], column: string, dateColumn?: string): { value: number | null; latest: boolean } {
  if (!column) return { value: null, latest: false }
  let found = false
  let sum = 0
  let max = -Infinity
  const distinct = new Set<number>()
  for (const row of rows) {
    const value = getNumber(row[column])
    if (value === null) continue
    found = true
    sum += value
    if (value > max) max = value
    distinct.add(value)
  }
  if (!found) return { value: null, latest: false }
  const isSnapshot = distinct.size < rows.length / 2 && sum > max * (rows.length / Math.max(distinct.size, 1))
  if (!isSnapshot) return { value: sum, latest: false }
  const periodRows = dateColumn ? latestPeriodRows(rows, dateColumn).rows : rows
  let snapshotValue = max
  for (let i = periodRows.length - 1; i >= 0; i--) {
    const value = getNumber(periodRows[i][column])
    if (value !== null) {
      snapshotValue = value
      break
    }
  }
  for (const row of periodRows) {
    const value = getNumber(row[column])
    if (value !== null && value > snapshotValue) snapshotValue = value
  }
  return { value: snapshotValue, latest: true }
}

function sumCogs(rows: DataRow[], columns: ColumnMap) {
  if (!columns.cogs) return null
  let total = 0
  let found = false
  for (const row of rows) {
    const value = rowCogs(row, columns)
    if (value === null) continue
    total += value
    found = true
  }
  return found ? round(total) : null
}

function rowCogs(row: DataRow, columns: ColumnMap) {
  if (!columns.cogs) return null
  const cost = getNumber(row[columns.cogs])
  if (cost === null) return null
  if (!isUnitCostColumn(columns.cogs)) return cost
  const quantity = columns.quantity ? getNumber(row[columns.quantity]) : null
  return quantity !== null ? cost * quantity : null
}

function rowUnitCost(row: DataRow, columns: ColumnMap) {
  if (!columns.cost) return null
  const cost = getNumber(row[columns.cost])
  if (cost === null) return null
  if (isUnitCostColumn(columns.cost)) return cost
  const quantity = columns.quantity ? getNumber(row[columns.quantity]) : null
  return quantity && quantity > 0 ? cost / quantity : cost
}

function isUnitCostColumn(column: string) {
  const normalized = column.toLowerCase().trim().replace(/[\s-]+/g, "_")
  return /^(unit_cost|cost_per_unit|per_unit_cost|unit_purchase_cost|supplier_unit_cost|vendor_unit_cost)$/.test(normalized)
}

function cogsCalculationSource(columns: ColumnMap) {
  if (!columns.cogs) return "unavailable"
  if (isUnitCostColumn(columns.cogs)) {
    return columns.quantity ? `${columns.cogs} x ${columns.quantity}` : `${columns.cogs} requires quantity`
  }
  return columns.cogs
}

function retailAverageOrderValue(rows: DataRow[], columns: ColumnMap, revenue: number | null) {
  if (revenue === null || revenue <= 0) {
    return {
      metric: "average_order_value" as const,
      value: null,
      aovStatus: "not_available" as const,
      status: "not_available" as const,
      orderCount: null,
      orderCountSource: null,
      calculationMethod: "requires positive total_revenue",
      sourceFields: columns.revenue ? [columns.revenue] : [],
      confidence: "low" as const,
    }
  }
  if (columns.order && isOrderIdentifierColumn(columns.order)) {
    const distinctOrders = uniqueCount(rows, columns.order)
    if (distinctOrders > 0) {
      return {
        metric: "average_order_value" as const,
        value: round(revenue / distinctOrders),
        aovStatus: "available" as const,
        status: "available" as const,
        orderCount: distinctOrders,
        orderCountSource: "distinct_order_id" as const,
        calculationMethod: "total_revenue / distinct_order_id",
        sourceFields: [columns.revenue, columns.order].filter((field): field is string => Boolean(field)),
        confidence: "high" as const,
      }
    }
  }
  return {
    metric: "average_order_value" as const,
    value: null,
    aovStatus: "not_available" as const,
    status: "not_available" as const,
    orderCount: null,
    orderCountSource: null,
    calculationMethod: "No reliable order identifier or order-level transaction grain detected.",
    sourceFields: columns.revenue ? [columns.revenue] : [],
    confidence: "low" as const,
  }
}

function isOrderIdentifierColumn(column: string) {
  const normalized = column.toLowerCase().trim().replace(/[\s-]+/g, "_")
  return /^(order_id|order_number|transaction_id|transaction_number|sale_id|receipt_id)$/.test(normalized)
}

function retailCategoryTotalsReconcile(
  rows: DataRow[],
  columns: ColumnMap,
  totals: { totalRevenue: number; totalCogs: number; totalGrossProfit: number },
) {
  const totalRevenue = sumColumn(rows, columns.revenue) ?? 0
  const totalCogs = sumCogs(rows, columns) ?? 0
  const totalGrossProfit = totalRevenue - totalCogs
  return withinTolerance(totals.totalRevenue, totalRevenue)
    && withinTolerance(totals.totalCogs, totalCogs)
    && withinTolerance(totals.totalGrossProfit, totalGrossProfit)
}

function withinTolerance(actual: number, expected: number) {
  return Math.abs(actual - expected) < 0.01
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

function uniqueCountWhere(rows: DataRow[], column: string | undefined, predicate: (row: DataRow) => boolean) {
  const values = new Set<string>()
  let fallbackCount = 0
  for (const row of rows) {
    if (!predicate(row)) continue
    if (!column) {
      fallbackCount += 1
      continue
    }
    const value = String(row[column] || "").trim()
    if (value) values.add(value)
  }
  return column ? values.size : fallbackCount
}

function churnRate(rows: DataRow[], column?: string) {
  if (!column || rows.length === 0) return null
  const statuses = rows.map((row) => normalizeBooleanStatus(row[column])).filter((status) => status !== "unknown")
  if (statuses.length === 0) return null
  const churned = statuses.filter((status) => status === "positive").length
  return round((churned / statuses.length) * 100)
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

function hasTrendFields(columns: ColumnMap) {
  return Boolean(columns.date || columns.projectStart || columns.projectEnd)
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
