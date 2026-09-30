import { resolveProfitabilitySchema } from "./schema-resolver"
import {
  normalizeRevenueFromResolution,
  normalizeExpenseFromResolution,
  type MappingDiagnostics,
  type NormalizedRevenueRecord,
  type NormalizedExpenseRecord,
} from "./normalized-model"
import { monthKey as monthKeyFromValue } from "./analysis-value-utils"

export type ProfitabilityFileRole = "revenue" | "expenses"
export type ProfitabilityStatus =
  | "waiting_for_expenses"
  | "waiting_for_revenue"
  | "matching_files"
  | "calculating"
  | "ready"
  | "failed"

export type ProfitabilitySourceFile = {
  role: ProfitabilityFileRole
  name: string
  columns: string[]
  rows: Record<string, unknown>[]
  rowCount?: number
  operatingExpenseCoverage?: "complete" | "partial"
}

export type ProfitabilityMetrics = {
  profitabilityAnalysisId: string
  status: ProfitabilityStatus
  statusLabel: string
  fileRole?: ProfitabilityFileRole
  hasRevenue: boolean
  hasExpenses: boolean
  hasBothFiles: boolean
  operatingExpenseCoverage: "complete" | "partial" | "unavailable"
  reportingPeriod: string | null
  revenueGrowth: number | null
  totalRevenue: number | null
  salesVolume: number | null
  customerCount: number | null
  cogs: number | null
  operatingExpenses: number | null
  interestExpense: number | null
  taxExpense: number | null
  totalExpenses: number | null
  grossProfit: number | null
  operatingProfit: number | null
  netProfit: number | null
  profit: number | null
  grossMargin: number | null
  operatingMargin: number | null
  netMargin: number | null
  margin: number | null
  expenseCategories: [string, number][]
  topCostCategories: [string, number][]
  revenueByProduct: [string, number][]
  revenueByRegion: [string, number][]
  revenueByMonth: Record<string, number>
  periodTrends: Array<{
    period: string
    department?: string
    revenue: number
    cogs: number | null
    operatingExpenses: number | null
    interestExpense: number | null
    taxExpense: number | null
    grossProfit: number | null
    operatingProfit: number | null
    netProfit: number | null
  }>
  departmentComparison: Array<{
    department: string
    revenue: number
    expenses: number
    grossProfit: number
    netProfit: number
    netMargin: number | null
  }>
  matchKey: string | null
  missingColumns: string[]
  unavailableMetrics: string[]
  dataConfidence: number
  dataQualityNotes: string[]
  metricSources: Partial<Record<"revenue" | "cogs" | "operatingExpenses" | "interestExpense" | "taxExpense" | "grossProfit" | "operatingProfit" | "netProfit" | "grossMargin" | "operatingMargin" | "netMargin", {
    kind: "source_value" | "derived_value" | "unavailable"
    note: string
  }>>
  sourceFiles: Array<{
    role: ProfitabilityFileRole
    name: string
    rowCount: number
    columns: string[]
  }>
  schemaDiagnostics?: {
    revenue: MappingDiagnostics & { warnings: string[] }
    expenses: MappingDiagnostics & { warnings: string[] }
  }
  currencyObservation?: {
    mixed: boolean
    currencies: string[]
    totalsWithheld: boolean
  }
  revenueByCustomer?: [string, number][]
  revenueByCategory?: [string, number][]
  expensesByVendor?: [string, number][]
  expensesByDepartment?: [string, number][]
  expensesByLocation?: [string, number][]
  topCostDrivers?: Array<{ name: string; amount: number; shareOfExpenses: number }>
  costConcentration?: number
  top3CostShare?: number
  revenueExpenseRatio?: number
}

type Bucket = {
  revenue: number
  cogs: number
  operatingExpenses: number
  interestExpense: number
  taxExpense: number
}

