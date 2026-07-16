import { calculateBusinessBalancedScorecard } from "@/lib/business/balanced-scorecard"
import { resolveBusinessModel, type BusinessModel } from "@/lib/data/business-model"
import { loadDatasetData } from "@/lib/data/dataset-access"
import { resolveDatasetType, type DatasetCategory } from "@/lib/data/dataset-category"
import type { datasets } from "@/lib/db/schema"
import type { ReportChart } from "@/lib/reports/report-generator"

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
  const columnMap = detectColumns(columns)
  const kpis = buildKpis(reportModel, rows, columnMap)
  const charts = buildCharts(reportModel, rows, columnMap)
  const findings = buildFindings(reportModel, rows, columnMap, kpis)
  const bbsc = calculateBusinessBalancedScorecard({ rows, columns, businessModel: reportModel })

  return {
    businessModel,
    reportType: reportModel,
    summary: `${reportModelLabel(reportModel)} report for ${dataset.name}. This report includes a Business Balanced Scorecard (also known as Balanced Scorecard or BSC) and uses only the selected dataset (${dataset.id}).`,
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
