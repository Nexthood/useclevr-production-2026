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
}

type ColumnMap = {
  amount?: string
  period?: string
  department?: string
  companyId?: string
  costCenter?: string
  category?: string
  product?: string
  region?: string
  customer?: string
  salesVolume?: string
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
  const revenueColumns = detectColumns(revenueFile?.columns || [])
  const expenseColumns = detectColumns(expensesFile?.columns || [])
  const matchKey = chooseMatchKey(revenueColumns, expenseColumns)
  const missingColumns: string[] = []
  const unavailableMetrics: string[] = []
  const dataQualityNotes: string[] = []

  if (!hasRevenue) missingColumns.push("revenue file")
  if (!hasExpenses) missingColumns.push("expenses file")
  if (hasRevenue && !revenueColumns.amount) missingColumns.push("revenue amount")
  if (hasExpenses && !expenseColumns.amount) missingColumns.push("expenses amount")
  if (hasBothFiles && !matchKey) dataQualityNotes.push("No shared period + department, company_id, or cost_center key was detected; totals are combined without row-level matching.")

  const revenueByProduct = new Map<string, number>()
  const revenueByRegion = new Map<string, number>()
  const revenueByMonth: Record<string, number> = {}
  const expenseCategories = new Map<string, number>()
  const periodBuckets = new Map<string, Bucket>()
  const departmentBuckets = new Map<string, Bucket>()
  const customers = new Set<string>()
  let totalRevenue = 0
  let salesVolume = 0
  let foundSalesVolume = false

  for (const row of revenueFile?.rows || []) {
    const amount = positiveAmount(row[revenueColumns.amount || ""])
    if (amount === null) continue
    totalRevenue += amount
    addBucket(periodBuckets, periodKey(row, revenueColumns, matchKey)).revenue += amount
    addBucket(departmentBuckets, departmentKey(row, revenueColumns)).revenue += amount

    const volume = numberValue(row[revenueColumns.salesVolume || ""])
    if (volume !== null) {
      salesVolume += volume
      foundSalesVolume = true
    }
    const product = labelValue(row[revenueColumns.product || revenueColumns.category || ""])
    if (product) addMapValue(revenueByProduct, product, amount)
    const region = labelValue(row[revenueColumns.region || ""])
    if (region) addMapValue(revenueByRegion, region, amount)
    const month = monthKey(row[revenueColumns.period || ""])
    if (month) revenueByMonth[month] = (revenueByMonth[month] || 0) + amount
    const customer = labelValue(row[revenueColumns.customer || ""])
    if (customer) customers.add(customer)
  }

  let cogs = 0
  let operatingExpenses = 0
  let interestExpense = 0
  let taxExpense = 0
  let foundCogs = false
  let foundOperating = false
  let foundInterest = false
  let foundTax = false

  for (const row of expensesFile?.rows || []) {
    const amount = positiveAmount(row[expenseColumns.amount || ""])
    if (amount === null) continue
    const category = labelValue(row[expenseColumns.category || ""]) || "Uncategorized"
    const kind = classifyExpense(category, expensesFile?.columns || [])
    addMapValue(expenseCategories, category, amount)
    const period = addBucket(periodBuckets, periodKey(row, expenseColumns, matchKey))
    const department = addBucket(departmentBuckets, departmentKey(row, expenseColumns))

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

  const revenueValue = hasRevenue && revenueColumns.amount ? round(totalRevenue) : null
  const cogsValue = hasExpenses && foundCogs ? round(cogs) : null
  const operatingExpensesValue = hasExpenses && foundOperating ? round(operatingExpenses) : null
  const completeOperatingExpensesValue = operatingExpenseCoverage === "complete" ? operatingExpensesValue : null
  const interestExpenseValue = hasExpenses && foundInterest ? round(interestExpense) : null
  const taxExpenseValue = hasExpenses && foundTax ? round(taxExpense) : null
  const totalExpenses = hasExpenses && expenseColumns.amount ? round(cogs + operatingExpenses + interestExpense + taxExpense) : null
  const grossProfit = revenueValue !== null && cogsValue !== null ? round(revenueValue - cogsValue) : null
  const operatingProfit = grossProfit !== null && completeOperatingExpensesValue !== null
    ? round(grossProfit - completeOperatingExpensesValue)
    : revenueValue !== null && completeOperatingExpensesValue !== null && cogsValue === null
      ? round(revenueValue - completeOperatingExpensesValue)
      : null
  const netProfit = operatingProfit !== null && interestExpenseValue !== null && taxExpenseValue !== null
    ? round(operatingProfit - interestExpenseValue - taxExpenseValue)
    : null

  if (grossProfit === null) unavailableMetrics.push("grossProfit")
  if (operatingProfit === null) unavailableMetrics.push("operatingProfit")
  if (netProfit === null) unavailableMetrics.push("netProfit")
  if (revenueValue === null || revenueValue <= 0) unavailableMetrics.push("grossMargin", "operatingMargin", "netMargin")

  const status: ProfitabilityStatus = !hasRevenue
    ? "waiting_for_revenue"
    : !hasExpenses
      ? "waiting_for_expenses"
      : missingColumns.length > 0
        ? "failed"
        : "ready"

  return {
    profitabilityAnalysisId: input.analysisId,
    status,
    statusLabel: statusLabel(status, missingColumns),
    fileRole: input.fileRole,
    hasRevenue,
    hasExpenses,
    hasBothFiles,
    operatingExpenseCoverage,
    reportingPeriod: reportingPeriodFromPeriodKeys(periodBuckets),
    totalRevenue: revenueValue,
    salesVolume: foundSalesVolume ? round(salesVolume) : null,
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
    expenseCategories: sortedEntries(expenseCategories),
    topCostCategories: sortedEntries(expenseCategories),
    revenueByProduct: sortedEntries(revenueByProduct),
    revenueByRegion: sortedEntries(revenueByRegion),
    revenueByMonth,
    metricSources: {
      revenue: revenueValue !== null ? sourceMeta("Revenue source total from selected Revenue input.") : unavailableMeta("No recognized revenue source field."),
      cogs: cogsValue !== null ? sourceMeta("COGS source total from selected Expenses input.") : unavailableMeta("No recognized COGS source field."),
      operatingExpenses: operatingExpensesValue !== null
        ? sourceMeta(operatingExpenseCoverage === "partial" ? "Partial operating-expense source total from selected Expenses input." : "Operating-expense source total from selected Expenses input.")
        : unavailableMeta("No recognized operating-expense source rows."),
      interestExpense: interestExpenseValue !== null ? sourceMeta("Interest-expense source total from selected Expenses input.") : unavailableMeta("No recognized interest-expense source rows."),
      taxExpense: taxExpenseValue !== null ? sourceMeta("Tax-expense source total from selected Expenses input.") : unavailableMeta("No recognized tax-expense source rows."),
      grossProfit: grossProfit !== null ? derivedMeta("Revenue minus COGS.") : unavailableMeta("Requires source-backed COGS or explicit gross profit."),
      operatingProfit: operatingProfit !== null
        ? grossProfit !== null
          ? derivedMeta("Gross profit minus operating expenses.")
          : derivedMeta("Revenue minus source-backed operating expenses because COGS is unavailable in the paired Profitability inputs.")
        : unavailableMeta(operatingExpenseCoverage === "partial" ? "Requires a complete operating-expense source before deriving operating profit." : "Requires revenue and source-backed operating expenses, or gross profit and operating expenses."),
      netProfit: netProfit !== null ? derivedMeta("Operating profit minus source-backed interest and tax expense.") : unavailableMeta("Requires source-backed interest and tax expense."),
      grossMargin: margin(grossProfit, revenueValue) !== null ? derivedMeta("Gross profit divided by revenue.") : unavailableMeta("Requires gross profit and non-zero revenue."),
      operatingMargin: margin(operatingProfit, revenueValue) !== null ? derivedMeta("Operating profit divided by revenue.") : unavailableMeta("Requires operating profit and non-zero revenue."),
      netMargin: margin(netProfit, revenueValue) !== null ? derivedMeta("Net profit divided by revenue.") : unavailableMeta("Requires net profit and non-zero revenue."),
    },
    periodTrends: buildPeriodTrends(periodBuckets, { hasCogs: foundCogs, hasOperating: foundOperating, hasCompleteOperatingExpenses: operatingExpenseCoverage === "complete", hasInterest: foundInterest, hasTax: foundTax }),
    departmentComparison: buildDepartmentComparison(departmentBuckets),
    matchKey,
    missingColumns,
    unavailableMetrics: Array.from(new Set(unavailableMetrics)),
    dataConfidence: confidenceScore(hasRevenue, hasExpenses, revenueColumns, expenseColumns, matchKey),
    dataQualityNotes,
    sourceFiles: [revenueFile, expensesFile].filter(Boolean).map((file) => ({
      role: file!.role,
      name: file!.name,
      rowCount: file!.rowCount ?? file!.rows.length,
      columns: file!.columns,
    })),
  }
}

function detectColumns(columns: string[]): ColumnMap {
  return {
    amount: findColumn(columns, [
      /^amount$/,
      /^revenue$/,
      /^sales$/,
      /^income$/,
      /^total$/,
      /^expense$/,
      /^cost$/,
      /^debit$/,
      /^value$/,
      /revenue/,
      /sales/,
      /income/,
      /expense/,
      /cost/,
      /debit/,
      /value/,
    ]),
    period: findColumn(columns, [/^period$/, /^month$/, /^date$/, /transaction_date/, /posted_date/, /created_at/, /year/]),
    department: findColumn(columns, [/department/, /^dept$/]),
    companyId: findColumn(columns, [/company_id/, /companyid/, /^company$/]),
    costCenter: findColumn(columns, [/cost_center/, /costcentre/, /cost center/]),
    category: findColumn(columns, [/category/, /expense_type/, /income_type/, /account/, /description/, /type/]),
    product: findColumn(columns, [/product/, /sku/, /item/, /service/]),
    region: findColumn(columns, [/region/, /country/, /location/, /market/]),
    customer: findColumn(columns, [/customer/, /client/, /account_name/]),
    salesVolume: findColumn(columns, [/sales_volume/, /quantity/, /^qty$/, /units/]),
  }
}

function chooseMatchKey(revenue: ColumnMap, expenses: ColumnMap) {
  if (revenue.period && expenses.period && revenue.department && expenses.department) return "period_department"
  if (revenue.period && expenses.period && revenue.companyId && expenses.companyId) return "period_company_id"
  if (revenue.period && expenses.period && revenue.costCenter && expenses.costCenter) return "period_cost_center"
  return null
}

function classifyExpense(category: string, columns: string[]) {
  const text = `${category} ${columns.join(" ")}`.toLowerCase()
  if (/cogs|cost of goods|goods sold|direct cost|product cost|materials?|inventory/.test(text)) return "cogs"
  if (/interest|financing|loan/.test(text)) return "interest"
  if (/\btax\b|taxes|vat|corporate tax|income tax/.test(text)) return "tax"
  return "operating"
}

function findColumn(columns: string[], patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = columns.find((column) => {
      const normalized = column.toLowerCase().trim().replace(/[_-]+/g, " ")
      return pattern.test(normalized)
    })
    if (match) return match
  }
  return undefined
}