export function calculateProfitabilityAnalysis(input: {
  analysisId: string
  revenueFile?: ProfitabilitySourceFile | null
  expensesFile?: ProfitabilitySourceFile | null
  fileRole?: ProfitabilityFileRole
}): ProfitabilityMetrics {
  const revenueFile = input.revenueFile || null
  const expensesFile = input.expensesFile || null
  const hasRevenue = Boolean(revenueFile)
  const hasExpenses = Boolean(expensesFile)
  const hasBothFiles = hasRevenue && hasExpenses
  const operatingExpenseCoverage = hasExpenses
    ? expensesFile?.operatingExpenseCoverage === "partial"
      ? "partial"
      : "complete"
    : "unavailable"

  // One authoritative semantic interpretation: resolve + normalize each file
  // exactly once; everything downstream reads the normalized records.
  const revenueResolution = resolveProfitabilitySchema(revenueFile?.columns || [], revenueFile?.rows || [], "revenue")
  const expenseResolution = resolveProfitabilitySchema(expensesFile?.columns || [], expensesFile?.rows || [], "expenses")
  const revenueNormalized = normalizeRevenueFromResolution(revenueFile?.columns || [], revenueFile?.rows || [], revenueResolution)
  const expenseNormalized = normalizeExpenseFromResolution(expensesFile?.columns || [], expensesFile?.rows || [], expenseResolution)

  const matchKey = chooseMatchKey(revenueResolution.mapping, expenseResolution.mapping)
  const missingColumns: string[] = []
  const unavailableMetrics: string[] = []
  const dataQualityNotes: string[] = []

  for (const warning of [...revenueNormalized.warnings, ...expenseNormalized.warnings]) {
    dataQualityNotes.push(warning.message)
  }

  if (!hasRevenue) missingColumns.push("revenue file")
  if (!hasExpenses) missingColumns.push("expenses file")
  if (hasRevenue && revenueNormalized.records.length === 0) missingColumns.push("revenue amount")
  if (hasExpenses && expenseNormalized.records.length === 0) missingColumns.push("expenses amount")
  if (hasBothFiles && !matchKey) {
    dataQualityNotes.push("No shared period + department, company, or cost center key was detected; totals are combined without row-level matching.")
  }

  const currencyObservation = combineCurrencyObservation(
    revenueNormalized.currency,
    expenseNormalized.currency,
    hasRevenue || hasExpenses,
  )
  if (currencyObservation.totalsWithheld) {
    dataQualityNotes.unshift(`Mixed currencies (${currencyObservation.currencies.join(", ")}) were detected across the Profitability inputs; combined monetary totals are withheld because no conversion data was provided.`)
  }
  const currencySafe = !currencyObservation.totalsWithheld

  const revenueByProduct = new Map<string, number>()
  const revenueByRegion = new Map<string, number>()
  const revenueByCategory = new Map<string, number>()
  const revenueByCustomer = new Map<string, number>()
  const revenueByMonth: Record<string, number> = {}
  const expenseCategories = new Map<string, number>()
  const expensesByVendor = new Map<string, number>()
  const expensesByDepartment = new Map<string, number>()
  const expensesByLocation = new Map<string, number>()
  const periodBuckets = new Map<string, Bucket>()
  const departmentBuckets = new Map<string, Bucket>()
  const customers = new Set<string>()
  let totalRevenue = 0
  let salesVolume = 0
  let foundSalesVolume = false

  for (const record of revenueNormalized.records) {
    const amount = record.amount
    totalRevenue += amount
    if (!currencySafe) continue
    addBucket(periodBuckets, periodBucketKey(record, matchKey)).revenue += amount
    addBucket(departmentBuckets, departmentBucketKey(record)).revenue += amount

    if (record.quantity !== null) {
      salesVolume += record.quantity
      foundSalesVolume = true
    }
    const product = record.product || record.category || record.sku
    if (product) addMapValue(revenueByProduct, product, amount)
    if (record.location) addMapValue(revenueByRegion, record.location, amount)
    if (record.customer) {
      addMapValue(revenueByCustomer, record.customer, amount)
      customers.add(record.customer)
    }
    if (record.category) addMapValue(revenueByCategory, record.category, amount)
    const month = record.date ? monthKeyFromValue(record.date) : ""
    if (month) revenueByMonth[month] = (revenueByMonth[month] || 0) + amount
  }

  let cogs = 0
  let operatingExpenses = 0
  let interestExpense = 0
  let taxExpense = 0
  let foundCogs = false
  let foundOperating = false
  let foundInterest = false
  let foundTax = false

  for (const record of expenseNormalized.records) {
    const amount = record.amount
    const category = record.category || "Uncategorized"
    const kind = classifyExpense(category)
    if (!currencySafe) continue
    addMapValue(expenseCategories, category, amount)
    if (record.vendor) addMapValue(expensesByVendor, record.vendor, amount)
    if (record.department) addMapValue(expensesByDepartment, record.department, amount)
    if (record.location) addMapValue(expensesByLocation, record.location, amount)
    const period = addBucket(periodBuckets, periodBucketKey(record, matchKey))
    const department = addBucket(departmentBuckets, departmentBucketKey(record))

    if (kind === "cogs") {
      cogs += amount
      period.cogs += amount
      department.cogs += amount
      foundCogs = true
    } else if (kind === "interest") {
      interestExpense += amount
      period.interestExpense += amount
      department.interestExpense += amount
      foundInterest = true
    } else if (kind === "tax") {
      taxExpense += amount
      period.taxExpense += amount
      department.taxExpense += amount
      foundTax = true
    } else {
      operatingExpenses += amount
      period.operatingExpenses += amount
      department.operatingExpenses += amount
      foundOperating = true
    }
  }

  const totalsWithheld = currencyObservation.totalsWithheld
  const revenueValue = hasRevenue && revenueNormalized.records.length > 0 && !totalsWithheld ? round(totalRevenue) : null
  const cogsValue = hasExpenses && foundCogs && !totalsWithheld ? round(cogs) : null
  const operatingExpensesValue = hasExpenses && foundOperating && !totalsWithheld ? round(operatingExpenses) : null
  const completeOperatingExpensesValue = operatingExpenseCoverage === "complete" ? operatingExpensesValue : null
  const interestExpenseValue = hasExpenses && foundInterest && !totalsWithheld ? round(interestExpense) : null
  const taxExpenseValue = hasExpenses && foundTax && !totalsWithheld ? round(taxExpense) : null
  const totalExpenses = hasExpenses && expenseNormalized.records.length > 0 && !totalsWithheld
    ? round(cogs + operatingExpenses + interestExpense + taxExpense)
    : null
  const grossProfit = revenueValue !== null && cogsValue !== null ? round(revenueValue - cogsValue) : null
  const operatingProfit = grossProfit !== null && completeOperatingExpensesValue !== null
    ? round(grossProfit - completeOperatingExpensesValue)
    : revenueValue !== null && completeOperatingExpensesValue !== null && cogsValue === null
      ? round(revenueValue - completeOperatingExpensesValue)
      : null
  const netProfit = operatingProfit !== null && interestExpenseValue !== null && taxExpenseValue !== null
    ? round(operatingProfit - interestExpenseValue - taxExpenseValue)
    : revenueValue !== null && totalExpenses !== null && operatingExpenseCoverage === "complete"
      ? round(revenueValue - totalExpenses)
      : null

  if (grossProfit === null) unavailableMetrics.push("grossProfit")
  if (operatingProfit === null) unavailableMetrics.push("operatingProfit")
  if (netProfit === null) unavailableMetrics.push("netProfit")
  if (revenueValue === null || revenueValue <= 0) unavailableMetrics.push("grossMargin", "operatingMargin", "netMargin")

  const revenueGrowth = revenueGrowthFromMonthlyAggregation(revenueByMonth)

  const status: ProfitabilityStatus = !hasRevenue
    ? "waiting_for_revenue"
    : !hasExpenses
      ? "waiting_for_expenses"
      : missingColumns.length > 0 || totalsWithheld
        ? "failed"
        : "ready"

  const expenseCategoryEntries = currencySafe ? sortedEntries(expenseCategories) : []
  const totalExpenseFromCategories = expenseCategoryEntries.reduce((total, [, value]) => total + value, 0)

  return {
    profitabilityAnalysisId: input.analysisId,
    status,
    statusLabel: statusLabel(status, missingColumns, totalsWithheld),
    fileRole: input.fileRole,
    hasRevenue,
    hasExpenses,
    hasBothFiles,
    operatingExpenseCoverage,
    reportingPeriod: currencySafe ? reportingPeriodFromPeriodKeys(periodBuckets) : null,
    revenueGrowth,
    totalRevenue: revenueValue,
    salesVolume: foundSalesVolume && !totalsWithheld ? round(salesVolume) : null,
    customerCount: customers.size > 0 ? customers.size : null,
    cogs: cogsValue,
    operatingExpenses: operatingExpensesValue,
    interestExpense: interestExpenseValue,
    taxExpense: taxExpenseValue,
    totalExpenses,
    grossProfit,
    operatingProfit,
    netProfit,
    profit: netProfit,
    grossMargin: margin(grossProfit, revenueValue),
    operatingMargin: margin(operatingProfit, revenueValue),
    netMargin: margin(netProfit, revenueValue),
    margin: margin(netProfit, revenueValue),
    expenseCategories: expenseCategoryEntries,
    topCostCategories: expenseCategoryEntries,
    revenueByProduct: currencySafe ? sortedEntries(revenueByProduct) : [],
    revenueByRegion: currencySafe ? sortedEntries(revenueByRegion) : [],
    revenueByMonth: currencySafe ? revenueByMonth : {},
    metricSources: {
      revenue: revenueValue !== null ? sourceMeta(revenueAmountSourceNote(revenueResolution)) : unavailableMeta("No recognized revenue source field."),
      cogs: cogsValue !== null ? sourceMeta("COGS source total from selected Expenses input.") : unavailableMeta("No recognized COGS source field."),
      operatingExpenses: operatingExpensesValue !== null
        ? sourceMeta(expenseAmountSourceNote(expenseResolution, cogsValue !== null))
        : unavailableMeta("No recognized operating-expense source rows."),
      interestExpense: interestExpenseValue !== null ? sourceMeta("Interest-expense source total from selected Expenses input.") : unavailableMeta("No recognized interest-expense source rows."),
      taxExpense: taxExpenseValue !== null ? sourceMeta("Tax-expense source total from selected Expenses input.") : unavailableMeta("No recognized tax-expense source rows."),
      grossProfit: grossProfit !== null ? derivedMeta("Revenue minus COGS.") : unavailableMeta("Requires source-backed COGS or explicit gross profit."),
      operatingProfit: operatingProfit !== null
        ? grossProfit !== null
          ? derivedMeta("Gross profit minus operating expenses.")
          : derivedMeta("Revenue minus source-backed operating expenses because COGS is unavailable in the paired Profitability inputs.")
        : unavailableMeta(operatingExpenseCoverage === "partial" ? "Requires a complete operating-expense source before deriving operating profit." : "Requires revenue and source-backed operating expenses, or gross profit and operating expenses."),
      netProfit: netProfit !== null
        ? derivedMeta(operatingProfit !== null && interestExpenseValue !== null && taxExpenseValue !== null ? "Operating profit minus source-backed interest and tax expense." : "Revenue minus source-backed total expenses.")
        : unavailableMeta("Requires source-backed total expenses, or operating profit with interest and tax expense."),
      grossMargin: margin(grossProfit, revenueValue) !== null ? derivedMeta("Gross profit divided by revenue.") : unavailableMeta("Requires gross profit and non-zero revenue."),
      operatingMargin: margin(operatingProfit, revenueValue) !== null ? derivedMeta("Operating profit divided by revenue.") : unavailableMeta("Requires operating profit and non-zero revenue."),
      netMargin: margin(netProfit, revenueValue) !== null ? derivedMeta("Net profit divided by revenue.") : unavailableMeta("Requires net profit and non-zero revenue."),
    },
    periodTrends: currencySafe ? buildPeriodTrends(periodBuckets, { hasCogs: foundCogs, hasOperating: foundOperating, hasCompleteOperatingExpenses: operatingExpenseCoverage === "complete", hasInterest: foundInterest, hasTax: foundTax }) : [],
    departmentComparison: currencySafe ? buildDepartmentComparison(departmentBuckets) : [],
    matchKey,
    missingColumns,
    unavailableMetrics: Array.from(new Set(unavailableMetrics)),
    dataConfidence: confidenceScore(hasRevenue, hasExpenses, revenueResolution, expenseResolution, matchKey, totalsWithheld),
    dataQualityNotes,
    sourceFiles: [revenueFile, expensesFile].filter(Boolean).map((file) => ({
      role: file!.role,
      name: file!.name,
      rowCount: file!.rowCount ?? file!.rows.length,
      columns: file!.columns,
    })),
    schemaDiagnostics: {
      revenue: toSchemaDiagnostics(revenueNormalized.mappingDiagnostics, revenueResolution.warnings),
      expenses: toSchemaDiagnostics(expenseNormalized.mappingDiagnostics, expenseResolution.warnings),
    },
    currencyObservation: {
      mixed: currencyObservation.mixed,
      currencies: currencyObservation.currencies,
      totalsWithheld,
    },
    revenueByCustomer: currencySafe ? sortedEntries(revenueByCustomer) : [],
    revenueByCategory: currencySafe ? sortedEntries(revenueByCategory) : [],
    expensesByVendor: currencySafe ? sortedEntries(expensesByVendor) : [],
    expensesByDepartment: currencySafe ? sortedEntries(expensesByDepartment) : [],
    expensesByLocation: currencySafe ? sortedEntries(expensesByLocation) : [],
    topCostDrivers: expenseCategoryEntries.slice(0, 5).map(([name, value]) => ({
      name,
      amount: value,
      shareOfExpenses: totalExpenseFromCategories > 0 ? round((value / totalExpenseFromCategories) * 100) : 0,
    })),
    costConcentration: expenseCategoryEntries.length > 0 && totalExpenseFromCategories > 0
      ? round((expenseCategoryEntries[0][1] / totalExpenseFromCategories) * 100)
      : undefined,
    top3CostShare: expenseCategoryEntries.length > 0 && totalExpenseFromCategories > 0
      ? round((expenseCategoryEntries.slice(0, 3).reduce((total, [, value]) => total + value, 0) / totalExpenseFromCategories) * 100)
      : undefined,
    revenueExpenseRatio: revenueValue !== null && totalExpenses !== null && totalExpenses > 0
      ? round(revenueValue / totalExpenses)
      : undefined,
  }
}

