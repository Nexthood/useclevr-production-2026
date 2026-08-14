import { calculateBusinessBalancedScorecard } from "@/lib/business/balanced-scorecard"
import { resolveBusinessModel, type BusinessModel } from "@/lib/data/business-model"
import { loadDatasetData } from "@/lib/data/dataset-access"
import { resolveDatasetType, type DatasetCategory } from "@/lib/data/dataset-category"
import type { datasets } from "@/lib/db/schema"
import { debugLog } from "@/lib/utils/debug"
import { ReportIntegrityError } from "@/lib/reports/report-generator"
import type { ReportChart, ReportDiagnostics, ReportFinancials, ReportRecommendation, ReportSemanticContext } from "@/lib/reports/report-generator"

type DatasetRecord = typeof datasets.$inferSelect
type DataRow = Record<string, unknown>
type ReportModel = BusinessModel | DatasetCategory | "business_consulting"
type ReportKpi = { title: string; value: number; format: "currency" | "number" | "percent" }
type MetricSource = "source_value" | "derived_value" | "unavailable"
type FinancialMetric = { value: number | null; source: MetricSource; note: string }

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
  channel?: string
  product?: string
  category?: string
  date?: string
  expenseCategory?: string
  expenseAmount?: string
  vendor?: string
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
  const kpis = buildKpis(reportModel, rows, columnMap, financials)
  const charts = buildCharts(reportModel, rows, columnMap)
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
  const findings = buildFindings(reportModel, canonicalRowCount, columnMap, kpis)
  const bbsc = calculateBusinessBalancedScorecard({ rows, columns, businessModel: reportModel })
  const recommendations = buildDatasetRecommendations(columnMap, financials, bbsc)
  const diagnostics = buildReportDiagnostics({
    dataset,
    rowCount: canonicalRowCount,
    rows,
    semanticContext,
    financials,
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
    summary: buildDatasetSummary(dataset.name, reportModel, canonicalRowCount, columnMap, financials, bbsc),
    findings,
    kpis,
    charts,
    financials,
    aiInsights: extractInsights(dataset.analysis),
    predictions: [],
    recommendations,
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
      requiredData: financials.missingFields,
    })
  }
  return recommendations.slice(0, 5)
}

function buildGenericFinancials(rows: DataRow[], columns: ColumnMap): ReportFinancials {
  const revenue = sourceMetric(sumColumn(rows, columns.revenue) ?? sumColumn(rows, columns.gmv), columns.revenue || columns.gmv)
  const cogs = sourceMetric(sumColumn(rows, columns.cogs), columns.cogs)
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
    grossProfit: findColumn(columns, [/gross_profit/, /grossprofit/]),
    operatingProfit: findColumn(columns, [/operating_profit/, /operatingprofit/, /ebit\b/]),
    netProfit: findColumn(columns, [/net_profit/, /netprofit/, /^profit$/, /profit_loss/]),
    cogs: findColumn(columns, [/^cogs$/, /cost_of_goods/, /cost_of_sales/]),
    operatingExpenses: findColumn(columns, [/operating_expenses/, /^opex$/, /sg_a/, /sga/]),
    interestExpense: findColumn(columns, [/interest_expense/, /^interest$/]),
    taxExpense: findColumn(columns, [/tax_expense/, /^tax$/, /taxes/]),
    profit: findColumn(columns, [/net_profit/, /gross_profit/, /operating_profit/, /^profit$/]),
    quantity: findColumn(columns, [/quantity/, /^qty$/, /units_sold/, /units/]),
    order: findColumn(columns, [/order_id/, /^order$/, /transaction/, /invoice/]),
    customer: findColumn(columns, [/customer_id/, /customer/, /client_id/, /client/]),
    country: findColumn(columns, [/country/, /region/, /location/]),
    channel: findColumn(columns, [/channel/, /source/]),
    product: findColumn(columns, [/product_id/, /product/, /^sku$/, /item/]),
    category: findColumn(columns, [/category/, /sector/, /industry/]),
    date: findColumn(columns, [/date/, /month/, /period/, /created_at/]),
    expenseCategory: findColumn(columns, [/expense_category/, /expensecategory/, /cost_category/, /costcategory/, /category/]),
    expenseAmount: findColumn(columns, [/expense_amount/, /expenseamount/, /cost_amount/, /costamount/, /amount/]),
    vendor: findColumn(columns, [/vendor_supplier/, /vendorsupplier/, /^vendor$/, /supplier/, /merchant/]),
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

function buildSemanticContext(input: {
  datasetId: string
  datasetType: string
  columnMap: ColumnMap
}): ReportSemanticContext {
  const mappings: Record<string, string | null> = {
    date: input.columnMap.date || null,
    revenue: input.columnMap.revenue || input.columnMap.gmv || null,
    cogs: input.columnMap.cogs || null,
    grossProfit: input.columnMap.grossProfit || null,
    operatingExpenses: input.columnMap.operatingExpenses || null,
    operatingProfit: input.columnMap.operatingProfit || null,
    interestExpense: input.columnMap.interestExpense || null,
    taxExpense: input.columnMap.taxExpense || null,
    netProfit: input.columnMap.netProfit || null,
    expenseCategory: input.columnMap.expenseCategory || null,
    expenseAmount: input.columnMap.expenseAmount || null,
    vendor: input.columnMap.vendor || null,
  }
  const required = ["date", "revenue", "netProfit", "expenseCategory", "expenseAmount", "vendor"]
  const available = required.filter((key) => Boolean(mappings[key])).length
  return {
    datasetId: input.datasetId,
    datasetType: input.datasetType,
    mappings,
    confidence: Math.round((available / required.length) * 100),
    dateField: mappings.date,
    revenueField: mappings.revenue,
    netProfitField: mappings.netProfit,
    costFields: [
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
  semanticContext: ReportSemanticContext
  financials: ReportFinancials
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
    trendAvailable: hasTrendDataForDiagnostics(input.financials),
    analysisObjectKeys: analysisKeys,
    reportInputKeys: [
      "businessModel",
      "reportType",
      "summary",
      "findings",
      "kpis",
      "charts",
      "financials",
      "aiInsights",
      "predictions",
      "recommendations",
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

function buildKpis(model: ReportModel, rows: DataRow[], columns: ColumnMap, financials: ReportFinancials): ReportKpi[] {
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

function buildFindings(model: ReportModel, rowCount: number, columns: ColumnMap, kpis: ReportKpi[]) {
  const findings = [`The selected dataset contains ${rowCount.toLocaleString()} loaded rows for ${reportModelLabel(model).toLowerCase()} analysis.`]
  if (kpis.some((kpi) => kpi.title === "Revenue")) findings.push("Revenue is available from a recognized source field in this dataset.")
  if (!columns.cogs && !columns.operatingExpenses && !columns.interestExpense && !columns.taxExpense) findings.push("Profitability and expense analysis are limited because recognized cost fields are missing.")
  if (!hasTrendFields(columns)) findings.push("Trend analysis is unavailable because no recognized date or period field exists.")
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

function hasTrendFields(columns: ColumnMap) {
  return Boolean(columns.date)
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