function positiveAmount(value: unknown) {
  const amount = numberValue(value)
  return amount === null ? null : Math.abs(amount)
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value !== "string") return null
  const raw = value.trim()
  const parenthesized = raw.includes("(") && raw.includes(")")
  const parsed = Number.parseFloat(raw.replace(/[^0-9.-]/g, ""))
  if (!Number.isFinite(parsed)) return null
  return parenthesized ? -Math.abs(parsed) : parsed
}

function labelValue(value: unknown) {
  const label = String(value ?? "").trim()
  return label ? label.slice(0, 80) : ""
}

function monthKey(value: unknown) {
  const text = String(value ?? "").trim()
  const yyyyMm = text.match(/(\d{4})[-/](\d{1,2})/)
  if (yyyyMm) return `${yyyyMm[1]}-${yyyyMm[2].padStart(2, "0")}`
  const parsed = Date.parse(text)
  if (Number.isNaN(parsed)) return ""
  const date = new Date(parsed)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}

function periodKey(row: Record<string, unknown>, columns: ColumnMap, matchKey: string | null) {
  const period = labelValue(row[columns.period || ""]) || "All periods"
  if (matchKey === "period_department") return `${period} • ${labelValue(row[columns.department || ""]) || "All departments"}`
  if (matchKey === "period_company_id") return `${period} • ${labelValue(row[columns.companyId || ""]) || "All companies"}`
  if (matchKey === "period_cost_center") return `${period} • ${labelValue(row[columns.costCenter || ""]) || "All cost centers"}`
  return period
}