function chooseMatchKey(
  revenue: ReturnType<typeof resolveProfitabilitySchema>["mapping"],
  expenses: ReturnType<typeof resolveProfitabilitySchema>["mapping"],
) {
  if (revenue.period && expenses.period && revenue.department && expenses.department) return "period_department"
  if (revenue.period && expenses.period && revenue.company && expenses.company) return "period_company"
  if (revenue.period && expenses.period && revenue.costCenter && expenses.costCenter) return "period_cost_center"
  return null
}

function classifyExpense(category: string) {
  const text = category.toLowerCase()
  if (/cogs|cost of goods|goods sold|direct cost|product cost|materials?|inventory/.test(text)) return "cogs"
  if (/interest|financing|loan/.test(text)) return "interest"
  if (/\btax\b|taxes|vat|corporate tax|income tax/.test(text)) return "tax"
  return "operating"
}

function combineCurrencyObservation(
  revenueCurrency: { mixed: boolean; currencies: string[]; source: string | null },
  expenseCurrency: { mixed: boolean; currencies: string[]; source: string | null },
  anyFile: boolean,
): { mixed: boolean; currencies: string[]; totalsWithheld: boolean } {
  const observed = new Set<string>()
  for (const currency of [...revenueCurrency.currencies, ...expenseCurrency.currencies]) {
    observed.add(normalizeCurrencyMarker(currency))
  }
  const currencies = Array.from(observed).sort()
  const mixed = currencies.length > 1
  return { mixed, currencies, totalsWithheld: mixed && anyFile }
}

function normalizeCurrencyMarker(marker: string): string {
  if (marker === "$") return "USD"
  if (marker === "€") return "EUR"
  if (marker === "£") return "GBP"
  if (marker === "¥") return "JPY"
  if (marker === "₹") return "INR"
  return marker.toUpperCase()
}

function revenueAmountSourceNote(resolution: ReturnType<typeof resolveProfitabilitySchema>) {
  if (resolution.amountStrategy === "derived_unit_quantity") {
    return "Revenue derived from unit price and quantity because no final revenue amount field was present."
  }
  if (resolution.amountStrategy === "gross_minus_adjustments") {
    return "Revenue derived from gross sales minus refunds and discounts because no final revenue amount field was present."
  }
  return "Revenue source total from selected Revenue input."
}

function expenseAmountSourceNote(resolution: ReturnType<typeof resolveProfitabilitySchema>, hasCogs: boolean) {
  if (resolution.amountStrategy === "derived_unit_quantity") {
    return "Operating expenses derived from unit cost and quantity because no final expense amount field was present; tax stays recorded separately and is never added."
  }
  if (hasCogs) return "Expense source total split into COGS and operating expenses by category."
  return "Operating-expense source total from selected Expenses input."
}

function toSchemaDiagnostics(
  diagnostics: MappingDiagnostics,
  warnings: { code: string; message: string }[],
): MappingDiagnostics & { warnings: string[] } {
  return {
    ...diagnostics,
    warnings: warnings.map((warning) => warning.message),
  }
}