function departmentKey(row: Record<string, unknown>, columns: ColumnMap) {
  return labelValue(row[columns.department || columns.costCenter || columns.companyId || ""]) || "Unassigned"
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

function reportingPeriodFromPeriodKeys(map: Map<string, Bucket>) {
  const periods = Array.from(new Set(Array.from(map.keys()).map((period) => period.split(" • ")[0]).filter((period) => period && period !== "All periods"))).sort((a, b) => a.localeCompare(b))
  if (periods.length === 0) return null
  if (periods.length === 1) return periods[0]
  return `${periods[0]} to ${periods[periods.length - 1]}`
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
    const netProfit = operatingProfit !== null && interestExpense !== null && taxExpense !== null ? operatingProfit - bucket.interestExpense - bucket.taxExpense : null
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

function sourceMeta(note: string) {
  return { kind: "source_value" as const, note }
}

function derivedMeta(note: string) {
  return { kind: "derived_value" as const, note }
}

function unavailableMeta(note: string) {
  return { kind: "unavailable" as const, note }
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

function confidenceScore(hasRevenue: boolean, hasExpenses: boolean, revenue: ColumnMap, expenses: ColumnMap, matchKey: string | null) {
  let score = 0
  if (hasRevenue) score += 20
  if (hasExpenses) score += 20
  if (revenue.amount) score += 15
  if (expenses.amount) score += 15
  if (expenses.category) score += 15
  if (matchKey) score += 15
  return Math.min(100, score)
}

function statusLabel(status: ProfitabilityStatus, missingColumns: string[]) {
  if (status === "waiting_for_expenses") return "Waiting for Expenses file"
  if (status === "waiting_for_revenue") return "Waiting for Revenue file"
  if (status === "matching_files") return "Matching files"
  if (status === "calculating") return "Calculating profitability"
  if (status === "failed") return `Failed${missingColumns.length ? `: missing ${missingColumns.join(", ")}` : ""}`
  return "Ready"
}

function round(value: number) {
  return Math.round(value * 100) / 100
}