function buildPeriodTrends(map: Map<string, Bucket>, availability: { hasCogs: boolean; hasOperating: boolean; hasCompleteOperatingExpenses: boolean; hasInterest: boolean; hasTax: boolean }) {
  return Array.from(map.entries()).map(([period, bucket]) => {
    const cogs = availability.hasCogs ? round(bucket.cogs) : null
    const operatingExpenses = availability.hasOperating ? round(bucket.operatingExpenses) : null
    const interestExpense = availability.hasInterest ? round(bucket.interestExpense) : null
    const taxExpense = availability.hasTax ? round(bucket.taxExpense) : null
    const grossProfit = cogs !== null ? bucket.revenue - bucket.cogs : null
    const operatingProfit = operatingExpenses !== null && availability.hasCompleteOperatingExpenses
      ? grossProfit !== null
        ? grossProfit - bucket.operatingExpenses
        : bucket.revenue - bucket.operatingExpenses
      : null
    const totalExpenses = bucket.cogs + bucket.operatingExpenses + bucket.interestExpense + bucket.taxExpense
    const netProfit = operatingProfit !== null && interestExpense !== null && taxExpense !== null
      ? operatingProfit - bucket.interestExpense - bucket.taxExpense
      : availability.hasCompleteOperatingExpenses
        ? bucket.revenue - totalExpenses
        : null
    return {
      period,
      revenue: round(bucket.revenue),
      cogs,
      operatingExpenses,
      interestExpense,
      taxExpense,
      grossProfit: grossProfit === null ? null : round(grossProfit),
      operatingProfit: operatingProfit === null ? null : round(operatingProfit),
      netProfit: netProfit === null ? null : round(netProfit),
    }
  }).sort((a, b) => a.period.localeCompare(b.period)).slice(0, 24)
}

function buildDepartmentComparison(map: Map<string, Bucket>) {
  return Array.from(map.entries()).map(([department, bucket]) => {
    const expenses = bucket.cogs + bucket.operatingExpenses + bucket.interestExpense + bucket.taxExpense
    const grossProfit = bucket.revenue - bucket.cogs
    const operatingProfit = grossProfit - bucket.operatingExpenses
    const netProfit = operatingProfit - bucket.interestExpense - bucket.taxExpense
    return {
      department,
      revenue: round(bucket.revenue),
      expenses: round(expenses),
      grossProfit: round(grossProfit),
      netProfit: round(netProfit),
      netMargin: margin(netProfit, bucket.revenue),
    }
  }).filter((row) => row.revenue !== 0 || row.expenses !== 0).sort((a, b) => b.revenue - a.revenue).slice(0, 12)
}

function margin(value: number | null, revenue: number | null) {
  if (value === null || revenue === null || revenue <= 0) return null
  return round((value / revenue) * 100)
}

function confidenceScore(
  hasRevenue: boolean,
  hasExpenses: boolean,
  revenueResolution: ReturnType<typeof resolveProfitabilitySchema>,
  expenseResolution: ReturnType<typeof resolveProfitabilitySchema>,
  matchKey: string | null,
  totalsWithheld: boolean,
): number {
  let score = 0
  if (hasRevenue) score += 20
  if (hasExpenses) score += 20
  if (revenueResolution.amountStrategy === "explicit_amount") score += 15
  else if (revenueResolution.amountStrategy !== "unresolved") score += 12
  if (expenseResolution.amountStrategy === "explicit_amount") score += 15
  else if (expenseResolution.amountStrategy !== "unresolved") score += 12
  if (expenseResolution.mapping.category) score += 15
  if (matchKey) score += 15
  if (totalsWithheld) score = Math.round(score / 2)
  return Math.min(100, score)
}

function statusLabel(status: ProfitabilityStatus, missingColumns: string[], totalsWithheld: boolean) {
  if (totalsWithheld) return "Mixed currencies detected; combined monetary totals withheld"
  if (status === "waiting_for_expenses") return "Waiting for Expenses file"
  if (status === "waiting_for_revenue") return "Waiting for Revenue file"
  if (status === "matching_files") return "Matching files"
  if (status === "calculating") return "Calculating profitability"
  if (status === "failed") return `Failed${missingColumns.length ? `: missing ${missingColumns.join(", ")}` : ""}`
  return "Ready"
}

function reportingPeriodFromPeriodKeys(map: Map<string, Bucket>) {
  const periods = Array.from(new Set(Array.from(map.keys()).map((period) => period.split(" • ")[0]).filter((period) => period && period !== "All periods"))).sort((a, b) => a.localeCompare(b))
  if (periods.length === 0) return null
  if (periods.length === 1) return periods[0]
  return `${periods[0]} to ${periods[periods.length - 1]}`
}

function addBucket(map: Map<string, Bucket>, key: string) {
  const current = map.get(key) || { revenue: 0, cogs: 0, operatingExpenses: 0, interestExpense: 0, taxExpense: 0 }
  map.set(key, current)
  return current
}

function addMapValue(map: Map<string, number>, key: string, value: number) {
  map.set(key, (map.get(key) || 0) + value)
}

function sortedEntries(map: Map<string, number>): [string, number][] {
  return Array.from(map.entries()).map(([key, value]) => [key, round(value)] as [string, number]).sort((a, b) => b[1] - a[1]).slice(0, 8)
}

function revenueGrowthFromMonthlyAggregation(monthly: Record<string, number>) {
  const months = Object.keys(monthly).filter((month) => month).sort()
  if (months.length < 2) return null
  const first = monthly[months[0]]
  const last = monthly[months[months.length - 1]]
  if (!Number.isFinite(first) || !Number.isFinite(last) || first === 0) return null
  return round(((last - first) / first) * 100)
}

/** Bucket key preserving the original period label and the shared match key. */
function periodBucketKey(record: NormalizedRevenueRecord | NormalizedExpenseRecord, matchKey: string | null): string {
  const period = record.periodLabel || "All periods"
  if (matchKey === "period_department" && record.department) return `${period} • ${record.department}`
  if (matchKey === "period_company" && record.company) return `${period} • ${record.company}`
  if (matchKey === "period_cost_center" && record.costCenter) return `${period} • ${record.costCenter}`
  return period
}

function departmentBucketKey(record: NormalizedRevenueRecord | NormalizedExpenseRecord): string {
  return record.department || record.costCenter || record.company || "Unassigned"
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

function round(value: number) {
  return Math.round(value * 100) / 100
}
